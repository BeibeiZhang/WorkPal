import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  checkPassword,
  type MemoryEntry,
} from './_lib/memory-store.js';

/** Handles all /api/memories* routes in one function — same Hobby-plan
 *  consolidation pattern as api/chats.ts and api/projects.ts. Sub-paths
 *  routed by vercel.json:
 *    /api/memories            → list (GET, public) | create (POST, password)
 *    /api/memories/verify     → POST endpoint=verify
 *    /api/memories/:id        → PUT | DELETE with id=:id (both password)
 *
 *  Auth model preserved: GET /api/memories is open (sync from any device);
 *  every mutation requires x-memory-password. */

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = strParam(req.query.id);
    const endpoint = strParam(req.query.endpoint);

    // POST /api/memories/verify — password check only.
    if (endpoint === 'verify') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      if (!checkPassword(req, res)) return;
      res.json({ ok: true });
      return;
    }

    // /api/memories/:id — PUT, DELETE.
    if (id) {
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
      return;
    }

    // /api/memories — list (open) or create (password).
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
