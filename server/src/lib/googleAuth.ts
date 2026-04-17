import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import { getConnector, setConnectorStatus } from './connectorStore.js';

/** The two Google-backed connector IDs we support. Gmail and Calendar use
 *  different scope sets; the right set is chosen in getAuthUrl(). */
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

/** Cached `OAuth2Client` instances per connector. googleapis auto-refreshes
 *  tokens and emits a `tokens` event; we reuse the client so the listener
 *  registered on first call keeps refreshed tokens flowing back to Supabase
 *  for the lifetime of the process. */
const clientCache: Partial<Record<GoogleConnectorId, OAuth2Client>> = {};

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

/* ─── State (CSRF) — 10 min TTL ───────────────────────────────────────── */

interface StateEntry {
  connectorId: GoogleConnectorId;
  ts: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const stateMap = new Map<string, StateEntry>();

function gcStateMap() {
  const now = Date.now();
  for (const [k, v] of stateMap) {
    if (now - v.ts > STATE_TTL_MS) stateMap.delete(k);
  }
}

export function createState(connectorId: GoogleConnectorId): string {
  gcStateMap();
  const token = randomBytes(16).toString('hex');
  stateMap.set(token, { connectorId, ts: Date.now() });
  return token;
}

/** Consume (validate + pop) a state token. Returns the stored connectorId on
 *  success, or null if the token is missing/expired — callers must treat null
 *  as a CSRF failure. */
export function consumeState(token: string): GoogleConnectorId | null {
  gcStateMap();
  const entry = stateMap.get(token);
  if (!entry) return null;
  stateMap.delete(token);
  if (Date.now() - entry.ts > STATE_TTL_MS) return null;
  return entry.connectorId;
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

  // Fetch the authenticated user's email so we can surface it in the UI
  // (e.g. "Connected as beibei@example.com"). Swallow failures — missing the
  // email shouldn't block the connect flow since scopes still grant tool use.
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

/* ─── OAuth client factory with auto token-refresh persistence ─────── */

/** Build an OAuth2Client wired to tokens stored in the connectors table.
 *  Registers a `tokens` listener once per connector so googleapis' built-in
 *  refresh cycle writes new access tokens (and any rotated refresh token)
 *  back to Supabase — otherwise the first 1-hour expiry drops us. */
export async function getOAuthClient(connectorId: GoogleConnectorId): Promise<OAuth2Client | null> {
  const existing = clientCache[connectorId];
  if (existing) return existing;

  const row = await getConnector(connectorId);
  if (!row || row.status !== 'connected' || !row.tokens) return null;

  const oauth2 = newClient();
  oauth2.setCredentials(row.tokens as Credentials);
  oauth2.on('tokens', (refreshed) => {
    // The event only carries the *new* tokens; merge with whatever we have so
    // the refresh_token (which Google only returns once) stays persistent.
    const merged = { ...(row.tokens as Credentials), ...refreshed };
    void setConnectorStatus(connectorId, 'connected', merged).catch((err) =>
      console.error(`Failed to persist refreshed tokens for ${connectorId}`, err),
    );
  });
  clientCache[connectorId] = oauth2;
  return oauth2;
}

/** Drop a cached client — call this after explicit disconnect so the next
 *  getOAuthClient() rereads from Supabase and sees the tokens cleared. */
export function invalidateOAuthClient(connectorId: GoogleConnectorId): void {
  delete clientCache[connectorId];
}
