import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listChatMetadata,
  getChat,
  upsertChat,
  deleteChat,
  bulkUpsertChats,
  type ChatRecord,
} from '../lib/chatStore.js';

const router = Router();

/** Mirror of api/_lib/chat-store.ts checkPassword — gates BOTH reads and
 *  writes for chats (unlike memory routes, which are read-public). Chat
 *  content is more sensitive than memory metadata. */
function requirePassword(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.MEMORY_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'MEMORY_PASSWORD not configured on server' });
    return;
  }
  const provided = req.header('x-memory-password');
  if (provided !== expected) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  next();
}

router.get('/chats', requirePassword, async (_req, res) => {
  try {
    const chats = await listChatMetadata();
    res.json({ chats });
  } catch (err) {
    console.error('GET /chats failed', err);
    res.status(500).json({ error: 'Failed to read chats' });
  }
});

// Static route registered BEFORE /chats/:id so Express doesn't match
// 'bulk-upsert' as the dynamic id segment.
router.post('/chats/bulk-upsert', requirePassword, async (req, res) => {
  try {
    const body = req.body as { chats?: ChatRecord[] };
    if (!Array.isArray(body?.chats)) {
      res.status(400).json({ error: 'Missing chats[]' });
      return;
    }
    const inserted = await bulkUpsertChats(body.chats);
    res.json({ inserted });
  } catch (err) {
    console.error('POST /chats/bulk-upsert failed', err);
    res.status(500).json({ error: 'Failed to bulk-upsert chats' });
  }
});

router.post('/chats', requirePassword, async (req, res) => {
  try {
    const chat = req.body as ChatRecord;
    if (!chat?.id || !chat?.title || !Array.isArray(chat?.messages)) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const saved = await upsertChat(chat);
    res.json({ chat: saved });
  } catch (err) {
    console.error('POST /chats failed', err);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

router.get('/chats/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const chat = await getChat(id);
    if (!chat) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ chat });
  } catch (err) {
    console.error('GET /chats/:id failed', err);
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

router.put('/chats/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const incoming = req.body as ChatRecord;
    const saved = await upsertChat({ ...incoming, id });
    res.json({ chat: saved });
  } catch (err) {
    console.error('PUT /chats/:id failed', err);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

router.delete('/chats/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const ok = await deleteChat(id);
    if (!ok) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /chats/:id failed', err);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;
