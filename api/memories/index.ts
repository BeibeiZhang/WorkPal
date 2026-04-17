import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listMemories,
  createMemory,
  checkPassword,
  type MemoryEntry,
} from '../_lib/memory-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const memories = await listMemories();
      res.json({ memories });
      return;
    }

    if (req.method === 'POST') {
      if (!checkPassword(req, res)) return;
      const entry = req.body as MemoryEntry;
      if (!entry?.id || !entry?.kind || !entry?.title || !entry?.content) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const saved = await createMemory(entry);
      res.json({ memory: saved });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/memories failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
