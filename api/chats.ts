import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listChatMetadata,
  getChat,
  upsertChat,
  deleteChat,
  bulkUpsertChats,
  checkPassword,
  type ChatRecord,
} from './_lib/chat-store.js';

/** Handles all /api/chats* routes in one function to fit under Vercel's
 *  Hobby-plan 12-function limit. Sub-paths are routed here by rewrites in
 *  vercel.json:
 *    /api/chats                       → list metadata (GET) | upsert (POST)
 *    /api/chats/bulk-upsert           → POST endpoint=bulk-upsert
 *    /api/chats/:id                   → GET | PUT | DELETE with id=:id
 *
 *  Same auth model as the per-file routes: every method requires
 *  x-memory-password (chat content is more sensitive than memory metadata,
 *  so unlike memories we gate GET too). */

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = strParam(req.query.id);
    const endpoint = strParam(req.query.endpoint);

    // POST /api/chats/bulk-upsert
    if (endpoint === 'bulk-upsert') {
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
      return;
    }

    // /api/chats/:id — GET, PUT, DELETE
    if (id) {
      if (!checkPassword(req, res)) return;

      if (req.method === 'GET') {
        const chat = await getChat(id);
        if (!chat) {
          res.status(404).json({ error: 'Not found' });
          return;
        }
        res.json({ chat });
        return;
      }

      if (req.method === 'PUT') {
        const incoming = req.body as ChatRecord;
        // Route id wins over body id so a client typo can't silently retarget.
        const saved = await upsertChat({ ...incoming, id });
        res.json({ chat: saved });
        return;
      }

      if (req.method === 'DELETE') {
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
      return;
    }

    // /api/chats — list metadata or create
    if (!checkPassword(req, res)) return;

    if (req.method === 'GET') {
      const chats = await listChatMetadata();
      res.json({ chats });
      return;
    }

    if (req.method === 'POST') {
      const chat = req.body as ChatRecord;
      if (!chat?.id || !chat?.title || !Array.isArray(chat?.messages)) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const saved = await upsertChat(chat);
      res.json({ chat: saved });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/chats failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
