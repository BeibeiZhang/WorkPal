import { Router } from 'express';
import { mkdir } from 'node:fs/promises';
import { runClaudeCode } from '../lib/claudeCode.js';

const router = Router();

// 5.4b cwd sandbox — real sessionFolder lands in 5.4e.
const SANDBOX_CWD = '/tmp/workpal-sandbox';

// POST /api/claude-chat — SSE stream of Claude Agent SDK events.
//
// Filter rules (Phase 5.4 shared decisions):
//   system.*       → drop (hook_started / hook_response / init noise)
//   assistant      → forward text blocks as { type:'text', content }
//   result         → forward as { type:'claude_done', usage, cost }
//   user (tools)   → TODO(5.4c) — tool_use / tool_result mapping
//   errors         → forward as { type:'error', content }
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

  // 5.4b: always sandbox. sessionFolder is accepted in the body so the client
  // API is stable across 5.4b–5.4e, but we ignore it here. 5.4e switches cwd
  // to the real Chat.sessionFolder and adds lazy mkdir on first Write/Edit.
  void sessionFolder;

  const workingDir = SANDBOX_CWD;
  await mkdir(workingDir, { recursive: true });

  console.log(`[claude-chat] start session=${sessionId ?? '-'} cwd=${workingDir}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (chunk: unknown) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  try {
    for await (const msg of runClaudeCode({ prompt, cwd: workingDir, sessionId })) {
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
              }
              // tool_use blocks live here too — TODO(5.4c) forward them.
            }
          }
          console.log('[claude-chat] assistant');
          break;
        }

        case 'user':
          // tool_result blocks ride on user messages. TODO(5.4c) surface them
          // to the inspector. 5.4b: text-only, so drop.
          break;

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

export default router;
