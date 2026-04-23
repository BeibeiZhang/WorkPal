import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listProjects,
  upsertProject,
  type ProjectRecord,
} from '../_lib/project-store.js';
import { checkPassword } from '../_lib/chat-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      // Same gate as chats — projects.files include user-uploaded documents.
      if (!checkPassword(req, res)) return;
      const projects = await listProjects();
      res.json({ projects });
      return;
    }

    if (req.method === 'POST') {
      if (!checkPassword(req, res)) return;
      const project = req.body as ProjectRecord;
      if (!project?.id || !project?.name) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const saved = await upsertProject({
        ...project,
        files: project.files ?? [],
        outputs: project.outputs ?? [],
      });
      res.json({ project: saved });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/projects failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
