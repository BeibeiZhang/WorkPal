import type { VercelRequest, VercelResponse } from '@vercel/node';
import { consumeState, exchangeCode } from '../../_lib/google-auth.js';
import { setConnectorStatus } from '../../_lib/connector-store.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  try {
    const tokens = await exchangeCode(code);
    await setConnectorStatus(connectorId, 'connected', tokens, { email: tokens.email ?? null });
    res.setHeader('Content-Type', 'text/html').send(callbackHtml('ok'));
  } catch (err) {
    console.error('GET /api/auth/google/callback failed', err);
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).setHeader('Content-Type', 'text/html').send(callbackHtml('error', msg));
  }
}
