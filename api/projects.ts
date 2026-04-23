import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listProjects,
  getProject,
  upsertProject,
  deleteProject,
  bulkUpsertProjects,
  type ProjectRecord,
} from './_lib/project-store.js';
import { checkPassword } from './_lib/chat-store.js';

/** Handles all /api/projects* routes in one function — same Hobby-plan
 *  consolidation pattern as api/chats.ts. Sub-paths routed by vercel.json:
 *    /api/projects                    → list (GET) | create (POST)
 *    /api/projects/bulk-upsert        → POST endpoint=bulk-upsert
 *    /api/projects/:id                → GET | PUT | DELETE with id=:id
 *
 *  Auth: all methods require x-memory-password (projects.files include
 *  user-uploaded documents). */

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = strParam(req.query.id);
    const endpoint = strParam(req.query.endpoint);

    if (endpoint === 'bulk-upsert') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      if (!checkPassword(req, res)) return;
      const body = req.body as { projects?: ProjectRecord[] };
      if (!Array.isArray(body?.projects)) {
        res.status(400).json({ error: 'Missing projects[]' });
        return;
      }
      const inserted = await bulkUpsertProjects(body.projects);
      res.json({ inserted });
      return;
    }

    if (id) {
      if (!checkPassword(req, res)) return;

      if (req.method === 'GET') {
        const project = await getProject(id);
        if (!project) {
          res.status(404).json({ error: 'Not found' });
          return;
        }
        res.json({ project });
        return;
      }

      if (req.method === 'PUT') {
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
      return;
    }

    if (!checkPassword(req, res)) return;

    if (req.method === 'GET') {
      const projects = await listProjects();
      res.json({ projects });
      return;
    }

    if (req.method === 'POST') {
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
