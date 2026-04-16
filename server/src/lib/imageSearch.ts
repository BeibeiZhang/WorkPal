export interface ImageResult {
  /** Full-size image URL (for lightbox / large view) */
  url: string;
  /** Smaller variant for the grid thumbnail */
  thumbUrl: string;
  /** Aspect-ratio hint — width / height. Used by the client to lay out mixed orientations. */
  aspectRatio?: number;
  /** Alt text / caption */
  alt: string;
  /** Canonical link back to the source page (for attribution click-through) */
  sourceUrl?: string;
  /** "Photo by X on Unsplash" — displayed as subtle overlay/caption */
  attribution?: string;
}

export function isImageSearchConfigured(): boolean {
  return !!process.env.UNSPLASH_ACCESS_KEY;
}

/**
 * Search Unsplash for photos matching a query. Chosen over the generic-image
 * search providers because it returns professional photography (matches the
 * UX requirement "clean, professional, not flashy") and has a clear free tier.
 * Returns an empty array on failure so the tool call degrades gracefully.
 */
export async function searchImages(query: string, count = 4): Promise<ImageResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const capped = Math.max(1, Math.min(count, 8));
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${capped}&content_filter=high`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${key}`,
        'Accept-Version': 'v1',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
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
