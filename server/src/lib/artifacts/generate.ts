import OpenAI from 'openai';
import { searchWeb, type WebResult } from '../webSearch.js';
import {
  createGeneratingArtifact,
  markArtifactReady,
  markArtifactFailed,
  findArtifactByWeek,
  type Artifact,
  type ArtifactContent,
} from '../artifactStore.js';
import {
  getTemplate,
  buildSlug,
  currentWeekKey,
  weekLabelFor,
  type TemplateDef,
} from './templates.js';

export interface GenerateOptions {
  templateId: string;
  /** User-supplied topic override (ad-hoc chat-initiated). NULL → use template default. */
  topic?: string | null;
  /** Set for recurring cron runs. NULL → ad-hoc (always new slug). */
  weekKey?: string | null;
  projectId?: string | null;
  chatId?: string | null;
}

export interface GenerateResult {
  artifact: Artifact;
  /** True when we returned a pre-existing row instead of generating. */
  cached: boolean;
}

/** Tavily result shape that survives into the OpenAI prompt — we strip down to
 *  the fields the model actually needs so the context stays small. */
interface SourceItem {
  title: string;
  url: string;
  content: string;
  category: string;
}

function openai(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey: key });
}

/** Run Tavily for each category × query, dedupe by URL, and return a flat list
 *  of candidate items tagged with their category key. Empty list means Tavily
 *  failed or returned nothing for every query — caller should treat as failure. */
async function gatherSources(template: TemplateDef, weekLabel: string): Promise<{
  items: SourceItem[];
  images: string[];
}> {
  const byUrl = new Map<string, SourceItem>();
  const images: string[] = [];
  for (const category of template.categories) {
    for (const q of category.queries) {
      const query = q.replace('{weekLabel}', weekLabel).replace('{topic}', template.defaultTopic);
      const res = await searchWeb(query, 6);
      for (const r of res.results as WebResult[]) {
        if (!r.url || byUrl.has(r.url)) continue;
        byUrl.set(r.url, {
          title: r.title,
          url: r.url,
          content: r.content.slice(0, 1200),
          category: category.key,
        });
      }
      for (const img of res.images) if (!images.includes(img)) images.push(img);
    }
  }
  return { items: Array.from(byUrl.values()), images };
}

/** Ask OpenAI to turn the raw Tavily dump into the structured per-category
 *  item list. One call per language so each copy reads naturally — we do NOT
 *  translate EN→中 after the fact, because the model picks better nuance when
 *  it shapes the prose from the source text directly. */
async function synthesize(
  template: TemplateDef,
  sources: SourceItem[],
  imageBag: string[],
  lang: 'en' | 'zh',
  topic: string,
): Promise<ArtifactContent> {
  const client = openai();
  const categoryList = template.categories
    .map((c) => `- ${c.key}: ${lang === 'en' ? c.labelEn : c.labelZh}`)
    .join('\n');
  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] (${s.category}) ${s.title}\n${s.url}\n${s.content}`)
    .join('\n\n');
  const imageList = imageBag.slice(0, 30).map((u, i) => `(${i + 1}) ${u}`).join('\n');

  const sysEn = `You are a local-weekend-guide editor. Produce a structured JSON digest from the supplied web search results.
Topic: ${topic}.
Categories (use these exact keys):\n${categoryList}
Item shape: ${template.itemSchemaHint}
Rules:
- 3-5 items per category, ${template.minItems}+ items total.
- Every item's imageUrl MUST be one of the supplied image URLs (copy-paste, don't invent).
- Use absolute URLs for the url field — the search result URL, not a homepage.
- Pick items actually happening this weekend based on the source content; skip past or far-future ones.
- If you can't find enough real items for a category, return fewer for that category rather than inventing any.
- Output English only.
Output strict JSON matching: { "title": string, "summary": string (1-2 sentences), "categories": [ { "key": string, "items": [ { "title": string, "location": string, "price": string, "date": string, "url": string, "imageUrl": string } ] } ] }`;

  const sysZh = `你是"湾区周末指南"编辑。根据提供的网页搜索结果生成结构化 JSON 周报。
主题:${topic}。
分类(必须用这些 key):\n${categoryList}
每项字段:${template.itemSchemaHint}
规则:
- 每个分类 3-5 条,总数 ≥ ${template.minItems} 条。
- 每项的 imageUrl 必须从提供的图片 URL 列表中选一个(原样复制,不要编造)。
- url 用搜索结果里的绝对 URL,不要用站点首页。
- 根据来源内容判断是否本周末发生,过时或远期的跳过。
- 某分类真实条目不够就宁缺毋滥,不要编造。
- 文案用中文输出。
严格输出 JSON:{ "title": string, "summary": string(1-2 句), "categories": [ { "key": string, "items": [ { "title": string, "location": string, "price": string, "date": string, "url": string, "imageUrl": string } ] } ] }`;

  const userPrompt = `Search results:\n\n${sourceBlock}\n\nAvailable image URLs:\n${imageList}`;
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: lang === 'en' ? sysEn : sysZh },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });
  const text = resp.choices[0]?.message?.content;
  if (!text) throw new Error(`OpenAI returned empty content for lang=${lang}`);
  const parsed = JSON.parse(text) as { title?: string; summary?: string; categories?: unknown };
  if (!parsed.title || !parsed.summary || !Array.isArray(parsed.categories)) {
    throw new Error(`OpenAI returned malformed JSON for lang=${lang}`);
  }
  return { title: parsed.title, summary: parsed.summary, body: { categories: parsed.categories } };
}

function pickCoverImage(content: ArtifactContent): string | null {
  const body = content.body as { categories?: Array<{ items?: Array<{ imageUrl?: string }> }> };
  for (const cat of body.categories ?? []) {
    for (const item of cat.items ?? []) {
      if (item.imageUrl && /^https?:\/\//.test(item.imageUrl)) return item.imageUrl;
    }
  }
  return null;
}

function countItems(content: ArtifactContent): number {
  const body = content.body as { categories?: Array<{ items?: unknown[] }> };
  return (body.categories ?? []).reduce((n, c) => n + (c.items?.length ?? 0), 0);
}

/** Full pipeline: create a placeholder row → Tavily → OpenAI ×2 → update to ready.
 *  On weak results or model failure, mark failed and rethrow. Caller decides
 *  whether to return 500 (chat-initiated) or log + continue (cron sweep). */
export async function generateArtifact(opts: GenerateOptions): Promise<GenerateResult> {
  const template = getTemplate(opts.templateId);
  if (!template) throw new Error(`Unknown templateId: ${opts.templateId}`);

  // Recurring idempotency — return existing row if (templateId, weekKey) hits.
  // Ad-hoc rows (weekKey=null) always make a new one.
  if (opts.weekKey) {
    const existing = await findArtifactByWeek(opts.templateId, opts.weekKey);
    if (existing && existing.status === 'ready') {
      return { artifact: existing, cached: true };
    }
    if (existing && existing.status === 'generating') {
      // In-flight from another caller — return as-is and let client poll.
      return { artifact: existing, cached: true };
    }
    // If existing is 'failed', fall through and regenerate.
  }

  const topic = opts.topic || template.defaultTopic;
  const slug = buildSlug(opts.templateId, opts.weekKey ?? null);

  const artifact = await createGeneratingArtifact({
    templateId: opts.templateId,
    slug,
    kind: template.kind,
    weekKey: opts.weekKey ?? null,
    topic: opts.topic ?? null,
    projectId: opts.projectId ?? null,
    chatId: opts.chatId ?? null,
  });

  try {
    const weekLabel = weekLabelFor();
    const { items, images } = await gatherSources(template, weekLabel);
    if (items.length < template.minItems) {
      throw new Error(`weak-results: only ${items.length} sources found (need ${template.minItems})`);
    }

    // Run the two language passes in parallel — they share the same sources but
    // OpenAI doesn't cache across calls so there's no reason to serialize.
    const [contentEn, contentZh] = await Promise.all([
      synthesize(template, items, images, 'en', topic),
      synthesize(template, items, images, 'zh', topic),
    ]);

    if (countItems(contentEn) < template.minItems) {
      throw new Error(`weak-results: EN synthesis produced only ${countItems(contentEn)} items`);
    }

    const coverImageUrl = pickCoverImage(contentEn);
    const ready = await markArtifactReady(artifact.id, { contentEn, contentZh, coverImageUrl });
    return { artifact: ready, cached: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    await markArtifactFailed(artifact.id, msg);
    throw err;
  }
}

export { currentWeekKey };
