import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getChat,
  upsertChat,
  deleteChat,
  checkPassword,
  type ChatRecord,
} from '../_lib/chat-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = String(req.query.id ?? '');
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    if (req.method === 'GET') {
      if (!checkPassword(req, res)) return;
      const chat = await getChat(id);
      if (!chat) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ chat });
      return;
    }

    if (req.method === 'PUT') {
      if (!checkPassword(req, res)) return;
      const incoming = req.body as ChatRecord;
      // Allow either route id or body id to win — they should match, but the
      // route is canonical so client errors don't silently retarget.
      const saved = await upsertChat({ ...incoming, id });
      res.json({ chat: saved });
      return;
    }

    if (req.method === 'DELETE') {
      if (!checkPassword(req, res)) return;
      const ok = await deleteChat(id);
      if (!ok) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/chats/[id] failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
