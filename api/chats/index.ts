import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listChatMetadata,
  upsertChat,
  checkPassword,
  type ChatRecord,
} from '../_lib/chat-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      // Chat content is more sensitive than memory metadata — gate reads too.
      if (!checkPassword(req, res)) return;
      const chats = await listChatMetadata();
      res.json({ chats });
      return;
    }

    if (req.method === 'POST') {
      if (!checkPassword(req, res)) return;
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
