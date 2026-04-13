import { useMemo, useState } from 'react';
import {
  BookOpen,
  Search,
  FileText,
  File as FileIcon,
  Presentation,
  Image as ImageIcon,
  Video,
  FileSpreadsheet,
  StickyNote,
  Sparkles,
  MoreHorizontal,
  Play,
  Download,
} from 'lucide-react';
import { FilterChip } from './shared';

interface LibraryPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/* ─── Item types ─── */
type ArtifactType =
  | 'report'
  | 'presentation'
  | 'image'
  | 'video'
  | 'document'
  | 'spreadsheet'
  | 'note';

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
}

/* ─── Mock data — represents AI-generated artifacts across the app ─── */
const ITEMS: LibraryItem[] = [
  {
    id: 'a1',
    title: 'Spark Driver Alcohol Delivery — Summary Report',
    type: 'report',
    source: 'Alcohol Delivery Issues',
    createdAt: 'Today',
    pages: 12,
    ratio: '3/4',
  },
  {
    id: 'a2',
    title: 'Pickup & Drop-off V4 Metrics — Q1 Deck',
    type: 'presentation',
    source: 'Pickup & Drop-off V4 Metrics',
    createdAt: 'Today',
    pages: 18,
    ratio: '4/3',
  },
  {
    id: 'a3',
    title: 'UX Meeting Minutes — Action Items',
    type: 'note',
    source: 'UX Meeting Minutes',
    createdAt: 'Yesterday',
    pages: 3,
    ratio: '1/1',
  },
  {
    id: 'a5',
    title: 'Driver onboarding walkthrough',
    type: 'video',
    source: 'My WorkPal',
    createdAt: '2 days ago',
    duration: '2:14',
    ratio: '4/3',
  },
  {
    id: 'a6',
    title: 'V4 Metrics — Raw data export',
    type: 'spreadsheet',
    source: 'Pickup & Drop-off V4 Metrics',
    createdAt: '2 days ago',
    pages: 4,
    ratio: '4/3',
  },
  {
    id: 'a7',
    title: 'Set up a UX review — Agenda doc',
    type: 'document',
    source: 'Set up a UX review',
    createdAt: '3 days ago',
    pages: 2,
    ratio: '3/4',
  },
  {
    id: 'a8',
    title: 'Customer interview highlights — Reel',
    type: 'video',
    source: 'Alcohol Delivery Issues',
    createdAt: '4 days ago',
    duration: '0:48',
    ratio: '9/16',
  },
  {
    id: 'a10',
    title: 'Q1 OKR rollup — Slide deck',
    type: 'presentation',
    source: 'My WorkPal',
    createdAt: 'Last week',
    pages: 24,
    ratio: '4/3',
  },
  {
    id: 'a11',
    title: 'Compliance review — Findings',
    type: 'report',
    source: 'Alcohol Delivery Issues',
    createdAt: 'Last week',
    pages: 9,
    ratio: '4/5',
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
];

const TYPE_META: Record<ArtifactType, { label: string; Icon: typeof FileText; tint: string }> = {
  report:       { label: 'Report',       Icon: FileText,        tint: '#7652B9' },
  presentation: { label: 'Presentation', Icon: Presentation,    tint: '#B46470' },
  image:        { label: 'Image',        Icon: ImageIcon,       tint: '#CA9D8C' },
  video:        { label: 'Video',        Icon: Video,           tint: '#3171FF' },
  document:     { label: 'Document',     Icon: FileIcon,        tint: '#028901' },
  spreadsheet:  { label: 'Spreadsheet',  Icon: FileSpreadsheet, tint: '#34A853' },
  note:         { label: 'Note',         Icon: StickyNote,      tint: '#F2A93B' },
};

/* ─── Item card — Pinterest-style tile with overlaid title ─── */
function LibraryCard({ item }: { item: LibraryItem }) {
  const meta = TYPE_META[item.type];
  const TypeIcon = meta.Icon;
  // CSS columns: prevent splitting across columns and add bottom spacing.
  // Hover: subtle lift via transform on inner wrapper.
  return (
    <div className="mb-3 break-inside-avoid">
      <div
        className="group relative w-full overflow-hidden rounded-2xl cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          aspectRatio: item.ratio.replace('/', ' / '),
          background: item.thumbnail ? 'var(--color-bg-hover)' : meta.tint,
          boxShadow: '0 1px 2px rgba(20,39,64,0.06)',
        }}
      >
        {/* Thumbnail or generated preview */}
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-x-0 top-0 bottom-[48px] flex items-center justify-center pointer-events-none">
            <div className="w-[30%] aspect-square">
              <TypeIcon strokeWidth={1.6} style={{ color: '#fff', width: '100%', height: '100%' }} />
            </div>
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
              <Play size={22} fill="#142740" stroke="#142740" />
            </div>
          </div>
        )}

        {/* Hover-only quick actions — top-right */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md transition-colors hover:bg-white"
            style={{ background: 'rgba(255,255,255,0.92)', color: '#142740' }}
            onClick={(e) => e.stopPropagation()}
            title="Download"
          >
            <Download size={14} />
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md transition-colors hover:bg-white"
            style={{ background: 'rgba(255,255,255,0.92)', color: '#142740' }}
            onClick={(e) => e.stopPropagation()}
            title="More"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Bottom title overlay — no gradient, no shadow */}
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pointer-events-none">
          <p
            className="text-white"
            style={{
              fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 600,
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
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function LibraryPage({ sidebarOpen, onToggleSidebar }: LibraryPageProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = {
      all: ITEMS.length,
      report: 0, presentation: 0, image: 0, video: 0,
      document: 0, spreadsheet: 0, note: 0,
    };
    ITEMS.forEach(i => { c[i.type] += 1; });
    return c;
  }, []);

  const filtered = useMemo(() => {
    return ITEMS.filter(item => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.source.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filter, search]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full" style={{ background: 'var(--color-bg-page)' }}>

      {/* Header bar — toggle only */}
      <div className="flex items-center gap-4 px-4 h-12 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors shrink-0 text-text-primary"
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor" />
              <rect width="15" height="2" rx="1" y="7" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>

      {/* Page title row — Agent Design style + search */}
      <div className="flex items-center gap-4 px-4 sm:px-8 pb-2 shrink-0">
        <h1
          className="flex-1 text-[40px] font-bold text-text-primary leading-[48px] tracking-[-0.5px]"
          style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          Library
        </h1>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full w-[260px]"
          style={{ background: 'var(--color-bg-hover)' }}
        >
          <Search size={16} className="shrink-0 text-text-primary" />
          <input
            type="text"
            placeholder="Search artifacts"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[14px] text-text-primary placeholder-text-secondary"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="pt-5 pb-4 shrink-0">
        <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible scrollbar-autohide px-4 sm:px-8">
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
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
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
            <p
              className="text-text-primary"
              style={{
                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontSize: 16, fontWeight: 600,
              }}
            >
              No artifacts match your filters
            </p>
            <p
              className="text-text-secondary text-center max-w-[360px]"
              style={{
                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontSize: 14, lineHeight: '20px',
              }}
            >
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
      </div>
    </div>
  );
}
