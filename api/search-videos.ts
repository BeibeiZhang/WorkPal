import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 10 };

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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function searchVideos(query: string, count: number): Promise<VideoResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const capped = Math.max(1, Math.min(count, 8));
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(capped),
    key,
    safeSearch: 'moderate',
    relevanceLanguage: 'en',
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          channelTitle?: string;
          description?: string;
          publishedAt?: string;
          thumbnails?: {
            medium?: { url?: string };
            high?: { url?: string };
            default?: { url?: string };
          };
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
  const videos = await searchVideos(query, typeof count === 'number' ? count : 5);
  res.json({ videos });
}
