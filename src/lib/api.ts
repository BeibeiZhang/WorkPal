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
  // 5.5: server auto-committed a successful file-write tool_result. The
  // frontend uses `toolUseId` to locate the Change entry created earlier and
  // stamps it with `commit` — that's what lights up the Undo button.
  | { type: 'commit'; toolUseId: string; commit: string }
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
  /** 6.2: when the chat lives under a project, the frontend sends the
   *  `slugify(project.name)` that built its sessionFolder. Presence flips
   *  the backend into worktree mode (init project repo if needed, `git
   *  worktree add -b session/<slug>` at request start). Absent for chats
   *  outside any project — server falls back to Phase 5's per-session git
   *  init on first file-write. */
  projectSlug?: string;
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

/** 5.5: ask the backend to `git reset --hard HEAD~1` the session folder. The
 *  server blindly rolls HEAD back one commit — the frontend is responsible
 *  for only offering Undo on the latest committed Change entry so LIFO is
 *  preserved. `changeId` is passed through for server-side logging only.
 *  Returns `{ok:true, commit}` on success or `{ok:false, error}` so the
 *  caller can surface an inline error without needing to know the HTTP code. */
export async function postUndoChange(
  sessionFolder: string,
  changeId: string,
): Promise<
  | { ok: true; commit: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch('/api/claude-chat/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionFolder, changeId }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const error =
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `Undo failed (${res.status})`;
      return { ok: false, error };
    }
    const payload = (await res.json()) as { commit?: string };
    return { ok: true, commit: payload.commit ?? '' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/** 6.3: one row in the Complete Session diff preview. Mirrors the
 *  server's `SessionDiffEntry`. `insertions`/`deletions` are `-1` for binary
 *  files so the modal can render a dash in that column instead of a number. */
export interface SessionDiffEntry {
  path: string;
  status: 'A' | 'M' | 'D';
  insertions: number;
  deletions: number;
}

/** 6.3: POST /api/session/complete — asks the backend to diff
 *  `session/<slug>` against the project's base branch and return the file
 *  list for the Complete Session modal. Does not merge anything. */
export async function postSessionComplete(
  projectSlug: string,
  sessionFolder: string,
): Promise<
  | { ok: true; files: SessionDiffEntry[] }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch('/api/session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug, sessionFolder }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const error =
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `Complete Session failed (${res.status})`;
      return { ok: false, error };
    }
    const payload = (await res.json()) as { files?: SessionDiffEntry[] };
    return { ok: true, files: payload.files ?? [] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/** 6.3: POST /api/session/merge — attempt `git merge --ff-only session/<slug>`
 *  in the project base repo. The three outcomes map to:
 *    • 200 → `{ok: true, commit, alreadyUpToDate}`
 *    • 409 → `{ok: false, reason: 'not-ff', ...}` with a copyable CLI command
 *    • 500 → `{ok: false, reason: 'other', ...}`
 *
 *  The CLI command for the non-FF path is browser-assembled here (not
 *  returned from the server): both `sessionFolder` and the derived slug were
 *  already validated on the way in, so reusing them keeps the string
 *  grounded in the same trust boundary (shared decision D5 "frontend-
 *  assembled from already-validated inputs"). `basename` isn't available in
 *  the browser, so the slug is extracted with a plain `split`. */
export async function postSessionMerge(
  projectSlug: string,
  sessionFolder: string,
): Promise<
  | { ok: true; commit: string; alreadyUpToDate: boolean }
  | { ok: false; reason: 'not-ff'; error: string; cliCommand: string }
  | { ok: false; reason: 'other'; error: string }
> {
  try {
    const res = await fetch('/api/session/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug, sessionFolder }),
    });
    if (res.ok) {
      const payload = (await res.json()) as {
        commit?: string;
        alreadyUpToDate?: boolean;
      };
      return {
        ok: true,
        commit: payload.commit ?? '',
        alreadyUpToDate: payload.alreadyUpToDate ?? false,
      };
    }
    const payload = await res.json().catch(() => ({}));
    const error =
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Merge failed (${res.status})`;
    if (
      res.status === 409 &&
      (payload as { reason?: unknown }).reason === 'not-ff'
    ) {
      // Strip trailing `/sessions/<slug>/` to get the project folder path
      // (lets us build `cd <projectPath> && git merge session/<slug>` without
      // a separate API call). Capture group preserves the project path.
      const trimmed = sessionFolder.replace(/\/+$/, '');
      const slug = trimmed.split('/').pop() || '';
      const projectPath = trimmed.replace(/\/sessions\/[^/]+$/, '');
      const cliCommand = `cd ${projectPath} && git merge session/${slug}`;
      return { ok: false, reason: 'not-ff', error, cliCommand };
    }
    return { ok: false, reason: 'other', error };
  } catch (err) {
    return {
      ok: false,
      reason: 'other',
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/** 6.1: make sure `~/WorkPal/<projectSlug>/` exists and has a git repo with a
 *  baseline commit. Called fire-and-forget on project create (App.tsx's
 *  `handleCreateProject` / `handlePromoteToProject`) and on project open
 *  (useEffect on `activeProjectId`). Backend is idempotent so double-firing
 *  is intentional — it means an existing project folder without `.git` gets
 *  initialized the first time the user enters it after upgrade. Never throws:
 *  a network failure resolves to `{ok:false, error}` so the caller can just
 *  `console.warn` and move on. */
export async function postInitProject(
  projectSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/project/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const error =
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `Project init failed (${res.status})`;
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/** 5.4e: ask the backend to reveal the session folder in Finder. The server
 *  re-validates the path with the same resolveSessionFolder() used by the chat
 *  route, so a malformed string here is rejected instead of launching Finder
 *  outside ~/WorkPal/. Resolves true on success, false if the server rejected
 *  the path or the spawn failed — caller decides whether to surface feedback. */
export async function postOpenFolder(sessionFolder: string): Promise<boolean> {
  try {
    const res = await fetch('/api/claude-chat/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionFolder }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to open folder:', err);
    return false;
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
