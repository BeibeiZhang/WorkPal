import type { VercelRequest, VercelResponse } from '@vercel/node';
import { summarizeUnreviewed } from './_lib/error-log-store.js';
import { checkPassword } from './_lib/chat-store.js';

/** §58 — password-gated GET endpoint that powers OverviewPage NYE. Same
 *  x-memory-password gate the rest of the read-sensitive endpoints use
 *  (chat-store.checkPassword) — stack traces can leak code paths and file
 *  layout, so even though writes are public this read is not. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!checkPassword(req, res)) return;

  try {
    const items = await summarizeUnreviewed();
    res.status(200).json({ items });
  } catch (err) {
    console.error('/api/error-summary failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
