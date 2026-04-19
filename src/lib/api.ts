import type { CardData, ImageResult, PermissionKind, VideoResult, WebResult } from '../types';

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
  // Claude Agent SDK tool-call events (5.4c). `id` pairs a tool_use with its
  // matching tool_result so the frontend can flip Progress steps by id.
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; isError: boolean; summary: string }
  // 5.4d: SDK canUseTool bridge. The server parks a resolver per requestId
  // and waits for POST /claude-chat/permission/:requestId with allow|deny.
  // The frontend renders the existing PermissionPrompt modal driven by these
  // fields and POSTs the user's decision back via postClaudePermissionDecision.
  | {
      type: 'permission_request';
      requestId: string;
      tool: string;
      kind: PermissionKind;
      target: string;
      scope: string;
      input: unknown;
    }
  // Claude Agent SDK final usage/cost.
  | { type: 'claude_done'; usage?: unknown; cost?: unknown }
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

  yield* parseSSE(reader);
}

/**
 * Stream a Claude Agent SDK response from /api/claude-chat.
 * Keyword-routed here by src/lib/intentRouter.ts (5.4b). In 5.4b this only
 * yields text/claude_done/error chunks — tool_use → inspector mapping is 5.4c.
 */
export async function* streamClaudeChat(opts: {
  prompt: string;
  sessionId: string;
  sessionFolder?: string;
  messages: ChatMessage[];
}): AsyncGenerator<StreamChunk> {
  const res = await fetch('/api/claude-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
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

  yield* parseSSE(reader);
}

/** 5.4d: POST the user's PermissionPrompt decision back to the server, which
 *  unblocks the SDK's canUseTool callback parked under this requestId. Fire-
 *  and-forget — the SDK will surface any follow-up (tool_result, halt) over
 *  the same SSE stream that's already in flight. */
export async function postClaudePermissionDecision(
  requestId: string,
  sessionId: string,
  decision: 'allow' | 'deny',
): Promise<void> {
  try {
    await fetch(`/api/claude-chat/permission/${encodeURIComponent(requestId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, sessionId }),
    });
  } catch (err) {
    // The user has already made their choice — there's nothing actionable on a
    // network failure. The SDK will eventually time out / be cancelled when
    // the SSE stream closes, which the server cleans up via req.on('close').
    console.warn('Failed to POST permission decision:', err);
  }
}

async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<StreamChunk> {
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
