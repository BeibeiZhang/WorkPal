import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Wire shape — what /api/log-error accepts and what /api/error-summary
 *  hands back to the Overview page. `source` is set client-side from
 *  detectSource() so it stays joinable with usage_log.source. */
export interface ErrorPayload {
  msg: string;
  stack?: string;
  url?: string;
  ua?: string;
  source?: string;
}

export interface ErrorSummaryItem {
  msg: string;
  count: number;
  first_seen: string;
  last_seen: string;
  stack?: string;
  url?: string;
  source?: string;
  sample_id: string;
}

interface DbRow {
  id: string;
  msg: string;
  stack: string | null;
  url: string | null;
  ua: string | null;
  source: string | null;
  ts: string;
  reviewed: boolean;
}

/** Source whitelist mirrors src/lib/usage.ts detectSource() output. Anything
 *  else from the wire collapses to 'unknown' rather than being stored as the
 *  attacker-supplied string — keeps the deployment-source breakdown trustable. */
export const KNOWN_SOURCES: ReadonlySet<string> = new Set([
  'localhost',
  'workpal-beibei',
  'my-workpal',
  'unknown',
]);

const STACK_LIMIT = 8000;
const MSG_LIMIT = 500;
const URL_LIMIT = 1000;
const UA_LIMIT = 500;

let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

const TABLE = 'error_log';

/** Server-side defense-in-depth: even though errorLogger.ts truncates the
 *  stack to 8KB before POSTing, re-truncate here so a hand-crafted curl can't
 *  bypass the cap. Same logic for msg/url/ua. */
function clamp(s: string | undefined, limit: number): string | undefined {
  if (s === undefined) return undefined;
  return s.length > limit ? s.slice(0, limit) : s;
}

/** Validate + insert. Throws a typed error so the route can map to 400. */
export async function insertError(payload: ErrorPayload): Promise<void> {
  if (typeof payload?.msg !== 'string' || payload.msg.trim().length === 0) {
    throw new ValidationError('msg is required');
  }
  const source = payload.source && KNOWN_SOURCES.has(payload.source)
    ? payload.source
    : 'unknown';
  const row = {
    msg: clamp(payload.msg, MSG_LIMIT)!,
    stack: clamp(payload.stack, STACK_LIMIT) ?? null,
    url: clamp(payload.url, URL_LIMIT) ?? null,
    ua: clamp(payload.ua, UA_LIMIT) ?? null,
    source,
  };
  const { error } = await client().from(TABLE).insert(row);
  if (error) throw error;
}

/** Pull up to 500 raw rows from the past 7 days where reviewed=false, then
 *  dedup by msg in JS (count + first/last seen + sample stack). The 500 cap
 *  bounds the dedup work — if a single error fires more than 500× in 7 days
 *  we lose precision past that, which is acceptable for v1 (you'll have
 *  bigger problems than precise counts). */
export async function summarizeUnreviewed(): Promise<ErrorSummaryItem[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client()
    .from(TABLE)
    .select('id,msg,stack,url,source,ts,reviewed')
    .eq('reviewed', false)
    .gte('ts', sevenDaysAgo)
    .order('ts', { ascending: false })
    .limit(500);
  if (error) throw error;

  const groups = new Map<string, ErrorSummaryItem>();
  for (const r of (data ?? []) as DbRow[]) {
    const existing = groups.get(r.msg);
    if (existing) {
      existing.count += 1;
      // ts is sorted DESC, so a later iteration is *older* — only update
      // first_seen, never last_seen or the sample stack.
      existing.first_seen = r.ts;
    } else {
      groups.set(r.msg, {
        msg: r.msg,
        count: 1,
        first_seen: r.ts,
        last_seen: r.ts,
        stack: r.stack ?? undefined,
        url: r.url ?? undefined,
        source: r.source ?? undefined,
        sample_id: r.id,
      });
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count || b.last_seen.localeCompare(a.last_seen))
    .slice(0, 20);
}

/** §59 — mark a whole msg-group reviewed. Two-step:
 *    1) SELECT msg by sample_id (single row)
 *    2) UPDATE all rows with that msg AND reviewed=false → reviewed=true
 *  Whole-group is intentional: GET /api/error-summary dedups by msg, so the
 *  NYE entry represents N occurrences. Marking the entire group keeps that
 *  semantics (one click dismisses the visible entry; a recurrence after
 *  the deploy fix re-fires a fresh row that will surface again).
 *
 *  Returns { marked } so anomalies surface without the route having to
 *  branch on 404: stale sample_id, multi-tab race ("already marked"), and
 *  RLS-denied UPDATE all collapse to marked=0 — the helper logs, the UI
 *  treats as success (entry is gone in DB either way). */
export async function markReviewedByMsg(sampleId: string): Promise<{ marked: number }> {
  const c = client();
  const { data: row, error: selErr } = await c
    .from(TABLE)
    .select('msg')
    .eq('id', sampleId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return { marked: 0 };
  const { count, error: updErr } = await c
    .from(TABLE)
    .update({ reviewed: true }, { count: 'exact' })
    .eq('msg', row.msg)
    .eq('reviewed', false);
  if (updErr) throw updErr;
  return { marked: count ?? 0 };
}

export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ValidationError';
  }
}
