import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  type MemoryEntry,
} from '../lib/memoryStore.js';

const router = Router();

/** Reject writes when the password header is missing or wrong. The server is
 *  unprotected for reads — sync from any device — but mutations need the PIN
 *  the user set in MEMORY_PASSWORD. */
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

router.get('/memories', async (_req, res) => {
  try {
    const memories = await listMemories();
    res.json({ memories });
  } catch (err) {
    console.error('GET /memories failed', err);
    res.status(500).json({ error: 'Failed to read memories' });
  }
});

router.post('/memories', requirePassword, async (req, res) => {
  try {
    const entry = req.body as MemoryEntry;
    if (!entry?.id || !entry?.kind || !entry?.title || !entry?.content) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const saved = await createMemory(entry);
    res.json({ memory: saved });
  } catch (err) {
    console.error('POST /memories failed', err);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

router.put('/memories/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const patch = req.body as Partial<MemoryEntry>;
    const saved = await updateMemory(id, patch);
    if (!saved) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ memory: saved });
  } catch (err) {
    console.error('PUT /memories/:id failed', err);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

router.delete('/memories/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const ok = await deleteMemory(id);
    if (!ok) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /memories/:id failed', err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

/** Verify a password without modifying anything — used by the password modal
 *  so the UI can confirm before the user has any pending edit. */
router.post('/memories/verify', requirePassword, (_req, res) => {
  res.json({ ok: true });
});

export default router;
