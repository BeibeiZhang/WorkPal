import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLatestArtifact } from '../_lib/artifact-store.js';

// GET /api/artifacts/latest?templateId=
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const templateId = typeof req.query.templateId === 'string' ? req.query.templateId : undefined;
    const artifact = await getLatestArtifact(templateId);
    res.json({ artifact });
  } catch (err) {
    console.error('GET /artifacts/latest failed', err);
    res.status(500).json({ error: 'Failed to fetch latest artifact' });
  }
}
