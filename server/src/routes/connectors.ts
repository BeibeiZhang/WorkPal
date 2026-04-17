import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listConnectors,
  getConnector,
  setConnectorStatus,
  clearTokens,
} from '../lib/connectorStore.js';
import {
  getAuthUrl,
  exchangeCode,
  createState,
  consumeState,
  isGoogleAuthConfigured,
  invalidateOAuthClient,
} from '../lib/googleAuth.js';

const router = Router();

/** Connector IDs that require real OAuth instead of the mock connect route.
 *  Keep this narrow — any unknown id falls into the mock-connect branch, which
 *  is only password-gated and stores no tokens. */
const OAUTH_CONNECTORS = new Set(['gmail', 'google-cal']);

function requirePassword(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.MEMORY_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'MEMORY_PASSWORD not configured on server' });
    return;
  }
  const provided = req.header('x-memory-password');
  if (provided !== expected) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  next();
}

/* ─── Public read ─────────────────────────────────────────────────────── */

router.get('/connectors', async (_req, res) => {
  try {
    const connectors = await listConnectors();
    res.json({ connectors });
  } catch (err) {
    console.error('GET /connectors failed', err);
    res.status(500).json({ error: 'Failed to read connectors' });
  }
});

/* ─── Mock connect/disconnect (password-gated) ────────────────────────── */

router.post('/connectors/:id/connect', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (OAUTH_CONNECTORS.has(id)) {
      res.status(400).json({ error: 'This connector requires OAuth — use /api/auth/google/start' });
      return;
    }
    const saved = await setConnectorStatus(id, 'connected', null);
    res.json({ connector: saved });
  } catch (err) {
    console.error('POST /connectors/:id/connect failed', err);
    res.status(500).json({ error: 'Failed to connect' });
  }
});

router.post('/connectors/:id/disconnect', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    await clearTokens(id);
    const saved = await setConnectorStatus(id, 'disconnected', null);
    // Drop cached OAuth2Client so the next tool call rereads from Supabase —
    // otherwise a reconnect with new scopes keeps returning the old client.
    if (id === 'gmail' || id === 'google-cal') invalidateOAuthClient(id);
    res.json({ connector: saved });
  } catch (err) {
    console.error('POST /connectors/:id/disconnect failed', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/* ─── Google OAuth (Gmail + Calendar) ─────────────────────────────────── */

type GoogleConnectorId = 'gmail' | 'google-cal';
function isGoogleConnector(v: unknown): v is GoogleConnectorId {
  return v === 'gmail' || v === 'google-cal';
}

router.get('/auth/google/start', (req, res) => {
  const connector = req.query.connector;
  if (!isGoogleConnector(connector)) {
    res.status(400).send('Unknown connector');
    return;
  }
  if (!isGoogleAuthConfigured()) {
    res.status(500).send('Google OAuth is not configured on the server. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to server/.env.');
    return;
  }
  try {
    const state = createState(connector);
    const url = getAuthUrl(connector, state);
    res.redirect(url);
  } catch (err) {
    console.error('GET /auth/google/start failed', err);
    res.status(500).send('Failed to start OAuth');
  }
});

/** Tiny HTML page shown inside the OAuth popup. Posts a message back to the
 *  opener and closes itself. Falls through to a visible message if the tab was
 *  opened in a plain browser (opener not reachable). */
function callbackHtml(status: 'ok' | 'error', detail?: string): string {
  const payload = JSON.stringify({ source: 'workpal-oauth', status, detail });
  const message = status === 'ok'
    ? 'Connected! You can close this window.'
    : `Something went wrong${detail ? `: ${detail}` : ''}. You can close this window.`;
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>WorkPal OAuth</title></head>
  <body style="font-family: -apple-system, system-ui, sans-serif; padding: 2rem; text-align: center; color: #142740;">
    <p>${message}</p>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage(${payload}, '*');
        }
      } catch (_) {}
      setTimeout(function () { try { window.close(); } catch (_) {} }, 500);
    </script>
  </body>
</html>`;
}

router.get('/auth/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const error = typeof req.query.error === 'string' ? req.query.error : '';
  if (error) {
    res.status(400).type('html').send(callbackHtml('error', error));
    return;
  }
  const connectorId = consumeState(state);
  if (!connectorId) {
    res.status(400).type('html').send(callbackHtml('error', 'invalid_state'));
    return;
  }
  if (!code) {
    res.status(400).type('html').send(callbackHtml('error', 'missing_code'));
    return;
  }
  try {
    const tokens = await exchangeCode(code);
    await setConnectorStatus(connectorId, 'connected', tokens, { email: tokens.email ?? null });
    // Drop any stale cached client so tool calls use the freshly-granted tokens.
    invalidateOAuthClient(connectorId);
    res.type('html').send(callbackHtml('ok'));
  } catch (err) {
    console.error('GET /auth/google/callback failed', err);
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).type('html').send(callbackHtml('error', msg));
  }
});

/** Debug helper — not linked from the UI. Useful for checking tokens exist
 *  without leaking them to the client: returns booleans only. */
router.get('/connectors/:id/status', async (req, res) => {
  try {
    const id = String(req.params.id);
    const c = await getConnector(id);
    if (!c) {
      res.json({ id, status: 'disconnected', hasTokens: false });
      return;
    }
    res.json({ id: c.id, status: c.status, hasTokens: !!c.tokens });
  } catch (err) {
    console.error('GET /connectors/:id/status failed', err);
    res.status(500).json({ error: 'Failed to read status' });
  }
});

export default router;
