import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createState,
  getAuthUrl,
  isGoogleAuthConfigured,
  type GoogleConnectorId,
} from '../../_lib/google-auth.js';

function isGoogleConnector(v: unknown): v is GoogleConnectorId {
  return v === 'gmail' || v === 'google-cal';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connector = req.query.connector;
  if (!isGoogleConnector(connector)) {
    res.status(400).send('Unknown connector');
    return;
  }
  if (!isGoogleAuthConfigured()) {
    res.status(500).send('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in Vercel env.');
    return;
  }
  try {
    const state = createState(connector);
    const url = getAuthUrl(connector, state);
    res.redirect(url);
  } catch (err) {
    console.error('GET /api/auth/google/start failed', err);
    res.status(500).send('Failed to start OAuth');
  }
}
