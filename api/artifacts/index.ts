import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listArtifacts, type ArtifactKind, type ArtifactStatus } from '../_lib/artifact-store.js';

// GET /api/artifacts?status=&projectId=&kind=&limit=
// Used by LibraryPage, ProjectPage Output, and OverviewPage unread card.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const status = typeof req.query.status === 'string' ? (req.query.status as ArtifactStatus) : undefined;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const kind = typeof req.query.kind === 'string' ? (req.query.kind as ArtifactKind) : undefined;
    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const limit = rawLimit && rawLimit > 0 && rawLimit <= 100 ? rawLimit : undefined;

    const artifacts = await listArtifacts({ status, projectId, kind, limit });
    res.json({ artifacts });
  } catch (err) {
    console.error('GET /artifacts failed', err);
    res.status(500).json({ error: 'Failed to list artifacts' });
  }
}
