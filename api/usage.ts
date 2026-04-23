import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  logUsage,
  summarize,
  type Capability,
  type Provider,
} from './_lib/usage-store.js';

/** Routes:
 *    GET  /api/usage?range=1|7|30      → aggregated UsageSummary for the
 *                                         Overview "API Spend" card.
 *    POST /api/usage/log               → client-computed entry (Realtime
 *                                         voice ships the token breakdown
 *                                         over WebRTC, never through us, so
 *                                         the browser is the only place that
 *                                         can price those turns).
 *
 *  vercel.json rewrites /api/usage/log to /api/usage?endpoint=log so this
 *  single function covers both paths and we stay under the Hobby-plan
 *  12-function cap.
 *
 *  No password gate here: the numbers aren't secret, and the Overview page
 *  needs to load without the memory password dialog. workpal-beibei.vercel
 *  .app is already private-by-obscurity at the URL level. */

const ALLOWED_RANGES = new Set([1, 7, 30]);
const ALLOWED_PROVIDERS: Provider[] = ['openai', 'anthropic', 'tavily'];
const ALLOWED_CAPABILITIES: Capability[] = ['chat', 'voice', 'web_query', 'agent', 'other'];

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const endpoint = strParam(req.query.endpoint);

    if (endpoint === 'log') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const body = (req.body ?? {}) as {
        provider?: string;
        model?: string;
        capability?: string;
        input_tokens?: number;
        output_tokens?: number;
        cache_read_tokens?: number;
        cache_write_tokens?: number;
        cost_usd?: number;
        images_count?: number;
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
      const capability = body.capability && ALLOWED_CAPABILITIES.includes(body.capability as Capability)
        ? (body.capability as Capability)
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
      });
      res.json({ ok: true });
      return;
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const raw = Number(req.query.range ?? 30);
    const range = ALLOWED_RANGES.has(raw) ? raw : 30;
    const summary = await summarize(range);
    res.json(summary);
  } catch (err) {
    console.error('[/api/usage] failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
