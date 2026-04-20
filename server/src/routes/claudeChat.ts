import { Router } from 'express';
import { access, mkdir, rmdir } from 'node:fs/promises';
import { basename, dirname, join as pathJoin, resolve as pathResolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { runClaudeCode, shapeToolUse, shapeToolResult } from '../lib/claudeCode.js';
import {
  commitAfterTool,
  initIfNeeded,
  SESSION_BRANCH_RE,
  undoLastCommit,
  worktreeAddIfNeeded,
  worktreeRemoveIfEmpty,
} from '../lib/git.js';
import { initProjectIfNeeded, resolveProjectFolder } from '../lib/project.js';
import { WORKPAL_ROOT } from '../lib/paths.js';

const router = Router();

/** Expand a user-supplied sessionFolder to an absolute path inside WORKPAL_ROOT.
 *  Returns { ok: false, reason } if the input is missing, not a string, or
 *  escapes the root (e.g. via `..` or an absolute path outside ~/WorkPal/). */
function resolveSessionFolder(
  folder: unknown,
): { ok: true; resolved: string } | { ok: false; reason: string } {
  if (typeof folder !== 'string' || folder.length === 0) {
    return { ok: false, reason: 'sessionFolder is required / sessionFolder 必填' };
  }
  // Node doesn't auto-expand `~`. Only strip the leading `~/` (or bare `~`) —
  // a mid-path tilde is treated as a literal directory name.
  const expanded = folder === '~'
    ? homedir()
    : folder.startsWith('~/')
      ? pathResolve(homedir(), folder.slice(2))
      : folder;
  const resolved = pathResolve(expanded);
  // startsWith with a trailing separator ensures `/foo/WorkPalEvil` doesn't
  // slip past a naive `startsWith('/foo/WorkPal')` check.
  if (resolved !== WORKPAL_ROOT && !resolved.startsWith(WORKPAL_ROOT + sep)) {
    return {
      ok: false,
      reason:
        'sessionFolder must be under ~/WorkPal/ / sessionFolder 必须在 ~/WorkPal/ 下',
    };
  }
  return { ok: true, resolved };
}

/* ── 5.4d permission bridge ───────────────────────────────────────────────
 *
 * Each canUseTool invocation registers a resolver in this Map and SSE-emits a
 * `permission_request` chunk. The frontend POSTs the user's decision to
 * /claude-chat/permission/:requestId, which looks up the resolver and unblocks
 * the SDK. requestIds are sessionId-prefixed so two concurrent chats can't
 * collide; sessionId is also stored on the entry as a defense-in-depth check
 * against a misrouted POST.
 */
type Resolver = {
  sessionId: string;
  /** Closes over the original tool input + the SDK promise resolver, so the
   *  POST handler only has to pass a decision string. allow → echo the
   *  original input back to the SDK so the tool runs with what Claude asked
   *  for; deny → surface a short message that Claude sees. */
  decide: (decision: 'allow' | 'deny') => void;
};

const resolverMap = new Map<string, Resolver>();

/** Frontend-facing kind for the PermissionPrompt modal. Mirrors src/types.ts
 *  `PermissionKind`. Kept as a string union here to avoid pulling React types
 *  into the server. */
type PermissionKind = 'file-read' | 'file-write' | 'command' | 'external-url';

/** Map an SDK tool name to the modal kind. The fallback is `command`, the
 *  most cautious copy ("Allow Claude to run this command?"). Any new
 *  file-mutating tool the SDK ships should be added to FILE_WRITE_TOOLS so
 *  it surfaces with the right wording. */
const FILE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const FILE_READ_TOOLS = new Set(['Read']);
const EXTERNAL_URL_TOOLS = new Set(['WebFetch', 'WebSearch']);

function toolToKind(toolName: string): PermissionKind {
  if (FILE_WRITE_TOOLS.has(toolName)) return 'file-write';
  if (FILE_READ_TOOLS.has(toolName)) return 'file-read';
  if (EXTERNAL_URL_TOOLS.has(toolName)) return 'external-url';
  return 'command';
}

function strField(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === 'string' ? v : '';
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/** Derive { target, scope } from the tool input. `target` is the exact thing
 *  we ask the user to approve (rendered verbatim in the prompt body). `scope`
 *  is the bucket the "Always allow" cache is keyed by — coarser than target
 *  so a single approval covers a session's worth of related calls (e.g. all
 *  writes inside the session folder, all GETs to the same origin). */
function deriveTargetScope(
  kind: PermissionKind,
  toolName: string,
  input: Record<string, unknown>,
): { target: string; scope: string } {
  if (kind === 'file-write') {
    const path = strField(input, 'file_path') || strField(input, 'notebook_path');
    if (path) return { target: path, scope: dirname(path) || path };
  }
  if (kind === 'file-read') {
    const path = strField(input, 'file_path');
    if (path) return { target: path, scope: path };
  }
  if (kind === 'command') {
    const cmd = strField(input, 'command');
    if (cmd) {
      // 6.4: scope is the first word of the command (e.g. `ls` out of
      // `ls /foo/bar | head -20`) so one "Always allow" for ls covers every
      // `ls *` variation in the session. Exact-command scope was too granular —
      // a session that ran ls against five paths would pop five modals even
      // after the user blanket-approved the first one. The modal body still
      // renders the full command so the user sees what they're approving the
      // first time; subsequent same-verb calls just skip the prompt.
      const firstWord = cmd.trim().split(/\s+/)[0] || cmd;
      return { target: cmd, scope: firstWord };
    }
  }
  if (kind === 'external-url') {
    const url = strField(input, 'url') || strField(input, 'query');
    if (url) return { target: url, scope: originOf(url) };
  }
  // Fallback when the input shape is unfamiliar: surface the tool name + a
  // JSON snapshot so the user still has something to inspect, and key the
  // cache by the tool name so blanket approval is at least possible.
  const snap = JSON.stringify(input).slice(0, 120);
  return { target: `${toolName}: ${snap}`, scope: toolName };
}

// POST /api/claude-chat — SSE stream of Claude Agent SDK events.
//
// Filter rules (Phase 5.4 shared decisions):
//   system.*       → drop (hook_started / hook_response / init noise)
//   assistant      → text blocks → { type:'text', content };
//                    tool_use blocks → { type:'tool_use', id, name, input }  (5.4c)
//   user           → tool_result blocks → { type:'tool_result', toolUseId, isError, summary }  (5.4c)
//   result         → forward as { type:'claude_done', usage, cost }
//   errors         → forward as { type:'error', content }
//
// 5.4d adds:
//   canUseTool     → SSE-send { type:'permission_request', requestId, ... }
//                    and await POST /claude-chat/permission/:requestId.
// 6.4: tools canUseTool waves through without prompting. The user told us
// "default to web" — a modal for every WebSearch/WebFetch contradicts that.
// Plus: read-only filesystem tools, orchestration helpers, and deferred-tool
// loaders. The whole workspace (~/WorkPal/) is already the user's explicit
// workspace, and the SDK's cwd is jailed inside it. Letting the model use its
// exploration tools without prompting is what makes "generate an intro page
// about WorkPal" actually work — without Read/Glob/Bash the agent is blind.
const AUTO_ALLOW_TOOLS = new Set([
  'WebSearch', 'WebFetch',
  'Read', 'Glob', 'Grep',
  'Task', 'Agent', 'Monitor', 'TaskOutput', 'TaskStop',
  'TodoWrite', 'ToolSearch', 'Skill',
]);

// 6.4: Bash verbs that only read / inspect. Auto-allow these; anything that
// could mutate the system (rm, chmod, curl, git push, npm install…) still
// prompts via canUseTool with verb-level scope.
const READ_ONLY_SHELL_VERBS = new Set([
  'ls', 'cat', 'head', 'tail', 'find', 'grep', 'rg', 'pwd', 'file',
  'wc', 'stat', 'which', 'tree', 'echo', 'date', 'whoami', 'uname',
  'test', 'ls -la', // common compound aliases hit on `split[0]` anyway
]);

// 6.4: file-writing tools. We auto-allow these into the session folder and
// pin any path that drifts outside it back to <cwd>/<basename>. The model
// has a bad habit of resolving relative paths against $HOME (e.g. `~/foo.html`
// → `/Users/beibeizhang/foo.html`) even when we tell it the cwd in the system
// prompt. Without pinning, the write lands in the user's home dir, git's add
// fails ("outside repository"), and the frontend artifact card carries an
// absolute path that resolveSessionFolder rejects — so clicking the card
// silently 400s and the user sees a broken output.
/** Pin a file-write tool's path into `cwd` if it drifts outside. Returns the
 *  (possibly rewritten) input. Pure — no side effects. Called from two sites:
 *  (1) the assistant-block handler, so the tool_use event we stream to the
 *  frontend already carries the pinned path (otherwise the artifact card ends
 *  up pointing at the pre-pin location); (2) the canUseTool callback, so the
 *  SDK's actual tool execution sees the pinned path. Both sites have to agree
 *  or the file will be saved in one place while the UI points at another. */
function pinFileWriteInput(
  toolName: string,
  input: Record<string, unknown>,
  cwd: string,
): { input: Record<string, unknown>; pinned: boolean } {
  if (!FILE_WRITE_TOOLS.has(toolName)) return { input, pinned: false };
  const pathField = toolName === 'NotebookEdit' ? 'notebook_path' : 'file_path';
  const raw = typeof input[pathField] === 'string' ? (input[pathField] as string) : '';
  if (!raw) return { input, pinned: false };
  const normalized = pathResolve(raw);
  const cwdPrefix = cwd + sep;
  if (normalized === cwd || normalized.startsWith(cwdPrefix)) {
    return { input, pinned: false };
  }
  const pinnedPath = pathJoin(cwd, basename(normalized));
  return { input: { ...input, [pathField]: pinnedPath }, pinned: true };
}

// 6.4: light-touch rule. The SDK's default system prompt already tells the
// agent how to use its tools — we only nudge on what WorkPal needs:
//   1. produce real files for tangible asks (not chat-inlined markdown),
//   2. mark the ONE deliverable so chat can render a single "open me" card
//      instead of 12 cards of scaffolding files.
// Mirrors the Cowork convention (outputs/ directory + end-of-message
// marker). The marker is parsed by ChatMessage when picking a primary
// artifact — if the agent forgets to include one, chat falls back to the
// last file under outputs/ or the last Write.
const ARTIFACT_PROMPT = [
  'When the user asks for a tangible artifact (webpage / 网页 / page / 页面 / document / 文档 / report / 报告 / file / 文件 / markdown), produce it as a real file via the Write tool. Chat reply should be a short sentence pointing at the file, not the artifact body inlined as markdown. Pick a clean filename with the right extension; the server pins it into the working directory. The current working directory is already WorkPal-owned, so you can freely Read, Glob, Grep, or Bash inside it to ground the artifact in the user\'s real project.',
  // Deliverable layout — gives us a directory signal when the agent forgets
  // the marker below.
  'DELIVERABLE LAYOUT: save the user-facing final deliverable under `<cwd>/outputs/` (for a single HTML page: `outputs/index.html`; for a markdown doc: `outputs/<name>.md`; for a built web app: whatever file the user is meant to open, e.g. `outputs/index.html`). Scaffolding — package.json, vite.config, tsconfig, source files under src/ — stays at the root or in its natural location, NOT inside outputs/. Rule of thumb: if the user would double-click it to consume the result, it goes in outputs/.',
  // Explicit end-of-message marker — the strongest signal.
  'END OF TURN MARKER (required when you produced an artifact): the LAST line of your final assistant message must be a marker on its own line. Use ONE of:\n  • `[PREVIEW: http://localhost:<port>]` — when you started a dev server the user should open in a browser (e.g. `npm run dev` produced `http://localhost:5173`).\n  • `[ARTIFACT: <absolute-or-relative-path>]` — when the deliverable is a single file (e.g. `[ARTIFACT: outputs/index.html]`).\nThe marker is stripped from the displayed chat and used to surface ONE clickable preview card. Do not include it if there is no deliverable (pure Q&A / discussion).',
].join('\n\n');

router.post('/claude-chat', async (req, res) => {
  const { prompt, sessionId, sessionFolder, projectSlug, hasAttachedFiles } = req.body as {
    prompt?: string;
    sessionId?: string;
    sessionFolder?: string;
    projectSlug?: string;
    messages?: unknown;
    /** 6.4: frontend sets this to true when the user message carries one or
     *  more attachments or an explicit @path mention. Drives whether we
     *  disable the local-exploration tool set for this request. */
    hasAttachedFiles?: boolean;
  };

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  // 5.4e: real Chat.sessionFolder replaces the 5.4b–5.4d sandbox cwd. Reject
  // path-traversal attempts and missing values up front so the SDK never
  // spawns with a cwd outside ~/WorkPal/.
  const folderCheck = resolveSessionFolder(sessionFolder);
  if (!folderCheck.ok) {
    res.status(400).json({ error: folderCheck.reason });
    return;
  }
  const workingDir = folderCheck.resolved;

  // 6.2: project-owned branch if the frontend sent a projectSlug alongside
  // the sessionFolder. Validate both + derive the branch name up front so
  // any input failure is a 400 before we touch the filesystem.
  let isProjectOwned = false;
  let projectPath: string | null = null;
  let branchName: string | null = null;
  if (typeof projectSlug === 'string' && projectSlug.length > 0) {
    const projectCheck = resolveProjectFolder(projectSlug);
    if (!projectCheck.ok) {
      res.status(400).json({ error: projectCheck.reason });
      return;
    }
    projectPath = projectCheck.resolved;
    // Containment check: the session folder must live under
    // <projectPath>/sessions/. Stops a client from pairing projectSlug A with
    // a sessionFolder pointing into project B's tree — that would land a
    // worktree in A's branch namespace at B's filesystem path, a confusing
    // cross-project state even if `resolveSessionFolder` alone would accept
    // it (both paths live under ~/WorkPal/). Principle #9: UI path == real
    // path == git path; this blocks the mismatch shape.
    const expectedParent = pathResolve(projectPath, 'sessions') + sep;
    if (!workingDir.startsWith(expectedParent)) {
      res.status(400).json({
        error:
          'sessionFolder must live under ~/WorkPal/<projectSlug>/sessions/ / sessionFolder 必须在 ~/WorkPal/<projectSlug>/sessions/ 下',
      });
      return;
    }
    // Branch name = session/<last path segment>. Strip any trailing slash
    // first so `foo/` and `foo` produce the same basename — matches how the
    // frontend's sessionFolder chip renders the path.
    const sessionSlug = basename(workingDir.replace(/\/+$/, ''));
    branchName = `session/${sessionSlug}`;
    if (!SESSION_BRANCH_RE.test(branchName)) {
      res.status(400).json({
        error:
          'sessionFolder slug contains characters not allowed in a git branch name / sessionFolder slug 含有不能用于 git 分支名的字符',
      });
      return;
    }
    isProjectOwned = true;
  }

  // 6.2: cleanup strategy for this request's finally block.
  //   'worktree' → `git worktree remove` + `git branch -D` (project-owned
  //                success path; empty session collapses back to zero
  //                on-disk state without leaving a stray branch behind)
  //   'rmdir'    → plain `rmdir workingDir` (Phase 5 legacy path AND the
  //                project-owned degraded fallback where worktree add threw
  //                and we mkdir'd a plain dir to keep SDK spawn alive)
  let cleanupMode: 'worktree' | 'rmdir' = 'rmdir';

  // 5.4e eager-mkdir constraint carried forward: the SDK spawns child
  // processes with `cwd=workingDir` at request start, and `child_process.spawn`
  // throws ENOENT if cwd doesn't exist (surfaced as a misleading "native
  // binary not found"). Phase 5's compromise was eager mkdir + finally-rmdir.
  // 6.2 continues that compromise, but the eager step is now either a
  // worktree add (project-owned: creates the leaf dir itself) or a plain
  // mkdir (legacy). We can't defer the worktree to the first file-write
  // tool_use the way the lazy principle would want — by the time a
  // tool_use arrives the SDK has already spawned.
  //
  // 5.5 also moves here for the project-owned path: once `worktreeAdd`
  // succeeds we set `gitReady = true` without waiting for a file-write.
  // Legacy stays lazy (no repo until first file-write) so pure Q&A legacy
  // sessions don't leave a `.git/` behind after the finally rmdir.
  let gitReady = false;

  if (isProjectOwned && projectPath && branchName) {
    try {
      // Defensive: catches the race where the user sends a message the same
      // tick NewProjectDialog fired `/project/init` — our POST might not have
      // landed yet. initProjectIfNeeded is idempotent (`.git` probe), so
      // calling it on every project-owned request costs one stat() past the
      // first init.
      await initProjectIfNeeded(projectPath);
      // git worktree add doesn't create intermediate directories, so the
      // <project>/sessions/ parent has to exist. Leaf is left absent —
      // worktree add creates it.
      await mkdir(dirname(workingDir), { recursive: true });
      await worktreeAddIfNeeded(projectPath, workingDir, branchName);
      gitReady = true;
      cleanupMode = 'worktree';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[claude-chat] worktree setup failed for ${workingDir}: ${message}`);
      // Degraded fallback: SDK still needs a valid cwd, so mkdir a plain dir.
      // gitReady stays false → no commits for this request. cleanupMode stays
      // 'rmdir' → finally wipes the plain dir if still empty. We don't pivot
      // to per-session `git init` here — silently swapping project-owned
      // semantics for legacy semantics mid-request would be a surprise, and
      // the Phase 5 precedent was "init failed → no git backup, stream lives".
      try {
        await mkdir(workingDir, { recursive: true });
      } catch (mkErr) {
        const mkMessage = mkErr instanceof Error ? mkErr.message : String(mkErr);
        console.error(`[claude-chat] fallback mkdir failed for ${workingDir}:`, mkMessage);
        res.status(500).json({ error: `Failed to prepare session folder: ${mkMessage}` });
        return;
      }
    }
  } else {
    // Legacy Phase 5 path: plain mkdir, lazy `initIfNeeded` fires later on
    // the first file-write tool_use. Known minor leak preserved — nested
    // paths under a brand-new project would leave intermediate empty dirs
    // after finally rmdir, but 6.2 doesn't introduce that case for legacy
    // (project-owned sessions go through the branch above).
    try {
      await mkdir(workingDir, { recursive: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[claude-chat] mkdir failed for ${workingDir}:`, message);
      res.status(500).json({ error: `Failed to prepare session folder: ${message}` });
      return;
    }
  }

  // True once a file-mutating tool_use lands — gates the finally-block
  // cleanup (false = folder stayed empty = remove worktree or rmdir) and
  // matches the frontend's chip-visibility flag.
  let folderMaterialized = false;

  // 5.5: git auto-commit pipeline. Legacy sessions init lazily on the first
  // file-write; project-owned already set `gitReady=true` in the block above.
  // Pending file-write tool_uses register here so the matching tool_result
  // (which only carries tool_use_id) can decide whether to commit.
  const pendingWrites = new Map<string, { toolName: string; filePath: string }>();

  const sid = sessionId ?? `nosid-${Date.now()}`;
  console.log(`[claude-chat] start session=${sid} cwd=${workingDir}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (chunk: unknown) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  /** Track which requestIds belong to this session so a mid-flight client
   *  disconnect (req close) can drain them with a synthetic deny — otherwise
   *  the SDK would block forever waiting on a Promise that never resolves. */
  const myRequests = new Set<string>();

  const canUseTool: CanUseTool = (toolName, input) => {
    // 6.4: auto-allow web tools without round-tripping to the frontend modal.
    // User's rule: "default to web" — a modal for every WebSearch contradicts
    // the default. Still logged so the activity feed shows what the AI
    // reached for.
    if (AUTO_ALLOW_TOOLS.has(toolName)) {
      console.log(`[claude-chat] auto-allow tool=${toolName}`);
      return Promise.resolve({ behavior: 'allow', updatedInput: input });
    }

    // 6.4: auto-allow file writes. Pin any path that drifts outside cwd back
    // to <cwd>/<basename> — the model writes to ~/foo.html when it should
    // write to <cwd>/foo.html, and the downstream breakage (open-file 400,
    // git commit rejection, card doesn't open) only surfaces after the fact.
    if (FILE_WRITE_TOOLS.has(toolName)) {
      const inputObj = input as Record<string, unknown>;
      const { input: nextInput, pinned } = pinFileWriteInput(toolName, inputObj, workingDir);
      if (pinned) {
        console.log(`[claude-chat] auto-pin ${toolName} → ${(nextInput as Record<string, unknown>).file_path ?? (nextInput as Record<string, unknown>).notebook_path}`);
      } else {
        console.log(`[claude-chat] auto-allow ${toolName} (under cwd)`);
      }
      return Promise.resolve({ behavior: 'allow', updatedInput: nextInput });
    }

    // 6.4 regression: auto-allow Bash for read-only verbs (ls/cat/find/grep
    // etc.). Destructive or network-touching commands (rm/curl/git push/npm)
    // still fall through to the modal. This restores the pre-restriction
    // workflow where the agent explores cwd freely — without Bash, "generate
    // an intro page about WorkPal" has no grounding and the model either
    // hallucinates or gives up.
    if (toolName === 'Bash') {
      const cmd = strField(input as Record<string, unknown>, 'command').trim();
      const firstWord = cmd.split(/\s+/)[0] || cmd;
      if (READ_ONLY_SHELL_VERBS.has(firstWord)) {
        console.log(`[claude-chat] auto-allow Bash verb=${firstWord}`);
        return Promise.resolve({ behavior: 'allow', updatedInput: input });
      }
    }

    const kind = toolToKind(toolName);
    const { target, scope } = deriveTargetScope(kind, toolName, input);
    const requestId = `${sid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<PermissionResult>((resolve) => {
      resolverMap.set(requestId, {
        sessionId: sid,
        decide: (decision) => {
          resolverMap.delete(requestId);
          myRequests.delete(requestId);
          if (decision === 'allow') {
            resolve({ behavior: 'allow', updatedInput: input });
          } else {
            resolve({ behavior: 'deny', message: 'User denied this action' });
          }
        },
      });
      myRequests.add(requestId);

      send({
        type: 'permission_request',
        requestId,
        tool: toolName,
        kind,
        target,
        scope,
        input,
      });
      console.log(`[claude-chat] permission_request id=${requestId} tool=${toolName} kind=${kind}`);
    });
  };

  // Cleanup on client disconnect — synthetic deny so the SDK exits cleanly.
  req.on('close', () => {
    if (myRequests.size === 0) return;
    console.log(`[claude-chat] client closed, draining ${myRequests.size} pending permission(s)`);
    for (const requestId of [...myRequests]) {
      const entry = resolverMap.get(requestId);
      if (entry) entry.decide('deny');
    }
  });

  try {
    // 6.4 regression: let the SDK operate with its default toolset. All
    // permission UX is handled by canUseTool's auto-allow rules below —
    // stripping tools or forcing acceptEdits was what boxed the agent in.
    for await (const msg of runClaudeCode({
      prompt,
      cwd: workingDir,
      sessionId,
      canUseTool,
      appendSystemPrompt: ARTIFACT_PROMPT,
    })) {
      switch (msg.type) {
        case 'system':
          // hook_started / hook_response / init — internal housekeeping.
          break;

        case 'assistant': {
          const blocks = (msg as { message?: { content?: unknown } }).message?.content;
          if (Array.isArray(blocks)) {
            for (const block of blocks) {
              if (
                block &&
                typeof block === 'object' &&
                (block as { type?: unknown }).type === 'text' &&
                typeof (block as { text?: unknown }).text === 'string'
              ) {
                const text = (block as { text: string }).text;
                if (text.length > 0) {
                  send({ type: 'text', content: text });
                }
                continue;
              }
              // tool_use blocks are interleaved with text in the same assistant
              // turn — the model decides "I'll write a file" then emits a
              // tool_use block. Forward them as-is; the frontend maps them to
              // inspector state (Progress / Tools active / Changes).
              const toolUseRaw = shapeToolUse(block);
              // 6.4: pre-pin the file-write input so the tool_use chunk the
              // frontend sees carries the same path the SDK's canUseTool is
              // about to pin. Otherwise the artifact card in chat points at
              // the AI's raw path (often ~/foo.html) while the file lives
              // at <cwd>/foo.html — clicking the card 400s.
              let toolUse = toolUseRaw;
              if (
                toolUseRaw &&
                toolUseRaw.input &&
                typeof toolUseRaw.input === 'object'
              ) {
                const { input: nextInput, pinned } = pinFileWriteInput(
                  toolUseRaw.name,
                  toolUseRaw.input as Record<string, unknown>,
                  workingDir,
                );
                if (pinned) {
                  toolUse = { ...toolUseRaw, input: nextInput };
                  console.log(`[claude-chat] pre-pin tool_use ${toolUseRaw.name}`);
                }
              }
              if (toolUse) {
                const isFileWrite = FILE_WRITE_TOOLS.has(toolUse.name);
                // 5.4e: flag this request as having touched files so the
                // finally block below won't rmdir the session folder. Folder
                // is already on disk (eager mkdir up front); this is purely
                // a cleanup-gate. Frontend also flips its chat.folderMaterialized
                // on the same chunk to reveal the folder chip.
                if (!folderMaterialized && isFileWrite) {
                  folderMaterialized = true;
                  console.log(`[claude-chat] folder used by ${toolUse.name}`);
                }
                // 5.5: lazy `git init` on the first file-write tool_use —
                // legacy (no projectSlug) path only. Project-owned requests
                // pre-init via the worktree add block at request start, so
                // `gitReady` is already true by the time any tool_use lands;
                // 6.2 deliberately does NOT fall back to per-session init for
                // project-owned requests whose worktree add failed (see the
                // request-start block's "degraded fallback" comment).
                // `git init` is idempotent at this layer (initIfNeeded checks
                // for .git first) so running it on every file-write would be
                // safe, but gating on gitReady saves a disk access per tool.
                // A failure here degrades to "no git backup for this request":
                // log, leave gitReady=false, let the SDK stream keep running.
                if (isFileWrite && !gitReady && !isProjectOwned) {
                  try {
                    await initIfNeeded(workingDir);
                    gitReady = true;
                  } catch (err) {
                    const m = err instanceof Error ? err.message : String(err);
                    console.error(`[claude-chat] git init failed: ${m}`);
                  }
                }
                // Register write inputs so the matching tool_result (which
                // carries only tool_use_id) can decide whether to commit.
                // Only file-write tools enter this map — Read/Bash/etc. never
                // trigger a commit even on success. If neither file_path nor
                // notebook_path is set (shouldn't happen for a well-formed
                // SDK tool_use, but defensive), we skip registration: better
                // to miss a commit than to stage an empty path.
                if (isFileWrite && gitReady) {
                  const inp = (toolUse.input && typeof toolUse.input === 'object'
                    ? toolUse.input as Record<string, unknown>
                    : {});
                  const filePath = strField(inp, 'file_path')
                    || strField(inp, 'notebook_path');
                  if (filePath) {
                    pendingWrites.set(toolUse.id, { toolName: toolUse.name, filePath });
                  }
                }
                send({ type: 'tool_use', ...toolUse });
                console.log(`[claude-chat] tool_use name=${toolUse.name}`);
              }
            }
          }
          console.log('[claude-chat] assistant');
          break;
        }

        case 'user': {
          // tool_result blocks ride on user messages (the SDK replays them
          // to us as synthetic user turns). Forward each one so the frontend
          // can flip the matching Progress step from active → completed.
          const blocks = (msg as { message?: { content?: unknown } }).message?.content;
          if (Array.isArray(blocks)) {
            for (const block of blocks) {
              const result = shapeToolResult(block);
              if (!result) continue;

              // Order matters: send tool_result FIRST so the frontend's Change
              // entry exists before we emit the commit chunk that updates it.
              // Flipping this order would make the commit chunk arrive for a
              // non-existent entry and silently drop.
              send({ type: 'tool_result', ...result });
              console.log(
                `[claude-chat] tool_result ${result.isError ? 'err' : 'ok'}`,
              );

              // 5.5: auto-commit the disk state after a successful file-write.
              // Failed writes (isError=true) stay out of the undo stack — they
              // correspond to Claude's wrong-path retries which would otherwise
              // leave phantom undoable entries in the UI.
              const pending = pendingWrites.get(result.toolUseId);
              if (pending && !result.isError && gitReady) {
                pendingWrites.delete(result.toolUseId);
                try {
                  const committed = await commitAfterTool(workingDir, {
                    sessionId: sid,
                    toolName: pending.toolName,
                    filePath: pending.filePath,
                  });
                  if (committed) {
                    send({ type: 'commit', toolUseId: result.toolUseId, commit: committed.commit });
                    console.log(`[claude-chat] commit ${committed.commit.slice(0, 7)} (${pending.toolName})`);
                  } else {
                    // commitAfterTool returned null → the targeted add staged
                    // no diff (e.g. Edit with identical contents). Skip the
                    // commit chunk so the frontend entry stays without an
                    // Undo affordance rather than lighting up a button that
                    // would silently no-op on click.
                    console.log(`[claude-chat] commit skipped (no diff) ${pending.toolName} ${pending.filePath}`);
                  }
                } catch (err) {
                  const m = err instanceof Error ? err.message : String(err);
                  console.error(`[claude-chat] commit failed: ${m}`);
                  // Degrade silently: the user's file is already on disk and
                  // the change entry is already in the UI — we just can't
                  // back it with a commit, so Undo won't light up. Surfacing
                  // this to the user would be noise; the server log is enough.
                }
              } else if (pending && result.isError) {
                // Clean up the pending entry so a future tool_use reusing the
                // same id (shouldn't happen, but defensive) doesn't commit
                // against a stale registration.
                pendingWrites.delete(result.toolUseId);
              }
            }
          }
          break;
        }

        case 'result': {
          const r = msg as { usage?: unknown; total_cost_usd?: unknown };
          send({ type: 'claude_done', usage: r.usage, cost: r.total_cost_usd });
          console.log('[claude-chat] result');
          break;
        }

        default:
          // Unknown event — log type only, don't dump payload.
          console.log(`[claude-chat] skip type=${(msg as { type?: string }).type ?? 'unknown'}`);
      }
    }
    console.log('[claude-chat] done');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[claude-chat] error:', message);
    send({ type: 'error', content: message });
  } finally {
    // 5.4e: "pure Q&A leaves disk clean" — if no file-mutating tool_use arrived,
    // the folder is still empty. Branch on cleanup mode:
    //   'worktree' → remove the worktree + delete the empty session branch so
    //               the project's branch list doesn't accumulate dead entries
    //               for Q&A sessions. worktreeRemoveIfEmpty is best-effort
    //               and swallows non-fatal errors (same policy as rmdir below).
    //   'rmdir'   → Phase 5 path. rmdir throws ENOTEMPTY for folders Claude
    //               actually wrote into (race on folderMaterialized), so user
    //               data can't be accidentally deleted here — the folder is
    //               preserved whenever it holds any content.
    if (!folderMaterialized) {
      if (cleanupMode === 'worktree' && projectPath && branchName) {
        await worktreeRemoveIfEmpty(projectPath, workingDir, branchName);
        console.log(`[claude-chat] worktree removed ${workingDir} (branch ${branchName})`);
      } else {
        try {
          await rmdir(workingDir);
          console.log(`[claude-chat] rmdir clean ${workingDir}`);
        } catch (err) {
          const e = err as NodeJS.ErrnoException;
          if (e.code !== 'ENOTEMPTY' && e.code !== 'ENOENT') {
            console.warn(`[claude-chat] rmdir ${workingDir} failed: ${e.message}`);
          }
        }
      }
    }
    res.end();
  }
});

// 5.4d: frontend POSTs the user's modal decision here. Looks up the resolver
// the canUseTool callback parked, validates the sessionId (defense-in-depth
// against a misrouted/forged POST), and unblocks the SDK with allow or deny.
router.post('/claude-chat/permission/:requestId', (req, res) => {
  const { requestId } = req.params;
  const { decision, sessionId } = req.body as {
    decision?: 'allow' | 'deny';
    sessionId?: string;
  };

  if (decision !== 'allow' && decision !== 'deny') {
    res.status(400).json({ error: 'decision must be "allow" or "deny"' });
    return;
  }

  const entry = resolverMap.get(requestId);
  if (!entry) {
    res.status(404).json({ error: 'unknown or already-resolved requestId' });
    return;
  }
  if (sessionId && sessionId !== entry.sessionId) {
    res.status(403).json({ error: 'sessionId mismatch' });
    return;
  }

  entry.decide(decision);
  console.log(`[claude-chat] permission resolved id=${requestId} decision=${decision}`);
  res.json({ ok: true });
});

// 5.4e: open the session folder in Finder. The body's sessionFolder is
// validated through the same resolveSessionFolder() used for the chat route,
// so a malformed or escaping path is rejected before we touch the OS. Darwin-
// only (WorkPal is a mac desktop prototype); other platforms respond 501 so
// a misconfigured client gets a clear signal instead of silent failure.
router.post('/claude-chat/open-folder', (req, res) => {
  const { sessionFolder } = req.body as { sessionFolder?: string };
  const folderCheck = resolveSessionFolder(sessionFolder);
  if (!folderCheck.ok) {
    res.status(400).json({ error: folderCheck.reason });
    return;
  }
  if (process.platform !== 'darwin') {
    res.status(501).json({ error: 'open-folder is only wired for darwin' });
    return;
  }
  try {
    // `open <path>` on macOS reveals the folder in Finder. detached + unref so
    // the request can return without keeping the child bound to the server
    // process; stdio ignored so Finder's own output (if any) doesn't leak.
    const child = spawn('open', [folderCheck.resolved], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    child.on('error', (err) => {
      console.error('[claude-chat] open-folder spawn error:', err.message);
    });
    console.log(`[claude-chat] open-folder ${folderCheck.resolved}`);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[claude-chat] open-folder failed:', message);
    res.status(500).json({ error: message });
  }
});

// Open a single generated file (e.g. claude-intro.html) in its default app.
// The frontend's ArtifactCard click in chat routes here. Same WORKPAL_ROOT
// jailing as open-folder — a crafted filePath that resolves outside the root
// is rejected before any spawn. Darwin-only: `open <file>` delegates to the
// registered default app, so .html → default browser, .png → Preview, etc.
router.post('/claude-chat/open-file', async (req, res) => {
  const { filePath } = req.body as { filePath?: string };
  // resolveSessionFolder is misnamed for this path, but the logic is
  // identical: resolve to absolute, then require it to sit under
  // WORKPAL_ROOT. Re-using it keeps one jailing rule instead of two.
  const pathCheck = resolveSessionFolder(filePath);
  if (!pathCheck.ok) {
    res.status(400).json({ error: pathCheck.reason });
    return;
  }
  if (process.platform !== 'darwin') {
    res.status(501).json({ error: 'open-file is only wired for darwin' });
    return;
  }
  try {
    // A file the user clicks on should exist — if it doesn't (e.g. the chat
    // was restored from localStorage but the artifact got deleted), fail with
    // a clear 404 rather than spawning `open` on a missing path (which pops a
    // confusing "The item can't be found" system dialog).
    await access(pathCheck.resolved);
  } catch {
    res.status(404).json({ error: 'file not found / 文件不存在' });
    return;
  }
  try {
    const child = spawn('open', [pathCheck.resolved], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    child.on('error', (err) => {
      console.error('[claude-chat] open-file spawn error:', err.message);
    });
    console.log(`[claude-chat] open-file ${pathCheck.resolved}`);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[claude-chat] open-file failed:', message);
    res.status(500).json({ error: message });
  }
});

// 6.4: read an artifact file for inline preview in the WorkPal DetailPanel.
// Same WORKPAL_ROOT jail as open-file — the frontend wires ArtifactCard clicks
// to this endpoint instead of spawning `open`, so the user sees the file
// content inside the app instead of a new browser/editor window. 10 MB cap
// keeps a misclick on a huge file from blocking the event loop.
router.post('/claude-chat/read-file', async (req, res) => {
  const { filePath } = req.body as { filePath?: string };
  const pathCheck = resolveSessionFolder(filePath);
  if (!pathCheck.ok) {
    res.status(400).json({ error: pathCheck.reason });
    return;
  }
  try {
    const { readFile, stat } = await import('node:fs/promises');
    const stats = await stat(pathCheck.resolved);
    if (!stats.isFile()) {
      res.status(400).json({ error: 'path is not a file / 路径不是文件' });
      return;
    }
    if (stats.size > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'file too large for inline preview (>10 MB) / 文件过大无法预览' });
      return;
    }
    const content = await readFile(pathCheck.resolved, 'utf8');
    res.json({ content, size: stats.size });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      res.status(404).json({ error: 'file not found / 文件不存在' });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[claude-chat] read-file failed:', message);
    res.status(500).json({ error: message });
  }
});

// 5.5: undo the most recent auto-commit in a session's folder. Body carries
// `changeId` only for server-side logging — the server blindly rolls HEAD
// back one commit. The frontend enforces LIFO visibility so only the latest
// committed Change entry has an Undo button, which keeps this endpoint
// idempotent per click without needing per-entry commit tracking on the
// server. Reuses `resolveSessionFolder` so a malformed path is rejected the
// same way it would be on the chat route.
router.post('/claude-chat/undo', async (req, res) => {
  const { sessionFolder, changeId } = req.body as {
    sessionFolder?: string;
    changeId?: string;
  };
  const folderCheck = resolveSessionFolder(sessionFolder);
  if (!folderCheck.ok) {
    res.status(400).json({ error: folderCheck.reason });
    return;
  }
  try {
    const { commit } = await undoLastCommit(folderCheck.resolved);
    console.log(
      `[claude-chat] undo change=${changeId ?? '?'} → ${commit.slice(0, 7)}`,
    );
    res.json({ ok: true, commit });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // `git reset HEAD~1` on a repo with no parent, or on a folder with no
    // `.git` at all, produces a clear stderr that distinguishes "nothing to
    // undo" (409) from a real failure (500). Matching on the message text
    // is brittle but git's phrasing here has been stable across versions.
    const nothingToUndo =
      /unknown revision|ambiguous argument|Not a git repository/i.test(message);
    console.error(`[claude-chat] undo failed: ${message}`);
    res
      .status(nothingToUndo ? 409 : 500)
      .json({ error: message });
  }
});

export default router;
