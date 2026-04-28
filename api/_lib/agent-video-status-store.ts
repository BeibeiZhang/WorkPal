import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export type VideoStatus = 'active' | 'inactive' | 'deleted';
export type StatusMap = Record<string, VideoStatus>;

interface DbRow {
  src: string;
  status: VideoStatus;
  updated_at: string;
}

let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

const TABLE = 'agent_video_status';

export async function loadStatusMap(): Promise<StatusMap> {
  const { data, error } = await client().from(TABLE).select('src,status');
  if (error) throw error;
  const map: StatusMap = {};
  for (const row of (data ?? []) as Pick<DbRow, 'src' | 'status'>[]) {
    map[row.src] = row.status;
  }
  return map;
}

export async function setStatus(src: string, status: VideoStatus): Promise<void> {
  const { error } = await client()
    .from(TABLE)
    .upsert({ src, status, updated_at: new Date().toISOString() }, { onConflict: 'src' });
  if (error) throw error;
}

/** Migration path: a fresh self-use browser pushes its localStorage map up
 *  on first cloud-load. `ignoreDuplicates: true` keeps the cloud copy
 *  authoritative if a row already exists, so a stale-cache device can't
 *  overwrite Beibei's latest choice from a more recent browser. */
export async function bulkUpsertIfMissing(map: StatusMap): Promise<number> {
  const rows = Object.entries(map).map(([src, status]) => ({
    src,
    status,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return 0;
  const { data, error } = await client()
    .from(TABLE)
    .upsert(rows, { onConflict: 'src', ignoreDuplicates: true })
    .select('src');
  if (error) throw error;
  return data?.length ?? 0;
}

export function checkPassword(req: VercelRequest, res: VercelResponse): boolean {
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
