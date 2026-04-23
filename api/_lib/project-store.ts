import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Wire shape for the projects table. `files` and `outputs` are opaque
 *  jsonb — the server doesn't introspect Attachment or OutputItem shape. */
export interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  files: unknown[];       // Attachment[] — base64 data URLs inline
  outputs: unknown[];     // OutputItem[]
  updatedAt: string;
}

interface DbRow {
  id: string;
  name: string;
  description: string | null;
  files: unknown[];
  outputs: unknown[];
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

const TABLE = 'projects';

function fromRow(r: DbRow): ProjectRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    files: r.files ?? [],
    outputs: r.outputs ?? [],
    updatedAt: r.updated_at,
  };
}

function toDbInsert(p: ProjectRecord) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    files: p.files,
    outputs: p.outputs,
    updated_at: p.updatedAt,
  };
}

/** Projects total count is small (<10 typical) and Project.files are shown
 *  on the ProjectPage header — no metadata/full split needed here. */
export async function listProjects(): Promise<ProjectRecord[]> {
  const { data, error } = await client()
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as DbRow));
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const { data, error } = await client()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as DbRow) : null;
}

export async function upsertProject(project: ProjectRecord): Promise<ProjectRecord> {
  const { data, error } = await client()
    .from(TABLE)
    .upsert(toDbInsert(project), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data as DbRow);
}

export async function deleteProject(id: string): Promise<boolean> {
  const { data, error } = await client()
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function bulkUpsertProjects(projects: ProjectRecord[]): Promise<number> {
  if (projects.length === 0) return 0;
  const { data, error } = await client()
    .from(TABLE)
    .upsert(projects.map(toDbInsert), { onConflict: 'id', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
