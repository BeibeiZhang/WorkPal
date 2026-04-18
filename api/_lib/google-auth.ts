import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getConnector, setConnectorStatus } from './connector-store.js';

/** Gmail + Calendar are the only Google-backed connectors we support.
 *  Each uses a different scope bundle — picked in getAuthUrl(). */
export type GoogleConnectorId = 'gmail' | 'google-cal';

const SCOPES: Record<GoogleConnectorId, string[]> = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  'google-cal': [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

export function isGoogleAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

function requireEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be set');
  }
  return { clientId, clientSecret, redirectUri };
}

function newClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = requireEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/* ─── Stateless CSRF state (HMAC-signed, 10 min TTL) ────────────────────
 *  Serverless functions don't share memory across invocations, so we sign
 *  the state token with a server secret instead of storing it. Format:
 *    base64url(`${connector}.${nonce}.${ts}`).sig
 *  where sig = hex(HMAC-SHA256(key, payload)).
 *  Key is GOOGLE_CLIENT_SECRET — always present when OAuth is configured.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

function signKey(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error('GOOGLE_CLIENT_SECRET must be set');
  return secret;
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

export function createState(connectorId: GoogleConnectorId): string {
  const nonce = randomBytes(8).toString('hex');
  const ts = Date.now().toString();
  const payload = b64urlEncode(`${connectorId}.${nonce}.${ts}`);
  const sig = createHmac('sha256', signKey()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** Returns the stored connectorId if the token is valid and unexpired, else null. */
export function consumeState(token: string): GoogleConnectorId | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', signKey()).update(payload).digest('hex');
  // Both hex strings of the same length — constant-time compare via hex bytes.
  if (sig.length !== expected.length) return null;
  const a = new Uint8Array(Buffer.from(sig, 'hex'));
  const b = new Uint8Array(Buffer.from(expected, 'hex'));
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  let raw: string;
  try { raw = b64urlDecode(payload); } catch { return null; }
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [connectorId, , tsStr] = parts;
  if (connectorId !== 'gmail' && connectorId !== 'google-cal') return null;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;
  return connectorId;
}

/* ─── Auth URL / code exchange ────────────────────────────────────────── */

export function getAuthUrl(connectorId: GoogleConnectorId, state: string): string {
  const oauth2 = newClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES[connectorId],
    state,
  });
}

export interface ExchangedTokens extends Credentials {
  email?: string | null;
}

export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const oauth2 = newClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  let email: string | null = null;
  try {
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const userInfo = await oauth2Api.userinfo.get();
    email = userInfo.data.email ?? null;
  } catch (err) {
    console.warn('Failed to fetch userinfo after token exchange', err);
  }
  return { ...tokens, email };
}

/** Build an OAuth2Client for a stored connector, wiring up token-refresh
 *  persistence back to Supabase. No in-process cache — serverless cold starts
 *  and concurrent invocations both need a fresh client anyway. */
export async function getOAuthClient(connectorId: GoogleConnectorId): Promise<OAuth2Client | null> {
  const row = await getConnector(connectorId);
  if (!row || row.status !== 'connected' || !row.tokens) return null;

  const oauth2 = newClient();
  oauth2.setCredentials(row.tokens as Credentials);
  oauth2.on('tokens', (refreshed) => {
    const merged = { ...(row.tokens as Credentials), ...refreshed };
    void setConnectorStatus(connectorId, 'connected', merged).catch((err) =>
      console.error(`Failed to persist refreshed tokens for ${connectorId}`, err),
    );
  });
  return oauth2;
}
