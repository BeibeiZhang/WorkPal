import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  loadStatusMap,
  setStatus,
  bulkUpsertIfMissing,
  checkPassword,
  type VideoStatus,
  type StatusMap,
} from './_lib/agent-video-status-store.js';

/** Handles /api/agent-videos. One Vercel function so we stay under the
 *  Hobby-plan 12-fn cap. Sub-paths via vercel.json:
 *    GET    /api/agent-videos                 → status map (NO auth)
 *    PUT    /api/agent-videos                 → upsert one row (auth)
 *    POST   /api/agent-videos/bulk-upsert     → first-load migration (auth)
 *
 *  GET is intentionally unauthenticated so the demo deployment
 *  (workpal.vercel.app) can fetch the published map cross-origin from
 *  workpal-beibei.vercel.app — the whole point of this endpoint is making
 *  Beibei's curated pool visible to demo visitors. CORS allows the demo
 *  origin specifically (no wildcard, no credentials). */

const ALLOWED_ORIGINS = new Set([
  'https://my-workpal.vercel.app',
  // Vercel preview/branch deploys for the demo project — pattern matched below.
]);

const STATUS_VALUES: ReadonlySet<VideoStatus> = new Set(['active', 'inactive', 'deleted']);

function isAllowedOrigin(origin: string | undefined): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Vercel preview deploys for the demo project look like
  // my-workpal-<hash>-<scope>.vercel.app
  return /^https:\/\/my-workpal-[a-z0-9-]+\.vercel\.app$/.test(origin);
}

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const endpoint = strParam(req.query.endpoint);

    // POST /api/agent-videos/bulk-upsert — one-shot migration from a fresh
    // browser's localStorage. Auth required.
    if (endpoint === 'bulk-upsert') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      if (!checkPassword(req, res)) return;
      const body = req.body as { map?: StatusMap };
      if (!body?.map || typeof body.map !== 'object') {
        res.status(400).json({ error: 'Missing map' });
        return;
      }
      for (const [src, status] of Object.entries(body.map)) {
        if (typeof src !== 'string' || !STATUS_VALUES.has(status as VideoStatus)) {
          res.status(400).json({ error: `Invalid entry: ${src}` });
          return;
        }
      }
      const inserted = await bulkUpsertIfMissing(body.map);
      res.json({ inserted });
      return;
    }

    if (req.method === 'GET') {
      const map = await loadStatusMap();
      res.json({ map });
      return;
    }

    if (req.method === 'PUT') {
      if (!checkPassword(req, res)) return;
      const body = req.body as { src?: string; status?: VideoStatus };
      if (!body?.src || typeof body.src !== 'string') {
        res.status(400).json({ error: 'Missing src' });
        return;
      }
      if (!body.status || !STATUS_VALUES.has(body.status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      await setStatus(body.src, body.status);
      res.json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/agent-videos failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
