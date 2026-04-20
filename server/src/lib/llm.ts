import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { searchImages, isImageSearchConfigured, type ImageResult } from './imageSearch.js';
import { searchVideos, isVideoSearchConfigured, type VideoResult } from './youtubeSearch.js';
import { searchWeb, isWebSearchConfigured, type WebResult } from './webSearch.js';
import { listConnectors } from './connectorStore.js';
import {
  searchGmail,
  sendEmail,
  listCalendarEvents,
  createCalendarEvent,
  humanLabel,
  ConnectorNotConnectedError,
  type CardJson,
  type ToolResult,
} from './googleTools.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Optional image data URLs on a user message — turned into OpenAI
   *  multimodal content parts so vision models can see the attachments. */
  images?: string[];
}

export type ChatMode = 'Chat' | 'Tasks' | 'Code';

export interface TaskStepChunk {
  id: string;
  label: string;
  status: 'active' | 'completed';
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'images'; images: ImageResult[] }
  | { type: 'videos'; videos: VideoResult[] }
  | { type: 'web_results'; results: WebResult[] }
  | { type: 'card'; card: CardJson }
  | { type: 'task_step'; step: TaskStepChunk }
  | { type: 'tool_active'; name: string }
  | { type: 'done'; content: string }
  | { type: 'error'; content: string };

const IMAGE_SEARCH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_images',
    description: 'Search for real photographs to illustrate your answer. Call this when the user asks to see pictures of something, wants visual examples, or when a few illustrative photos would make the answer clearer. IMPORTANT: Before calling this tool, always write a short one-sentence intro like "Here are some photos of X:" — that is the ONLY text that will accompany the images, since no follow-up message is generated after the tool call.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Short, specific search phrase in English, e.g. "golden retriever puppy", "tokyo shibuya at night", "minimalist desk setup".',
        },
        count: {
          type: 'integer',
          description: 'How many images to show, 1-6. Default 4.',
          minimum: 1,
          maximum: 6,
        },
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
        query: {
          type: 'string',
          description: 'Search phrase. Match the user\'s language (e.g. use Chinese if they asked in Chinese) and include specifics like skill level or tool name — "react hooks tutorial for beginners", "日语五十音教学", "figma auto layout demo".',
        },
        count: {
          type: 'integer',
          description: 'How many videos to show, 1-8. Default 5.',
          minimum: 1,
          maximum: 8,
        },
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
        query: {
          type: 'string',
          description: 'Specific search query. Include product name, brand, country/market, and "official" or "site:brand.com" when looking for authoritative prices. Match the language appropriate to the target site (e.g. Chinese for chanel.cn, English for chanel.com).',
        },
        max_results: {
          type: 'integer',
          description: 'How many source results to fetch, 3-8. Default 5.',
          minimum: 3,
          maximum: 8,
        },
      },
      required: ['query'],
    },
  },
};

const SEARCH_GMAIL_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_gmail',
    description: 'Search the user\'s Gmail inbox for messages matching a query. Use this when the user asks about their inbox, recent emails, or messages from a specific person/topic. Returns a compact list of matching threads (from, subject, date, snippet). After the tool returns, write a brief text summary referencing the top 3-5 results.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query using Gmail\'s search syntax (e.g. "from:alice newer_than:7d", "subject:invoice", "is:unread"). Keep it specific; empty string returns the most recent messages.',
        },
        max_results: {
          type: 'integer',
          description: 'How many messages to return, 1-20. Default 10.',
          minimum: 1,
          maximum: 20,
        },
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
    description: 'List upcoming events from the user\'s primary Google Calendar. Call this whenever the user asks what\'s on their schedule, what they have this week, or what meetings are coming up. Defaults to the next 7 days if no range is given.',
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

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are WorkPal, an AI workplace assistant. You help users with meeting summaries, task management, research, scheduling, and general work productivity. Be concise, helpful, and professional. Respond in the same language the user uses.

When a user attaches an image, describe what you visually observe — subjects, setting, composition, mood, visible text, style — so the user can work with the content. For photos of people, describe visible attributes (expression, clothing, hair, pose, background) without attempting to identify or guess who the person is. Never respond that you "cannot see" or "cannot describe" an attached image; the image is present and you are able to describe it.

For any question about current prices, product specs, news, live statistics, official-website content, or anything that may have changed since your training, you MUST call the web_search tool. Do NOT guess, do NOT say "I cannot browse the web," and do NOT tell the user to check the website themselves — you have web_search, use it. After the tool returns, write a concise answer in the user's language that synthesizes the findings. The UI renders source chips from the tool results automatically, so you do not need to paste raw URLs.

CONNECTED TOOLS: When Gmail or Google Calendar tools are in your tool list, that means the user has already connected their Google account — use these tools directly for any inbox or calendar question. Call search_gmail for inbox questions ("what emails do I have", "messages from X", "重要邮件"), list_calendar_events for schedule questions ("what's on my calendar", "meetings this week", "下周有什么会"), send_email to send email (only after the user confirms recipient/subject/body), and create_calendar_event to schedule. Never respond with "I don't have access to your email/calendar" when these tools are available — that text is forbidden. If a Gmail or Calendar tool is NOT in your tool list, then (and only then) tell the user the connector is not connected and suggest they visit the Connectors page.`;

function toOpenAIMessage(msg: ChatMessage): ChatCompletionMessageParam {
  // Only user messages can carry images. Assistant/system stay text-only.
  if (msg.role === 'user' && msg.images && msg.images.length > 0) {
    return {
      role: 'user',
      content: [
        ...(msg.content ? [{ type: 'text' as const, text: msg.content }] : []),
        ...msg.images.map(url => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    };
  }
  return { role: msg.role, content: msg.content } as ChatCompletionMessageParam;
}

export async function* streamChat(
  messages: ChatMessage[],
  model = 'gpt-4o-mini',
  mode: ChatMode = 'Chat',
): AsyncGenerator<StreamChunk> {
  const toolList: ChatCompletionTool[] = [];
  if (isImageSearchConfigured()) toolList.push(IMAGE_SEARCH_TOOL);
  if (isVideoSearchConfigured()) toolList.push(VIDEO_SEARCH_TOOL);
  if (isWebSearchConfigured()) toolList.push(WEB_SEARCH_TOOL);

  // Gmail + Calendar tools are exposed whenever the connector is connected,
  // in both Chat and Tasks modes — users naturally ask about their inbox or
  // calendar without first switching modes. Without the connector the tools
  // are hidden entirely so the model falls back to plain text.
  let gmailOn = false;
  let calOn = false;
  try {
    const connectors = await listConnectors();
    gmailOn = connectors.find((c) => c.id === 'gmail')?.status === 'connected';
    calOn = connectors.find((c) => c.id === 'google-cal')?.status === 'connected';
  } catch (err) {
    // If the connectors table isn't reachable, skip silently — Gmail/Cal
    // tools won't be exposed but all the non-Google tools still work.
    console.warn('Could not read connectors for tool gating', err);
  }
  if (gmailOn) toolList.push(SEARCH_GMAIL_TOOL, SEND_EMAIL_TOOL);
  if (calOn) toolList.push(LIST_EVENTS_TOOL, CREATE_EVENT_TOOL);
  // Silence unused-param warning; `mode` is still accepted for forward compat.
  void mode;

  const tools = toolList.length > 0 ? toolList : undefined;

  // Tell the model today's date so "next week" / "tomorrow" resolve correctly
  // — otherwise GPT-4o-mini confidently picks a date from its training year.
  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const systemPrompt = `${SYSTEM_PROMPT}\n\nCurrent date: ${todayLabel} (ISO ${today.toISOString().slice(0, 10)}). Use this for any relative date the user mentions — "tomorrow", "next week", "下周", etc. Always include a timezone in ISO datetimes you pass to calendar tools (Z for UTC, or ±HH:MM).`;

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(toOpenAIMessage),
  ];

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: baseMessages,
      stream: true,
      ...(tools ? { tools, tool_choice: 'auto' as const } : {}),
    });

    const toolCallsBuffer: Array<{
      id: string;
      function: { name: string; arguments: string };
    }> = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) yield { type: 'text', content: delta.content };
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

    // Execute one-shot tools (images/videos) — results are terminal UI output.
    // Web search + Gmail/Calendar tools need a second LLM pass so the model can
    // synthesize an answer from the retrieved data; collect those separately.
    const webCalls: Array<{
      id: string;
      name: string;
      rawArgs: string;
      results: WebResult[];
      images: string[];
    }> = [];

    // Gmail/Calendar tool calls that succeeded — fed to the second-pass
    // synthesis so the model can reference specific emails/events by name.
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
        if (images.length > 0) yield { type: 'images', images };
      } else if (name === 'search_videos') {
        const videos = await searchVideos((args.query as string) || '', (args.count as number) || 5);
        if (videos.length > 0) yield { type: 'videos', videos };
      } else if (name === 'web_search') {
        const resp = await searchWeb((args.query as string) || '', (args.max_results as number) || 5);
        if (resp.results.length > 0) yield { type: 'web_results', results: resp.results };
        webCalls.push({
          id: tc.id,
          name,
          rawArgs: tc.function.arguments || '{}',
          results: resp.results,
          images: resp.images,
        });
      } else if (name === 'search_gmail' || name === 'send_email' || name === 'list_calendar_events' || name === 'create_calendar_event') {
        const stepId = tc.id || `call_${Math.random().toString(36).slice(2, 10)}`;
        yield { type: 'tool_active', name };
        yield { type: 'task_step', step: { id: stepId, label: humanLabel(name, tc.function.arguments || '{}'), status: 'active' } };
        try {
          let result: ToolResult;
          if (name === 'search_gmail') result = await searchGmail(args as Parameters<typeof searchGmail>[0]);
          else if (name === 'send_email') result = await sendEmail(args as Parameters<typeof sendEmail>[0]);
          else if (name === 'list_calendar_events') result = await listCalendarEvents(args as Parameters<typeof listCalendarEvents>[0]);
          else result = await createCalendarEvent(args as Parameters<typeof createCalendarEvent>[0]);

          yield { type: 'card', card: result.card };
          yield { type: 'task_step', step: { id: stepId, label: humanLabel(name, tc.function.arguments || '{}'), status: 'completed' } };
          // Read-only tools with results already shown in the card skip the
          // second-pass synthesis (avoids duplicating bullet lists in text).
          // Empty results DO get synthesis so the model can say "You have no
          // meetings next week" in the user's language — an empty card alone
          // feels too terse.
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
          yield { type: 'task_step', step: { id: stepId, label: humanLabel(name, tc.function.arguments || '{}'), status: 'completed' } };
          googleCalls.push({ id: stepId, name, rawArgs: tc.function.arguments || '{}', result: { error: errMsg } });
        }
      }
    }

    // Second pass: any tool that needs a synthesized text response (web + Google)
    // feeds its results back so the model can write a final assistant message.
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
      });

      for await (const chunk of followup) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) yield { type: 'text', content: delta.content };
      }

      // If web_search returned inline images, show the first one as a product photo.
      const firstImage = webCalls.flatMap((c) => c.images).find(Boolean);
      if (firstImage) {
        yield {
          type: 'images',
          images: [{
            url: firstImage,
            thumbUrl: firstImage,
            alt: 'Search result image',
            sourceUrl: webCalls[0]?.results[0]?.url,
            attribution: webCalls[0]?.results[0]?.title,
          }],
        };
      }
    }

    yield { type: 'done', content: '' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    yield { type: 'error', content: message };
  }
}

export function getAvailableModels(): { id: string; name: string; provider: string }[] {
  const models: { id: string; name: string; provider: string }[] = [];

  if (process.env.OPENAI_API_KEY) {
    models.push(
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    );
  }

  // Future: add Claude, Gemini, DeepSeek here

  return models;
}
