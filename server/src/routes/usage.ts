import { Router } from 'express';
import { logUsage, summarize, type Capability, type Provider, type Source } from '../lib/usageLog.js';

const router = Router();

const ALLOWED_RANGES = new Set([1, 7, 30]);
const ALLOWED_PROVIDERS: Provider[] = ['openai', 'anthropic', 'tavily'];
const ALLOWED_CAPABILITIES: Capability[] = ['chat', 'voice', 'web_query', 'agent', 'other'];
const ALLOWED_SOURCES: Source[] = ['localhost', 'workpal-beibei', 'my-workpal', 'unknown'];

// GET /api/usage?range=1|7|30
router.get('/usage', async (req, res) => {
  const raw = Number(req.query.range ?? 30);
  const range = ALLOWED_RANGES.has(raw) ? raw : 30;
  try {
    const summary = await summarize(range);
    res.json(summary);
  } catch (err) {
    console.error('[/api/usage] failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/usage/log — client-computed usage (Realtime voice, etc. where the
// cost math lives on the browser because the OpenAI event ships the token
// breakdown over WebRTC, never through our server).
router.post('/usage/log', async (req, res) => {
  const body = req.body as {
    provider?: string;
    model?: string;
    capability?: string;
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
    cost_usd?: number;
    images_count?: number;
    source?: string;
  };
  if (!body.provider || !ALLOWED_PROVIDERS.includes(body.provider as Provider)) {
    res.status(400).json({ error: 'invalid provider' });
    return;
  }
  if (!body.model || typeof body.model !== 'string') {
    res.status(400).json({ error: 'model is required' });
    return;
  }
  if (typeof body.cost_usd !== 'number' || !Number.isFinite(body.cost_usd) || body.cost_usd < 0) {
    res.status(400).json({ error: 'cost_usd must be a non-negative number' });
    return;
  }
  try {
    const capability = body.capability && ALLOWED_CAPABILITIES.includes(body.capability as Capability)
      ? (body.capability as Capability)
      : undefined;
    const source = body.source && ALLOWED_SOURCES.includes(body.source as Source)
      ? (body.source as Source)
      : undefined;
    await logUsage({
      provider: body.provider as Provider,
      model: body.model,
      capability,
      input_tokens: Number(body.input_tokens) || 0,
      output_tokens: Number(body.output_tokens) || 0,
      images_count: typeof body.images_count === 'number' ? body.images_count : undefined,
      cache_read_tokens: typeof body.cache_read_tokens === 'number' ? body.cache_read_tokens : undefined,
      cache_write_tokens: typeof body.cache_write_tokens === 'number' ? body.cache_write_tokens : undefined,
      cost_usd: body.cost_usd,
      source,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/usage/log] failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
