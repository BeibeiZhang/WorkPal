export interface VideoResult {
  /** YouTube video ID (e.g. "dQw4w9WgXcQ") */
  videoId: string;
  /** Canonical watch URL — opened in a new tab when the user clicks the card. */
  url: string;
  /** Video title */
  title: string;
  /** Uploader / channel name, shown under the title. */
  channelTitle: string;
  /** Thumbnail URL (medium — 320x180). */
  thumbnailUrl: string;
  /** ISO-8601 publish date, used for a "2 years ago"-style label. */
  publishedAt?: string;
  /** Short snippet from the video description — shown as a subtitle. */
  description?: string;
}

export function isVideoSearchConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

/**
 * Search YouTube for videos matching a query via the YouTube Data API v3.
 * Requires YOUTUBE_API_KEY (Google Cloud API key with YouTube Data API v3 enabled).
 * Returns an empty array on failure so the tool call degrades gracefully.
 */
export async function searchVideos(query: string, count = 5): Promise<VideoResult[]> {
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
    const data = await res.json() as {
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

/** YouTube API returns titles/descriptions with HTML entities like &amp;, &#39;.
 *  Decode the common ones so the UI doesn't show raw entity codes. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
