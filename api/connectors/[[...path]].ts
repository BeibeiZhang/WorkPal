import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearTokens,
  listConnectors,
  setConnectorStatus,
} from '../_lib/connector-store.js';

/** Single catch-all handler for all /api/connectors* routes — keeps us
 *  under Vercel's Hobby-plan 12-function limit. Routes:
 *    GET  /api/connectors                          → list
 *    POST /api/connectors/:id/connect              → mock-connect (password)
 *    POST /api/connectors/:id/disconnect           → disconnect (password)
 *  Gmail / Calendar require real OAuth — those are handled by
 *  /api/auth/google/*, not this route. */
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

/** Vercel's optional catch-all ([[...path]]) returns req.query.path as:
 *   - undefined  → request was /api/connectors (bare)
 *   - string[]   → request was /api/connectors/<segments>
 *  Normalise to a string[] for easier matching below. */
function parsePath(req: VercelRequest): string[] {
  const p = req.query.path;
  if (!p) return [];
  return Array.isArray(p) ? p.map(String) : [String(p)];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const segments = parsePath(req);

    // GET /api/connectors — list all (no auth required).
    if (segments.length === 0) {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const connectors = await listConnectors();
      res.json({ connectors });
      return;
    }

    // POST /api/connectors/:id/connect
    // POST /api/connectors/:id/disconnect
    if (segments.length === 2) {
      const [id, action] = segments;
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      if (!checkPassword(req, res)) return;

      if (action === 'connect') {
        if (OAUTH_CONNECTORS.has(id)) {
          res.status(400).json({ error: 'This connector requires OAuth — use /api/auth/google/start' });
          return;
        }
        const saved = await setConnectorStatus(id, 'connected', null);
        res.json({ connector: saved });
        return;
      }
      if (action === 'disconnect') {
        await clearTokens(id);
        const saved = await setConnectorStatus(id, 'disconnected', null);
        res.json({ connector: saved });
        return;
      }
      res.status(404).json({ error: `Unknown action: ${action}` });
      return;
    }

    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('/api/connectors/* failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
