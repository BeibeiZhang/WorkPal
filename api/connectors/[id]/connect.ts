import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setConnectorStatus } from '../../_lib/connector-store.js';

/** Gmail / Calendar require real OAuth — redirect them to the dedicated flow. */
const OAUTH_CONNECTORS = new Set(['gmail', 'google-cal']);

function checkPassword(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.MEMORY_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'MEMORY_PASSWORD not configured on server' });
    return false;
  }
  const provided = req.headers['x-memory-password'];
  if (provided !== expected) {
    res.status(401).json({ error: 'Invalid password' });
    return false;
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!checkPassword(req, res)) return;

  try {
    const id = String(req.query.id ?? '');
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    if (OAUTH_CONNECTORS.has(id)) {
      res.status(400).json({ error: 'This connector requires OAuth — use /api/auth/google/start' });
      return;
    }
    const saved = await setConnectorStatus(id, 'connected', null);
    res.json({ connector: saved });
  } catch (err) {
    console.error('POST /api/connectors/[id]/connect failed', err);
    res.status(500).json({ error: 'Failed to connect' });
  }
}
