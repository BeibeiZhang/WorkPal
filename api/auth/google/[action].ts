import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  consumeState,
  createState,
  exchangeCode,
  getAuthUrl,
  isGoogleAuthConfigured,
  type GoogleConnectorId,
} from '../../_lib/google-auth.js';
import { setConnectorStatus } from '../../_lib/connector-store.js';

/** Single handler for /api/auth/google/start and /api/auth/google/callback —
 *  one function covering both endpoints keeps us under Vercel's Hobby-plan
 *  12-function limit. */

function isGoogleConnector(v: unknown): v is GoogleConnectorId {
  return v === 'gmail' || v === 'google-cal';
}

/** HTML shown inside the OAuth popup. Posts a message back to the opener
 *  and closes itself; falls through to a visible message if no opener. */
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

async function handleStart(req: VercelRequest, res: VercelResponse) {
  const connector = req.query.connector;
  if (!isGoogleConnector(connector)) {
    res.status(400).send('Unknown connector');
    return;
  }
  if (!isGoogleAuthConfigured()) {
    res.status(500).send('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in Vercel env.');
    return;
  }
  const state = createState(connector);
  const url = getAuthUrl(connector, state);
  res.redirect(url);
}

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const error = typeof req.query.error === 'string' ? req.query.error : '';
  if (error) {
    res.status(400).setHeader('Content-Type', 'text/html').send(callbackHtml('error', error));
    return;
  }
  const connectorId = consumeState(state);
  if (!connectorId) {
    res.status(400).setHeader('Content-Type', 'text/html').send(callbackHtml('error', 'invalid_state'));
    return;
  }
  if (!code) {
    res.status(400).setHeader('Content-Type', 'text/html').send(callbackHtml('error', 'missing_code'));
    return;
  }
  const tokens = await exchangeCode(code);
  await setConnectorStatus(connectorId, 'connected', tokens, { email: tokens.email ?? null });
  res.setHeader('Content-Type', 'text/html').send(callbackHtml('ok'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const action = String(req.query.action ?? '');
    if (action === 'start') {
      await handleStart(req, res);
      return;
    }
    if (action === 'callback') {
      await handleCallback(req, res);
      return;
    }
    res.status(404).send('Unknown action');
  } catch (err) {
    console.error('/api/auth/google/[action] failed', err);
    const msg = err instanceof Error ? err.message : 'unknown';
    const action = String(req.query.action ?? '');
    if (action === 'callback') {
      res.status(500).setHeader('Content-Type', 'text/html').send(callbackHtml('error', msg));
    } else {
      res.status(500).send('Internal error');
    }
  }
}
