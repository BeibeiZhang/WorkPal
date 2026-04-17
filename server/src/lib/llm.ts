import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { searchImages, isImageSearchConfigured, type ImageResult } from './imageSearch.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Optional image data URLs on a user message — turned into OpenAI
   *  multimodal content parts so vision models can see the attachments. */
  images?: string[];
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'images'; images: ImageResult[] }
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are WorkPal, an AI workplace assistant. You help users with meeting summaries, task management, research, scheduling, and general work productivity. Be concise, helpful, and professional. Respond in the same language the user uses.

When a user attaches an image, describe what you visually observe — subjects, setting, composition, mood, visible text, style — so the user can work with the content. For photos of people, describe visible attributes (expression, clothing, hair, pose, background) without attempting to identify or guess who the person is. Never respond that you "cannot see" or "cannot describe" an attached image; the image is present and you are able to describe it.`;

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
): AsyncGenerator<StreamChunk> {
  // gpt-4o-mini already supports vision, so image messages Just Work.
  const tools = isImageSearchConfigured() ? [IMAGE_SEARCH_TOOL] : undefined;

  try {
    // Single-pass streaming. The model may stream text and tool_call deltas
    // in the same response; the tool description instructs it to write a
    // one-sentence intro *before* calling search_images, so no follow-up
    // round is needed — we execute the tool, yield the images, and end.
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(toOpenAIMessage),
      ],
      stream: true,
      ...(tools ? { tools, tool_choice: 'auto' as const } : {}),
    });

    const toolCallsBuffer: Array<{
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
            toolCallsBuffer[idx] = { function: { name: '', arguments: '' } };
          }
          if (tc.function?.name) toolCallsBuffer[idx].function.name = tc.function.name;
          if (tc.function?.arguments) toolCallsBuffer[idx].function.arguments += tc.function.arguments;
        }
      }
    }

    // Execute tool calls after the text stream finishes, then emit images.
    for (const tc of toolCallsBuffer) {
      if (tc.function.name !== 'search_images') continue;
      let args: { query?: string; count?: number } = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* invalid JSON — treat as empty */ }
      const images = await searchImages(args.query || '', args.count || 4);
      if (images.length > 0) yield { type: 'images', images };
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
