import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  updateMemory,
  deleteMemory,
  checkPassword,
  type MemoryEntry,
} from '../_lib/memory-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = String(req.query.id ?? '');
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    if (req.method === 'PUT') {
      if (!checkPassword(req, res)) return;
      const patch = req.body as Partial<MemoryEntry>;
      const saved = await updateMemory(id, patch);
      if (!saved) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ memory: saved });
      return;
    }

    if (req.method === 'DELETE') {
      if (!checkPassword(req, res)) return;
      const ok = await deleteMemory(id);
      if (!ok) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'PUT, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/memories/[id] failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
