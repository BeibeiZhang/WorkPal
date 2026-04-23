import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getProject,
  upsertProject,
  deleteProject,
  type ProjectRecord,
} from '../_lib/project-store.js';
import { checkPassword } from '../_lib/chat-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = String(req.query.id ?? '');
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    if (req.method === 'GET') {
      if (!checkPassword(req, res)) return;
      const project = await getProject(id);
      if (!project) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ project });
      return;
    }

    if (req.method === 'PUT') {
      if (!checkPassword(req, res)) return;
      const incoming = req.body as ProjectRecord;
      const saved = await upsertProject({
        ...incoming,
        id,
        files: incoming.files ?? [],
        outputs: incoming.outputs ?? [],
      });
      res.json({ project: saved });
      return;
    }

    if (req.method === 'DELETE') {
      if (!checkPassword(req, res)) return;
      const ok = await deleteProject(id);
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
    console.error('/api/projects/[id] failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
