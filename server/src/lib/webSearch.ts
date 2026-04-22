import { countCallsSince, logUsage } from './usageLog.js';

// Tavily's current pay-as-you-go rate for a basic search. Hardcoded because
// Tavily doesn't echo a cost field back, and updating these two lines is the
// only maintenance the dashboard needs if pricing / free-tier changes.
const TAVILY_PER_SEARCH_USD = 0.005;
// Tavily's Free tier includes 1,000 searches per calendar month — the UI
// should only surface dollars once we're past the quota, otherwise it feels
// like every click costs money when it doesn't.
const TAVILY_FREE_PER_MONTH = 1000;

function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export interface WebResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface WebSearchResponse {
  results: WebResult[];
  images: string[];
  answer?: string;
}

export function isWebSearchConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResponse> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: [], images: [] };
  const capped = Math.max(1, Math.min(maxResults, 8));
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: capped,
        include_images: true,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { results: [], images: [] };
    // Free tier: first 1,000 searches/month cost $0. Log them anyway so the
    // dashboard can show "X / 1,000 used" later, but with cost_usd = 0 so the
    // "API Spend" total stays honest.
    const usedThisMonth = await countCallsSince('tavily', startOfCurrentMonthIso());
    const cost = usedThisMonth < TAVILY_FREE_PER_MONTH ? 0 : TAVILY_PER_SEARCH_USD;
    await logUsage({
      provider: 'tavily',
      model: 'tavily-search-basic',
      // 'other' keeps it out of the Subscription Health Check counts — the
      // triggering OpenAI turn already owns the 'web_query' classification,
      // and counting Tavily again here would double-count every search.
      capability: 'other',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: cost,
    });
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      images?: Array<string | { url?: string }>;
      answer?: string;
    };
    const results: WebResult[] = (data.results || [])
      .map((r) => ({
        title: (r.title || '').trim(),
        url: (r.url || '').trim(),
        content: (r.content || '').trim(),
        score: r.score,
      }))
      .filter((r) => r.url);
    const images = (data.images || [])
      .map((i) => (typeof i === 'string' ? i : i?.url || ''))
      .filter((u): u is string => !!u);
    return { results, images, answer: data.answer };
  } catch {
    return { results: [], images: [] };
  }
}
