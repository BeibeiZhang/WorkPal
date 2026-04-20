import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, MapPin, Ticket, ExternalLink, Loader2 } from 'lucide-react';
import { fetchArtifactBySlug, markArtifactViewed, type Artifact } from '../lib/artifacts';

/* ═══════════════════════════════════════════════════════════════
   Public artifact page — /artifact/:slug

   Standalone webpage, no WorkPal shell. Loads via client fetch (v1).
   OG SSR is TODO — the SPA only sets `document.title` for now via
   the useEffect below, so human visitors get the right tab title but
   social-share crawlers (Twitter / Slack / iMessage link preview)
   won't pick up the artifact's title or cover image. A follow-up edge
   function at api/artifact-og.ts should rewrite /artifact/:slug to an
   HTML shell with proper <meta og:*> tags before serving index.html.
   EN/中 toggle switches between stored content_en and content_zh —
   both are always pregenerated server-side.
   ═══════════════════════════════════════════════════════════════ */

type Lang = 'en' | 'zh';

interface ItemShape {
  title?: string;
  location?: string;
  price?: string;
  date?: string;
  url?: string;
  imageUrl?: string;
}

interface CategoryShape {
  key: string;
  label?: string;
  items?: ItemShape[];
}

export default function ArtifactPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>(() =>
    (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en',
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArtifactBySlug(slug).then((a) => {
      if (cancelled) return;
      setArtifact(a);
      setLoading(false);
      if (a) markArtifactViewed(a.slug);
    });
    return () => { cancelled = true; };
  }, [slug]);

  // Set document title + og:title once we have an artifact. The SSR og
  // function sets these at crawl-time; this just keeps the live tab title
  // in sync for the human visitor.
  useEffect(() => {
    if (!artifact) return;
    const content = lang === 'zh' ? artifact.contentZh : artifact.contentEn;
    if (content?.title) document.title = content.title;
  }, [artifact, lang]);

  const content = useMemo(() => {
    if (!artifact) return null;
    return lang === 'zh' ? artifact.contentZh : artifact.contentEn;
  }, [artifact, lang]);

  const categories: CategoryShape[] = useMemo(() => {
    if (!content) return [];
    const body = content.body as { categories?: CategoryShape[] } | undefined;
    return body?.categories ?? [];
  }, [content]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page">
        <Loader2 className="w-8 h-8 animate-spin text-text-primary/40" />
      </div>
    );
  }

  if (!artifact || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Not found</h1>
          <p className="text-text-primary/60">
            This artifact doesn’t exist or isn’t ready yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      {/* Top bar — brand + EN/中 toggle, no WorkPal nav shell */}
      <header className="max-w-[960px] mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary/50 tracking-wide uppercase">
          WorkPal · Artifact
        </p>
        <div className="flex items-center gap-0.5 p-0.5 rounded-full border border-stroke-outline">
          {(['en', 'zh'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                lang === l
                  ? 'bg-text-primary text-white'
                  : 'text-text-primary/60 hover:text-text-primary'
              }`}
            >
              {l === 'en' ? 'EN' : '中'}
            </button>
          ))}
        </div>
      </header>

      {/* Hero: cover image + title + summary */}
      <section className="max-w-[960px] mx-auto px-6">
        {artifact.coverImageUrl && (
          <div className="w-full aspect-[16/7] rounded-2xl overflow-hidden mb-8 bg-bg-hover">
            <img
              src={artifact.coverImageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        )}
        <h1 className="text-[40px] leading-[1.1] font-bold tracking-tight mb-4">
          {content.title}
        </h1>
        <p className="text-lg text-text-primary/70 leading-relaxed max-w-[720px]">
          {content.summary}
        </p>
      </section>

      {/* Categories */}
      <main className="max-w-[960px] mx-auto px-6 py-10 flex flex-col gap-12">
        {categories.map((cat) => (
          <CategorySection key={cat.key} category={cat} />
        ))}
      </main>

      <footer className="max-w-[960px] mx-auto px-6 py-10 text-center text-sm text-text-primary/40">
        Generated {new Date(artifact.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })} · WorkPal
      </footer>
    </div>
  );
}

function CategorySection({ category }: { category: CategoryShape }) {
  const items = category.items ?? [];
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{category.label || category.key}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((item, i) => (
          <ArtifactItemCard key={`${category.key}-${i}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function ArtifactItemCard({ item }: { item: ItemShape }) {
  const handleClick = () => {
    if (!item.url) return;
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };
  return (
    <article
      onClick={handleClick}
      className="flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-bg-hover border border-stroke-outline hover:shadow-lg transition-shadow cursor-pointer"
    >
      {item.imageUrl && (
        <div className="w-full aspect-[4/3] bg-bg-hover overflow-hidden">
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-lg leading-snug line-clamp-2">
          {item.title || 'Untitled'}
        </h3>
        <div className="flex flex-col gap-1.5 text-sm text-text-primary/70">
          {item.location && (
            <InfoLine icon={<MapPin className="w-4 h-4" />}>{item.location}</InfoLine>
          )}
          {item.date && (
            <InfoLine icon={<Calendar className="w-4 h-4" />}>{item.date}</InfoLine>
          )}
          {item.price && (
            <InfoLine icon={<Ticket className="w-4 h-4" />}>{item.price}</InfoLine>
          )}
        </div>
        {item.url && (
          <p className="text-xs text-text-primary/50 inline-flex items-center gap-1 mt-1">
            <ExternalLink className="w-3 h-3" /> {safeHost(item.url)}
          </p>
        )}
      </div>
    </article>
  );
}

function InfoLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-primary/50">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
