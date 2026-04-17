import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPassword } from '../_lib/memory-store.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!checkPassword(req, res)) return;
  res.json({ ok: true });
}
