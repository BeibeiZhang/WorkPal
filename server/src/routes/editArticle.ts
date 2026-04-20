import { Router } from 'express';
import { streamEditArticle, isEditPreset } from '../lib/editArticle.js';

const router = Router();

// POST /api/edit-article — rewrite an article per a preset instruction, streamed via SSE.
// Body: { articleText: string, preset: 'shorter'|'extend'|'formal'|'translate' }
router.post('/edit-article', async (req, res) => {
  const { articleText, preset } = req.body as {
    articleText?: unknown;
    preset?: unknown;
  };

  if (typeof articleText !== 'string' || articleText.trim().length === 0) {
    res.status(400).json({ error: 'articleText (non-empty string) is required' });
    return;
  }
  if (!isEditPreset(preset)) {
    res.status(400).json({ error: 'preset must be one of: shorter, extend, formal, translate' });
    return;
  }

  // Cap the input so a runaway paste can't blow the context window + cost.
  // 20k chars ≈ ~5k tokens, well under gpt-4o-mini's 128k limit but a clear
  // user-visible error is better than a silent OpenAI 400.
  if (articleText.length > 20000) {
    res.status(400).json({ error: 'articleText exceeds 20000 characters' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Abort the OpenAI stream the moment the browser goes away (user clicked
  // Cancel or closed the panel). `res.on('close')` fires on writer-side
  // disconnect; `req.on('close')` would fire as soon as the request body is
  // fully received, which is immediately for a small JSON POST and would
  // abort every request before any text is produced.
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    for await (const chunk of streamEditArticle(articleText, preset, controller.signal)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  } catch {
    res.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream failed' })}\n\n`);
  }

  res.end();
});

export default router;
