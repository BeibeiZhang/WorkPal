import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 15 };

interface WebResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

async function searchWeb(query: string, maxResults: number): Promise<{ results: WebResult[]; images: string[] }> {
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
    return { results, images };
  } catch {
    return { results: [], images: [] };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { query, max_results } = (req.body ?? {}) as { query?: string; max_results?: number };
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  const resp = await searchWeb(query, typeof max_results === 'number' ? max_results : 5);
  res.json({ results: resp.results, images: resp.images });
}
