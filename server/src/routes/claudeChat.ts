import { Router } from 'express';
import { mkdir, rmdir } from 'node:fs/promises';
import { basename, dirname, resolve as pathResolve, sep } from 'node:path';
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
    if (cmd) return { target: cmd, scope: cmd };
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
router.post('/claude-chat', async (req, res) => {
  const { prompt, sessionId, sessionFolder, projectSlug } = req.body as {
    prompt?: string;
    sessionId?: string;
    sessionFolder?: string;
    projectSlug?: string;
    messages?: unknown;
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
    for await (const msg of runClaudeCode({ prompt, cwd: workingDir, sessionId, canUseTool })) {
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
              const toolUse = shapeToolUse(block);
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
