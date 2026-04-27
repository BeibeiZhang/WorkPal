import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  FileText,
  File as FileIcon,
  Presentation,
  Image as ImageIcon,
  Video,
  FileSpreadsheet,
  StickyNote,
  Globe,
  MoreHorizontal,
  Play,
  Download,
} from 'lucide-react';
import { FilterChip, PageLayout, SearchBox } from './shared';
import { IS_DEMO } from '../lib/demoMode';
import { listArtifacts, type Artifact } from '../lib/artifacts';

interface LibraryPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
}

/* ─── Item types ─── */
type ArtifactType =
  | 'report'
  | 'presentation'
  | 'image'
  | 'video'
  | 'document'
  | 'spreadsheet'
  | 'note'
  | 'webpage';

interface LibraryItem {
  id: string;
  title: string;
  type: ArtifactType;
  source: string;
  createdAt: string; // display string e.g. "2 days ago"
  /** Optional preview image path */
  thumbnail?: string;
  /** Used for video items — duration label like "2:14" */
  duration?: string;
  /** Used for spreadsheet/doc items — page or sheet count */
  pages?: number;
  /** Aspect ratio (width / height) for masonry layout — drives tile height */
  ratio: string;
  /** Short summary shown on the card below the title divider. */
  summary?: string;
  /** Candidate #3: for real webpage artifacts, click opens this URL in a
   *  new tab. Undefined for mock/demo items — they stay inert. */
  href?: string;
}

/* ─── Demo mock data — represents AI-generated artifacts across the app.
       In non-demo contexts we swap these out for real rows from the
       /api/artifacts endpoint. ─── */
const DEMO_ITEMS: LibraryItem[] = [
  {
    id: 'a1',
    title: 'Spark Driver Alcohol Delivery — Summary Report',
    type: 'report',
    source: 'Alcohol Delivery Issues',
    createdAt: 'Today',
    pages: 12,
    ratio: '3/4',
    summary: 'Root-cause synthesis across 47 driver complaints — ID verification, multi-stop handoffs, refund disputes.',
  },
  {
    id: 'a2',
    title: 'Pickup & Drop-off V4 Metrics — Q1 Deck',
    type: 'presentation',
    source: 'Pickup & Drop-off V4 Metrics',
    createdAt: 'Today',
    pages: 18,
    ratio: '4/3',
    summary: 'Quarterly review: dwell-time -18%, mispick rate down to 2.1%, V4 rollout readiness.',
  },
  {
    id: 'a3',
    title: 'UX Meeting Minutes — Action Items',
    type: 'note',
    source: 'UX Meeting Minutes',
    createdAt: 'Yesterday',
    pages: 3,
    ratio: '1/1',
    summary: '7 action items assigned — owners, due dates, linked tickets.',
  },
  {
    id: 'a5',
    title: 'Driver onboarding walkthrough',
    type: 'video',
    source: 'My WorkPal',
    createdAt: '2 days ago',
    duration: '2:14',
    ratio: '4/3',
    summary: 'Step-by-step screen recording of the new driver onboarding flow.',
  },
  {
    id: 'a6',
    title: 'V4 Metrics — Raw data export',
    type: 'spreadsheet',
    source: 'Pickup & Drop-off V4 Metrics',
    createdAt: '2 days ago',
    pages: 4,
    ratio: '4/3',
    summary: '4 sheets: dwell time, mispick rate, driver NPS, weekly rollup.',
  },
  {
    id: 'a7',
    title: 'Set up a UX review — Agenda doc',
    type: 'document',
    source: 'Set up a UX review',
    createdAt: '3 days ago',
    pages: 2,
    ratio: '3/4',
    summary: 'Agenda, attendees, review criteria, and pre-read links for Thursday\'s UX review.',
  },
  {
    id: 'a8',
    title: 'Customer interview highlights — Reel',
    type: 'video',
    source: 'Alcohol Delivery Issues',
    createdAt: '4 days ago',
    duration: '0:48',
    ratio: '9/16',
    summary: 'Clipped highlights from 5 driver interviews on alcohol-delivery friction.',
  },
  {
    id: 'a10',
    title: 'Q1 OKR rollup — Slide deck',
    type: 'presentation',
    source: 'My WorkPal',
    createdAt: 'Last week',
    pages: 24,
    ratio: '4/3',
    summary: 'Company-wide Q1 OKR status: 3 on-track, 2 at risk, 1 missed — with owner commentary.',
  },
  {
    id: 'a11',
    title: 'Compliance review — Findings',
    type: 'report',
    source: 'Alcohol Delivery Issues',
    createdAt: 'Last week',
    pages: 9,
    ratio: '4/5',
    summary: 'Legal and compliance findings across 9 state jurisdictions, recommendations per region.',
  },
];

/* ─── Filter chip definitions ─── */
type FilterId = 'all' | ArtifactType;

const FILTERS: { id: FilterId; label: string; Icon: typeof FileText | null }[] = [
  { id: 'all', label: 'All', Icon: null },
  { id: 'report', label: 'Reports', Icon: FileText },
  { id: 'presentation', label: 'Presentations', Icon: Presentation },
  { id: 'image', label: 'Images', Icon: ImageIcon },
  { id: 'video', label: 'Videos', Icon: Video },
  { id: 'document', label: 'Documents', Icon: FileIcon },
  { id: 'spreadsheet', label: 'Spreadsheets', Icon: FileSpreadsheet },
  { id: 'note', label: 'Notes', Icon: StickyNote },
  { id: 'webpage', label: 'Webpages', Icon: Globe },
];

/* Vivid, high-brightness palette — matches Figma's colorful card style (e.g. #f06a6a). */
const TYPE_META: Record<ArtifactType, { label: string; Icon: typeof FileText; tint: string }> = {
  report:       { label: 'Report',       Icon: FileText,        tint: '#F06A6A' }, // coral red
  presentation: { label: 'Presentation', Icon: Presentation,    tint: '#F59E42' }, // orange
  image:        { label: 'Image',        Icon: ImageIcon,       tint: '#E879F9' }, // fuchsia
  video:        { label: 'Video',        Icon: Video,           tint: '#3B82F6' }, // bright blue
  document:     { label: 'Document',     Icon: FileIcon,        tint: '#14B8A6' }, // teal
  spreadsheet:  { label: 'Spreadsheet',  Icon: FileSpreadsheet, tint: '#22C55E' }, // vivid green
  note:         { label: 'Note',         Icon: StickyNote,      tint: '#FBBF24' }, // amber
  webpage:      { label: 'Webpage',      Icon: Globe,           tint: '#7652B9' }, // brand purple
};

/* ─── Item card — Figma-style (node 6417:25543): icon + title header with a
       white bottom-divider, summary text below. Thumbnail items keep the
       image-fill layout with the old bottom-title overlay. ─── */
function LibraryCard({ item }: { item: LibraryItem }) {
  const meta = TYPE_META[item.type];
  const TypeIcon = meta.Icon;
  const handleClick = () => {
    if (item.href) window.open(item.href, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="mb-3 break-inside-avoid">
      <div
        onClick={handleClick}
        className="group relative w-full overflow-hidden rounded-2xl cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          aspectRatio: item.ratio.replace('/', ' / '),
          background: item.thumbnail ? 'var(--color-bg-hover)' : meta.tint,
          boxShadow: '0 1px 2px rgba(20,39,64,0.06)',
        }}
      >
        {item.thumbnail ? (
          <>
            <img
              src={item.thumbnail}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Bottom title overlay for thumbnail items */}
            <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pointer-events-none">
              <p
                className="type-detail-emphasized text-white"
                style={{
                  lineHeight: '18px',
                  letterSpacing: '-0.16px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.title}
              </p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 p-3 flex flex-col gap-1">
            {/* Header: icon + title + 1px white bottom divider */}
            <div
              className="flex flex-col gap-1 pb-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.6)' }}
            >
              <TypeIcon size={24} strokeWidth={1.6} className="text-white" />
              <p
                className="type-detail-emphasized text-white"
                style={{
                  lineHeight: '18px',
                  letterSpacing: '-0.16px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.title}
              </p>
            </div>

            {item.summary && (
              <p
                className="type-footnote"
                style={{
                  lineHeight: '15px',
                  color: 'rgba(255,255,255,0.9)',
                  display: '-webkit-box',
                  WebkitLineClamp: 8,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.summary}
              </p>
            )}
          </div>
        )}

        {/* Video play overlay — only on hover */}
        {item.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div
              className="flex items-center justify-center rounded-full backdrop-blur-sm"
              style={{
                width: 52,
                height: 52,
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0px 2px 6px 0px rgba(1,20,80,0.3)',
              }}
            >
              <Play size={22} fill="var(--color-fixed-dark-text)" stroke="var(--color-fixed-dark-text)" />
            </div>
          </div>
        )}

        {/* Hover-only quick actions — top-right */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md transition-colors hover:bg-white text-text-fixed-dark"
            style={{ background: 'rgba(255,255,255,0.92)' }}
            onClick={(e) => e.stopPropagation()}
            title="Download"
          >
            <Download size={14} />
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md transition-colors hover:bg-white text-text-fixed-dark"
            style={{ background: 'rgba(255,255,255,0.92)' }}
            onClick={(e) => e.stopPropagation()}
            title="More"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Convert a server Artifact into a LibraryItem for rendering. Kept here
 *  (not in lib/artifacts.ts) because LibraryItem is a LibraryPage-local
 *  shape — the display-ratio and source-label policies belong next to the
 *  card that reads them. */
function artifactToLibraryItem(a: Artifact): LibraryItem {
  const title = a.contentEn?.title || a.topic || a.templateId;
  const summary = a.contentEn?.summary || undefined;
  const source = a.topic || humanizeTemplateId(a.templateId);
  // webpage artifacts render taller than wide; match existing Figma "note" ratio.
  const ratio = a.kind === 'webpage' ? '3/4' : '4/3';
  return {
    id: a.slug,
    title,
    type: a.kind,
    source,
    createdAt: relativeTime(a.createdAt),
    thumbnail: a.coverImageUrl ?? undefined,
    ratio,
    summary,
    href: `/artifact/${a.slug}`,
  };
}

function humanizeTemplateId(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const hr = Math.round(diff / 3_600_000);
  if (hr < 1) return 'Just now';
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

/* ─── Page ─── */
export default function LibraryPage({ sidebarOpen, onToggleSidebar, onNewChat }: LibraryPageProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');

  // Demo mode keeps the static mocks — the demo Vercel project has no
  // backend artifacts table. Everywhere else we fetch real rows from
  // /api/artifacts and fall back to an empty state when there are none.
  const [items, setItems] = useState<LibraryItem[]>(() => (IS_DEMO ? DEMO_ITEMS : []));
  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    listArtifacts({ status: 'ready' }).then((rows) => {
      if (cancelled) return;
      setItems(rows.map(artifactToLibraryItem));
    });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = {
      all: items.length,
      report: 0, presentation: 0, image: 0, video: 0,
      document: 0, spreadsheet: 0, note: 0, webpage: 0,
    };
    items.forEach(i => { c[i.type] += 1; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.source.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, search]);

  return (
    <PageLayout
      title="Library"
      bgClass="app-bg"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onNewChat={onNewChat}
      rightSlot={
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search artifacts"
        />
      }
      filters={
        <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible scrollbar-autohide -mx-4 sm:mx-0 px-4 sm:px-0">
          {FILTERS.map(({ id, label, Icon }) => {
            const active = filter === id;
            return (
              <FilterChip
                key={id}
                label={label}
                active={active}
                icon={Icon ? <Icon size={14} className={active ? '' : 'icon-theme'} /> : undefined}
                count={counts[id]}
                onClick={() => setFilter(id)}
              />
            );
          })}
        </div>
      }
      maxWidth="full"
    >
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 64, height: 64,
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-stroke-outline)',
            }}
          >
            <BookOpen size={26} className="text-text-primary" />
          </div>
          <p className="type-h2-emphasized text-text-primary">
            No artifacts match your filters
          </p>
          <p className="type-detail text-text-secondary text-center max-w-[360px]">
            Try a different category or clear your search to see everything WorkPal has produced.
          </p>
        </div>
      ) : (
        <div
          className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6"
          style={{ columnGap: '12px' }}
        >
          {filtered.map(item => (
            <LibraryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
