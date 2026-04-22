/**
 * Pre-computed API Spend fixtures for the demo deployment. The real
 * `/api/usage` endpoint only exists in the local Express server
 * (`server/src/routes/usage.ts`) — it was never ported to a Vercel
 * serverless function, so `my-workpal.vercel.app` would otherwise 404
 * and show "Free / No activity yet".
 *
 * Numbers are tuned so the Subscription Health Check lands on a single
 * clean narrative across all three tabs:
 *   - Usage mixes voice + Deep Research + Claude Agent, which means
 *     neither ChatGPT Plus ($20, no agent) nor Claude Pro ($20, no voice
 *     / web) can cover alone — combo ($40) is the cheapest fitting plan.
 *   - Normalized monthly API cost = $16.50, so combo still loses: verdict
 *     reads "API direct costs $16.50/mo — cheaper than Plus + Claude Pro
 *     ($40/mo). You save ~$23.50/mo."
 *
 * Source of truth for the shape: src/lib/usage.ts `UsageSummary`.
 */
import type { UsageSummary } from '../../lib/usage';

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const DEMO_USAGE_30: UsageSummary = {
  range_days: 30,
  total_cost_usd: 16.5,
  total_input_tokens: 1_009_000,
  total_output_tokens: 338_000,
  total_images_uploaded: 4,
  call_count: 266,
  by_provider: [
    { provider: 'openai', cost_usd: 7.0, call_count: 146 },
    { provider: 'anthropic', cost_usd: 9.5, call_count: 112 },
    { provider: 'tavily', cost_usd: 0, call_count: 8 },
  ],
  by_model: [
    { model: 'gpt-4o', provider: 'openai', cost_usd: 4.5, input_tokens: 200_000, output_tokens: 56_000, call_count: 80 },
    { model: 'gpt-4o-realtime-preview', provider: 'openai', cost_usd: 2.2, input_tokens: 0, output_tokens: 0, call_count: 6 },
    { model: 'gpt-4o-mini', provider: 'openai', cost_usd: 0.3, input_tokens: 138_000, output_tokens: 48_000, call_count: 60 },
    { model: 'claude-sonnet-4-6', provider: 'anthropic', cost_usd: 4.0, input_tokens: 275_000, output_tokens: 93_000, call_count: 55 },
    { model: 'claude-haiku-4-5', provider: 'anthropic', cost_usd: 0.5, input_tokens: 180_000, output_tokens: 45_000, call_count: 45 },
    { model: 'claude-opus-4-7', provider: 'anthropic', cost_usd: 5.0, input_tokens: 216_000, output_tokens: 96_000, call_count: 12 },
    { model: 'tavily-search', provider: 'tavily', cost_usd: 0, input_tokens: 0, output_tokens: 0, call_count: 8 },
  ],
  by_capability: [
    { capability: 'chat', call_count: 240, cost_usd: 9.3, voice_minutes: 0, images_count: 4 },
    { capability: 'voice', call_count: 6, cost_usd: 2.2, voice_minutes: 20, images_count: 0 },
    { capability: 'web_query', call_count: 8, cost_usd: 0, voice_minutes: 0, images_count: 0 },
    { capability: 'agent', call_count: 12, cost_usd: 5.0, voice_minutes: 0, images_count: 0 },
  ],
  by_day: [
    { date: daysAgo(29), cost_usd: 0.4 }, { date: daysAgo(28), cost_usd: 0.7 },
    { date: daysAgo(27), cost_usd: 0.1 }, { date: daysAgo(26), cost_usd: 0.6 },
    { date: daysAgo(25), cost_usd: 0.9 }, { date: daysAgo(24), cost_usd: 0.5 },
    { date: daysAgo(23), cost_usd: 0 },   { date: daysAgo(22), cost_usd: 0 },
    { date: daysAgo(21), cost_usd: 0.7 }, { date: daysAgo(20), cost_usd: 1.1 },
    { date: daysAgo(19), cost_usd: 0.4 }, { date: daysAgo(18), cost_usd: 1.0 },
    { date: daysAgo(17), cost_usd: 0.7 }, { date: daysAgo(16), cost_usd: 0.3 },
    { date: daysAgo(15), cost_usd: 0 },   { date: daysAgo(14), cost_usd: 0 },
    { date: daysAgo(13), cost_usd: 0.5 }, { date: daysAgo(12), cost_usd: 0.8 },
    { date: daysAgo(11), cost_usd: 1.1 }, { date: daysAgo(10), cost_usd: 0.5 },
    { date: daysAgo(9),  cost_usd: 0.8 }, { date: daysAgo(8),  cost_usd: 0.6 },
    { date: daysAgo(7),  cost_usd: 0 },   { date: daysAgo(6),  cost_usd: 0 },
    { date: daysAgo(5),  cost_usd: 0.6 }, { date: daysAgo(4),  cost_usd: 0.9 },
    { date: daysAgo(3),  cost_usd: 0.7 }, { date: daysAgo(2),  cost_usd: 0.4 },
    { date: daysAgo(1),  cost_usd: 0.8 }, { date: daysAgo(0),  cost_usd: 0.5 },
  ],
};

// 7-day ≈ 30-day × 7/30. Integer call counts rounded so the Health Check
// normalizes back to the same monthly verdict regardless of tab selection.
const DEMO_USAGE_7: UsageSummary = {
  range_days: 7,
  total_cost_usd: 3.85,
  total_input_tokens: 236_000,
  total_output_tokens: 79_000,
  total_images_uploaded: 1,
  call_count: 62,
  by_provider: [
    { provider: 'openai', cost_usd: 1.65, call_count: 34 },
    { provider: 'anthropic', cost_usd: 2.2, call_count: 26 },
    { provider: 'tavily', cost_usd: 0, call_count: 2 },
  ],
  by_model: [
    { model: 'gpt-4o', provider: 'openai', cost_usd: 1.05, input_tokens: 47_000, output_tokens: 13_000, call_count: 19 },
    { model: 'gpt-4o-realtime-preview', provider: 'openai', cost_usd: 0.5, input_tokens: 0, output_tokens: 0, call_count: 1 },
    { model: 'gpt-4o-mini', provider: 'openai', cost_usd: 0.1, input_tokens: 32_000, output_tokens: 11_000, call_count: 14 },
    { model: 'claude-sonnet-4-6', provider: 'anthropic', cost_usd: 0.95, input_tokens: 64_000, output_tokens: 22_000, call_count: 13 },
    { model: 'claude-haiku-4-5', provider: 'anthropic', cost_usd: 0.1, input_tokens: 42_000, output_tokens: 11_000, call_count: 10 },
    { model: 'claude-opus-4-7', provider: 'anthropic', cost_usd: 1.15, input_tokens: 51_000, output_tokens: 22_000, call_count: 3 },
    { model: 'tavily-search', provider: 'tavily', cost_usd: 0, input_tokens: 0, output_tokens: 0, call_count: 2 },
  ],
  by_capability: [
    { capability: 'chat', call_count: 56, cost_usd: 2.2, voice_minutes: 0, images_count: 1 },
    { capability: 'voice', call_count: 1, cost_usd: 0.5, voice_minutes: 5, images_count: 0 },
    { capability: 'web_query', call_count: 2, cost_usd: 0, voice_minutes: 0, images_count: 0 },
    { capability: 'agent', call_count: 3, cost_usd: 1.15, voice_minutes: 0, images_count: 0 },
  ],
  by_day: [
    { date: daysAgo(6), cost_usd: 0 },
    { date: daysAgo(5), cost_usd: 0.6 },
    { date: daysAgo(4), cost_usd: 0.9 },
    { date: daysAgo(3), cost_usd: 0.7 },
    { date: daysAgo(2), cost_usd: 0.4 },
    { date: daysAgo(1), cost_usd: 0.8 },
    { date: daysAgo(0), cost_usd: 0.45 },
  ],
};

const DEMO_USAGE_1: UsageSummary = {
  range_days: 1,
  total_cost_usd: 0.55,
  total_input_tokens: 34_000,
  total_output_tokens: 11_000,
  total_images_uploaded: 0,
  call_count: 9,
  by_provider: [
    { provider: 'openai', cost_usd: 0.24, call_count: 5 },
    { provider: 'anthropic', cost_usd: 0.31, call_count: 4 },
    { provider: 'tavily', cost_usd: 0, call_count: 0 },
  ],
  by_model: [
    { model: 'gpt-4o', provider: 'openai', cost_usd: 0.15, input_tokens: 7_000, output_tokens: 2_000, call_count: 3 },
    { model: 'gpt-4o-realtime-preview', provider: 'openai', cost_usd: 0.07, input_tokens: 0, output_tokens: 0, call_count: 1 },
    { model: 'gpt-4o-mini', provider: 'openai', cost_usd: 0.02, input_tokens: 4_500, output_tokens: 1_500, call_count: 1 },
    { model: 'claude-sonnet-4-6', provider: 'anthropic', cost_usd: 0.12, input_tokens: 9_000, output_tokens: 3_000, call_count: 2 },
    { model: 'claude-haiku-4-5', provider: 'anthropic', cost_usd: 0.03, input_tokens: 6_000, output_tokens: 1_500, call_count: 1 },
    { model: 'claude-opus-4-7', provider: 'anthropic', cost_usd: 0.16, input_tokens: 7_500, output_tokens: 3_000, call_count: 1 },
  ],
  by_capability: [
    { capability: 'chat', call_count: 7, cost_usd: 0.32, voice_minutes: 0, images_count: 0 },
    { capability: 'voice', call_count: 1, cost_usd: 0.07, voice_minutes: 1, images_count: 0 },
    { capability: 'web_query', call_count: 0, cost_usd: 0, voice_minutes: 0, images_count: 0 },
    { capability: 'agent', call_count: 1, cost_usd: 0.16, voice_minutes: 0, images_count: 0 },
  ],
  by_day: [{ date: daysAgo(0), cost_usd: 0.55 }],
};

export const DEMO_USAGE: Record<1 | 7 | 30, UsageSummary> = {
  1: DEMO_USAGE_1,
  7: DEMO_USAGE_7,
  30: DEMO_USAGE_30,
};
