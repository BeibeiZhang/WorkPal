import { Router } from 'express';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve as pathResolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { runClaudeCode, shapeToolUse, shapeToolResult } from '../lib/claudeCode.js';

const router = Router();

/** 5.4e: real session folders live under ~/WorkPal/. Any resolved path must
 *  stay inside this root — both to prevent a malformed sessionFolder from
 *  writing elsewhere on disk, and to keep `open-folder` from spawning Finder
 *  outside the app's sandbox. */
const WORKPAL_ROOT = pathResolve(homedir(), 'WorkPal');

/** Expand a user-supplied sessionFolder to an absolute path inside WORKPAL_ROOT.
 *  Returns { ok: false, reason } if the input is missing, not a string, or
 *  escapes the root (e.g. via `..` or an absolute path outside ~/WorkPal/). */
function resolveSessionFolder(
  folder: unknown,
): { ok: true; resolved: string } | { ok: false; reason: string } {
  if (typeof folder !== 'string' || folder.length === 0) {
    return { ok: false, reason: 'sessionFolder is required' };
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
    return { ok: false, reason: 'sessionFolder must be under ~/WorkPal/' };
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
  const { prompt, sessionId, sessionFolder } = req.body as {
    prompt?: string;
    sessionId?: string;
    sessionFolder?: string;
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

  // 5.4e: mkdir is deferred until the first file-mutating tool_use below —
  // pure Q&A sessions must leave disk untouched. `folderMaterialized` gates
  // the one-time mkdir per request so we don't hammer the fs on every write.
  let folderMaterialized = false;

  const sid = sessionId ?? `nosid-${Date.now()}`;
  console.log(`[claude-chat] start session=${sid} cwd=${workingDir} (lazy mkdir)`);

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
                // 5.4e: materialize the session folder on first file-mutating
                // tool_use. await before the SSE send so the directory exists
                // by the time the frontend flips folderMaterialized=true and
                // before the SDK actually runs the Write (which happens after
                // canUseTool resolves allow).
                if (!folderMaterialized && FILE_WRITE_TOOLS.has(toolUse.name)) {
                  await mkdir(workingDir, { recursive: true });
                  folderMaterialized = true;
                  console.log(`[claude-chat] materialized folder ${workingDir}`);
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
              if (result) {
                send({ type: 'tool_result', ...result });
                console.log(
                  `[claude-chat] tool_result ${result.isError ? 'err' : 'ok'}`,
                );
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

export default router;
