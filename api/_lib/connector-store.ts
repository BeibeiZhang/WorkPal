import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** One row in public.connectors — mirrors server/src/lib/connectorStore.ts.
 *  The Vercel side and the Express server share the same Supabase project, so
 *  rows written by one are visible to the other. */
export interface Connector {
  id: string;
  status: 'connected' | 'disconnected';
  connectedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface ConnectorWithTokens extends Connector {
  tokens: unknown | null;
}

interface DbRow {
  id: string;
  status: 'connected' | 'disconnected';
  connected_at: string | null;
  metadata: Record<string, unknown> | null;
  tokens: unknown | null;
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

const TABLE = 'connectors';

function fromRow(r: DbRow): Connector {
  return {
    id: r.id,
    status: r.status,
    connectedAt: r.connected_at,
    metadata: r.metadata ?? {},
  };
}

function fromRowWithTokens(r: DbRow): ConnectorWithTokens {
  return { ...fromRow(r), tokens: r.tokens ?? null };
}

export async function listConnectors(): Promise<Connector[]> {
  const { data, error } = await client()
    .from(TABLE)
    .select('id,status,connected_at,metadata')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as DbRow));
}

export async function getConnector(id: string): Promise<ConnectorWithTokens | null> {
  const { data, error } = await client()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRowWithTokens(data as DbRow) : null;
}

export async function setConnectorStatus(
  id: string,
  status: 'connected' | 'disconnected',
  tokens?: unknown | null,
  metadata?: Record<string, unknown>,
): Promise<Connector> {
  const row: Record<string, unknown> = {
    id,
    status,
    connected_at: status === 'connected' ? new Date().toISOString() : null,
  };
  if (tokens !== undefined) row.tokens = tokens;
  if (metadata !== undefined) row.metadata = metadata;
  const { data, error } = await client()
    .from(TABLE)
    .upsert(row, { onConflict: 'id' })
    .select('id,status,connected_at,metadata')
    .single();
  if (error) throw error;
  return fromRow(data as DbRow);
}

export async function clearTokens(id: string): Promise<void> {
  const { error } = await client()
    .from(TABLE)
    .update({ tokens: null, status: 'disconnected', connected_at: null })
    .eq('id', id);
  if (error) throw error;
}
