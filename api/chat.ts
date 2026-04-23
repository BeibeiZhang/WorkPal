import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listConnectors } from './_lib/connector-store.js';
import {
  searchGmail,
  sendEmail,
  listCalendarEvents,
  createCalendarEvent,
  humanLabel,
  ConnectorNotConnectedError,
  type CardJson,
  type ToolResult,
} from './_lib/google-tools.js';
import { logUsage, priceFor, countCallsSince } from './_lib/usage-store.js';

// Tavily's basic-search rate + free-tier cap. Mirrors server/src/lib/webSearch
// .ts — update in both places if pricing changes. Free tier covers 1,000
// searches/month; we log quota-covered calls with cost_usd=0 so the dashboard
// can show "X/1000 used" without pretending every click cost money.
const TAVILY_PER_SEARCH_USD = 0.005;
const TAVILY_FREE_PER_MONTH = 1000;
function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

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
    // Log the Tavily call regardless of cost — the dashboard uses the count
    // to render "X/1,000 free tier used". Capability is 'other' so it doesn't
    // double-count against the triggering OpenAI turn's 'web_query' bucket.
    const usedThisMonth = await countCallsSince('tavily', startOfCurrentMonthIso());
    const cost = usedThisMonth < TAVILY_FREE_PER_MONTH ? 0 : TAVILY_PER_SEARCH_USD;
    await logUsage({
      provider: 'tavily',
      model: 'tavily-search-basic',
      capability: 'other',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: cost,
    });
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

const SEARCH_GMAIL_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_gmail',
    description: 'Search the user\'s Gmail inbox for messages matching a query. Use this whenever the user asks about their inbox, recent emails, unread messages, or messages from a specific person/topic — in any language. Returns a compact list of matching threads (from, subject, date, snippet). After the tool returns, write a brief text summary referencing the top 3-5 results in the user\'s language.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query using Gmail\'s search syntax (e.g. "from:alice newer_than:7d", "subject:invoice", "is:unread", "is:important newer_than:1d"). Keep it specific; empty string returns the most recent messages.' },
        max_results: { type: 'integer', description: 'How many messages to return, 1-20. Default 10.', minimum: 1, maximum: 20 },
      },
      required: ['query'],
    },
  },
};

const SEND_EMAIL_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'send_email',
    description: 'Send an email from the user\'s Gmail account. ONLY call this when the user explicitly asks to send an email and has confirmed the recipient, subject, and body. Do NOT guess recipients. After the tool returns, confirm the send briefly.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Plain-text email body.' },
        cc: { type: 'string', description: 'Optional comma-separated CC addresses.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
};

const LIST_EVENTS_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'list_calendar_events',
    description: 'List upcoming events from the user\'s primary Google Calendar. Call this whenever the user asks what\'s on their schedule, what meetings are coming up, what they have this week, or any similar question — in any language. Defaults to the next 7 days if no range is given.',
    parameters: {
      type: 'object',
      properties: {
        time_min: { type: 'string', description: 'ISO-8601 start of the window (inclusive). Defaults to now.' },
        time_max: { type: 'string', description: 'ISO-8601 end of the window (exclusive). Defaults to now + 7 days.' },
        max_results: { type: 'integer', description: 'Maximum events to return, 1-20. Default 10.', minimum: 1, maximum: 20 },
      },
      required: [],
    },
  },
};

const CREATE_EVENT_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_calendar_event',
    description: 'Create a new event on the user\'s primary Google Calendar. Use this when the user asks to schedule a meeting, book time, or add an event. Confirms attendees via Google\'s own invite emails (sendUpdates=all).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title / summary.' },
        start_iso: { type: 'string', description: 'ISO-8601 start datetime with timezone, e.g. "2026-04-18T15:00:00-07:00".' },
        end_iso: { type: 'string', description: 'ISO-8601 end datetime with timezone.' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Optional list of attendee email addresses.' },
        location: { type: 'string', description: 'Optional location — physical or meeting URL.' },
        description: { type: 'string', description: 'Optional meeting description / agenda.' },
      },
      required: ['title', 'start_iso', 'end_iso'],
    },
  },
};

const SYSTEM_PROMPT = `You are WorkPal, an AI workplace assistant. You help users with meeting summaries, task management, research, scheduling, and general work productivity. Be concise, helpful, and professional. Respond in the same language the user uses.

When a user attaches an image, describe what you visually observe — subjects, setting, composition, mood, visible text, style — so the user can work with the content. For photos of people, describe visible attributes (expression, clothing, hair, pose, background) without attempting to identify or guess who the person is. Never respond that you "cannot see" or "cannot describe" an attached image; the image is present and you are able to describe it.

For any question about current prices, product specs, news, live statistics, official-website content, or anything that may have changed since your training, you MUST call the web_search tool. Do NOT guess, do NOT say "I cannot browse the web," and do NOT tell the user to check the website themselves — you have web_search, use it. After the tool returns, write a concise answer in the user's language that synthesizes the findings. The UI renders source chips from the tool results automatically, so you do not need to paste raw URLs.

CONNECTED TOOLS: When Gmail or Google Calendar tools are in your tool list, that means the user has already connected their Google account — use these tools directly for any inbox or calendar question. Call search_gmail for inbox questions ("what emails do I have", "messages from X", "重要邮件"), list_calendar_events for schedule questions ("what's on my calendar", "meetings this week", "下周有什么会"), send_email to send email (only after the user confirms recipient/subject/body), and create_calendar_event to schedule. Never respond with "I don't have access to your email/calendar" when these tools are available — that text is forbidden. If a Gmail or Calendar tool is NOT in your tool list, then (and only then) tell the user the connector is not connected and suggest they visit the Connectors page.`;

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
    mode?: string;
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

  // Gmail/Calendar tools are exposed whenever the connector is connected —
  // in both Chat and Tasks modes, since users naturally ask about their
  // inbox/schedule without explicitly switching modes.
  let gmailOn = false;
  let calOn = false;
  try {
    const connectors = await listConnectors();
    gmailOn = connectors.find((c) => c.id === 'gmail')?.status === 'connected';
    calOn = connectors.find((c) => c.id === 'google-cal')?.status === 'connected';
  } catch (err) {
    console.warn('Could not read connectors for tool gating', err);
  }
  if (gmailOn) tools.push(SEARCH_GMAIL_TOOL, SEND_EMAIL_TOOL);
  if (calOn) tools.push(LIST_EVENTS_TOOL, CREATE_EVENT_TOOL);

  const write = (chunk: unknown) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  // Tell the model today's date so relative dates resolve correctly.
  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const systemPrompt = `${SYSTEM_PROMPT}\n\nCurrent date: ${todayLabel} (ISO ${today.toISOString().slice(0, 10)}). Use this for any relative date the user mentions — "tomorrow", "next week", "下周", etc. Always include a timezone in ISO datetimes you pass to calendar tools (Z for UTC, or ±HH:MM).`;

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(toOpenAIMessage),
  ];

  // Running totals across first + (optional) follow-up pass — logged once at
  // stream end so the dashboard sees one row per user turn rather than two.
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: baseMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {}),
    });

    const toolCallsBuffer: Array<{ id: string; function: { name: string; arguments: string } }> = [];

    for await (const chunk of stream) {
      if (chunk.usage) {
        totalInputTokens += chunk.usage.prompt_tokens ?? 0;
        totalOutputTokens += chunk.usage.completion_tokens ?? 0;
      }
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

    // Gmail/Calendar tool results — fed into the follow-up pass so the model
    // can synthesize a text answer referencing specific emails/events.
    const googleCalls: Array<{
      id: string;
      name: string;
      rawArgs: string;
      result: ToolResult | { error: string };
    }> = [];

    for (const tc of toolCallsBuffer) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* invalid JSON — treat as empty */ }
      const name = tc.function.name;
      if (name === 'search_images') {
        const images = await searchImages((args.query as string) || '', (args.count as number) || 4);
        if (images.length > 0) write({ type: 'images', images });
      } else if (name === 'search_videos') {
        const videos = await searchVideos((args.query as string) || '', (args.count as number) || 5);
        if (videos.length > 0) write({ type: 'videos', videos });
      } else if (name === 'web_search') {
        const resp = await searchWeb((args.query as string) || '', (args.max_results as number) || 5);
        if (resp.results.length > 0) write({ type: 'web_results', results: resp.results });
        webCalls.push({
          id: tc.id,
          name,
          rawArgs: tc.function.arguments || '{}',
          results: resp.results,
          images: resp.images,
        });
      } else if (name === 'search_gmail' || name === 'send_email' || name === 'list_calendar_events' || name === 'create_calendar_event') {
        const stepId = tc.id || `call_${Math.random().toString(36).slice(2, 10)}`;
        write({ type: 'tool_active', name });
        write({ type: 'task_step', step: { id: stepId, label: humanLabel(name, tc.function.arguments || '{}'), status: 'active' } });
        try {
          let result: ToolResult;
          if (name === 'search_gmail') result = await searchGmail(args as Parameters<typeof searchGmail>[0]);
          else if (name === 'send_email') result = await sendEmail(args as Parameters<typeof sendEmail>[0]);
          else if (name === 'list_calendar_events') result = await listCalendarEvents(args as Parameters<typeof listCalendarEvents>[0]);
          else result = await createCalendarEvent(args as Parameters<typeof createCalendarEvent>[0]);

          write({ type: 'card', card: result.card as CardJson });
          write({ type: 'task_step', step: { id: stepId, label: humanLabel(name, tc.function.arguments || '{}'), status: 'completed' } });
          // Read-only tools with non-empty results skip the second-pass synthesis
          // (avoids duplicating bullet lists in text). Empty results DO get
          // synthesis so the model can say "You have no meetings" in the
          // user's language.
          const isReadOnly = name === 'search_gmail' || name === 'list_calendar_events';
          const data = result.data as { events?: unknown[]; hits?: unknown[] } | undefined;
          const isEmpty = name === 'list_calendar_events'
            ? !data?.events || data.events.length === 0
            : name === 'search_gmail'
              ? !data?.hits || data.hits.length === 0
              : false;
          if (!isReadOnly || isEmpty) {
            googleCalls.push({ id: stepId, name, rawArgs: tc.function.arguments || '{}', result });
          }
        } catch (err) {
          console.error(`[tool ${name}] failed with args=${tc.function.arguments}`, err);
          const errMsg = err instanceof ConnectorNotConnectedError
            ? `${name === 'search_gmail' || name === 'send_email' ? 'Gmail' : 'Google Calendar'} is not connected. Ask the user to connect it on the Connectors page.`
            : err instanceof Error ? err.message : 'Tool failed';
          write({ type: 'task_step', step: { id: stepId, label: humanLabel(name, tc.function.arguments || '{}'), status: 'completed' } });
          googleCalls.push({ id: stepId, name, rawArgs: tc.function.arguments || '{}', result: { error: errMsg } });
        }
      }
    }

    if (webCalls.length > 0 || googleCalls.length > 0) {
      const toolCallBlocks = [
        ...webCalls.map((c) => ({
          id: c.id || `call_${Math.random().toString(36).slice(2, 10)}`,
          name: c.name,
          rawArgs: c.rawArgs,
        })),
        ...googleCalls.map((c) => ({
          id: c.id,
          name: c.name,
          rawArgs: c.rawArgs,
        })),
      ];
      const toolResponseBlocks: ChatCompletionMessageParam[] = [
        ...webCalls.map((c) => ({
          role: 'tool' as const,
          tool_call_id: c.id || `call_${Math.random().toString(36).slice(2, 10)}`,
          content: JSON.stringify({
            results: c.results.map((r) => ({ title: r.title, url: r.url, content: r.content })),
          }),
        })),
        ...googleCalls.map((c) => {
          const content = 'error' in c.result
            ? JSON.stringify({ error: c.result.error })
            : JSON.stringify({ data: c.result.data });
          return { role: 'tool' as const, tool_call_id: c.id, content };
        }),
      ];

      const followupMessages: ChatCompletionMessageParam[] = [
        ...baseMessages,
        {
          role: 'assistant',
          content: null,
          tool_calls: toolCallBlocks.map((c) => ({
            id: c.id,
            type: 'function' as const,
            function: { name: c.name, arguments: c.rawArgs },
          })),
        },
        ...toolResponseBlocks,
      ];

      const followup = await openai.chat.completions.create({
        model,
        messages: followupMessages,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of followup) {
        if (chunk.usage) {
          totalInputTokens += chunk.usage.prompt_tokens ?? 0;
          totalOutputTokens += chunk.usage.completion_tokens ?? 0;
        }
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

    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      // Classify the turn for the Subscription Health Check: web_search
      // invocations map to the Deep Research quota; otherwise plain chat.
      // Image uploads get their own counter so the card can separately
      // surface "you sent N images this month" regardless of classification.
      const calledWebSearch = webCalls.length > 0;
      const imagesCount = messages.reduce(
        (n, m) => n + (m.role === 'user' && m.images ? m.images.length : 0),
        0,
      );
      await logUsage({
        provider: 'openai',
        model,
        capability: calledWebSearch ? 'web_query' : 'chat',
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        images_count: imagesCount,
        cost_usd: priceFor(model, totalInputTokens, totalOutputTokens),
      });
    }

    write({ type: 'done', content: '' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    write({ type: 'error', content: message });
  }

  res.end();
}
