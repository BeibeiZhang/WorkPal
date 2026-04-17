import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface MemoryEntry {
  id: string;
  kind: 'core' | 'preference' | 'project';
  title: string;
  content: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  id: string;
  kind: 'core' | 'preference' | 'project';
  title: string;
  content: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

const TABLE = 'memories';

function fromRow(r: DbRow): MemoryEntry {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    content: r.content,
    projectId: r.project_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listMemories(): Promise<MemoryEntry[]> {
  const { data, error } = await client()
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createMemory(entry: MemoryEntry): Promise<MemoryEntry> {
  const { data, error } = await client()
    .from(TABLE)
    .insert({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      content: entry.content,
      project_id: entry.projectId ?? null,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data as DbRow);
}

export async function updateMemory(id: string, patch: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.projectId !== undefined) update.project_id = patch.projectId ?? null;
  const { data, error } = await client()
    .from(TABLE)
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as DbRow) : null;
}

export async function deleteMemory(id: string): Promise<boolean> {
  const { data, error } = await client()
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Reject the request with 401 if the password header doesn't match the
 *  server-configured MEMORY_PASSWORD. Returns true when authenticated. */
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
