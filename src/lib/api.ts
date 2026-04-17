import type { ImageResult, VideoResult } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Optional image data URLs (data:image/*;base64,...) attached to this message.
   *  Forwarded to the backend, which builds an OpenAI multimodal content array
   *  so vision-capable models (gpt-4o / gpt-4o-mini) can see the images. */
  images?: string[];
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'images'; images: ImageResult[] }
  | { type: 'videos'; videos: VideoResult[] }
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
    body: JSON.stringify({ messages, model }),
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
