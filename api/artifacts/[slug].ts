import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getArtifactBySlug } from '../_lib/artifact-store.js';

// GET /api/artifacts/:slug — public read for the /artifact/:slug share page.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const slug = String(req.query.slug);
    const artifact = await getArtifactBySlug(slug);
    if (!artifact) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }
    if (artifact.status !== 'ready') {
      res.status(404).json({ error: 'Artifact not ready' });
      return;
    }
    res.json({ artifact });
  } catch (err) {
    console.error('GET /artifacts/:slug failed', err);
    res.status(500).json({ error: 'Failed to fetch artifact' });
  }
}
