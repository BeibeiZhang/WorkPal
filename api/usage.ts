import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  logUsage,
  summarize,
  type Capability,
  type Provider,
  type Source,
} from './_lib/usage-store.js';
import {
  insertError,
  markReviewedByMsg,
  summarizeUnreviewed,
  ValidationError,
  type ErrorPayload,
} from './_lib/error-log-store.js';
import { checkPassword } from './_lib/chat-store.js';

/** Routes:
 *    GET  /api/usage?range=1|7|30      → aggregated UsageSummary for the
 *                                         Overview "API Spend" card.
 *    POST /api/usage/log               → client-computed entry (Realtime
 *                                         voice ships the token breakdown
 *                                         over WebRTC, never through us, so
 *                                         the browser is the only place that
 *                                         can price those turns).
 *    POST  /api/log-error              → §58 anonymous error capture
 *    GET   /api/error-summary          → §58 password-gated dedup top-20
 *    PATCH /api/errors                 → §59 password-gated mark-reviewed
 *
 *  vercel.json rewrites map the human-readable URLs to ?endpoint=… params
 *  so this single function covers all five paths and we stay under the
 *  Hobby-plan 12-function cap. The two telemetry domains (usage + errors)
 *  are co-located here because they share the same wire pattern (anonymous
 *  POST + GET-with-summary) and live next to each other on the Overview
 *  page; the Supabase tables remain separate.
 *
 *  No password gate on /api/usage GET: the spend numbers aren't secret, and
 *  the Overview page needs to load without the memory password dialog.
 *  /api/error-summary IS gated because stack traces can leak code paths. */

const ALLOWED_RANGES = new Set([1, 7, 30]);
const ALLOWED_PROVIDERS: Provider[] = ['openai', 'anthropic', 'tavily'];
const ALLOWED_CAPABILITIES: Capability[] = ['chat', 'voice', 'web_query', 'agent', 'other'];
const ALLOWED_SOURCES: Source[] = ['localhost', 'workpal-beibei', 'my-workpal', 'unknown'];

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const endpoint = strParam(req.query.endpoint);

    // POST /api/log-error → endpoint=log-error  (anonymous, public write)
    // Fail-quiet on insert: error logging that itself errors must not cascade
    // (would mask the real bug being reported, and the unhandledrejection
    // listener could re-fire on the failed fetch).
    if (endpoint === 'log-error') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const payload = req.body as ErrorPayload | undefined;
      if (!payload || typeof payload !== 'object') {
        res.status(400).json({ error: 'Body must be JSON object' });
        return;
      }
      try {
        await insertError(payload);
        res.status(200).json({ ok: true });
      } catch (err) {
        if (err instanceof ValidationError) {
          res.status(400).json({ error: err.message });
          return;
        }
        // Unexpected — log server-side and still return 200 so the client's
        // logger doesn't loop on a 500.
        console.warn('/api/log-error insert failed', err);
        res.status(200).json({ ok: true });
      }
      return;
    }

    // GET /api/error-summary → endpoint=error-summary  (password-gated read)
    if (endpoint === 'error-summary') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      if (!checkPassword(req, res)) return;
      const items = await summarizeUnreviewed();
      res.status(200).json({ items });
      return;
    }

    // PATCH /api/errors → endpoint=mark-error-reviewed  (password-gated write)
    // markReviewedByMsg collapses stale-id / multi-tab-race / RLS-denied
    // into marked=0 — the helper + UI treat that as success (entry is gone
    // in DB either way), so no separate 404 branch here.
    if (endpoint === 'mark-error-reviewed') {
      if (req.method !== 'PATCH') {
        res.setHeader('Allow', 'PATCH');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      if (!checkPassword(req, res)) return;
      const body = req.body as { sample_id?: unknown } | undefined;
      if (!body || typeof body.sample_id !== 'string' || !body.sample_id) {
        res.status(400).json({ error: 'sample_id required' });
        return;
      }
      const { marked } = await markReviewedByMsg(body.sample_id);
      res.status(200).json({ ok: true, marked });
      return;
    }

    // POST /api/usage/log → endpoint=log  (existing usage write)
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
      return;
    }

    // GET /api/usage?range=… (default summary)
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
