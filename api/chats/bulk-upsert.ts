import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  bulkUpsertChats,
  checkPassword,
  type ChatRecord,
} from '../_lib/chat-store.js';

/** Migration endpoint — used once per device when its localStorage chats
 *  haven't been synced yet. `ignoreDuplicates: true` semantics live in the
 *  store: existing rows are left alone (source of truth wins), only new
 *  ids are inserted. Subsequent normal flushes from this device update via
 *  PUT /api/chats/[id]. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    if (!checkPassword(req, res)) return;
    const body = req.body as { chats?: ChatRecord[] };
    if (!Array.isArray(body?.chats)) {
      res.status(400).json({ error: 'Missing chats[]' });
      return;
    }
    const inserted = await bulkUpsertChats(body.chats);
    res.json({ inserted });
  } catch (err) {
    console.error('/api/chats/bulk-upsert failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
