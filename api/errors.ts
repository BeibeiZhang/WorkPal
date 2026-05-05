import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  insertError,
  summarizeUnreviewed,
  ValidationError,
  type ErrorPayload,
} from './_lib/error-log-store.js';
import { checkPassword } from './_lib/chat-store.js';

/** §58 — consolidated handler for the error_log resource. Two routes share
 *  one function (Hobby-plan consolidation, same as api/chats.ts /
 *  api/memories.ts):
 *
 *    POST /api/log-error      → endpoint=log     (anonymous, public write)
 *    GET  /api/error-summary  → endpoint=summary (password-gated read)
 *
 *  Sub-paths are routed by vercel.json rewrites; the frontend keeps calling
 *  the human-readable URLs and never sees the dispatch param. Anonymous
 *  POST is intentional: production users (HR / friends visiting
 *  workpal-beibei.vercel.app) don't have a memory password, but their
 *  crashes still need to surface in Beibei's "Needs Your Eyes". The GET
 *  side is gated because stack traces can leak code paths.
 *
 *  Defense layers, in order: (1) the frontend short-circuits on IS_DEMO and
 *  truncates stacks to 8KB before sending, (2) error-log-store.ts re-truncates
 *  + whitelists the source field server-side, (3) Vercel's request body cap
 *  (~4.5MB) bounds extreme payloads.
 *
 *  Fail-quiet on insert: error logging that itself errors must not cascade
 *  (would mask the real bug being reported, and the unhandledrejection
 *  listener could re-fire on the failed fetch). */

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const endpoint = strParam(req.query.endpoint);

    // POST /api/log-error → endpoint=log
    if (endpoint === 'log') {
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
        // logger doesn't loop on a 500 (which itself would queue another
        // unhandledrejection if the .catch path is somehow bypassed).
        console.warn('/api/log-error insert failed', err);
        res.status(200).json({ ok: true });
      }
      return;
    }

    // GET /api/error-summary → endpoint=summary
    if (endpoint === 'summary') {
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

    res.status(404).json({ error: 'Unknown endpoint' });
  } catch (err) {
    console.error('/api/errors failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
