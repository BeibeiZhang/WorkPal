import type { VercelRequest, VercelResponse } from '@vercel/node';

// Collapsed from api/search-{images,videos,web}.ts. Each kind is wired to a
// different 3rd-party API; the response shape is preserved per kind so
// existing callers (src/lib/realtime.ts) keep working unchanged via
// vercel.json rewrites (/api/search-<kind> → /api/search?kind=<kind>).
//
// Kept together here only to stay under Vercel Hobby's 12-function cap
// (13 functions triggers a "Deploying outputs..." failure; see commit
// history on PR #92). If the search providers diverge further in shape or
// latency characteristics, this file is a fine candidate to split back out
// once the deployment moves off Hobby.
export const config = { maxDuration: 15 };

type Kind = 'images' | 'videos' | 'web';

function parseKind(req: VercelRequest): Kind | null {
  const raw = typeof req.query.kind === 'string' ? req.query.kind : '';
  if (raw === 'images' || raw === 'videos' || raw === 'web') return raw;
  return null;
}

/* ── images — Unsplash ─────────────────────────────────────────────── */

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
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
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

/* ── videos — YouTube ──────────────────────────────────────────────── */

interface VideoResult {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
  description?: string;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

async function searchVideos(query: string, count: number): Promise<VideoResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const capped = Math.max(1, Math.min(count, 8));
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', q: query,
    maxResults: String(capped), key,
    safeSearch: 'moderate', relevanceLanguage: 'en',
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string; channelTitle?: string; description?: string; publishedAt?: string;
          thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
        };
      }>;
    };
    return (data.items || [])
      .map((it): VideoResult | null => {
        const videoId = it.id?.videoId;
        const snippet = it.snippet;
        if (!videoId || !snippet) return null;
        const thumb = snippet.thumbnails?.medium?.url
          || snippet.thumbnails?.high?.url
          || snippet.thumbnails?.default?.url
          || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        return {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: decodeHtmlEntities(snippet.title || ''),
          channelTitle: decodeHtmlEntities(snippet.channelTitle || ''),
          thumbnailUrl: thumb,
          publishedAt: snippet.publishedAt,
          description: decodeHtmlEntities(snippet.description || ''),
        };
      })
      .filter((v): v is VideoResult => v !== null);
  } catch {
    return [];
  }
}

/* ── web — Tavily ──────────────────────────────────────────────────── */

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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        query, search_depth: 'basic', max_results: capped,
        include_images: true, include_answer: false,
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
        title: (r.title || '').trim(), url: (r.url || '').trim(),
        content: (r.content || '').trim(), score: r.score,
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

/* ── dispatch ──────────────────────────────────────────────────────── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const kind = parseKind(req);
  if (!kind) {
    res.status(400).json({ error: 'kind query param required (images | videos | web)' });
    return;
  }

  const body = (req.body ?? {}) as { query?: string; count?: number; max_results?: number };
  if (!body.query || typeof body.query !== 'string') {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  if (kind === 'images') {
    const images = await searchImages(body.query, typeof body.count === 'number' ? body.count : 4);
    res.json({ images });
    return;
  }
  if (kind === 'videos') {
    const videos = await searchVideos(body.query, typeof body.count === 'number' ? body.count : 5);
    res.json({ videos });
    return;
  }
  // kind === 'web'
  const resp = await searchWeb(body.query, typeof body.max_results === 'number' ? body.max_results : 5);
  res.json({ results: resp.results, images: resp.images });
}
