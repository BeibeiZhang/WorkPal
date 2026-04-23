import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  bulkUpsertProjects,
  type ProjectRecord,
} from '../_lib/project-store.js';
import { checkPassword } from '../_lib/chat-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
  } catch (err) {
    console.error('/api/projects/bulk-upsert failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
