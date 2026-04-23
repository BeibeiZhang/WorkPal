import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Wire shape — timestamps are ISO strings (Date round-trips poorly through
 *  JSON). The client converts to Date at the boundary. `messages` is opaque
 *  to the server: any Message[] shape from src/types.ts goes in the jsonb
 *  column verbatim. Cards, attachments, image/video results all ride along
 *  inline. */
export interface ChatRecord {
  id: string;
  title: string;
  lastMessage: string;
  projectId?: string;
  isDraft?: boolean;
  hasInspector?: boolean;
  sessionFolder?: string;
  folderMaterialized?: boolean;
  sessionCompleted?: boolean;
  draftPrompt?: string;
  messages: unknown[];           // Message[] — server doesn't introspect
  timestamp: string;
  updatedAt: string;
}

/** Sidebar-only payload — strips `messages` to keep the list endpoint small.
 *  A chat with attachments can be MB-scale; sidebar showing 50 chats would
 *  pull tens of MB if we shipped the full record. */
export type ChatMetadata = Omit<ChatRecord, 'messages'>;

interface DbRow {
  id: string;
  title: string;
  last_message: string;
  project_id: string | null;
  is_draft: boolean;
  has_inspector: boolean | null;
  session_folder: string | null;
  folder_materialized: boolean | null;
  session_completed: boolean | null;
  draft_prompt: string | null;
  messages: unknown[];
  timestamp: string;
  updated_at: string;
}

type DbMetadataRow = Omit<DbRow, 'messages'>;

let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

const TABLE = 'chats';

const META_COLUMNS =
  'id,title,last_message,project_id,is_draft,has_inspector,session_folder,folder_materialized,session_completed,draft_prompt,timestamp,updated_at';

function metaFromRow(r: DbMetadataRow): ChatMetadata {
  return {
    id: r.id,
    title: r.title,
    lastMessage: r.last_message,
    projectId: r.project_id ?? undefined,
    isDraft: r.is_draft || undefined,
    hasInspector: r.has_inspector ?? undefined,
    sessionFolder: r.session_folder ?? undefined,
    folderMaterialized: r.folder_materialized ?? undefined,
    sessionCompleted: r.session_completed ?? undefined,
    draftPrompt: r.draft_prompt ?? undefined,
    timestamp: r.timestamp,
    updatedAt: r.updated_at,
  };
}

function fromRow(r: DbRow): ChatRecord {
  return { ...metaFromRow(r), messages: r.messages ?? [] };
}

function toDbInsert(c: ChatRecord) {
  return {
    id: c.id,
    title: c.title,
    last_message: c.lastMessage,
    project_id: c.projectId ?? null,
    is_draft: c.isDraft ?? false,
    has_inspector: c.hasInspector ?? null,
    session_folder: c.sessionFolder ?? null,
    folder_materialized: c.folderMaterialized ?? null,
    session_completed: c.sessionCompleted ?? null,
    draft_prompt: c.draftPrompt ?? null,
    messages: c.messages,
    timestamp: c.timestamp,
    updated_at: c.updatedAt,
  };
}

export async function listChatMetadata(): Promise<ChatMetadata[]> {
  const { data, error } = await client()
    .from(TABLE)
    .select(META_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => metaFromRow(r as DbMetadataRow));
}

export async function getChat(id: string): Promise<ChatRecord | null> {
  const { data, error } = await client()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as DbRow) : null;
}

/** Used for both create (first PUT after the user sends their first message)
 *  and update (every later flush). Idempotent on id; `updated_at` is always
 *  refreshed by the caller before sending. */
export async function upsertChat(chat: ChatRecord): Promise<ChatRecord> {
  const { data, error } = await client()
    .from(TABLE)
    .upsert(toDbInsert(chat), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data as DbRow);
}

export async function deleteChat(id: string): Promise<boolean> {
  const { data, error } = await client()
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Migration path: takes a batch of localStorage chats from a device that
 *  has never synced. `ignoreDuplicates: true` makes this a no-op for ids
 *  that already exist server-side, so two devices uploading the same legacy
 *  chat don't collide and don't accidentally overwrite the canonical copy.
 *  Subsequent normal flushes from those devices will then update via the
 *  regular upsert path. */
export async function bulkUpsertChats(chats: ChatRecord[]): Promise<number> {
  if (chats.length === 0) return 0;
  const { data, error } = await client()
    .from(TABLE)
    .upsert(chats.map(toDbInsert), { onConflict: 'id', ignoreDuplicates: true })
    .select('id');
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
