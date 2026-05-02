import type { CardData, ImageResult, PermissionKind, VideoResult, WebResult } from '../types';
import { fetchAgent, AgentUnreachableError } from './agent';

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
  /** 6.4: true when the current user message carries attachments. When false
   *  the server strips Bash/Read/Glob/Grep from the SDK so the model defaults
   *  to web search instead of roaming the filesystem to guess at file paths. */
  hasAttachedFiles?: boolean;
  /** §17: per-project external knowledge folders (absolute paths). Server
   *  re-validates each before passing them to the SDK as
   *  `additionalDirectories`. */
  referenceDirectories?: string[];
  messages: ChatMessage[];
}): AsyncGenerator<StreamChunk> {
  let res: Response;
  try {
    res = await fetchAgent('/api/claude-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
  } catch (err) {
    // fetchAgent already flipped agentState to 'unreachable' so the
    // App-level OnboardingSurface is rendering. Yield a short error chunk
    // here so the chat bubble closes gracefully instead of hanging on the
    // loading indicator.
    if (err instanceof AgentUnreachableError) {
      yield {
        type: 'error',
        content: 'Local agent unreachable. Install the WorkPal Agent to enable code edits.',
      };
      return;
    }
    yield { type: 'error', content: err instanceof Error ? err.message : 'Network error' };
    return;
  }

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
    await fetchAgent(`/api/claude-chat/permission/${encodeURIComponent(requestId)}`, {
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
    const res = await fetchAgent('/api/claude-chat/undo', {
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
    const res = await fetchAgent('/api/session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug, sessionFolder }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const error =
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `Save to Knowledge failed (${res.status})`;
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

/** §20: per-target outcome from POST /api/session/merge. Mirrors the
 *  backend's MergeTargetResult plus a frontend-assembled `cliCommand` on the
 *  not-ff project case (server-side path is unavailable to the browser, so
 *  we build it from the already-validated sessionFolder per shared decision
 *  D5 "frontend-assembled from already-validated inputs"). */
export type SessionMergeTargetResult =
  | { target: 'project'; ok: true; commit: string; alreadyUpToDate: boolean }
  | { target: 'project'; ok: false; reason: 'not-ff'; error: string; gitMessage: string; cliCommand: string }
  | { target: 'project'; ok: false; reason: 'other'; error: string }
  | { target: 'reference'; path: string; ok: true; copiedCount: number; usedFallback?: false }
  | { target: 'reference'; path: string; ok: true; copiedCount: number; usedFallback: true }
  | { target: 'reference'; path: string; ok: true; copiedCount: 0; warning: 'no_outputs_dir' }
  | { target: 'reference'; path: string; ok: true; copiedCount: 0; warning: 'no_new_deliverables' }
  | {
      target: 'reference';
      path: string;
      ok: false;
      code: 'permission_denied' | 'not_found' | 'disk_full' | 'invalid_path' | 'unknown';
      message: string;
    };

/** §20: aggregate response. `kind: 'completed'` means the server processed
 *  the request (which may include per-target failures); `kind: 'transport'`
 *  means we couldn't reach the server at all. Modal keys off `kind` first,
 *  then `ok` for completed-but-partial. */
export type SessionMergeResponse =
  | { kind: 'completed'; ok: boolean; results: SessionMergeTargetResult[] }
  | { kind: 'transport'; error: string };

/** 6.3 + §20: POST /api/session/merge — attempt to merge the session into the
 *  selected targets. Project target → `git merge --ff-only` in the project
 *  base; each reference folder target → `fs.cp(<sessionPath>/outputs/, <ref>)`.
 *  Project failure short-circuits the request (server-side) so ref folders
 *  aren't touched if the canonical merge couldn't go through.
 *
 *  The CLI command for the project not-ff path is browser-assembled here
 *  (not returned from the server): both `sessionFolder` and the derived slug
 *  were already validated on the way in, so reusing them keeps the string
 *  grounded in the same trust boundary. `basename` isn't available in the
 *  browser, so the slug is extracted with a plain `split`. */
export async function postSessionMerge(opts: {
  projectSlug: string;
  sessionFolder: string;
  targets: { project: boolean; referenceFolders: string[] };
}): Promise<SessionMergeResponse> {
  const { projectSlug, sessionFolder, targets } = opts;
  try {
    const res = await fetchAgent('/api/session/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug, sessionFolder, targets }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      results?: unknown[];
      error?: string;
    };

    // Pre-validation 4xx (no `results` array) — synthesize one "other" failure
    // for the project target so the modal still has something to render.
    if (!Array.isArray(payload.results)) {
      const error =
        typeof payload.error === 'string'
          ? payload.error
          : `Merge failed (${res.status})`;
      return {
        kind: 'completed',
        ok: false,
        results: [{ target: 'project', ok: false, reason: 'other', error }],
      };
    }

    // Adapt server results → frontend results: project not-ff gets a
    // browser-assembled cliCommand. Other shapes pass through unchanged.
    const trimmed = sessionFolder.replace(/\/+$/, '');
    const slug = trimmed.split('/').pop() || '';
    const projectPath = trimmed.replace(/\/sessions\/[^/]+$/, '');
    const cliCommand = `cd ${projectPath} && git merge session/${slug}`;

    const results: SessionMergeTargetResult[] = (
      payload.results as SessionMergeTargetResult[]
    ).map((r) => {
      if (r.target === 'project' && !r.ok && r.reason === 'not-ff') {
        return { ...r, cliCommand };
      }
      return r;
    });

    return { kind: 'completed', ok: payload.ok ?? false, results };
  } catch (err) {
    return {
      kind: 'transport',
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
    const res = await fetchAgent('/api/project/init', {
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

/** §31: best-effort filename → absolute-path recovery for legacy
 *  OutputItem entries created before §23 started persisting `path` on
 *  commit. Posts the missing names to the agent which walks
 *  `~/WorkPal/<projectSlug>/sessions/` and returns only names with exactly
 *  one match (0 / multiple → dropped so we never overwrite with a wrong
 *  path). Resolves to `[]` on any failure: the backfill is non-essential
 *  and a missing agent / network blip should silently leave entries alone. */
export async function postScanProjectOutputs(
  projectSlug: string,
  names: string[],
): Promise<{ name: string; path: string }[]> {
  if (names.length === 0) return [];
  try {
    const res = await fetchAgent('/api/project/scan-outputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug, names }),
    });
    if (!res.ok) {
      console.warn(`[scan-outputs] non-ok ${res.status}`);
      return [];
    }
    const payload = (await res.json()) as { matches?: { name: string; path: string }[] };
    return Array.isArray(payload.matches) ? payload.matches : [];
  } catch (err) {
    if (!(err instanceof AgentUnreachableError)) {
      console.warn('[scan-outputs] failed:', err);
    }
    return [];
  }
}

/** §43: one row from GET /api/project/:slug/deliverables. Represents a
 *  file on the project's main branch ("saved") or on an active session
 *  branch ("in-session"). The frontend uses this as the authoritative
 *  Output grid data source instead of the legacy project.outputs[]. */
export interface DeliverableItem {
  name: string;
  path: string;
  status: 'saved' | 'in-session';
  mtime: string;
  sessionId?: string;
}

/** §43: fetch the authoritative deliverable list for a project. Merges
 *  main-branch saved files with in-session uncommitted files, deduped by
 *  basename. Returns [] on any failure — the Output grid falls back to
 *  the existing project.outputs[] source. */
export async function fetchProjectDeliverables(
  projectSlug: string,
): Promise<DeliverableItem[]> {
  try {
    const res = await fetchAgent(
      `/api/project/${encodeURIComponent(projectSlug)}/deliverables`,
    );
    if (!res.ok) {
      console.warn(`[deliverables] non-ok ${res.status}`);
      return [];
    }
    const payload = (await res.json()) as { items?: DeliverableItem[] };
    return Array.isArray(payload.items) ? payload.items : [];
  } catch (err) {
    if (!(err instanceof AgentUnreachableError)) {
      console.warn('[deliverables] failed:', err);
    }
    return [];
  }
}

/** 6.5: one error row from the reaper summary. Mirrors the server's
 *  `ReapError`. `stage` distinguishes a failed worktree remove (destructive
 *  step that was aborted) from a failed branch delete (cosmetic stray
 *  pointer after a successful remove). */
export interface ReaperError {
  path: string;
  branch: string | null;
  stage: 'remove-worktree' | 'delete-branch';
  message: string;
}

/** 6.5: per-project summary entry. `skipped` is set when the backend bailed
 *  on this project before running the reap — malformed payload (`invalid-slug`
 *  / `invalid-session-path`) or uninitialized repo (`no-git`). Frontend
 *  console.warns on any skipped entry so a dev can spot payload bugs. */
export interface ReaperProjectSummary {
  projectSlug: string;
  reapedCount: number;
  prunedCount: number;
  errors: ReaperError[];
  skipped?: 'no-git' | 'invalid-slug' | 'invalid-session-path';
  skippedReason?: string;
}

export interface ReaperInput {
  projectSlug: string;
  activeSessionFolders: string[];
}

/** 6.5: POST /api/reaper/run — fire-and-forget sweep that removes
 *  `session/<slug>` worktrees whose paths aren't in `activeSessionFolders`.
 *  See docs/phase-6-requirements.md §6.5 for the orphan-shape table and
 *  the "Phase 5 legacy sessions are structurally excluded" invariant. The
 *  backend always responds 200 on valid top-level shape; per-project
 *  failures land in the summary's `skipped` / `errors` fields. */
export async function postReaperRun(
  projects: ReaperInput[],
): Promise<
  | { ok: true; summary: ReaperProjectSummary[] }
  | { ok: false; error: string }
> {
  try {
    const res = await fetchAgent('/api/reaper/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const error =
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `Reaper failed (${res.status})`;
      return { ok: false, error };
    }
    const payload = (await res.json()) as {
      summary?: ReaperProjectSummary[];
    };
    return { ok: true, summary: payload.summary ?? [] };
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
    const res = await fetchAgent('/api/claude-chat/open-folder', {
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

/** Open a single file via the backend `open <path>` spawn. Used by the inline
 *  ArtifactCard in chat — clicking it routes through the same path-traversal
 *  check that `postOpenFolder` uses, then hands off to macOS which delegates
 *  to the default app for the file type (`.html` → default browser). */
export async function postOpenFile(filePath: string): Promise<boolean> {
  try {
    const res = await fetchAgent('/api/claude-chat/open-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to open file:', err);
    return false;
  }
}

/** §23: reveal-and-highlight a file in macOS Finder via `open -R <path>`.
 *  Distinct from postOpenFile (which delegates to the default app) — Reveal
 *  pops a Finder window with the file pre-selected, the canonical "show me
 *  where this lives" gesture. Used by the DetailPanel header button when the
 *  user wants to escape the inline preview into the OS file browser. */
export async function postRevealInFinder(filePath: string): Promise<boolean> {
  try {
    const res = await fetchAgent('/api/claude-chat/reveal-in-finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to reveal file:', err);
    return false;
  }
}

export type ReadFileResult =
  | { content: string; resolvedPath: string }
  | { content: null; reason: 'file_no_longer_accessible' | 'error' };

/** 6.4 + §52: read a produced artifact file for inline preview. Accepts
 *  optional fallback paths so the backend can try project root / ref
 *  directories when the original session path has been reaped. */
export async function postReadFile(
  filePath: string,
  fallbackPaths?: string[],
): Promise<ReadFileResult> {
  try {
    const body: Record<string, unknown> = { filePath };
    if (fallbackPaths && fallbackPaths.length > 0) body.fallbackPaths = fallbackPaths;
    const res = await fetchAgent('/api/claude-chat/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { reason?: string };
      if (res.status === 404 && data.reason === 'file_no_longer_accessible') {
        return { content: null, reason: 'file_no_longer_accessible' };
      }
      return { content: null, reason: 'error' };
    }
    const data = (await res.json()) as { content?: string; resolvedPath?: string };
    if (typeof data.content === 'string') {
      return { content: data.content, resolvedPath: data.resolvedPath ?? filePath };
    }
    return { content: null, reason: 'error' };
  } catch (err) {
    console.warn('Failed to read file:', err);
    return { content: null, reason: 'error' };
  }
}

/** Phase 7 #2: one of the four preset rewrite actions exposed by the
 *  DetailPanel popover. Server validates against the same list — keep in sync
 *  with `server/src/lib/editArticle.ts`. */
export type EditPreset = 'shorter' | 'extend' | 'formal' | 'translate';

export type EditArticleChunk =
  | { type: 'text'; content: string }
  | { type: 'done' }
  | { type: 'error'; content: string };

/** Phase 7 #2: stream a rewritten version of `articleText` from
 *  /api/edit-article. Pass `signal` from an AbortController so the DetailPanel
 *  can cancel mid-stream (user clicks Cancel) — this aborts the fetch, which
 *  the Express route notices via `req.on('close')` and passes through to the
 *  OpenAI stream. Silent abort: on cancel, the generator simply stops yielding
 *  rather than emitting an error chunk, so callers don't need to distinguish
 *  "user cancelled" from "server error" in their state machine. */
export async function* streamEditArticle(
  articleText: string,
  preset: EditPreset,
  signal?: AbortSignal,
): AsyncGenerator<EditArticleChunk> {
  let res: Response;
  try {
    res = await fetch('/api/edit-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleText, preset }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    yield { type: 'error', content: err instanceof Error ? err.message : 'Network error' };
    return;
  }

  if (!res.ok) {
    // Try to surface the validation error from the route (400 → { error: "..." }).
    let detail = `API error: ${res.status}`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (typeof payload.error === 'string') detail = payload.error;
    } catch {
      // Non-JSON body — keep the generic HTTP message.
    }
    yield { type: 'error', content: detail };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: 'error', content: 'No response stream' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(line.slice(6)) as EditArticleChunk;
            yield chunk;
          } catch {
            // Skip malformed JSON — same policy as parseSSE().
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    yield { type: 'error', content: err instanceof Error ? err.message : 'Stream error' };
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
