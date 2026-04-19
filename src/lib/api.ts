import type { CardData, ImageResult, VideoResult, WebResult } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Optional image data URLs (data:image/*;base64,...) attached to this message.
   *  Forwarded to the backend, which builds an OpenAI multimodal content array
   *  so vision-capable models (gpt-4o / gpt-4o-mini) can see the images. */
  images?: string[];
}

/** A live task-progress step emitted by the server as a Gmail/Calendar tool
 *  runs. Mirrors server/src/lib/llm.ts `TaskStepChunk`. Rendered in the
 *  TaskContextPanel's Progress list. */
export interface TaskStepPayload {
  id: string;
  label: string;
  status: 'active' | 'completed';
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'images'; images: ImageResult[] }
  | { type: 'videos'; videos: VideoResult[] }
  | { type: 'web_results'; results: WebResult[] }
  | { type: 'card'; card: CardData }
  | { type: 'task_step'; step: TaskStepPayload }
  | { type: 'tool_active'; name: string }
  | { type: 'done'; content: string }
  | { type: 'error'; content: string };

/**
 * Stream a chat response from the backend LLM API.
 * Yields text chunks as they arrive via SSE.
 */
export async function* streamChat(
  messages: ChatMessage[],
  model?: string,
): AsyncGenerator<StreamChunk> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Always request the full tool set — the model decides whether to reach
    // for Gmail/Calendar/search/etc. based on the user's message, and when it
    // does, the frontend auto-opens the inspector panel on the first
    // tool_active chunk. No need for a client-side "mode" toggle.
    body: JSON.stringify({ messages, model, mode: 'Tasks' }),
  });

  if (!res.ok) {
    yield { type: 'error', content: `API error: ${res.status}` };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: 'error', content: 'No response stream' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const chunk: StreamChunk = JSON.parse(line.slice(6));
          yield chunk;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}
