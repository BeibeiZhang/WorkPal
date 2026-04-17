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
