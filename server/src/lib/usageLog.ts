import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'usage-log.jsonl');

export type Provider = 'openai' | 'anthropic' | 'tavily';

// What the user was actually trying to do. Drives the Subscription Health
// Check breakdown — each capability maps to a different subscription quota
// (chat ↔ Plus/Pro message count, voice ↔ Plus's ~30h/mo, etc). `other` is
// a catch-all for side-effect entries like Tavily that shouldn't be counted
// as a user-facing query.
export type Capability = 'chat' | 'voice' | 'web_query' | 'agent' | 'other';

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
const PRICING: Record<string, { in: number; out: number }> = {
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

async function ensureLogFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(LOG_FILE); } catch { await fs.writeFile(LOG_FILE, ''); }
}

export async function logUsage(entry: Omit<UsageEntry, 'ts'>): Promise<void> {
  try {
    await ensureLogFile();
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    await fs.appendFile(LOG_FILE, line);
  } catch (err) {
    console.warn('[usageLog] failed to write entry', err);
  }
}

/** Count this provider's entries since `sinceIso` (inclusive). Used to decide
 *  whether a given call still falls inside a free-tier quota — callers pass
 *  the start of the current calendar month when the quota is monthly. */
export async function countCallsSince(provider: Provider, sinceIso: string): Promise<number> {
  const all = await readAll();
  const cutoff = new Date(sinceIso).getTime();
  return all.reduce((n, r) => {
    if (r.provider !== provider) return n;
    const t = new Date(r.ts).getTime();
    return Number.isFinite(t) && t >= cutoff ? n + 1 : n;
  }, 0);
}

async function readAll(): Promise<UsageEntry[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf-8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) as UsageEntry; } catch { return null; }
      })
      .filter((x): x is UsageEntry => x !== null);
  } catch {
    return [];
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
  by_day: Array<{ date: string; cost_usd: number }>;
}

export async function summarize(rangeDays: number): Promise<UsageSummary> {
  const all = await readAll();
  const cutoff = Date.now() - rangeDays * 86_400_000;
  const rows = all.filter((r) => {
    const t = new Date(r.ts).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });

  const modelMap = new Map<string, {
    provider: Provider; cost: number; input: number; output: number; count: number;
  }>();
  const providerMap = new Map<Provider, { cost: number; count: number }>();
  const capabilityMap = new Map<Capability, {
    cost: number; count: number; voiceMinutes: number; images: number;
  }>();
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
    by_day: Array.from(dayMap, ([date, cost_usd]) => ({ date, cost_usd }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
