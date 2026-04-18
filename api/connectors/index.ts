import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listConnectors } from '../_lib/connector-store.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const connectors = await listConnectors();
    res.json({ connectors });
  } catch (err) {
    console.error('GET /api/connectors failed', err);
    res.status(500).json({ error: 'Failed to read connectors' });
  }
}
