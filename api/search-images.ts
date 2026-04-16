import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 10 };

interface ImageResult {
  url: string;
  thumbUrl: string;
  aspectRatio?: number;
  alt: string;
  sourceUrl?: string;
  attribution?: string;
}

async function searchImages(query: string, count: number): Promise<ImageResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const capped = Math.max(1, Math.min(count, 8));
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${capped}&content_filter=high`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${key}`,
        'Accept-Version': 'v1',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        urls: { regular: string; small: string };
        width?: number;
        height?: number;
        alt_description?: string;
        description?: string;
        user: { name: string; links?: { html?: string } };
        links?: { html?: string };
      }>;
    };
    return (data.results || []).map((p) => ({
      url: p.urls.regular,
      thumbUrl: p.urls.small,
      aspectRatio: p.width && p.height ? p.width / p.height : undefined,
      alt: p.alt_description || p.description || query,
      sourceUrl: p.links?.html,
      attribution: p.user?.name ? `Photo by ${p.user.name} on Unsplash` : 'Unsplash',
    }));
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { query, count } = (req.body ?? {}) as { query?: string; count?: number };
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  const images = await searchImages(query, typeof count === 'number' ? count : 4);
  res.json({ images });
}
