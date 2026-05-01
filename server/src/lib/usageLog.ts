import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Mirror of api/_lib/usage-store.ts — local Express + Vercel serverless
 *  share a schema but each has its own copy because /server is ESM NodeNext
 *  and the api/ side compiles standalone. Keep both in sync if the schema
 *  or pricing table changes.
 *
 *  Both sides write into the same public.usage_log table (migration 0004),
 *  so anything you chat with locally also shows up on the Overview page at
 *  workpal-beibei.vercel.app/overview — one combined history across devices
 *  and environments. */

export type Provider = 'openai' | 'anthropic' | 'tavily';

// What the user was actually trying to do. Drives the Subscription Health
// Check breakdown — each capability maps to a different subscription quota
// (chat ↔ Plus/Pro message count, voice ↔ Plus's ~30h/mo, etc). `other` is
// a catch-all for side-effect entries like Tavily that shouldn't be counted
// as a user-facing query.
export type Capability = 'chat' | 'voice' | 'web_query' | 'agent' | 'other';

// Which deployment wrote the row. Lets the dashboard tell apart cost driven
// by Beibei's own use vs. anyone hitting the public workpal-beibei URL.
// Pre-migration rows have null source and bucket as 'unknown' on read.
export type Source = 'localhost' | 'workpal-beibei' | 'my-workpal' | 'unknown';

export interface UsageEntry {
  ts: string;
  provider: Provider;
  model: string;
  /** Optional for backward compat: entries written before the field was added
   *  are classified via a best-effort fallback in `inferCapability`. */
  capability?: Capability;
  input_tokens: number;
  output_tokens: number;
  /** How many images the user attached to this turn. Used by the dashboard
   *  to compare against ChatGPT Plus's ~80 msg / 3h cap (images count the
   *  same as text messages toward that quota). */
  images_count?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  cost_usd: number;
  source?: Source;
}

interface DbRow {
  id: string;
  ts: string;
  provider: string;
  model: string;
  capability: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  images_count: number | null;
  cost_usd: number;
  source: string | null;
}

/** Fallback when an entry predates the `capability` field. Cheap heuristic
 *  based on provider + model — kept here so older rows still show up in the
 *  right bucket on the dashboard instead of silently disappearing. */
function inferCapability(e: UsageEntry): Capability {
  if (e.capability) return e.capability;
  if (e.provider === 'anthropic') return 'agent';
  if (e.provider === 'tavily') return 'other';
  if (e.model.includes('realtime')) return 'voice';
  return 'chat';
}

// Per 1M tokens, USD. Prefix match so versioned ids (e.g. "claude-opus-4-7-20260115")
// still land on the right price. If no prefix matches, priceFor returns 0 — the
// dashboard shows $0 rather than crashing, and we'll notice via the model label.
//
// Also serves as the single source of truth for "which models do we reference"
// — the Software Update page derives its known-model lists from these keys
// (see server/src/routes/versionInfo.ts).
export const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'gpt-4o-realtime-preview': { in: 5.00, out: 20.00 },
  'gpt-4o': { in: 2.50, out: 10.00 },
  'claude-opus-4-7': { in: 15, out: 75 },
  'claude-opus-4-6': { in: 15, out: 75 },
  'claude-opus-4-5': { in: 15, out: 75 },
  'claude-opus-4': { in: 15, out: 75 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'claude-sonnet-4': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 0.80, out: 4 },
  'claude-haiku-4': { in: 0.80, out: 4 },
};

export function priceFor(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(PRICING)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  if (!key) return 0;
  const p = PRICING[key];
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
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

const TABLE = 'usage_log';

export async function logUsage(entry: Omit<UsageEntry, 'ts'>): Promise<void> {
  try {
    const { error } = await client()
      .from(TABLE)
      .insert({
        provider: entry.provider,
        model: entry.model,
        capability: entry.capability ?? null,
        input_tokens: entry.input_tokens,
        output_tokens: entry.output_tokens,
        cache_read_tokens: entry.cache_read_tokens ?? null,
        cache_write_tokens: entry.cache_write_tokens ?? null,
        images_count: entry.images_count ?? null,
        cost_usd: entry.cost_usd,
        source: entry.source ?? null,
      });
    if (error) console.warn('[usageLog] insert failed', error);
  } catch (err) {
    console.warn('[usageLog] insert threw', err);
  }
}

/** Count this provider's entries since `sinceIso` (inclusive). Used to decide
 *  whether a given call still falls inside a free-tier quota — callers pass
 *  the start of the current calendar month when the quota is monthly. */
export async function countCallsSince(provider: Provider, sinceIso: string): Promise<number> {
  try {
    const { count, error } = await client()
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('provider', provider)
      .gte('ts', sinceIso);
    if (error) {
      console.warn('[usageLog] countCallsSince failed', error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn('[usageLog] countCallsSince threw', err);
    return 0;
  }
}

export interface UsageSummary {
  range_days: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  /** Total images the user uploaded to the model over the window. */
  total_images_uploaded: number;
  call_count: number;
  by_model: Array<{
    model: string;
    provider: Provider;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    call_count: number;
  }>;
  by_provider: Array<{ provider: Provider; cost_usd: number; call_count: number }>;
  by_capability: Array<{
    capability: Capability;
    call_count: number;
    cost_usd: number;
    /** Only meaningful for voice — minutes approximated from audio tokens
     *  (`audio_tokens / 600` at 10 tokens/sec). 0 for other capabilities. */
    voice_minutes: number;
    images_count: number;
  }>;
  /** Cost split by deployment that wrote the row. Pre-migration rows (null
   *  source) bucket as 'unknown'. Drives the "where is this $$ coming from"
   *  read on Overview — public workpal-beibei traffic vs. Beibei's own dev. */
  by_source: Array<{ source: Source; cost_usd: number; call_count: number }>;
  by_day: Array<{ date: string; cost_usd: number }>;
}

const EMPTY_SUMMARY = (rangeDays: number): UsageSummary => ({
  range_days: rangeDays,
  total_cost_usd: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_images_uploaded: 0,
  call_count: 0,
  by_model: [],
  by_provider: [],
  by_capability: [],
  by_source: [],
  by_day: [],
});

export async function summarize(rangeDays: number): Promise<UsageSummary> {
  const cutoff = new Date(Date.now() - rangeDays * 86_400_000).toISOString();
  let rows: UsageEntry[];
  try {
    const { data, error } = await client()
      .from(TABLE)
      .select('*')
      .gte('ts', cutoff)
      .order('ts', { ascending: false });
    if (error) {
      console.warn('[usageLog] summarize select failed', error);
      return EMPTY_SUMMARY(rangeDays);
    }
    rows = (data ?? []).map((r: DbRow): UsageEntry => ({
      ts: r.ts,
      provider: r.provider as Provider,
      model: r.model,
      capability: (r.capability as Capability | null) ?? undefined,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cache_read_tokens: r.cache_read_tokens ?? undefined,
      cache_write_tokens: r.cache_write_tokens ?? undefined,
      images_count: r.images_count ?? undefined,
      cost_usd: r.cost_usd,
      source: (r.source as Source | null) ?? undefined,
    }));
  } catch (err) {
    console.warn('[usageLog] summarize threw', err);
    return EMPTY_SUMMARY(rangeDays);
  }

  const modelMap = new Map<string, {
    provider: Provider; cost: number; input: number; output: number; count: number;
  }>();
  const providerMap = new Map<Provider, { cost: number; count: number }>();
  const capabilityMap = new Map<Capability, {
    cost: number; count: number; voiceMinutes: number; images: number;
  }>();
  const sourceMap = new Map<Source, { cost: number; count: number }>();
  const dayMap = new Map<string, number>();

  let totalCost = 0;
  let totalIn = 0;
  let totalOut = 0;
  let totalImages = 0;

  for (const r of rows) {
    totalCost += r.cost_usd;
    totalIn += r.input_tokens;
    totalOut += r.output_tokens;
    totalImages += r.images_count ?? 0;

    const m = modelMap.get(r.model) ?? { provider: r.provider, cost: 0, input: 0, output: 0, count: 0 };
    m.cost += r.cost_usd;
    m.input += r.input_tokens;
    m.output += r.output_tokens;
    m.count += 1;
    modelMap.set(r.model, m);

    const p = providerMap.get(r.provider) ?? { cost: 0, count: 0 };
    p.cost += r.cost_usd;
    p.count += 1;
    providerMap.set(r.provider, p);

    const cap = inferCapability(r);
    const c = capabilityMap.get(cap) ?? { cost: 0, count: 0, voiceMinutes: 0, images: 0 };
    c.cost += r.cost_usd;
    c.count += 1;
    c.images += r.images_count ?? 0;
    if (cap === 'voice') {
      // Realtime bills mostly on audio tokens (~10 tokens/sec). Divide by 600
      // to get minutes — rough, but good enough for a "30 min this week" readout.
      const audioTokens = (r.input_tokens + r.output_tokens);
      c.voiceMinutes += audioTokens / 600;
    }
    capabilityMap.set(cap, c);

    const src: Source = (r.source as Source | undefined) ?? 'unknown';
    const s = sourceMap.get(src) ?? { cost: 0, count: 0 };
    s.cost += r.cost_usd;
    s.count += 1;
    sourceMap.set(src, s);

    const day = r.ts.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + r.cost_usd);
  }

  return {
    range_days: rangeDays,
    total_cost_usd: totalCost,
    total_input_tokens: totalIn,
    total_output_tokens: totalOut,
    total_images_uploaded: totalImages,
    call_count: rows.length,
    by_model: Array.from(modelMap, ([model, v]) => ({
      model,
      provider: v.provider,
      cost_usd: v.cost,
      input_tokens: v.input,
      output_tokens: v.output,
      call_count: v.count,
    })).sort((a, b) => b.cost_usd - a.cost_usd),
    by_provider: Array.from(providerMap, ([provider, v]) => ({
      provider,
      cost_usd: v.cost,
      call_count: v.count,
    })).sort((a, b) => b.cost_usd - a.cost_usd),
    by_capability: Array.from(capabilityMap, ([capability, v]) => ({
      capability,
      call_count: v.count,
      cost_usd: v.cost,
      voice_minutes: Math.round(v.voiceMinutes * 10) / 10,
      images_count: v.images,
    })).sort((a, b) => b.call_count - a.call_count),
    by_source: Array.from(sourceMap, ([source, v]) => ({
      source,
      cost_usd: v.cost,
      call_count: v.count,
    })).sort((a, b) => b.cost_usd - a.cost_usd),
    by_day: Array.from(dayMap, ([date, cost_usd]) => ({ date, cost_usd }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
