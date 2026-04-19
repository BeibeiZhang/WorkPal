import { Router } from 'express';
import { mkdir } from 'node:fs/promises';
import { runClaudeCode } from '../lib/claudeCode.js';

const router = Router();

// POST /api/claude-chat — 5.4a: drain SDK stream to server console, return counts.
// SSE forwarding, tool-event mapping, permission wiring, and real session folders
// arrive in 5.4b → 5.4e.
router.post('/claude-chat', async (req, res) => {
  const { prompt, cwd, sessionId } = req.body as {
    prompt?: string;
    cwd?: string;
    sessionId?: string;
  };

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  const workingDir = cwd || '/tmp/workpal-5.4a';
  await mkdir(workingDir, { recursive: true });

  console.log(`[claude-chat] prompt="${prompt}" cwd=${workingDir}`);

  try {
    let count = 0;
    for await (const msg of runClaudeCode({ prompt, cwd: workingDir, sessionId })) {
      count += 1;
      console.log(
        `[claude-chat] #${count} type=${msg.type}`,
        JSON.stringify(msg).slice(0, 400),
      );
    }
    console.log(`[claude-chat] done (${count} events)`);
    res.json({ ok: true, events: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[claude-chat] error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
