// Serverless mirror of server/src/lib/artifacts/{templates,generate}.ts.
// Inlines the Tavily web-search call (api/search-web.ts has the same wrapper —
// duplicated for locality; the two endpoints have different lifetime/timeout
// constraints and we'd rather not couple them).

import OpenAI from 'openai';
import {
  createGeneratingArtifact, markArtifactReady, markArtifactFailed,
  findArtifactByWeek,
  type Artifact, type ArtifactContent, type ArtifactKind,
} from './artifact-store.js';

/* ── Templates ─────────────────────────────────────────────────────── */

export interface TemplateCategory {
  key: string;
  labelEn: string;
  labelZh: string;
  queries: string[];
}

export interface TemplateDef {
  id: string;
  kind: ArtifactKind;
  defaultTopic: string;
  titleEn: string;
  titleZh: string;
  itemSchemaHint: string;
  minItems: number;
  categories: TemplateCategory[];
}

const bayAreaWeekend: TemplateDef = {
  id: 'bay-area-weekend',
  kind: 'webpage',
  defaultTopic: 'Bay Area this weekend',
  titleEn: 'Bay Area Weekend Digest',
  titleZh: '湾区周末指南',
  itemSchemaHint:
    'Each item must have: title, location (neighborhood or venue), price (string — "$20", "Free", or "$15-$40"), ' +
    'date (date or date-range string for this weekend), url (official/source link), imageUrl (absolute https:// URL from the search results).',
  minItems: 8,
  categories: [
    { key: 'festivals',   labelEn: 'Festivals',        labelZh: '节日',
      queries: ['Bay Area festivals this weekend {weekLabel}', 'San Francisco festival events {weekLabel}'] },
    { key: 'events',      labelEn: 'Events',           labelZh: '活动',
      queries: ['Bay Area events this weekend {weekLabel}', 'things to do San Francisco Oakland {weekLabel}'] },
    { key: 'exhibitions', labelEn: 'Exhibitions',      labelZh: '展览',
      queries: ['Bay Area art exhibitions this weekend {weekLabel}', 'San Francisco museum shows {weekLabel}'] },
    { key: 'markets',     labelEn: 'Markets & Fairs',  labelZh: '集市',
      queries: ['Bay Area farmers market fair this weekend {weekLabel}', 'San Francisco flea market craft fair {weekLabel}'] },
  ],
};

const REGISTRY: Record<string, TemplateDef> = { [bayAreaWeekend.id]: bayAreaWeekend };

export function getTemplate(id: string): TemplateDef | null { return REGISTRY[id] ?? null; }
export function listTemplateIds(): string[] { return Object.keys(REGISTRY); }

export function currentWeekKey(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function weekLabelFor(now: Date = new Date()): string {
  const d = new Date(now);
  const dow = d.getDay();
  const daysUntilSat = (6 - dow + 7) % 7;
  d.setDate(d.getDate() + daysUntilSat);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function buildSlug(templateId: string, weekKey: string | null): string {
  if (weekKey) return `${templateId}-${weekKey}`;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${templateId}-${s}`;
}

/* ── Tavily wrapper (local copy of server/src/lib/webSearch.ts) ────── */

interface TavilyResult { title: string; url: string; content: string; score?: number; }
interface TavilyResponse { results: TavilyResult[]; images: string[]; }

async function tavilySearch(query: string, maxResults = 6): Promise<TavilyResponse> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: [], images: [] };
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        query, search_depth: 'basic',
        max_results: Math.max(1, Math.min(maxResults, 8)),
        include_images: true, include_answer: false,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { results: [], images: [] };
    const data = await res.json() as {
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      images?: Array<string | { url?: string }>;
    };
    const results: TavilyResult[] = (data.results || [])
      .map((r) => ({ title: (r.title || '').trim(), url: (r.url || '').trim(), content: (r.content || '').trim(), score: r.score }))
      .filter((r) => r.url);
    const images = (data.images || [])
      .map((i) => (typeof i === 'string' ? i : i?.url || ''))
      .filter((u): u is string => !!u);
    return { results, images };
  } catch {
    return { results: [], images: [] };
  }
}

/* ── Pipeline ──────────────────────────────────────────────────────── */

interface SourceItem { title: string; url: string; content: string; category: string; }

async function gatherSources(template: TemplateDef, weekLabel: string): Promise<{ items: SourceItem[]; images: string[] }> {
  const byUrl = new Map<string, SourceItem>();
  const images: string[] = [];
  for (const category of template.categories) {
    for (const q of category.queries) {
      const query = q.replace('{weekLabel}', weekLabel).replace('{topic}', template.defaultTopic);
      const res = await tavilySearch(query, 6);
      for (const r of res.results) {
        if (!r.url || byUrl.has(r.url)) continue;
        byUrl.set(r.url, {
          title: r.title, url: r.url,
          content: r.content.slice(0, 1200), category: category.key,
        });
      }
      for (const img of res.images) if (!images.includes(img)) images.push(img);
    }
  }
  return { items: Array.from(byUrl.values()), images };
}

async function synthesize(
  template: TemplateDef, sources: SourceItem[], imageBag: string[],
  lang: 'en' | 'zh', topic: string,
): Promise<ArtifactContent> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const client = new OpenAI({ apiKey: key });

  const categoryList = template.categories
    .map((c) => `- ${c.key}: ${lang === 'en' ? c.labelEn : c.labelZh}`).join('\n');
  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] (${s.category}) ${s.title}\n${s.url}\n${s.content}`).join('\n\n');
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
Output strict JSON matching: { "title": string, "summary": string, "categories": [ { "key": string, "items": [ { "title": string, "location": string, "price": string, "date": string, "url": string, "imageUrl": string } ] } ] }`;

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
严格输出 JSON:{ "title": string, "summary": string, "categories": [ { "key": string, "items": [ { "title": string, "location": string, "price": string, "date": string, "url": string, "imageUrl": string } ] } ] }`;

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: lang === 'en' ? sysEn : sysZh },
      { role: 'user', content: `Search results:\n\n${sourceBlock}\n\nAvailable image URLs:\n${imageList}` },
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

export interface GenerateOptions {
  templateId: string;
  topic?: string | null;
  weekKey?: string | null;
  projectId?: string | null;
  chatId?: string | null;
}

export interface GenerateResult { artifact: Artifact; cached: boolean; }

export async function generateArtifact(opts: GenerateOptions): Promise<GenerateResult> {
  const template = getTemplate(opts.templateId);
  if (!template) throw new Error(`Unknown templateId: ${opts.templateId}`);

  if (opts.weekKey) {
    const existing = await findArtifactByWeek(opts.templateId, opts.weekKey);
    if (existing && existing.status === 'ready') return { artifact: existing, cached: true };
    if (existing && existing.status === 'generating') return { artifact: existing, cached: true };
  }

  const topic = opts.topic || template.defaultTopic;
  const slug = buildSlug(opts.templateId, opts.weekKey ?? null);
  const artifact = await createGeneratingArtifact({
    templateId: opts.templateId, slug, kind: template.kind,
    weekKey: opts.weekKey ?? null, topic: opts.topic ?? null,
    projectId: opts.projectId ?? null, chatId: opts.chatId ?? null,
  });

  try {
    const weekLabel = weekLabelFor();
    const { items, images } = await gatherSources(template, weekLabel);
    if (items.length < template.minItems) {
      throw new Error(`weak-results: only ${items.length} sources found (need ${template.minItems})`);
    }
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
