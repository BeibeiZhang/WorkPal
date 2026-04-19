import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearTokens,
  listConnectors,
  setConnectorStatus,
} from './_lib/connector-store.js';

/** Handles all /api/connectors* routes in one function to fit under Vercel's
 *  Hobby-plan 12-function limit. Sub-paths are routed here by a rewrite in
 *  vercel.json (/api/connectors/:id/:action → /api/connectors?id=…&action=…),
 *  so we read id/action from req.query instead of filesystem routing.
 *    GET  /api/connectors                          → list
 *    POST /api/connectors/:id/connect              → mock-connect (password)
 *    POST /api/connectors/:id/disconnect           → disconnect (password)
 *  Gmail / Calendar require real OAuth — handled by /api/auth/google/*. */
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

function strParam(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = strParam(req.query.id);
    const action = strParam(req.query.action);

    // GET /api/connectors — list all (no auth required).
    if (!id && !action) {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const connectors = await listConnectors();
      res.json({ connectors });
      return;
    }

    // POST /api/connectors/:id/:action
    if (id && action) {
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
    console.error('/api/connectors failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
