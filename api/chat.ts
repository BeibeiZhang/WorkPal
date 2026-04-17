import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 60 };

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

interface ImageResult {
  url: string;
  thumbUrl: string;
  aspectRatio?: number;
  alt: string;
  sourceUrl?: string;
  attribution?: string;
}

interface VideoResult {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
  description?: string;
}

interface WebResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

async function searchImages(query: string, count: number): Promise<ImageResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const capped = Math.max(1, Math.min(count, 8));
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${capped}&content_filter=high`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        urls: { regular: string; small: string };
        width?: number;
        height?: number;
        alt_description?: string;
        description?: string;
        user: { name: string; links?: { html?: string } };
        links?: { html?: string };
      }>;
    };
    return (data.results || []).map((p) => ({
      url: p.urls.regular,
      thumbUrl: p.urls.small,
      aspectRatio: p.width && p.height ? p.width / p.height : undefined,
      alt: p.alt_description || p.description || query,
      sourceUrl: p.links?.html,
      attribution: p.user?.name ? `Photo by ${p.user.name} on Unsplash` : 'Unsplash',
    }));
  } catch {
    return [];
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function searchVideos(query: string, count: number): Promise<VideoResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const capped = Math.max(1, Math.min(count, 8));
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(capped),
    key,
    safeSearch: 'moderate',
    relevanceLanguage: 'en',
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          channelTitle?: string;
          description?: string;
          publishedAt?: string;
          thumbnails?: {
            medium?: { url?: string };
            high?: { url?: string };
            default?: { url?: string };
          };
        };
      }>;
    };
    return (data.items || [])
      .map((it): VideoResult | null => {
        const videoId = it.id?.videoId;
        const snippet = it.snippet;
        if (!videoId || !snippet) return null;
        const thumb = snippet.thumbnails?.medium?.url
          || snippet.thumbnails?.high?.url
          || snippet.thumbnails?.default?.url
          || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        return {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: decodeHtmlEntities(snippet.title || ''),
          channelTitle: decodeHtmlEntities(snippet.channelTitle || ''),
          thumbnailUrl: thumb,
          publishedAt: snippet.publishedAt,
          description: decodeHtmlEntities(snippet.description || ''),
        };
      })
      .filter((v): v is VideoResult => v !== null);
  } catch {
    return [];
  }
}

async function searchWeb(query: string, maxResults: number): Promise<{ results: WebResult[]; images: string[] }> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: [], images: [] };
  const capped = Math.max(3, Math.min(maxResults, 8));
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: capped,
        include_images: true,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { results: [], images: [] };
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      images?: Array<string | { url?: string }>;
    };
    const results: WebResult[] = (data.results || [])
      .map((r) => ({
        title: (r.title || '').trim(),
        url: (r.url || '').trim(),
        content: (r.content || '').trim(),
        score: r.score,
      }))
      .filter((r) => r.url);
    const images = (data.images || [])
      .map((i) => (typeof i === 'string' ? i : i?.url || ''))
      .filter((u): u is string => !!u);
    return { results, images };
  } catch {
    return { results: [], images: [] };
  }
}

const IMAGE_SEARCH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_images',
    description: 'Search for real photographs to illustrate your answer. Call this when the user asks to see pictures of something, wants visual examples, or when a few illustrative photos would make the answer clearer. IMPORTANT: Before calling this tool, always write a short one-sentence intro like "Here are some photos of X:" — that is the ONLY text that will accompany the images, since no follow-up message is generated after the tool call.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Short, specific search phrase in English, e.g. "golden retriever puppy", "tokyo shibuya at night", "minimalist desk setup".' },
        count: { type: 'integer', description: 'How many images to show, 1-6. Default 4.', minimum: 1, maximum: 6 },
      },
      required: ['query'],
    },
  },
};

const VIDEO_SEARCH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_videos',
    description: 'Search YouTube for real videos to accompany your answer. Call this whenever the user asks for video tutorials, how-to guides, lectures, talks, reviews, demos, or any request that would be best answered by pointing to specific videos. IMPORTANT: Before calling this tool, always write a short one-sentence intro like "Here are a few videos on X:" — that is the ONLY text that will accompany the videos, since no follow-up message is generated after the tool call. Do NOT invent or guess YouTube URLs; use this tool.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search phrase. Match the user\'s language (e.g. use Chinese if they asked in Chinese) and include specifics like skill level or tool name — "react hooks tutorial for beginners", "日语五十音教学", "figma auto layout demo".' },
        count: { type: 'integer', description: 'How many videos to show, 1-8. Default 5.', minimum: 1, maximum: 8 },
      },
      required: ['query'],
    },
  },
};

const WEB_SEARCH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the live web for up-to-date facts, prices, news, product specs, official sources, or any information that may have changed since your training cutoff. ALWAYS call this — do not refuse or say you "cannot browse" — when the user asks for current prices, product availability, official website content, recent events, statistics, or anything requiring live data. After the tool returns, write a concise synthesized answer in the user\'s language and cite the sources naturally (the UI will render source chips automatically from the tool results).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Specific search query. Include product name, brand, country/market, and "official" or "site:brand.com" when looking for authoritative prices. Match the language appropriate to the target site (e.g. Chinese for chanel.cn, English for chanel.com).' },
        max_results: { type: 'integer', description: 'How many source results to fetch, 3-8. Default 5.', minimum: 3, maximum: 8 },
      },
      required: ['query'],
    },
  },
};

const SYSTEM_PROMPT = `You are WorkPal, an AI workplace assistant. You help users with meeting summaries, task management, research, scheduling, and general work productivity. Be concise, helpful, and professional. Respond in the same language the user uses.

When a user attaches an image, describe what you visually observe — subjects, setting, composition, mood, visible text, style — so the user can work with the content. For photos of people, describe visible attributes (expression, clothing, hair, pose, background) without attempting to identify or guess who the person is. Never respond that you "cannot see" or "cannot describe" an attached image; the image is present and you are able to describe it.

For any question about current prices, product specs, news, live statistics, official-website content, or anything that may have changed since your training, you MUST call the web_search tool. Do NOT guess, do NOT say "I cannot browse the web," and do NOT tell the user to check the website themselves — you have web_search, use it. After the tool returns, write a concise answer in the user's language that synthesizes the findings. The UI renders source chips from the tool results automatically, so you do not need to paste raw URLs.`;

function toOpenAIMessage(msg: ChatMessage): ChatCompletionMessageParam {
  if (msg.role === 'user' && msg.images && msg.images.length > 0) {
    return {
      role: 'user',
      content: [
        ...(msg.content ? [{ type: 'text' as const, text: msg.content }] : []),
        ...msg.images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ],
    };
  }
  return { role: msg.role, content: msg.content } as ChatCompletionMessageParam;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages, model = 'gpt-4o-mini' } = (req.body ?? {}) as {
    messages?: ChatMessage[];
    model?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const tools: ChatCompletionTool[] = [];
  if (process.env.UNSPLASH_ACCESS_KEY) tools.push(IMAGE_SEARCH_TOOL);
  if (process.env.YOUTUBE_API_KEY) tools.push(VIDEO_SEARCH_TOOL);
  if (process.env.TAVILY_API_KEY) tools.push(WEB_SEARCH_TOOL);

  const write = (chunk: unknown) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(toOpenAIMessage),
  ];

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: baseMessages,
      stream: true,
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {}),
    });

    const toolCallsBuffer: Array<{ id: string; function: { name: string; arguments: string } }> = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) write({ type: 'text', content: delta.content });
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsBuffer[idx]) {
            toolCallsBuffer[idx] = { id: '', function: { name: '', arguments: '' } };
          }
          if (tc.id) toolCallsBuffer[idx].id = tc.id;
          if (tc.function?.name) toolCallsBuffer[idx].function.name = tc.function.name;
          if (tc.function?.arguments) toolCallsBuffer[idx].function.arguments += tc.function.arguments;
        }
      }
    }

    const webCalls: Array<{
      id: string;
      name: string;
      rawArgs: string;
      results: WebResult[];
      images: string[];
    }> = [];

    for (const tc of toolCallsBuffer) {
      let args: { query?: string; count?: number; max_results?: number } = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* invalid JSON — treat as empty */ }
      if (tc.function.name === 'search_images') {
        const images = await searchImages(args.query || '', args.count || 4);
        if (images.length > 0) write({ type: 'images', images });
      } else if (tc.function.name === 'search_videos') {
        const videos = await searchVideos(args.query || '', args.count || 5);
        if (videos.length > 0) write({ type: 'videos', videos });
      } else if (tc.function.name === 'web_search') {
        const resp = await searchWeb(args.query || '', args.max_results || 5);
        if (resp.results.length > 0) write({ type: 'web_results', results: resp.results });
        webCalls.push({
          id: tc.id,
          name: tc.function.name,
          rawArgs: tc.function.arguments || '{}',
          results: resp.results,
          images: resp.images,
        });
      }
    }

    if (webCalls.length > 0) {
      const followupMessages: ChatCompletionMessageParam[] = [
        ...baseMessages,
        {
          role: 'assistant',
          content: null,
          tool_calls: webCalls.map((c) => ({
            id: c.id || `call_${Math.random().toString(36).slice(2, 10)}`,
            type: 'function' as const,
            function: { name: c.name, arguments: c.rawArgs },
          })),
        },
        ...webCalls.map((c) => ({
          role: 'tool' as const,
          tool_call_id: c.id || `call_${Math.random().toString(36).slice(2, 10)}`,
          content: JSON.stringify({
            results: c.results.map((r) => ({ title: r.title, url: r.url, content: r.content })),
          }),
        })),
      ];

      const followup = await openai.chat.completions.create({
        model,
        messages: followupMessages,
        stream: true,
      });

      for await (const chunk of followup) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) write({ type: 'text', content: delta.content });
      }

      const firstImage = webCalls.flatMap((c) => c.images).find(Boolean);
      if (firstImage) {
        write({
          type: 'images',
          images: [{
            url: firstImage,
            thumbUrl: firstImage,
            alt: 'Search result image',
            sourceUrl: webCalls[0]?.results[0]?.url,
            attribution: webCalls[0]?.results[0]?.title,
          }],
        });
      }
    }

    write({ type: 'done', content: '' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    write({ type: 'error', content: message });
  }

  res.end();
}
