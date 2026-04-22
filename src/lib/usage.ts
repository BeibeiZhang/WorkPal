export type Provider = 'openai' | 'anthropic' | 'tavily';
export type Capability = 'chat' | 'voice' | 'web_query' | 'agent' | 'other';

export interface UsageSummary {
  range_days: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
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
    voice_minutes: number;
    images_count: number;
  }>;
  by_day: Array<{ date: string; cost_usd: number }>;
}

export async function fetchUsage(rangeDays: 1 | 7 | 30): Promise<UsageSummary | null> {
  try {
    const res = await fetch(`/api/usage?range=${rangeDays}`);
    if (!res.ok) return null;
    return (await res.json()) as UsageSummary;
  } catch {
    return null;
  }
}

/** Compute USD cost for one OpenAI Realtime `response.done` event. Audio and
 *  text are billed at very different rates, so we can't just use a single
 *  per-token rate the way we do for chat models. Rates below are the current
 *  gpt-4o-realtime-preview published prices (per 1M tokens). Update here if
 *  OpenAI changes them. */
export function realtimeCostUsd(usage: {
  input_token_details?: { text_tokens?: number; audio_tokens?: number; cached_tokens?: number };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}): number {
  const i = usage.input_token_details ?? {};
  const o = usage.output_token_details ?? {};
  const textIn = i.text_tokens ?? 0;
  const audioIn = i.audio_tokens ?? 0;
  const cachedIn = Math.min(i.cached_tokens ?? 0, textIn);
  const textOut = o.text_tokens ?? 0;
  const audioOut = o.audio_tokens ?? 0;

  const TEXT_IN = 5;       // per 1M tokens
  const TEXT_OUT = 20;
  const AUDIO_IN = 100;
  const AUDIO_OUT = 200;
  const CACHED_IN = 2.5;

  const nonCachedTextIn = Math.max(0, textIn - cachedIn);
  const usd =
    nonCachedTextIn * TEXT_IN +
    cachedIn * CACHED_IN +
    audioIn * AUDIO_IN +
    textOut * TEXT_OUT +
    audioOut * AUDIO_OUT;
  return usd / 1_000_000;
}

/** POST a pre-computed usage entry to the server log. Used by voice mode
 *  where OpenAI's usage fields ship over the Realtime WebRTC data channel
 *  (never through our backend). Fire-and-forget — a dropped log entry just
 *  means that one utterance won't show up on the dashboard, not a user-
 *  visible failure. */
export async function logClientUsage(entry: {
  provider: Provider;
  model: string;
  capability?: Capability;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cache_read_tokens?: number;
  images_count?: number;
}): Promise<void> {
  try {
    await fetch('/api/usage/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // intentional: see doc above.
  }
}

export function formatUsd(n: number): string {
  if (n === 0) return 'Free';
  if (n < 0.01) return '<$0.01';
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(0)}`;
}
