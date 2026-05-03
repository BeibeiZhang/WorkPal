import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Menu, LayoutDashboard, Plus, Link, BookOpen, Search, ChevronDown,
  ChevronRight, Code2, FileCode2, FileText, FolderOpen, FolderPlus,
  MessageCircle, MoreVertical, PanelRight, Palette, Pen, Star, X,
  MessageSquare, CheckSquare, AtSign, Folder, GitBranch, Mic, Activity, SquarePen,
  Brain, Moon, Home, Zap,
  // Additional icons referenced in the live Icon Library showcase
  AlertTriangle, Check, Clock, BadgeCheck, XCircle, Send, Smile, Eye,
  Download, File, Presentation, Video, Image as ImageIcon, FileSpreadsheet,
  StickyNote, Ticket, Mail, MoreHorizontal, Sparkles, Play, Timer, User,
  Globe, ArrowLeft, Sun, Pause,
  // Icons used elsewhere in the app — surfaced here so the library covers
  // every lucide-react icon imported by any page (no silent gaps).
  ChevronUp, PanelLeft, ArrowUpRight, ExternalLink, LogOut, Inbox,
  Pencil, Copy, Trash2, FilePen, FilePlus2, FileMinus2, FileUp, FolderInput,
  Camera, Undo2,
  AlertCircle, CheckCircle2, Info, Loader2, ShieldAlert, ShieldOff, Gauge,
  FolderClosed, FileImage, FileQuestion, Calendar, CalendarClock, MapPin,
  GitMerge, BarChart3,
  Lock, MonitorPlay, Smartphone, Volume2, VolumeX,
  Baby, Briefcase, Dice5, Footprints, Gamepad2, Rocket,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SectionTitle as SharedSectionTitle, ProgressBar, CategoryBreakdown,
  TimePill, StepIndicator, Tag, FilterChip, Chip, UtilityChip, PrimaryButton, SecondaryButton, TertiaryButton,
  GhostPillButton, HeaderIconButton, NavItem, AddRowButton,
  SolutionRow, SummaryFooter,
  MetricCard, InsightCard, TaskProgressCard, ReviewItemCard,
  StatusTag, ConnectorCard, HealthDimensionRow, SearchBox, TextField, PageLayout,
  HeaderBar, SplitView, SidePanelHeader, SidePanelBody, SideCard, ToolbarPill, DemoBadge,
  ToolbarIconButton, ToolbarSegmented, Tooltip, Switch,
  Checkbox, AreaChart, ArtifactCard, EmptyState, VersionRow, AgentRequiredHint,
} from './shared';
// Live imports — every "real" component that ships in the app.
// Rendering these here (not screenshots) means a foundations change
// shows up in this page the same way it shows up everywhere else.
import Sidebar, { MiniSidebar } from './Sidebar';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import MessageCard from './MessageCard';
import DetailPanel from './DetailPanel';
import TaskContextPanel from './TaskContextPanel';
import NewProjectDialog from './NewProjectDialog';
import PermissionPrompt from './PermissionPrompt';
import type { PermissionKind, PermissionRequest } from '../types';
import type { Chat, Message, CardData, ArtifactRef } from '../types';
import { AGENTS, useAgentVideoStatus, type AgentVideo, type VideoStatus } from '../agentVideos';
import { IS_DEMO } from '../lib/demoMode';

interface DesignSystemPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}


function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="type-h1--emphasized text-text-primary mt-8 mb-6 scroll-mt-[120px]">
      {children}
    </h2>
  );
}

type TabId = 'foundations' | 'principles' | 'layouts' | 'components' | 'agent-videos' | 'review';

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'foundations',  label: 'Foundations',                 hint: 'Color, typography, spacing, radius, and icons — the single source of truth everything else builds on' },
  { id: 'principles',   label: 'Principles & Requirements',   hint: 'Rules and guidelines I follow when building' },
  { id: 'layouts',      label: 'Layout Templates',            hint: 'Layout shells we use across the app' },
  { id: 'components',   label: 'Component Library',           hint: 'All shared components, states, and where they are used' },
  { id: 'agent-videos', label: 'Agent Videos',                hint: 'Videos used by the welcome-state avatars. Toggle Active/Inactive to skip from rotation.' },
  { id: 'review',       label: 'Review Queue',                hint: 'New components awaiting your approval' },
];

function SearchBoxDemo() {
  const [q, setQ] = useState('');
  return <SearchBox value={q} onChange={setQ} placeholder="Search artifacts" />;
}

function TextFieldDemo() {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  return (
    <div className="flex flex-col gap-4 max-w-[360px]">
      <TextField
        label="Username"
        value={name}
        onChange={setName}
        placeholder="Your name"
        autoComplete="username"
        leadingIcon={<User size={16} />}
      />
      <TextField
        label="Password"
        type="password"
        value={pw}
        onChange={setPw}
        placeholder="Enter password"
        autoComplete="current-password"
        leadingIcon={<X size={16} />}
        error={pw.length > 0 && pw.length < 4 ? 'At least 4 characters' : null}
      />
    </div>
  );
}

function CheckboxDemo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <div className="flex flex-col gap-1 max-w-[320px]">
      <Checkbox checked={a} onChange={setA} label="Auto-save on close" hint="Save session outputs when navigating away" />
      <Checkbox checked={b} onChange={setB} label="Include archived" />
      <Checkbox checked={false} onChange={() => {}} label="Disabled option" disabled />
    </div>
  );
}

function SplitViewDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg overflow-hidden border border-stroke-outline" style={{ background: 'var(--color-bg-page)', height: 220 }}>
      <SplitView
        sideOpen={open}
        onCloseSide={() => setOpen(false)}
        sideWidth={220}
        mainMinWidth={260}
        side={
          <div className="h-full border-l border-stroke-outline p-4" style={{ background: 'var(--color-bg-hover)' }}>
            <SidePanelHeader title="Side panel" onClose={() => setOpen(false)} />
            <p className="type-caption text-text-secondary">Side column content</p>
          </div>
        }
      >
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="type-caption text-text-primary mb-2">Main column</p>
            {!open && (
              <TertiaryButton onClick={() => setOpen(true)}>Open side panel</TertiaryButton>
            )}
          </div>
        </div>
      </SplitView>
    </div>
  );
}

function PageLayoutDemo() {
  return (
    <div className="rounded-lg overflow-hidden border border-stroke-outline" style={{ background: 'var(--color-bg-hover)' }}>
      <div className="p-4">
        <div className="rounded border border-dashed border-stroke-outline flex items-center px-3" style={{ height: 32, background: 'var(--color-bg-page)' }}>
          <span className="type-caption font-mono text-text-secondary">Toggle bar · h-12</span>
        </div>
        <div className="mt-2 rounded border border-dashed border-stroke-outline px-3 py-2" style={{ background: 'var(--color-bg-page)' }}>
          <span className="type-h2-emphasized text-text-primary">Page Title</span>
        </div>
        <div className="mt-2 rounded border border-dashed border-stroke-outline flex items-center justify-center" style={{ background: 'var(--color-bg-page)', height: 80 }}>
          <span className="type-caption font-mono text-text-secondary">children · maxWidth: 'full' | 'reading'</span>
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPage({ sidebarOpen, onToggleSidebar }: DesignSystemPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('foundations');
  const [search, setSearch] = useState('');

  const activeTabMeta = useMemo(
    () => TABS.find(t => t.id === activeTab) ?? TABS[0],
    [activeTab]
  );

  const isSearching = search.trim().length > 0;

  const handleTabClick = (id: TabId) => {
    setActiveTab(id);
    setSearch('');
    const scrollEl = document.getElementById('ds-scroll-container');
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PageLayout
      title="Design System"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      scrollContainerId="ds-scroll-container"
      bgClass="app-bg"
      rightSlot={<SearchBox value={search} onChange={setSearch} placeholder="Search design system" />}
      filters={
        <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible scrollbar-autohide -mx-4 sm:mx-0 px-4 sm:px-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full type-detail transition-colors border ${
                activeTab === tab.id && !isSearching
                  ? 'border-transparent'
                  : 'border-stroke-outline text-text-primary chip-gradient-hover'
              }`}
              style={activeTab === tab.id && !isSearching ? { background: 'var(--color-selected-bg)', color: 'var(--color-selected-text)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
        {isSearching ? (
          <SearchResults query={search} onPick={handleTabClick} />
        ) : (
          <>
            {/* Tab hint */}
            <p className="type-caption text-text-secondary -mt-4 mb-6">{activeTabMeta.hint}</p>

            {activeTab === 'foundations' && <FoundationsTab />}

            {activeTab === 'principles' && <PrinciplesTab />}


            {activeTab === 'layouts'      && <LayoutsTab />}
            {activeTab === 'components'   && <ComponentsTab />}
            {activeTab === 'agent-videos' && <AgentVideosTab />}
            {activeTab === 'review'       && <ReviewTab />}
          </>
        )}
    </PageLayout>
  );
}

/* ═══════════════════════════════════════════════════
   Tab 1 — Design Foundations
   The single source of truth for color, typography,
   spacing, radius, and icons. Everything in the app
   composes out of these tokens. Edit the CSS variables
   in src/index.css (or Tailwind `colors` mapping) and
   the change propagates through every component.
   ═══════════════════════════════════════════════════ */

type ColorToken = {
  name: string;
  cssVar: string;
  tailwind?: string;
  /** Additional CSS vars that resolve to the same value in every theme.
   *  Rendered in the Swatch under the primary cssVar so duplicates collapse
   *  into a single entry without hiding that the extra token exists. */
  aliases?: string[];
  usage: string;
};

const SURFACE_TOKENS: ColorToken[] = [
  {
    name: 'Text · Primary',
    cssVar: '--color-text-primary',
    tailwind: 'text-text-primary',
    usage: 'Default text & icons — Display/H1/H2 headings, body copy, labels, form input text, primary icons, active nav items',
  },
  {
    name: 'Text · Secondary',
    cssVar: '--color-text-secondary',
    tailwind: 'text-text-secondary',
    usage: '70% text — descriptions, captions, timestamps, helper copy under titles, inactive nav labels, column headers in tables',
  },
  {
    name: 'Text · Tertiary',
    cssVar: '--color-text-tertiary',
    tailwind: 'text-text-tertiary',
    usage: '40% text — disabled controls, muted metadata, dimmed hints, placeholder separators',
  },
  {
    name: 'Background · Page',
    cssVar: '--color-bg-page',
    tailwind: 'bg-bg-page',
    aliases: ['--color-sidebar-bg'],
    usage: 'Inner page canvas — chat area, panel bodies, dropdowns, popovers, and the left sidebar (shares value with --color-sidebar-bg in both light and dark)',
  },
  {
    name: 'Background · Hover',
    cssVar: '--color-bg-hover',
    tailwind: 'bg-bg-hover',
    usage: '5% / 10% overlay — row & cell hover, chip fills, chat message bubbles, inline code blocks, subtle inset panels',
  },
  {
    name: 'Background · Card',
    cssVar: '--color-card-panel-bg',
    usage: 'Elevated surfaces — CardShell, ArtifactCard, AgentRequiredHint card, VoiceMode panel. White in light; matches bg-hover (10% light blue) in dark so cards lift off the canvas with the same tone as other elevated surfaces',
  },
  {
    name: 'Background · Input',
    cssVar: '--color-input-bg',
    usage: 'Input field fill — ChatInput textarea, inline search surfaces, DarkToggle outer pill in dark. #142740 at 5% in light (same overlay as bg-hover); 20% black in dark so the shell gradient reads through',
  },
  {
    name: 'Background · Outer',
    cssVar: '--color-outer-bg',
    usage: 'App shell exterior — the strip around the rounded 40px page card. Gives the visible margin in light (#f5f5f7); blends with page in dark',
  },
  {
    name: 'Stroke · Outline',
    cssVar: '--color-stroke-outline',
    tailwind: 'border-stroke-outline',
    aliases: ['--color-stroke-toggle'],
    usage: 'Default 1px borders — cards, panels, dividers, popups, outlined buttons, input & dropdown containers, table rows, and control borders (Switch / segmented / DarkToggle pill via --color-stroke-toggle, same value in both modes)',
  },
  {
    name: 'Selected · Fill',
    cssVar: '--color-selected-bg',
    usage: 'Active/selected state fill — active FilterChip, ToolbarSegmented selected tab, focus-ring backgrounds. 10% blue in light, solid blue in dark',
  },
  {
    name: 'Selected · Text',
    cssVar: '--color-selected-text',
    usage: 'Text & icon color on Selected · Fill — blue on the 10% light fill, white on the solid dark fill (maintains contrast in both modes)',
  },
];

const ACCENT_TOKENS: ColorToken[] = [
  { name: 'Blue · Callout',    cssVar: '--color-accent-blue',    usage: 'Selection, links, focus highlights' },
  { name: 'Green · Success',   cssVar: '--color-accent-green',   usage: 'StatusTag success text' },
  { name: 'Red · Error',       cssVar: '--color-accent-red',     usage: 'Error state, destructive action' },
  { name: 'Amber',             cssVar: '--color-accent-amber',   usage: 'Warning / pending states' },
  { name: 'Orange',            cssVar: '--color-accent-orange',  usage: 'Accent badges' },
  { name: 'Violet',            cssVar: '--color-accent-violet',  usage: 'Accent badges' },
  { name: 'Neutral',           cssVar: '--color-accent-neutral', usage: 'Muted / inactive badges' },
];

const BRAND_STOPS: { stop: string; cssVar: string }[] = [
  { stop: 'Start',  cssVar: '--brand-grad-start' },
  { stop: 'Middle', cssVar: '--brand-grad-mid' },
  { stop: 'End',    cssVar: '--brand-grad-end' },
];

/** Parse a computed color string (hex or rgb[a]) into `{ hex, opacity }`.
 *  Browsers' `getComputedStyle` normalizes to `rgb()` / `rgba()` — we still
 *  accept hex so the helper round-trips if we ever read the raw source. */
function parseColorToHexOpacity(raw: string): { hex: string; opacity: number } | null {
  const value = raw.trim();
  if (!value) return null;

  const hexMatch = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    if (h.length === 6) return { hex: '#' + h.toUpperCase(), opacity: 1 };
    if (h.length === 8) {
      const a = parseInt(h.slice(6, 8), 16) / 255;
      return { hex: '#' + h.slice(0, 6).toUpperCase(), opacity: a };
    }
  }

  const rgbMatch = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([0-9.]+)\s*)?\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0').toUpperCase()).join('');
    return { hex, opacity: a };
  }

  return null;
}

/** Resolve a CSS variable to its current `{ hex, opacity }`, re-reading
 *  whenever `.dark` toggles on `<html>` so the swatch labels stay accurate
 *  in both themes. */
function useResolvedColor(cssVar: string) {
  const [resolved, setResolved] = useState<{ hex: string; opacity: number } | null>(null);
  useEffect(() => {
    const read = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
      setResolved(parseColorToHexOpacity(val));
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [cssVar]);
  return resolved;
}

function Swatch({ token, withBorder = true }: { token: ColorToken; withBorder?: boolean }) {
  const resolved = useResolvedColor(token.cssVar);
  const opacityPct = resolved ? Math.round(resolved.opacity * 100) : null;
  return (
    <div className="rounded-xl border border-stroke-outline overflow-hidden" style={{ background: 'var(--color-bg-page)' }}>
      <div
        className={`h-16 w-full ${withBorder ? 'border-b border-stroke-outline' : ''}`}
        style={{ background: `var(${token.cssVar})` }}
      />
      <div className="p-3">
        <div className="type-caption font-bold text-text-primary">{token.name}</div>
        {resolved && (
          <div className="mt-1 flex items-center gap-1.5">
            <code className="type-caption font-mono text-text-primary">{resolved.hex}</code>
            <span className="type-caption text-text-tertiary">·</span>
            <code className="type-caption font-mono text-text-secondary">{opacityPct}%</code>
          </div>
        )}
        <code className="block mt-1 type-caption font-mono text-text-secondary break-all">{token.cssVar}</code>
        {token.aliases?.map(a => (
          <code key={a} className="block type-caption font-mono text-text-tertiary break-all">↳ {a}</code>
        ))}
        {token.tailwind && (
          <code className="block mt-0.5 type-caption font-mono" style={{ color: 'var(--color-accent-blue)' }}>{token.tailwind}</code>
        )}
        <p className="mt-1 type-caption text-text-secondary">{token.usage}</p>
      </div>
    </div>
  );
}

/**
 * Typography Scale — the single source of truth. Every text surface in
 * the app picks one of these 8 canonical styles via its `.type-*` class.
 * The `appearances` field collapses what used to be three tables (Typography
 * Scale + Headings in Use + Row Titles in Use) into one — grouped by
 * actual font parameters, not by surface type.
 */
const TYPE_SCALE: {
  className: string;
  label: string;
  size: string;
  lh: string;
  weight: string;
  tracking: string;
  sample: string;
  usage: string;
  appearances: string[];
}[] = [
  {
    className: 'type-display-xl',
    label: 'Display XL',
    size: '60', lh: '60', weight: '700', tracking: '-0.5',
    sample: '10',
    usage: 'Oversized numeric — MetricCard values (stat dashboards)',
    appearances: [
      'OverviewPage — MetricCard values (Family "10", Self "+2h", API Spend "$1.02")',
    ],
  },
  {
    className: 'type-display',
    label: 'Display',
    size: '40', lh: '48', weight: '700', tracking: '-0.5',
    sample: 'Welcome to WorkPal',
    usage: 'Only one per page — H1 set by PageLayout',
    appearances: [
      'PageLayout H1 — Overview, Memory, Design System, Connectors, Library',
    ],
  },
  {
    className: 'type-h1',
    label: 'H1 / Regular',
    size: '22', lh: '—', weight: '500', tracking: '0',
    sample: 'WorkPal',
    usage: 'Display-weight H1 — brand wordmark, hero greetings',
    appearances: [
      'Sidebar — app wordmark ("WorkPal")',
      'ChatPanel — welcome-state greeting ("Hi, Beibei", combined with .gradient-text)',
    ],
  },
  {
    className: 'type-h1--emphasized',
    label: 'H1 / Emphasized',
    size: '22', lh: '—', weight: '700', tracking: '0',
    sample: 'Life Health Index',
    usage: 'Section headers — top-level regions inside a page',
    appearances: [
      'DesignSystemPage section headers (<h2 id=…>)',
      'Agent showcase headers',
      'OverviewPage — hero greeting ("Good morning, Beibei…"), Life Health Index, Needs Your Eyes, Agents at Work, Scheduled, Your Positive Impact This Week',
      'PermissionPrompt modal title',
      'CompleteSessionModal title',
      'NewProjectDialog title — "New Project" / "Promote to Project"',
    ],
  },
  {
    className: 'type-body-emphasized',
    label: 'Body / Emphasized',
    size: '16', lh: '32', weight: '700', tracking: '0',
    sample: 'Section headings, scenario prompts',
    usage: 'Long-form section headings where loose 32px leading is desired',
    appearances: [
      'ArtifactPage — Output grid category headers',
      'DesignSystemPage — internal section labels (principles, checklists)',
    ],
  },
  {
    className: 'type-body',
    label: 'Body / Regular',
    size: '16', lh: '32', weight: '400', tracking: '0',
    sample: 'Long-form paragraph copy — loose 32px leading for multi-line reading.',
    usage: 'Long-form paragraph copy (loose leading for multi-line reading)',
    appearances: [
      'ArtifactPage — page descriptions and empty-state paragraphs',
      'ConnectorsPage — section description copy',
      'SearchInput (shared) — search-field input text',
      'DesignSystemPage — principle rule paragraphs',
    ],
  },
  {
    className: 'type-h2',
    label: 'H2 / Regular',
    size: '16', lh: '22', weight: '400', tracking: '0',
    sample: 'Alcohol Delivery Issues',
    usage: 'Default 16px copy — chat messages, inputs, list rows, compact dense surfaces',
    appearances: [
      'ChatMessage — user message bubble AND assistant markdown body',
      'NewProjectDialog — project-name input, description textarea',
      'Onboarding — scenario question, drop-zone header, draggable chips',
      'TaskContextPanel — Changes / Folder / Context / Tools rows',
      'Sidebar — chat rows in Recents, project rows in Projects',
      'Sidebar — New Session / Overview / Search / New Project buttons',
      'MessageCard — body text inside Meeting / Ticket / Research / Agent cards',
      'DetailPanel — document body viewer',
      'ChatInput — suggestion chips, input placeholders',
    ],
  },
  {
    className: 'type-h2-emphasized',
    label: 'H2 / Emphasized',
    size: '16', lh: '22', weight: '700', tracking: '0',
    sample: 'Alcohol Delivery Issues',
    usage: 'Default bold 16px title — card titles, sidebar/page section headers, side-panel card titles',
    appearances: [
      'SideCard titles — Instructions, Scheduled, Files, Context (ProjectPage)',
      'SidePanelHeader — DetailPanel, TaskContextPanel',
      'MessageCard titles — Meeting, Ticket, Research, Schedule, Agent',
      'ArtifactCard name — inline artifact cards in chat and Output grid',
      'Sidebar section headers — "Projects", "Recents"',
      'Sidebar profile name — "Beibei Zhang"',
      'ProjectPage Output / Recents section headers',
      'MemoryPage empty-state — "Teach your AI about you"',
      'OverviewPage — Work / Family / Self category headers',
      'DemoExplainerModal — "About this demo"',
      'PasswordModal — "Confirm with password"',
    ],
  },
  {
    className: 'type-h3',
    label: 'H3 / Regular',
    size: '14', lh: '16', weight: '400', tracking: '0',
    sample: 'Compact heading',
    usage: 'Sub-section labels and dense card titles — same size as Detail but tighter 16px leading for short headings',
    appearances: [
      'Reserved for new compact-heading surfaces — pair with detail/caption body copy.',
    ],
  },
  {
    className: 'type-detail-emphasized',
    label: 'Detail / Emphasized',
    size: '14', lh: '22', weight: '700', tracking: '0',
    sample: 'Form labels, small section heads',
    usage: 'Form labels, chip emphasis, metadata headings',
    appearances: [
      'SectionTitle — Overview Work / Family / Self',
      'TaskProgressCard title',
      'InsightCard headline',
      'SolutionRow title',
      'ReviewItemCard — needs-review row',
      'HealthDimensionRow — stress / health metric rows',
      'ConnectorCard — Gmail, Calendar, Slack, Asana',
      'ProjectPage — chat rows in the project Recents panel',
      'PrimaryButton, InvertedButton',
    ],
  },
  {
    className: 'type-detail',
    label: 'Detail / Regular',
    size: '14', lh: '22', weight: '400', tracking: '0',
    sample: 'Helper text, captions, chip labels, inline hints.',
    usage: 'Helper text, captions, chip labels, form labels, dense menu rows',
    appearances: [
      'Helper text, captions, chip labels (generic)',
      'PermissionPrompt body, CompleteSessionModal body',
      'NewProjectDialog — field labels, folder-path input',
      'ConnectorsPage — API key / folder labels',
      'Sidebar row context menu (Move / Delete / project targets)',
      'AvatarMenu items — Connectors, Library, Memory, Onboarding, Design System',
      'OverviewPage — body text, impact details, scheduled cron description',
      'DetailPanel — error banner, cancel / retry / undo buttons',
      'ChatInput — attachment pill name & file-size meta',
    ],
  },
  {
    className: 'type-caption',
    label: 'Caption',
    size: '12', lh: '16', weight: '400', tracking: '0',
    sample: 'Smallest non-mono tier — chart legends, mono code blocks, docs chrome.',
    usage: 'Chart legends, mono code/command blocks, docs-chrome tables, captions & meta rows',
    appearances: [
      'PermissionPrompt — command target box (with font-mono)',
      'CompleteSessionModal — command + diff stats (with font-mono)',
      'markdown.tsx — fenced code blocks (with font-mono)',
      'TaskContextPanel — file path chips (with font-mono)',
      'ChatPanel — path breadcrumb (with font-mono)',
      'DesignSystemPage — token tables, search result rows, usage captions, inline code references, panel-spec meta (with font-mono)',
      'OverviewPage — Weekly Trends chart legend (with opacity-70)',
      'ChatInput — attachment validation error (with red inline color)',
      'TaskContextPanel — step execution error (with red inline color)',
    ],
  },
  {
    className: 'type-footnote',
    label: 'Footnote',
    size: '11', lh: '—', weight: '400', tracking: '0',
    sample: 'wikipedia.org',
    usage: 'Compact citation chips, micro pill labels; line-height collapses to 1',
    appearances: [
      'ChatMessage — follow-up citation chips (favicon + host)',
      'ChatMessage — image attribution overlay on hover',
    ],
  },
];

/**
 * Typography Outliers — non-canonical styles that intentionally depart
 * from the 11 tokens. Listed here so they stay visible; if a new design
 * needs something not in the scale, it belongs here (or becomes a new
 * token) rather than being hidden as a hardcoded inline size.
 */
const TYPE_OUTLIERS: {
  label: string;
  classes: string;
  maps: string;
  sample: string;
  sampleStyle: React.CSSProperties;
  usedIn: string[];
  note: string;
}[] = [
  {
    label: 'Metric Label (Uppercase)',
    classes: 'text-[14px] font-bold uppercase tracking-[0.5px]',
    maps: 'type-detail-emphasized + uppercase + tracking 0.5',
    sample: 'FOCUS TIME',
    sampleStyle: { fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
    usedIn: ['MetricCard title — Overview dashboard metrics'],
    note: 'Intentional uppercase modifier of detail-emphasized for dashboard metrics.',
  },
  {
    label: 'Uppercase Label (11)',
    classes: 'text-[11px] font-semibold uppercase tracking-[0.5px]',
    maps: '11 / — / 600 uppercase tracking 0.5',
    sample: 'USED IN',
    sampleStyle: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
    usedIn: ['DesignSystemPage — component meta labels', 'VoiceMode — hint section header'],
    note: 'Eyebrow label for secondary meta rows. Does not replace StatusTag.',
  },
  {
    label: 'Eyebrow Micro (10)',
    classes: 'text-[10px] font-semibold uppercase tracking-[0.5px] (or tracking-wider)',
    maps: '10 / — / 600 uppercase tracking 0.5–wider',
    sample: 'CODE',
    sampleStyle: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
    usedIn: [
      'DesignSystemPage — "Code" eyebrow above snippets',
      'DesignSystemPage — Component meta labels',
      'DesignSystemPage — Preview badge (tracking-wider variant)',
    ],
    note: 'Smaller cousin of Uppercase Label (11). Reserved for DS-internal meta chrome; do not use in product UI.',
  },
  {
    label: 'Icon Usage Meta (10)',
    classes: 'text-[10px] leading-[13px]',
    maps: '10 / 13 / 400',
    sample: 'Sidebar, MiniSidebar',
    sampleStyle: { fontSize: 10, lineHeight: '13px' },
    usedIn: ['DesignSystemPage — Icon card "usedIn" caption'],
    note: 'Truncated metadata under icon cards. Smallest text tier anywhere — DS only.',
  },
  {
    label: 'Tooltip (11 tight)',
    classes: 'text-[11px] leading-tight',
    maps: '11 / 1.25 / 400',
    sample: 'Copy to clipboard',
    sampleStyle: { fontSize: 11, lineHeight: 1.25, background: 'var(--color-tooltip-bg)', color: '#fff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' },
    usedIn: ['shared — Tooltip hover bubble'],
    note: 'Footnote (11/1) variant with a 1.25 leading cushion. Always on a dark 1a1a1a bubble.',
  },
  {
    label: 'Tight Tracking (−0.3)',
    classes: 'tracking-[-0.3px]',
    maps: 'any size + tracking −0.3',
    sample: 'Pending · 12',
    sampleStyle: { fontSize: 12, letterSpacing: '-0.3px' },
    usedIn: ['shared — StatusTag', 'shared — ChatListItem unread count chip'],
    note: 'Micro letter-spacing tighten for dense chip/tag labels. Pair with caption (12) size.',
  },
  {
    label: 'Inline Code (0.9em relative)',
    classes: 'text-[0.9em] font-mono',
    maps: '0.9× parent / inherited / 400 mono',
    sample: 'const x = 1;',
    sampleStyle: { fontSize: '0.9em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '2px 4px', borderRadius: 4, background: 'var(--color-bg-hover)' },
    usedIn: ['markdown — inline `code` spans inside AI responses'],
    note: 'The only em-based (relative) size in the app — scales with the surrounding paragraph so inline code matches running text.',
  },
];

const SPACING_SCALE: { token: string; css: string; tailwind: string; usage: string }[] = [
  { token: '--space-1',  css: '4px',  tailwind: 'p-1 / gap-1 / mt-1',  usage: 'Hairline — inside tight stacks (icon ↔ label)' },
  { token: '--space-2',  css: '8px',  tailwind: 'p-2 / gap-2 / mt-2',  usage: 'Chip/button internal padding rhythm' },
  { token: '--space-3',  css: '12px', tailwind: 'p-3 / gap-3 / mt-3',  usage: 'Title ↔ helper text inside a card' },
  { token: '--space-4',  css: '16px', tailwind: 'p-4 / gap-4 / mt-4',  usage: 'Default card padding, horizontal page gutter (mobile)' },
  { token: '--space-5',  css: '20px', tailwind: 'p-5 / gap-5 / mt-5',  usage: 'Generous card padding' },
  { token: '--space-6',  css: '24px', tailwind: 'p-6 / gap-6 / mt-6',  usage: 'Title → filters gap in PageLayout' },
  { token: '--space-8',  css: '32px', tailwind: 'p-8 / gap-8 / mt-8',  usage: 'Title/filters → content gap; section dividers' },
  { token: '--space-10', css: '40px', tailwind: 'pb-10',               usage: 'Page bottom padding' },
];

const RADIUS_SCALE: { token: string; css: string; usage: string }[] = [
  { token: '--radius-sm',    css: '8px',    usage: 'Small tags, internal chips' },
  { token: '--radius-md',    css: '12px',   usage: 'Buttons, input fields' },
  { token: '--radius-lg',    css: '16px',   usage: 'Cards, message bubbles' },
  { token: '--radius-pill',  css: '9999px', usage: 'Chips, pills, toggles' },
  { token: '--radius-shell', css: '40px',   usage: 'Outer app shell' },
];

// Icon Library — real lucide-react components, grouped by semantic purpose.
// Each entry carries the component reference itself so we can render the
// actual SVG at multiple sizes and colors (no abbreviations or stubs).
type IconEntry = {
  name: string;
  Icon: LucideIcon;
  purpose: string;
  usedIn: string;
};

const ICON_GROUPS: { group: string; blurb: string; icons: IconEntry[] }[] = [
  {
    group: 'Navigation & Layout',
    blurb: 'Sidebar, top-level nav targets, and panel chrome.',
    icons: [
      { name: 'LayoutDashboard', Icon: LayoutDashboard, purpose: 'Overview page nav target',          usedIn: 'Sidebar, MiniSidebar' },
      { name: 'Link',            Icon: Link,            purpose: 'Connectors section nav target',     usedIn: 'Sidebar, MiniSidebar' },
      { name: 'BookOpen',        Icon: BookOpen,        purpose: 'Library section nav target',        usedIn: 'Sidebar, MiniSidebar' },
      { name: 'Palette',         Icon: Palette,         purpose: 'Design System nav target',          usedIn: 'Sidebar, MiniSidebar' },
      { name: 'ChevronDown',     Icon: ChevronDown,     purpose: 'Collapsible section toggle',        usedIn: 'Sidebar' },
      { name: 'ChevronRight',    Icon: ChevronRight,    purpose: 'Drill-in / forward affordance',     usedIn: 'Sidebar, shared' },
      { name: 'PanelRight',      Icon: PanelRight,      purpose: 'Open the right context panel',      usedIn: 'ChatPanel, TaskContextPanel' },
      { name: 'Menu',            Icon: Menu,            purpose: 'Mobile sidebar toggle',             usedIn: 'Sidebar' },
      { name: 'Home',            Icon: Home,            purpose: 'Home / welcome state',              usedIn: 'shared, welcome flows' },
      { name: 'ArrowLeft',       Icon: ArrowLeft,       purpose: 'Back navigation (mobile search)',   usedIn: 'shared (SearchBox)' },
      { name: 'ChevronUp',       Icon: ChevronUp,       purpose: 'Collapse / scroll-to-top affordance', usedIn: 'OverviewPage' },
      { name: 'PanelLeft',       Icon: PanelLeft,       purpose: 'Collapse / open the left sidebar',  usedIn: 'Sidebar, shared' },
      { name: 'ArrowUpRight',    Icon: ArrowUpRight,    purpose: 'Open in new view / external link',  usedIn: 'shared, MessageCard' },
      { name: 'ExternalLink',    Icon: ExternalLink,    purpose: 'Outbound link (artifact source)',   usedIn: 'ArtifactPage' },
      { name: 'LogOut',          Icon: LogOut,          purpose: 'Sign out from user menu',           usedIn: 'Sidebar' },
      { name: 'Inbox',           Icon: Inbox,           purpose: 'Project / unread tray entry',       usedIn: 'ProjectPage' },
    ],
  },
  {
    group: 'Actions & Controls',
    blurb: 'User-initiated operations — creating, searching, dismissing, sending.',
    icons: [
      { name: 'SquarePen',   Icon: SquarePen,   purpose: 'New session / compose chat',               usedIn: 'Sidebar, shared (HeaderBar)' },
      { name: 'Plus',        Icon: Plus,        purpose: 'Create / add (project, API, list item)',   usedIn: 'ConnectorsPage, shared (SideCard, ChatInput)' },
      { name: 'FolderPlus',  Icon: FolderPlus,  purpose: 'New project action',                       usedIn: 'Sidebar' },
      { name: 'Search',      Icon: Search,      purpose: 'Search affordance',                        usedIn: 'Sidebar, shared (SearchBox)' },
      { name: 'X',           Icon: X,           purpose: 'Close / dismiss / remove chip',            usedIn: 'NewProjectDialog, Onboarding, SearchBox' },
      { name: 'Send',        Icon: Send,        purpose: 'Submit message / submitted status',        usedIn: 'ChatInput, shared (StatusTag)' },
      { name: 'Download',    Icon: Download,    purpose: 'Download report',                          usedIn: 'MessageCard' },
      { name: 'Play',        Icon: Play,        purpose: 'Start action / play video',                usedIn: 'shared (ActionCard), LibraryPage' },
      { name: 'Eye',         Icon: Eye,         purpose: 'Review / preview toggle',                  usedIn: 'shared (ReviewItemCard)' },
      { name: 'Pen',         Icon: Pen,         purpose: 'Edit / compose',                           usedIn: 'shared, ChatInput' },
      { name: 'MoreVertical',Icon: MoreVertical,purpose: 'Overflow menu (vertical)',                 usedIn: 'Sidebar, shared' },
      { name: 'MoreHorizontal',Icon: MoreHorizontal,purpose: 'Overflow menu (horizontal)',           usedIn: 'LibraryPage' },
      { name: 'Pencil',      Icon: Pencil,      purpose: 'Inline rename / edit (alt to Pen)',        usedIn: 'MemoryPage, DetailPanel' },
      { name: 'Copy',        Icon: Copy,        purpose: 'Copy text / artifact to clipboard',        usedIn: 'CompleteSessionModal' },
      { name: 'Trash2',      Icon: Trash2,      purpose: 'Delete memory / chat / item',              usedIn: 'MemoryPage, Sidebar' },
      { name: 'FilePen',     Icon: FilePen,     purpose: 'Edit existing file artifact',              usedIn: 'CompleteSessionModal, TaskContextPanel' },
      { name: 'FilePlus2',   Icon: FilePlus2,   purpose: 'Create new file artifact',                 usedIn: 'CompleteSessionModal, TaskContextPanel' },
      { name: 'FileMinus2',  Icon: FileMinus2,  purpose: 'Remove file from set',                     usedIn: 'CompleteSessionModal, TaskContextPanel' },
      { name: 'FileUp',      Icon: FileUp,      purpose: 'Attach / upload a file',                   usedIn: 'ChatInput' },
      { name: 'FolderInput', Icon: FolderInput, purpose: 'Move into folder / import',                usedIn: 'Sidebar' },
      { name: 'Camera',      Icon: Camera,      purpose: 'Take screenshot / camera capture',         usedIn: 'ChatInput' },
      { name: 'Undo2',       Icon: Undo2,       purpose: 'Undo last step / revert',                  usedIn: 'TaskContextPanel' },
    ],
  },
  {
    group: 'Status & Feedback',
    blurb: 'Semantic state indicators. Pair with accent tokens (green/amber/red/blue).',
    icons: [
      { name: 'Check',         Icon: Check,         purpose: 'Step complete / confirmed',        usedIn: 'shared (StepIndicator, HealthDimensionRow)' },
      { name: 'BadgeCheck',    Icon: BadgeCheck,    purpose: 'Success status',                   usedIn: 'shared (StatusTag: success)' },
      { name: 'AlertTriangle', Icon: AlertTriangle, purpose: 'Warning / pending caution',        usedIn: 'shared (StatusTag: pending)' },
      { name: 'Clock',         Icon: Clock,         purpose: 'In-progress / ETA / expired',      usedIn: 'shared (StatusTag, SummaryFooter, ActionCard)' },
      { name: 'Timer',         Icon: Timer,         purpose: 'Duration estimate',                usedIn: 'shared (ActionCard)' },
      { name: 'XCircle',       Icon: XCircle,       purpose: 'Failed status',                    usedIn: 'shared (StatusTag: failed)' },
      { name: 'Smile',         Icon: Smile,         purpose: 'In-review status',                 usedIn: 'shared (StatusTag: in-review)' },
      { name: 'Activity',      Icon: Activity,      purpose: 'Live / active signal',             usedIn: 'shared, OverviewPage' },
      { name: 'Star',          Icon: Star,          purpose: 'Favorite / highlight',             usedIn: 'shared, LibraryPage' },
      { name: 'Sparkles',      Icon: Sparkles,      purpose: 'AI insight / emphasis',            usedIn: 'shared (InsightBox)' },
      { name: 'AlertCircle',   Icon: AlertCircle,   purpose: 'Inline warning (alt to Triangle)', usedIn: 'CompleteSessionModal, MessageCard' },
      { name: 'CheckCircle2',  Icon: CheckCircle2,  purpose: 'Strong success confirmation',      usedIn: 'CompleteSessionModal, TaskContextPanel' },
      { name: 'Info',          Icon: Info,          purpose: 'Informational hint / tooltip',     usedIn: 'shared, MemoryPage' },
      { name: 'Loader2',       Icon: Loader2,       purpose: 'Indeterminate loading spinner',    usedIn: 'CompleteSessionModal, ArtifactPage, MessageCard' },
      { name: 'ShieldAlert',   Icon: ShieldAlert,   purpose: 'Permission prompt / risky action', usedIn: 'PermissionPrompt' },
      { name: 'ShieldOff',     Icon: ShieldOff,     purpose: 'Permission denied / blocked',      usedIn: 'TaskContextPanel' },
      { name: 'Gauge',         Icon: Gauge,         purpose: 'Performance / metric reading',     usedIn: 'OverviewPage' },
    ],
  },
  {
    group: 'Content & Data',
    blurb: 'File types, artifacts, and data-bearing items.',
    icons: [
      { name: 'FileText',        Icon: FileText,        purpose: 'Document / doc artifact',       usedIn: 'shared, LibraryPage' },
      { name: 'File',            Icon: File,            purpose: 'Generic file',                  usedIn: 'TaskContextPanel' },
      { name: 'FileCode2',       Icon: FileCode2,       purpose: 'Code file',                     usedIn: 'shared, Library' },
      { name: 'FileSpreadsheet', Icon: FileSpreadsheet, purpose: 'Spreadsheet artifact',          usedIn: 'LibraryPage' },
      { name: 'Folder',          Icon: Folder,          purpose: 'Folder / grouping',             usedIn: 'Sidebar, Library' },
      { name: 'FolderOpen',      Icon: FolderOpen,      purpose: 'Expanded folder',               usedIn: 'Library' },
      { name: 'Presentation',    Icon: Presentation,    purpose: 'Deck / presentation',           usedIn: 'LibraryPage' },
      { name: 'Video',           Icon: Video,           purpose: 'Video artifact',                usedIn: 'LibraryPage' },
      { name: 'ImageIcon',       Icon: ImageIcon,       purpose: 'Image artifact',                usedIn: 'LibraryPage' },
      { name: 'StickyNote',      Icon: StickyNote,      purpose: 'Note artifact',                 usedIn: 'LibraryPage' },
      { name: 'Ticket',          Icon: Ticket,          purpose: 'Ticket review card',            usedIn: 'shared (ReviewItemCard)' },
      { name: 'Mail',            Icon: Mail,            purpose: 'Email review card',             usedIn: 'shared (ReviewItemCard)' },
      { name: 'Code2',           Icon: Code2,           purpose: 'Code reference',                usedIn: 'shared, DevTools' },
      { name: 'GitBranch',       Icon: GitBranch,       purpose: 'Worktree / branch indicator',   usedIn: 'Sidebar' },
      { name: 'FolderClosed',    Icon: FolderClosed,    purpose: 'Collapsed folder (alt to Folder)', usedIn: 'ProjectPage, ChatPanel' },
      { name: 'FileImage',       Icon: FileImage,       purpose: 'Image-type file artifact',      usedIn: 'shared' },
      { name: 'FileQuestion',    Icon: FileQuestion,    purpose: 'Unknown / unsupported file',    usedIn: 'DetailPanel' },
      { name: 'Calendar',        Icon: Calendar,        purpose: 'Date / event reference',        usedIn: 'ArtifactPage' },
      { name: 'CalendarClock',   Icon: CalendarClock,   purpose: 'Scheduled / time-bound event',  usedIn: 'OverviewPage' },
      { name: 'MapPin',          Icon: MapPin,          purpose: 'Location reference',            usedIn: 'ArtifactPage' },
      { name: 'GitMerge',        Icon: GitMerge,        purpose: 'Merge / sync workflow step',    usedIn: 'TaskContextPanel' },
      { name: 'BarChart3',       Icon: BarChart3,       purpose: 'Chart / quantitative summary',  usedIn: 'OverviewPage' },
    ],
  },
  {
    group: 'Communication',
    blurb: 'Chat, mention, and conversation affordances.',
    icons: [
      { name: 'MessageSquare', Icon: MessageSquare, purpose: 'Chat session entry',          usedIn: 'Sidebar, ChatPanel' },
      { name: 'MessageCircle', Icon: MessageCircle, purpose: 'Active step / thread',        usedIn: 'TaskContextPanel' },
      { name: 'AtSign',        Icon: AtSign,        purpose: 'Mention / address someone',   usedIn: 'ChatInput' },
      { name: 'Mic',           Icon: Mic,           purpose: 'Voice capture',               usedIn: 'ChatInput' },
      { name: 'CheckSquare',   Icon: CheckSquare,   purpose: 'Task / todo item',            usedIn: 'shared' },
      { name: 'User',          Icon: User,          purpose: 'Author / person avatar',      usedIn: 'shared (TimePill)' },
    ],
  },
  {
    group: 'Theme & Utility',
    blurb: 'App-wide utility — theme toggle, intelligence, fallbacks.',
    icons: [
      { name: 'Sun',    Icon: Sun,    purpose: 'Light-mode theme toggle',        usedIn: 'Sidebar footer' },
      { name: 'Moon',   Icon: Moon,   purpose: 'Dark-mode theme toggle',         usedIn: 'Sidebar footer' },
      { name: 'Brain',  Icon: Brain,  purpose: 'AI model / intelligence',        usedIn: 'Onboarding, shared' },
      { name: 'Zap',    Icon: Zap,    purpose: 'Fast path / quick action',       usedIn: 'shared' },
      { name: 'Globe',  Icon: Globe,  purpose: 'Fallback connector icon',       usedIn: 'ConnectorsPage (BrandLogo fallback)' },
      { name: 'Lock',        Icon: Lock,        purpose: 'Locked / protected affordance',     usedIn: 'PasswordModal, LoginScreen' },
      { name: 'MonitorPlay', Icon: MonitorPlay, purpose: 'Demo / video playback surface',     usedIn: 'shared' },
      { name: 'Smartphone',  Icon: Smartphone,  purpose: 'Mobile device / responsive context',usedIn: 'shared' },
      { name: 'Volume2',     Icon: Volume2,     purpose: 'Audio on / play sound',             usedIn: 'OverviewPage, MessageCard' },
      { name: 'VolumeX',     Icon: VolumeX,     purpose: 'Audio muted',                       usedIn: 'MessageCard' },
    ],
  },
  {
    group: 'Activities & Categories',
    blurb: 'Decorative category labels — used in Overview / project tagging, not in chrome.',
    icons: [
      { name: 'Baby',       Icon: Baby,       purpose: 'Family / parenting category',  usedIn: 'OverviewPage' },
      { name: 'Briefcase',  Icon: Briefcase,  purpose: 'Work category',                usedIn: 'OverviewPage' },
      { name: 'Dice5',      Icon: Dice5,      purpose: 'Games / chance category',      usedIn: 'OverviewPage' },
      { name: 'Footprints', Icon: Footprints, purpose: 'Health / fitness category',    usedIn: 'OverviewPage' },
      { name: 'Gamepad2',   Icon: Gamepad2,   purpose: 'Gaming category',              usedIn: 'OverviewPage' },
      { name: 'Rocket',     Icon: Rocket,     purpose: 'Launch / growth category',     usedIn: 'OverviewPage' },
    ],
  },
];

// Flat helper for the size & color showcase at the top.
const SHOWCASE_ICON = Search;

// ---------- Principles tab ----------
// Text-only rules. Components, tokens, and layouts live in their own tabs —
// never duplicate them here. This tab answers "what are the rules" only.

const PRINCIPLES: { n: number; title: string; rule: string; why?: string; refTab?: string }[] = [
  {
    n: 1,
    title: 'Shared-first',
    rule: 'Build reusable UI in src/components/shared.tsx, then import into pages. Never copy component code inline.',
    why: 'One source of truth means token changes propagate everywhere automatically.',
    refTab: 'Component Library',
  },
  {
    n: 2,
    title: 'Tokens-first',
    rule: 'Use CSS variables and utility classes for every color, size, and spacing. Never hardcode hex, px font sizes, or arbitrary spacing values.',
    why: 'Tokens are the only way light/dark mode and future rebrands stay coherent.',
    refTab: 'Design Foundations',
  },
  {
    n: 3,
    title: 'One Primary button per view',
    rule: 'Use PrimaryButton (gradient CTA) at most once per view. Multiple gradient CTAs dilute the focal point.',
    why: 'The gradient is a visual anchor — duplicating it creates ambiguity about the primary action.',
  },
  {
    n: 4,
    title: '1–2% gradient budget',
    rule: 'The brand gradient (#7652B9 → #B46470 → #CA9D8C) is reserved for the single focal element per view: the primary CTA, a hover affordance, or a hero title.',
    why: 'Gradient saturation breaks the hierarchy and reads as decorative rather than meaningful.',
  },
  {
    n: 5,
    title: 'Callouts are blue, not gradient',
    rule: 'Use --color-accent-blue (#3171FF) for selected chips, links, progress, and focus rings. Never substitute the brand gradient for these signals.',
  },
  {
    n: 6,
    title: 'StatusTag success green is unique',
    rule: 'The success green (--color-accent-green) appears only inside StatusTag variant="success". Do not repurpose it for other UI.',
    why: 'Reserving the color keeps "success" visually unambiguous across the product.',
  },
  {
    n: 7,
    title: '5 text styles only',
    rule: 'Use .type-display-xl, .type-display, .type-h1, .type-h1--emphasized, .type-body, .type-body-emphasized, .type-h2, .type-h2-emphasized, .type-h3, .type-detail, .type-detail-emphasized, .type-caption, .type-footnote. Forbidden running-text sizes: 9, 10, 13, 17, 18, 24, 28, 32 px. 11/12 are valid only via .type-footnote / .type-caption.',
    refTab: 'Design Foundations',
  },
  {
    n: 8,
    title: 'Icons = lucide-react',
    rule: 'All icons come from lucide-react. Never render letters or abbreviations as icon stand-ins. Never import another icon library or inline SVG.',
    refTab: 'Design Foundations',
  },
  {
    n: 9,
    title: 'Dark-mode is automatic',
    rule: 'All colors must come from CSS variables bound to :root / .dark. Monochrome PNG assets use .icon-theme for auto-inversion. Lucide SVGs inherit currentColor.',
  },
  {
    n: 10,
    title: 'Three-panel shell',
    rule: 'Every feature is a slot inside NavPanel, ConversationPanel, or InspectorPanel. Do not introduce new top-level chrome.',
    refTab: 'Layout Templates',
  },
  {
    n: 11,
    title: 'Review queue for new components',
    rule: 'If an existing shared component cannot satisfy a need, build the new one in shared.tsx and register it in the Review Queue tab. Approved components get promoted; rejected ones revert to the closest existing primitive.',
    refTab: 'Review Queue',
  },
];

/* ═══════════════════════════════════════════════════
   Search index — flat list of every searchable item.
   Derived from the same arrays the tabs render from,
   plus a manual list for layouts / components / review
   where items live inline in JSX. Matches on name,
   description, or section (case-insensitive).
   ═══════════════════════════════════════════════════ */
type SearchEntry = {
  tab: TabId;
  section: string;
  name: string;
  description?: string;
};

const SEARCH_INDEX: SearchEntry[] = [
  // Foundations — Colors
  ...SURFACE_TOKENS.map<SearchEntry>(t => ({
    tab: 'foundations',
    section: 'Foundations · Color · Surface & Text',
    name: t.name,
    description: `${t.cssVar}${t.tailwind ? ' · ' + t.tailwind : ''} — ${t.usage}`,
  })),
  ...ACCENT_TOKENS.map<SearchEntry>(t => ({
    tab: 'foundations',
    section: 'Foundations · Color · Accent / Status',
    name: t.name,
    description: `${t.cssVar} — ${t.usage}`,
  })),
  ...BRAND_STOPS.map<SearchEntry>(s => ({
    tab: 'foundations',
    section: 'Foundations · Color · Brand Gradient',
    name: `Brand · ${s.stop}`,
    description: s.cssVar,
  })),
  // Foundations — Typography
  ...TYPE_SCALE.map<SearchEntry>(r => ({
    tab: 'foundations',
    section: 'Foundations · Typography',
    name: r.label,
    description: `.${r.className} · ${r.size}/${r.lh}/${r.weight} — ${r.usage}`,
  })),
  // Foundations — Typography Outliers
  ...TYPE_OUTLIERS.map<SearchEntry>(o => ({
    tab: 'foundations',
    section: 'Foundations · Typography Outliers',
    name: o.label,
    description: `${o.classes} · ${o.usedIn.join(' · ')}`,
  })),
  // Foundations — Spacing
  ...SPACING_SCALE.map<SearchEntry>(s => ({
    tab: 'foundations',
    section: 'Foundations · Spacing',
    name: s.token,
    description: `${s.css} · ${s.tailwind} — ${s.usage}`,
  })),
  // Foundations — Radius
  ...RADIUS_SCALE.map<SearchEntry>(r => ({
    tab: 'foundations',
    section: 'Foundations · Radius',
    name: r.token,
    description: `${r.css} — ${r.usage}`,
  })),
  // Foundations — Icons
  ...ICON_GROUPS.flatMap<SearchEntry>(g =>
    g.icons.map(i => ({
      tab: 'foundations' as TabId,
      section: `Foundations · Icons · ${g.group}`,
      name: i.name,
      description: `${i.purpose} · used in ${i.usedIn}`,
    })),
  ),
  // Principles
  ...PRINCIPLES.map<SearchEntry>(p => ({
    tab: 'principles',
    section: `Principle ${p.n}`,
    name: p.title,
    description: p.rule,
  })),
  // Layouts
  { tab: 'layouts', section: 'Layout Templates', name: 'App Shell — Three-Panel Structure', description: 'NavPanel + ConversationPanel + InspectorPanel — the shell every view composes into' },
  { tab: 'layouts', section: 'Layout Templates', name: 'PageLayout', description: 'Toggle bar + H1 + optional filters + scrollable body — the canonical page shell' },
  { tab: 'layouts', section: 'Layout Templates', name: 'HeaderBar', description: "Slim top bar for pages that don't use PageLayout (mainly ChatPanel)" },
  { tab: 'layouts', section: 'Layout Templates', name: 'SplitView', description: 'Main column + collapsible side column, responsive overlay mode' },
  { tab: 'layouts', section: 'Layout Templates', name: 'SidePanelHeader', description: 'Shared header row for side panels — close button and typography unified' },
  { tab: 'layouts', section: 'Layout Templates', name: 'SidePanelBody', description: 'Scrollable body wrapper that pairs with SidePanelHeader — single source of truth for L/R padding, gap, and scrollbar treatment across right panels' },
  { tab: 'layouts', section: 'Layout Templates', name: 'SideCard', description: 'Collapsible card for right-column panels (Instructions / Scheduled / Files / Context)' },
  // Components — shared primitives
  { tab: 'components', section: 'Components · Shared Primitives', name: 'PrimaryButton · SecondaryButton · TertiaryButton', description: 'Three-tier button system, all h-[48px]. Only ONE Primary per view.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'GhostPillButton', description: 'Pill-shaped bordered secondary action — h-10 rounded-full with optional leading icon.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'HeaderIconButton', description: 'Square 40×40 rounded-xl icon-only button for page headers (close/toggle).' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'NavItem', description: 'Sidebar main-nav list-item — icon + label + optional trailing, .gradient-ring when active.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'AddRowButton', description: 'Inline "add a new row" button — full-width rounded-lg row with leading Plus, secondary → primary text on hover.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'StatusTag', description: 'Semantic status pill — 7 variants (pending, in-progress, submitted, in-review, success, failed, expired).' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'Tag', description: 'Neutral display pill (filled or outline).' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'TimePill', description: 'Blue pill with user icon + time.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'FilterChip', description: 'Master filter chip — active, count, with icon (type-detail / gap-2).' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'Chip', description: 'Inline-content chip — icon, active, removable, draggable (type-h2 / gap-1).' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'UtilityChip', description: 'Mono utility pill for paths / IDs — solid hover, h-8 (font-mono / type-caption).' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'DemoBadge', description: 'Click-to-open demo-mode badge shown in HeaderBar.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'ConnectorCard', description: 'Compact row for an integration — logo + name + Connect / Connected.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'ProgressBar', description: 'Determinate progress bar with optional label.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'CategoryBreakdown', description: 'Stacked percentage bar + color-dot legend for breakdowns like stress analysis.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'StepIndicator', description: 'Done (check) / in-progress (filled dot) / pending (empty circle).' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'MetricCard', description: 'Large centered number with title and subtitle.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'InsightCard', description: 'Sparkle icon + body + action buttons.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'TaskProgressCard', description: 'Clickable progress card that expands to show step list.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'ReviewItemCard', description: 'Needs-review card with metadata, time pill, action button.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'HealthDimensionRow', description: 'Icon + label/desc + auto-colored status pill by value/target.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'SolutionRow', description: 'Emoji + title/desc + right-aligned category tag.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'SummaryFooter', description: 'Right-aligned row with clock icon + summary text.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'SectionTitle', description: 'Emoji + bold title + optional count badge.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'SearchBox', description: 'Responsive search input — desktop pill / mobile icon that expands on tap.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'TextField', description: 'Filled labeled text input with optional leading icon and inline error. Used by LoginScreen, PasswordModal.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'Checkbox', description: 'Accessible checkbox row — label + optional hint, checked/unchecked/disabled states.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'AreaChart', description: 'SVG area chart with Catmull-Rom smoothing, responsive width, x-axis labels.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'ArtifactCard', description: 'Compact file card — icon by file type, name, optional link/click. Used in chat messages.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'EmptyState', description: 'Centered icon + title + optional description for empty sections.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'VersionRow', description: 'Version info row — label, current/latest, status tag. Used by Software Update.' },
  { tab: 'components', section: 'Components · Shared Primitives', name: 'AgentRequiredHint', description: 'Mobile-only notice when a feature needs the local WorkPal Agent. Two variants: card / tip.' },
  // Components — chat & messaging
  { tab: 'components', section: 'Components · Chat & Messaging', name: 'ChatMessage', description: 'User / assistant chat bubble — markdown, chips, feedback bar.' },
  { tab: 'components', section: 'Components · Chat & Messaging', name: 'ChatInput', description: 'Text composer — textarea, attachment menu, voice input.' },
  { tab: 'components', section: 'Components · Chat & Messaging', name: 'MessageCard — 5 variants', description: 'Meeting / research / ticket / schedule / agent cards embedded in chat messages.' },
  // Components — navigation
  { tab: 'components', section: 'Components · Navigation', name: 'Sidebar', description: 'Full left navigation — search, links, projects, recents, theme toggle, profile.' },
  { tab: 'components', section: 'Components · Navigation', name: 'MiniSidebar', description: 'Icon-only collapsed rail.' },
  // Components — side panels & dialogs
  { tab: 'components', section: 'Components · Side Panels & Dialogs', name: 'DetailPanel', description: 'Right-hand document panel with AI transform buttons.' },
  { tab: 'components', section: 'Components · Side Panels & Dialogs', name: 'TaskContextPanel', description: 'Progress steps + folder / context / tools for in-flight tasks.' },
  { tab: 'components', section: 'Components · Side Panels & Dialogs', name: 'NewProjectDialog', description: 'Modal for creating a new project (name + description).' },
  { tab: 'components', section: 'Components · Side Panels & Dialogs', name: 'PermissionPrompt', description: 'Cowork-style permission gate — Cancel / Always allow / Allow, covers 4 kinds.' },
  // Components — project page shared layout
  { tab: 'components', section: 'Components · ProjectPage Shared Layout', name: 'PageLayout (ProjectPage)', description: 'Canonical page shell used by ProjectPage.' },
  { tab: 'components', section: 'Components · ProjectPage Shared Layout', name: 'SplitView (ProjectPage)', description: 'Main + collapsible side column with responsive overlay.' },
  { tab: 'components', section: 'Components · ProjectPage Shared Layout', name: 'SidePanelHeader (ProjectPage)', description: 'Shared header row for side panels.' },
  { tab: 'components', section: 'Components · ProjectPage Shared Layout', name: 'SidePanelBody (ProjectPage)', description: 'Scrollable body wrapper paired with SidePanelHeader.' },
  { tab: 'components', section: 'Components · ProjectPage Shared Layout', name: 'SideCard (ProjectPage)', description: 'Collapsible side-panel card.' },
  // Components — pages
  // Review Queue
  { tab: 'review', section: 'Review · Pending', name: 'ToolbarPill', description: 'ChatInput toolbar pill — rounded border, hover gradient, leading/trailing slots.' },
  { tab: 'review', section: 'Review · Pending', name: 'ToolbarIconButton', description: 'Icon-only sibling of ToolbarPill — square, same height token.' },
  { tab: 'review', section: 'Review · Pending', name: 'ToolbarSegmented', description: 'Connected 3-in-1 segmented pill sharing one outer border.' },
  { tab: 'review', section: 'Review Queue', name: 'Approved (promoted to shared.tsx)', description: 'Approved components permanently promoted to shared.tsx.' },
  { tab: 'review', section: 'Review Queue', name: 'Rejected', description: 'Rejected components — reverted to the closest existing primitive.' },
];

function SearchResults({
  query,
  onPick,
}: {
  query: string;
  onPick: (tab: TabId) => void;
}) {
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      SEARCH_INDEX.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          e.section.toLowerCase().includes(q),
      ),
    [q],
  );

  if (matches.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-stroke-outline p-8 text-center"
        style={{ background: 'var(--color-bg-page)' }}
      >
        <p className="type-detail text-text-primary mb-1">No matches for &ldquo;{query}&rdquo;</p>
        <p className="type-caption text-text-secondary">
          Try a token name (<code className="font-mono">--color-text-primary</code>), a component name (<code className="font-mono">StatusTag</code>), or a principle keyword (<code className="font-mono">gradient</code>).
        </p>
      </div>
    );
  }

  // Group by tab, preserving TABS display order.
  const grouped: { tab: TabId; entries: SearchEntry[] }[] = TABS
    .map(t => ({ tab: t.id, entries: matches.filter(m => m.tab === t.id) }))
    .filter(g => g.entries.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <p className="type-caption text-text-secondary">
        {matches.length} result{matches.length === 1 ? '' : 's'} for{' '}
        <strong className="text-text-primary">&ldquo;{query}&rdquo;</strong>
      </p>
      {grouped.map(({ tab, entries }) => {
        const tabMeta = TABS.find(t => t.id === tab)!;
        return (
          <div
            key={tab}
            className="rounded-2xl border border-stroke-outline p-5"
            style={{ background: 'var(--color-bg-page)' }}
          >
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="type-footnote font-semibold uppercase tracking-[0.5px] text-text-secondary">Tab</span>
                <span className="type-detail-emphasized text-text-primary">{tabMeta.label}</span>
                <span className="type-caption text-text-secondary">· {entries.length}</span>
              </div>
              <button
                onClick={() => onPick(tab)}
                className="type-caption font-medium px-3 py-1 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors text-text-primary"
              >
                Open tab
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {entries.map((e, i) => (
                <li key={`${e.tab}-${e.section}-${e.name}-${i}`}>
                  <button
                    onClick={() => onPick(tab)}
                    className="w-full text-left rounded-xl border border-stroke-outline hover:bg-bg-hover transition-colors p-3"
                  >
                    <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                      <span className="type-caption font-semibold text-text-primary">{e.name}</span>
                      <span className="type-caption text-text-secondary">· {e.section}</span>
                    </div>
                    {e.description && (
                      <p className="type-caption text-text-secondary">{e.description}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PrinciplesTab() {
  return (
    <div>
      {/* Intro card */}
      <div
        className="mb-6 rounded-2xl border p-5"
        style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-outline)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="type-body">📏</span>
          <span className="type-body-emphasized text-text-primary">The rules, and only the rules</span>
        </div>
        <p className="type-detail text-text-secondary">
          These are the 11 principles that govern every WorkPal UI decision. Tokens live in
          <span className="type-detail-emphasized text-text-primary"> Design Foundations</span>, layout shells in
          <span className="type-detail-emphasized text-text-primary"> Layout Templates</span>, and live components in the
          <span className="type-detail-emphasized text-text-primary"> Component Library</span> — not here.
        </p>
      </div>

      {/* Principle list */}
      <ol className="space-y-3">
        {PRINCIPLES.map((p) => (
          <li
            key={p.n}
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--color-stroke-outline)', background: 'var(--color-bg-page)' }}
          >
            <div className="flex items-start gap-4">
              <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center type-detail-emphasized"
                style={{
                  background: 'var(--color-selected-bg)',
                  color: 'var(--color-selected-text)',
                }}
              >
                {p.n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="type-body-emphasized text-text-primary mb-1">{p.title}</div>
                <p className="type-body text-text-primary mb-2">{p.rule}</p>
                {p.why && (
                  <p className="type-detail text-text-secondary">
                    <span className="type-detail-emphasized text-text-primary">Why: </span>
                    {p.why}
                  </p>
                )}
                {p.refTab && (
                  <p className="type-detail text-text-tertiary mt-1">
                    See <span className="type-detail-emphasized text-text-secondary">{p.refTab}</span> tab for examples.
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FoundationsTab() {
  return (
    <div>
      {/* Intro card */}
      <div className="mb-6 rounded-2xl border p-5" style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-outline)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="type-body">🎨</span>
          <span className="type-body-emphasized text-text-primary">Single source of truth</span>
        </div>
        <p className="type-detail text-text-primary">
          Every color, font size, spacing step, and radius below is a <strong>token</strong>, not a hardcoded value.
          Edit the CSS variable in <code className="type-caption font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-page)', color: 'var(--color-accent-blue)' }}>src/index.css</code> once and every component, page, and screen — onboarding, chat messages, cards, charts — picks up the change automatically through the Tailwind mapping in <code className="type-caption font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-page)', color: 'var(--color-accent-blue)' }}>tailwind.config.js</code>.
        </p>
        <p className="type-detail text-text-primary mt-2">
          <strong>Rule:</strong> never hardcode a hex, font size, or pixel spacing. If a token is missing, add it here first, then use it.
        </p>
      </div>

      {/* ─── Color palette ─── */}
      <SectionTitle id="ds-foundation-color">Color Palette</SectionTitle>

      <div className="mb-5 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-3">Surface & Text — bound to <code className="type-caption font-mono">--color-*</code>, mode-aware (light/dark)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SURFACE_TOKENS.map(t => <Swatch key={t.cssVar} token={t} />)}
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Accent / Status — semantic callouts</div>
        <p className="type-detail text-text-secondary mb-3">Use for tags, badges, and single-purpose callouts. Do NOT use for headlines or primary actions.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ACCENT_TOKENS.map(t => <Swatch key={t.cssVar} token={t} />)}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Brand Gradient</div>
        <p className="type-detail text-text-secondary mb-3">
          The identity accent — <strong>1–2% of any page</strong>. Reserved for the primary CTA, onboarding title, first-time states, and loading dots.
        </p>
        <div
          className="h-16 w-full rounded-xl border border-stroke-outline mb-3"
          style={{ background: 'linear-gradient(74deg, var(--brand-grad-start) 0%, var(--brand-grad-mid) 52%, var(--brand-grad-end) 100%)' }}
        />
        <div className="grid grid-cols-3 gap-3">
          {BRAND_STOPS.map(s => (
            <div key={s.cssVar} className="rounded-xl border border-stroke-outline overflow-hidden">
              <div className="h-12" style={{ background: `var(${s.cssVar})` }} />
              <div className="p-2">
                <div className="type-detail-emphasized text-text-primary">{s.stop}</div>
                <code className="block type-caption font-mono text-text-secondary">{s.cssVar}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Typography scale ─── */}
      <SectionTitle id="ds-foundation-type">Typography Scale</SectionTitle>

      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <p className="type-detail text-text-secondary mb-4">
          Eight canonical styles — every text surface in the app picks one. Use the <code className="type-caption font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-blue)' }}>type-*</code> utility classes — never inline <code className="type-caption font-mono">text-[Xpx]</code>. Editing the <code className="type-caption font-mono">--font-*</code> variables in <code className="type-caption font-mono">src/index.css</code> updates every usage app-wide. Each row lists all the surfaces that share the same parameters. <strong>Responsive rule:</strong> detail scales up to 16px on mobile (&lt;768px) so the smallest tier stays readable on phones.
        </p>
        <div className="flex flex-col divide-y divide-stroke-outline">
          {TYPE_SCALE.map(row => (
            <div key={row.className} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3 md:gap-6 items-start">
              <div>
                <div className="type-detail-emphasized text-text-primary">{row.label}</div>
                <code className="block mt-1 type-caption font-mono" style={{ color: 'var(--color-accent-blue)' }}>.{row.className}</code>
                <div className="mt-1 type-caption font-mono text-text-secondary">
                  {row.size}px / {row.lh}px / {row.weight} / {row.tracking}px
                </div>
                <p className="mt-1 type-caption text-text-secondary">{row.usage}</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className={`${row.className} text-text-primary`}>{row.sample}</div>
                <ul className="type-caption text-text-secondary flex flex-col gap-0.5">
                  {row.appearances.map(a => <li key={a}>• {a}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Typography outliers ─── */}
      <SectionTitle id="ds-foundation-type-outliers">Typography Outliers</SectionTitle>

      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <p className="type-detail text-text-secondary mb-4">
          Non-canonical styles that intentionally depart from the 11 tokens. Everything else must map to a row in <strong>Typography Scale</strong> above. If a new design needs a style that isn&apos;t there, add it here (or as a new token) — never inline a one-off size.
        </p>
        <div className="flex flex-col divide-y divide-stroke-outline">
          {TYPE_OUTLIERS.map((row, i) => (
            <div key={i} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3 md:gap-6 items-start">
              <div>
                <div className="type-detail-emphasized text-text-primary">{row.label}</div>
                <code className="block mt-1 type-caption font-mono leading-[16px]" style={{ color: 'var(--color-accent-blue)' }}>{row.classes}</code>
                <div className="mt-1 type-caption font-mono text-text-secondary">
                  Maps to <code>{row.maps}</code>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-text-primary" style={row.sampleStyle}>{row.sample}</div>
                <p className="type-caption text-text-secondary">{row.note}</p>
                <ul className="type-caption text-text-secondary flex flex-col gap-0.5">
                  {row.usedIn.map(u => <li key={u}>• {u}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Spacing scale ─── */}
      <SectionTitle id="ds-foundation-space">Spacing Scale</SectionTitle>

      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <p className="type-detail text-text-secondary mb-4">
          Mirrors the Tailwind spacing scale. Always snap to a step — never <code className="type-caption font-mono">gap-[9px]</code> or <code className="type-caption font-mono">p-[17px]</code>.
        </p>
        <div className="flex flex-col gap-3">
          {SPACING_SCALE.map(s => {
            const px = parseInt(s.css, 10);
            return (
              <div key={s.token} className="grid grid-cols-[120px_1fr_140px] md:grid-cols-[140px_1fr_180px_1fr] gap-3 items-center">
                <div>
                  <code className="type-caption font-mono text-text-primary">{s.token}</code>
                  <div className="type-caption font-mono text-text-secondary">{s.css}</div>
                </div>
                <div className="h-4 rounded" style={{ width: px, background: 'var(--color-accent-blue)' }} aria-hidden />
                <code className="type-caption font-mono text-text-secondary">{s.tailwind}</code>
                <p className="hidden md:block type-caption text-text-secondary">{s.usage}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Border radius ─── */}
      <SectionTitle id="ds-foundation-radius">Border Radius</SectionTitle>

      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {RADIUS_SCALE.map(r => (
            <div key={r.token} className="flex flex-col items-start">
              <div
                className="w-full h-20 border border-stroke-outline mb-2"
                style={{ background: 'var(--color-bg-hover)', borderRadius: `var(${r.token})` }}
                aria-hidden
              />
              <code className="type-caption font-mono text-text-primary">{r.token}</code>
              <div className="type-caption font-mono text-text-secondary">{r.css}</div>
              <p className="mt-1 type-caption text-text-secondary">{r.usage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Icon library ─── */}
      <SectionTitle id="ds-foundation-icons">Icon Library</SectionTitle>

      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <p className="type-detail text-text-primary mb-1"><strong>Library:</strong> <code className="type-caption font-mono" style={{ color: 'var(--color-accent-blue)' }}>lucide-react</code> — the single icon source.</p>
        <p className="type-detail text-text-secondary">
          Never import from any other icon library, and never inline custom SVGs in components. Icons inherit <code className="type-caption font-mono">currentColor</code> — size with the <code className="type-caption font-mono">size</code> prop; color via parent text color or a direct <code className="type-caption font-mono">color</code> style. Default stroke width is <code className="type-caption font-mono">2</code>.
        </p>
      </div>

      {/* Size ramp — real SVG rendered at every ramp step */}
      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Size ramp</div>
        <p className="type-detail text-text-secondary mb-4">
          Preferred sizes. Snap to one of these; avoid arbitrary values. Showcasing <code className="type-caption font-mono">&lt;Search /&gt;</code> at each step.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          {[12, 14, 16, 20, 24, 28, 32].map(sz => (
            <div key={sz} className="flex flex-col items-center gap-2">
              <div
                className="flex items-center justify-center rounded-lg border border-stroke-outline"
                style={{ width: 56, height: 56, background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
              >
                <SHOWCASE_ICON size={sz} />
              </div>
              <code className="type-caption font-mono text-text-primary">size={sz}</code>
              <span className="type-caption text-text-secondary">{sz === 16 ? 'default' : sz === 20 ? 'sidebar' : sz === 24 ? 'toolbar' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Color showcase — real SVG rendered with semantic tokens */}
      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Color</div>
        <p className="type-detail text-text-secondary mb-4">
          Icons render with <code className="type-caption font-mono">currentColor</code> — color comes from the text color of the parent, or an inline <code className="type-caption font-mono">color</code> style pointing at a token. Showcasing <code className="type-caption font-mono">&lt;BadgeCheck /&gt;</code>, <code className="type-caption font-mono">&lt;AlertTriangle /&gt;</code>, <code className="type-caption font-mono">&lt;XCircle /&gt;</code>, <code className="type-caption font-mono">&lt;Clock /&gt;</code>, <code className="type-caption font-mono">&lt;Sparkles /&gt;</code>.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Primary',   token: '--color-text-primary',   Icon: Search,        cssVar: '--color-text-primary' },
            { label: 'Secondary', token: '--color-text-secondary', Icon: Search,        cssVar: '--color-text-secondary' },
            { label: 'Success',   token: '--color-accent-green',   Icon: BadgeCheck,    cssVar: '--color-accent-green' },
            { label: 'Warning',   token: '--color-accent-amber',   Icon: AlertTriangle, cssVar: '--color-accent-amber' },
            { label: 'Danger',    token: '--color-accent-red',     Icon: XCircle,       cssVar: '--color-accent-red' },
            { label: 'Info',      token: '--color-accent-blue',    Icon: Clock,         cssVar: '--color-accent-blue' },
            { label: 'Violet',    token: '--color-accent-violet',  Icon: Sparkles,      cssVar: '--color-accent-violet' },
            { label: 'Orange',    token: '--color-accent-orange',  Icon: Clock,         cssVar: '--color-accent-orange' },
            { label: 'Neutral',   token: '--color-accent-neutral', Icon: Clock,         cssVar: '--color-accent-neutral' },
            { label: 'Tertiary',  token: '--color-text-tertiary',  Icon: Clock,         cssVar: '--color-text-tertiary' },
          ].map(r => {
            const Ico = r.Icon;
            return (
              <div key={r.label} className="flex items-center gap-3 rounded-xl border border-stroke-outline px-3 py-2.5">
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{ width: 40, height: 40, background: 'var(--color-bg-hover)', color: `var(${r.cssVar})` }}
                >
                  <Ico size={20} />
                </div>
                <div className="min-w-0">
                  <div className="type-detail-emphasized text-text-primary truncate">{r.label}</div>
                  <code className="block type-caption font-mono text-text-secondary truncate">{r.token}</code>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stroke weight showcase */}
      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Stroke weight</div>
        <p className="type-detail text-text-secondary mb-4">
          Default is <code className="type-caption font-mono">2</code>. Heavier weights read better at very small sizes; lighter weights at large display sizes.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          {[1, 1.5, 2, 2.5, 3].map(sw => (
            <div key={sw} className="flex flex-col items-center gap-2">
              <div
                className="flex items-center justify-center rounded-lg border border-stroke-outline"
                style={{ width: 56, height: 56, background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
              >
                <SHOWCASE_ICON size={24} strokeWidth={sw} />
              </div>
              <code className="type-caption font-mono text-text-primary">strokeWidth={sw}</code>
            </div>
          ))}
        </div>
      </div>

      {/* In-context samples — icon + label pairings that actually ship in the app */}
      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">In context</div>
        <p className="type-detail text-text-secondary mb-4">Real icon-plus-label pairings as they appear in the app.</p>
        <div className="flex flex-wrap gap-2">
          {/* Sidebar nav row */}
          <div className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-stroke-outline text-text-primary" style={{ background: 'var(--color-bg-hover)' }}>
            <LayoutDashboard size={16} />
            <span className="type-detail-emphasized">Overview</span>
          </div>
          {/* Primary CTA */}
          <div className="inline-flex items-center gap-2 px-3 h-9 rounded-lg text-white" style={{ background: 'var(--color-accent-blue)' }}>
            <Plus size={16} />
            <span className="type-detail-emphasized">New Project</span>
          </div>
          {/* Status pill: success */}
          <div className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full type-detail-emphasized" style={{ background: 'var(--color-accent-green-bg)', color: 'var(--color-accent-green)' }}>
            <BadgeCheck size={14} />
            Completed
          </div>
          {/* Status pill: pending */}
          <div className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full type-detail-emphasized" style={{ background: 'rgba(168,119,37,0.1)', color: 'var(--color-accent-amber)' }}>
            <AlertTriangle size={14} />
            Needs review
          </div>
          {/* Status pill: in progress */}
          <div className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full type-detail-emphasized" style={{ background: 'rgba(49,113,255,0.1)', color: 'var(--color-accent-blue)' }}>
            <Clock size={14} />
            In progress
          </div>
          {/* Icon-only toolbar button */}
          <button className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-stroke-outline text-text-primary" style={{ background: 'var(--color-bg-page)' }} aria-label="Open side panel">
            <PanelRight size={16} />
          </button>
          {/* Search chip */}
          <div className="inline-flex items-center gap-2 px-3 h-9 rounded-full border border-stroke-outline text-text-secondary" style={{ background: 'var(--color-bg-page)' }}>
            <Search size={16} />
            <span className="type-detail">Search</span>
          </div>
          {/* AI insight header */}
          <div className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full type-detail-emphasized" style={{ background: 'rgba(107,84,230,0.1)', color: 'var(--color-accent-violet)' }}>
            <Sparkles size={14} />
            Stephen's insight
          </div>
        </div>
      </div>

      {/* Catalog — every icon, grouped */}
      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Catalog</div>
        <p className="type-detail text-text-secondary mb-4">
          Every lucide icon currently used across the WorkPal codebase, rendered as the real SVG component.
        </p>
        <div className="flex flex-col gap-5">
          {ICON_GROUPS.map(g => (
            <div key={g.group}>
              <div className="flex items-baseline gap-2 mb-2">
                <div className="type-detail-emphasized text-text-primary">{g.group}</div>
                <span className="type-caption text-text-secondary">· {g.blurb}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {g.icons.map(ic => {
                  const Ico = ic.Icon;
                  return (
                    <div key={ic.name} className="flex items-center gap-3 rounded-xl border border-stroke-outline px-3 py-2.5">
                      <div
                        className="flex items-center justify-center rounded-lg shrink-0"
                        style={{ width: 40, height: 40, background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                      >
                        <Ico size={20} />
                      </div>
                      <div className="min-w-0">
                        <code className="block type-caption font-mono text-text-primary truncate">{ic.name}</code>
                        <p className="type-caption text-text-secondary truncate">{ic.purpose}</p>
                        <p className="text-[10px] text-text-tertiary leading-[13px] truncate">{ic.usedIn}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="type-detail text-text-secondary mt-4">
          <strong>Monochrome PNGs in dark mode:</strong> any <code className="type-caption font-mono">.png</code> logo uses the <code className="type-caption font-mono">.icon-theme</code> class for auto black→white inversion. Lucide SVGs inherit <code className="type-caption font-mono">currentColor</code> and need no inversion.
        </p>
      </div>

      {/* ─── Usage checklist ─── */}
      <div className="mb-6 rounded-2xl border p-5" style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-outline)' }}>
        <div className="type-body-emphasized text-text-primary mb-2">Foundation usage checklist</div>
        <ul className="list-disc pl-5 type-detail text-text-primary space-y-1">
          <li>Colors: use <code className="type-caption font-mono">text-text-*</code> / <code className="type-caption font-mono">bg-bg-*</code> / <code className="type-caption font-mono">border-stroke-outline</code>, or <code className="type-caption font-mono">var(--color-*)</code> inline. Never a raw hex.</li>
          <li>Typography: one of <code className="type-caption font-mono">type-display</code>, <code className="type-caption font-mono">type-h1</code>, <code className="type-caption font-mono">type-body</code>, <code className="type-caption font-mono">type-body-emphasized</code>, <code className="type-caption font-mono">type-h2</code>, <code className="type-caption font-mono">type-h2-emphasized</code>, <code className="type-caption font-mono">type-detail</code>, <code className="type-caption font-mono">type-detail-emphasized</code>.</li>
          <li>Spacing: Tailwind scale (<code className="type-caption font-mono">p-*, gap-*, mt-*</code>). No arbitrary <code className="type-caption font-mono">gap-[9px]</code>.</li>
          <li>Radius: <code className="type-caption font-mono">rounded-lg</code> for cards, <code className="type-caption font-mono">rounded-full</code> for pills, <code className="type-caption font-mono">rounded-[40px]</code> for the app shell.</li>
          <li>Icons: <code className="type-caption font-mono">lucide-react</code> only.</li>
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Tab 2 — Layout Templates
   Every layout shell in shared.tsx, with a live demo,
   spec, and which pages use it.
   ═══════════════════════════════════════════════════ */
function LayoutCard({
  name, pagesUsing, children,
}: { name: string; pagesUsing: string[]; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="type-h2-emphasized text-text-primary">{name}</span>
        <span className="type-caption px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-4 pt-3 border-t border-stroke-outline">
        <div className="type-footnote font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Used by</div>
        <div className="flex flex-wrap gap-2">
          {pagesUsing.map(p => (
            <span key={p} className="type-caption px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LayoutsTab() {
  const [sideOpen, setSideOpen] = useState(true);
  return (
    <div>
      {/* ─── App shell: the three-panel structure every surface plugs into ─── */}
      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="type-h2-emphasized text-text-primary">App Shell — Three-Panel Structure</span>
          <span className="type-caption px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">App.tsx</span>
        </div>
        <p className="type-caption text-text-primary mt-2 mb-4">
          Every WorkPal view composes into a single three-panel shell: <strong>NavPanel</strong> (global navigation), <strong>ConversationPanel</strong> (primary working surface), and <strong>InspectorPanel</strong> (contextual detail). Foundations tokens flow through all three; edit a color once and every panel updates.
        </p>

        {/* Visual diagram */}
        <div className="rounded-xl overflow-hidden border border-stroke-outline mb-4" style={{ background: 'var(--color-bg-hover)' }}>
          <div className="grid grid-cols-[110px_1fr_160px] h-[220px] gap-0">
            {/* NavPanel */}
            <div className="relative border-r border-dashed border-stroke-outline p-3 flex flex-col justify-between" style={{ background: 'var(--color-sidebar-bg)' }}>
              <div>
                <div className="type-detail-emphasized text-text-primary">NavPanel</div>
                <div className="type-caption font-mono text-text-secondary mt-1">300px / 64px collapsed</div>
              </div>
              <div className="flex flex-col gap-1.5" aria-hidden>
                <div className="h-3 rounded" style={{ background: 'var(--color-bg-hover)' }} />
                <div className="h-3 rounded" style={{ background: 'var(--color-bg-hover)' }} />
                <div className="h-3 rounded" style={{ background: 'var(--color-selected-bg)' }} />
                <div className="h-3 rounded" style={{ background: 'var(--color-bg-hover)' }} />
              </div>
            </div>
            {/* ConversationPanel */}
            <div className="relative p-3 flex flex-col" style={{ background: 'var(--color-bg-page)' }}>
              <div className="flex items-center justify-between">
                <div className="type-detail-emphasized text-text-primary">ConversationPanel</div>
                <span className="type-caption font-mono text-text-secondary">flex-1</span>
              </div>
              <div className="type-caption font-mono text-text-secondary mt-1 mb-3">primary working surface · max-w 863px</div>
              <div className="flex-1 flex flex-col justify-end gap-2" aria-hidden>
                <div className="h-5 w-2/3 rounded-lg self-start" style={{ background: 'var(--color-bg-hover)' }} />
                <div className="h-5 w-3/4 rounded-lg self-end" style={{ background: 'var(--color-selected-bg)' }} />
                <div className="h-8 rounded-full border border-stroke-outline" />
              </div>
            </div>
            {/* InspectorPanel */}
            <div className="relative border-l border-dashed border-stroke-outline p-3 flex flex-col justify-between" style={{ background: 'var(--color-bg-page)' }}>
              <div>
                <div className="flex items-center justify-between">
                  <div className="type-detail-emphasized text-text-primary">InspectorPanel</div>
                  <PanelRight size={14} />
                </div>
                <div className="type-caption font-mono text-text-secondary mt-1">280–504px · optional</div>
              </div>
              <div className="flex flex-col gap-1.5" aria-hidden>
                <div className="h-3 rounded w-full" style={{ background: 'var(--color-bg-hover)' }} />
                <div className="h-3 rounded w-5/6" style={{ background: 'var(--color-bg-hover)' }} />
                <div className="h-3 rounded w-2/3" style={{ background: 'var(--color-bg-hover)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Panel → code mapping */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              panel: 'NavPanel',
              role: 'Global navigation, view switching, recents, profile',
              components: ['Sidebar', 'MiniSidebar'],
              sizing: 'Sidebar · 300px · sidebar-bg\nMiniSidebar · 64px · collapsed',
              widthHint: '300 / 64 px',
            },
            {
              panel: 'ConversationPanel',
              role: 'The user\u2019s primary working surface — chat, page content, forms',
              components: ['ChatPanel', 'PageLayout (+ any page)'],
              sizing: 'flex-1 · centered content max-w-[863px]',
              widthHint: 'flex-1',
            },
            {
              panel: 'InspectorPanel',
              role: 'Contextual detail to the right: document, task context, side cards',
              components: ['DetailPanel', 'TaskContextPanel', 'SplitView side'],
              sizing: 'DetailPanel · 504px\nTaskContextPanel · 280px\nOverlays on narrow viewports',
              widthHint: '280 / 504 px',
            },
          ].map(p => (
            <div key={p.panel} className="rounded-xl border border-stroke-outline p-4" style={{ background: 'var(--color-bg-hover)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="type-detail-emphasized text-text-primary">{p.panel}</span>
                <span className="type-caption font-mono text-text-secondary">{p.widthHint}</span>
              </div>
              <p className="type-caption text-text-primary mb-3">{p.role}</p>
              <div className="text-[10px] font-semibold uppercase tracking-[0.5px] text-text-secondary mb-1">Code</div>
              <div className="flex flex-wrap gap-1 mb-3">
                {p.components.map(c => (
                  <code key={c} className="type-caption font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-page)', color: 'var(--color-accent-blue)' }}>{c}</code>
                ))}
              </div>
              <pre className="type-caption font-mono text-text-secondary whitespace-pre-wrap">{p.sizing}</pre>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-stroke-outline">
          <p className="type-caption text-text-primary">
            <strong>Rule:</strong> a new feature is a <em>slot</em> in one of these three panels — never a new top-level chrome element. If you need a new panel primitive, build it in <code className="type-caption font-mono">shared.tsx</code> and register it under the relevant panel here.
          </p>
        </div>
      </div>

      <LayoutCard name="PageLayout" pagesUsing={['OverviewPage', 'LibraryPage', 'ConnectorsPage', 'DesignSystemPage', 'Onboarding', 'ProjectPage', 'ComingSoonPage']}>
        <p className="type-caption text-text-primary mb-3">
          Canonical page shell. Toggle bar + H1 + optional filters + scrollable body. Edit the spec in <code className="type-caption font-mono px-1 rounded text-accent-blue" style={{ background: 'var(--color-bg-hover)' }}>shared.tsx</code> once — every page updates.
        </p>
        <div className="rounded-lg border border-stroke-outline overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
          <div className="p-5">
            <div className="rounded border border-dashed border-stroke-outline flex items-center px-3" style={{ height: 40, background: 'var(--color-bg-page)' }}>
              <span className="type-caption font-mono text-text-secondary">Toggle bar · h-12</span>
            </div>
            <div className="mt-3 rounded border border-dashed border-stroke-outline px-4 py-3" style={{ background: 'var(--color-bg-page)' }}>
              <span className="type-h2-emphasized text-text-primary">Page Title</span>
              <span className="ml-3 type-caption font-mono text-text-secondary">text-[40px] / 48 / 700</span>
            </div>
            <div className="mt-3 rounded border border-dashed border-stroke-outline flex items-center gap-2 px-3 py-2" style={{ background: 'var(--color-bg-page)' }}>
              <span className="px-3 py-1 rounded-full type-caption text-text-primary border border-stroke-outline">Filter A</span>
              <span className="px-3 py-1 rounded-full type-caption text-text-primary border border-stroke-outline">Filter B</span>
              <span className="ml-auto type-caption font-mono text-text-secondary">filters? (optional)</span>
            </div>
            <div className="mt-3 rounded border border-dashed border-stroke-outline flex items-center justify-center" style={{ background: 'var(--color-bg-page)', height: 100 }}>
              <span className="type-caption font-mono text-text-secondary">children · maxWidth: 'full' | 'reading' (863px)</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 type-caption text-text-primary mt-4">
          <div><strong>Toggle bar:</strong> h-12 (48px)</div>
          <div><strong>Horizontal pad:</strong> <code className="font-mono type-caption">px-4 sm:px-8</code></div>
          <div><strong>Title → filters:</strong> mt-6</div>
          <div><strong>Title/filters → content:</strong> mt-8</div>
          <div><strong>maxWidth 'full':</strong> no limit</div>
          <div><strong>maxWidth 'reading':</strong> 863px centered</div>
        </div>
      </LayoutCard>

      <LayoutCard name="HeaderBar" pagesUsing={['ChatPanel']}>
        <p className="type-caption text-text-primary mb-3">
          Slim top bar — hamburger (when sidebar closed) + optional right slot. Used by pages that don't take PageLayout (mainly ChatPanel).
        </p>
        <div className="rounded-lg overflow-hidden border border-stroke-outline" style={{ background: 'var(--color-bg-page)' }}>
          <HeaderBar
            sidebarOpen={false}
            onToggleSidebar={() => {}}
            headerRight={
              <HeaderIconButton ariaLabel="Open context panel">
                <PanelRight size={20} />
              </HeaderIconButton>
            }
          />
        </div>
        <div className="type-caption text-text-primary mt-3">
          <strong>Props:</strong> <code className="font-mono type-caption">sidebarOpen</code>, <code className="font-mono type-caption">onToggleSidebar</code>, <code className="font-mono type-caption">headerRight</code>
        </div>
      </LayoutCard>

      <LayoutCard name="SplitView" pagesUsing={['ProjectPage', 'LibraryPage (detail panel)']}>
        <p className="type-caption text-text-primary mb-3">
          Main column + collapsible side column. Auto-switches to overlay mode when the viewport is too narrow to fit both inline.
        </p>
        <div className="rounded-lg overflow-hidden border border-stroke-outline mb-3" style={{ background: 'var(--color-bg-page)', height: 220 }}>
          <SplitView
            sideOpen={sideOpen}
            onCloseSide={() => setSideOpen(false)}
            sideWidth={240}
            mainMinWidth={280}
            side={
              <div className="h-full border-l border-stroke-outline p-4" style={{ background: 'var(--color-bg-hover)' }}>
                <SidePanelHeader title="Side panel" onClose={() => setSideOpen(false)} />
                <p className="type-caption text-text-secondary">Side column content</p>
              </div>
            }
          >
            <div className="flex-1 p-4 flex items-center justify-center">
              <div className="text-center">
                <p className="type-caption text-text-primary mb-2">Main column</p>
                {!sideOpen && (
                  <TertiaryButton onClick={() => setSideOpen(true)}>Open side panel</TertiaryButton>
                )}
              </div>
            </div>
          </SplitView>
        </div>
        <div className="type-caption text-text-primary">
          <strong>Props:</strong> <code className="font-mono type-caption">side</code>, <code className="font-mono type-caption">sideOpen</code>, <code className="font-mono type-caption">onCloseSide</code>, <code className="font-mono type-caption">sideWidth</code>, <code className="font-mono type-caption">mainMinWidth</code>
        </div>
      </LayoutCard>

      <LayoutCard name="SidePanelHeader" pagesUsing={['ProjectPage side panel', 'TaskContextPanel', 'DetailPanel']}>
        <p className="type-caption text-text-primary mb-3">
          Shared header row for any side panel. Unifies close-button size (40px rounded-xl), hover, and typography across every panel.
        </p>
        <div className="rounded-lg overflow-hidden border border-stroke-outline mb-3" style={{ background: 'var(--color-bg-page)' }}>
          <SidePanelHeader title="Panel title" onClose={() => {}} closeIcon="x" />
        </div>
        <div className="rounded-lg overflow-hidden border border-stroke-outline mb-3" style={{ background: 'var(--color-bg-page)' }}>
          <SidePanelHeader title="With panel-right toggle" onClose={() => {}} closeIcon="panel-right" />
        </div>
        <div className="type-caption text-text-primary">
          <strong>Props:</strong> <code className="font-mono type-caption">title</code>, <code className="font-mono type-caption">onClose</code>, <code className="font-mono type-caption">closeIcon</code> ('x' | 'panel-right'), <code className="font-mono type-caption">closeLabel</code>
        </div>
      </LayoutCard>

      <LayoutCard name="SidePanelBody" pagesUsing={['ProjectPage side panel', 'TaskContextPanel']}>
        <p className="type-caption text-text-primary mb-3">
          Scrollable body that pairs with <code className="font-mono type-caption">SidePanelHeader</code> and holds a vertical stack of <code className="font-mono type-caption">SideCard</code>s. Single source of truth for right-panel L/R padding (px-3) and inter-card gap (gap-4) — switching between project view and task view no longer shifts content horizontally.
        </p>
        <div className="rounded-lg overflow-hidden border border-stroke-outline" style={{ background: 'var(--color-bg-page)', height: 320 }}>
          <div className="flex flex-col h-full">
            <SidePanelHeader title="Panel title" onClose={() => {}} closeIcon="panel-right" />
            <SidePanelBody>
              <SideCard title="Instructions" defaultOpen>
                <p className="type-caption text-text-primary">First card content.</p>
              </SideCard>
              <SideCard title="Files" defaultOpen>
                <p className="type-caption text-text-primary">Second card content.</p>
              </SideCard>
              <SideCard title="Context">
                <p className="type-caption text-text-primary">Third card content.</p>
              </SideCard>
            </SidePanelBody>
          </div>
        </div>
        <div className="type-caption text-text-primary mt-3">
          <strong>Props:</strong> <code className="font-mono type-caption">children</code>. Padding / gap are intentionally not configurable — that's the point.
        </div>
      </LayoutCard>

      <LayoutCard name="SideCard" pagesUsing={['ProjectPage (Instructions/Scheduled/Files/Context)', 'TaskContextPanel']}>
        <p className="type-caption text-text-primary mb-3">
          Collapsible card for right-column side panels. Header with title + optional icon + optional add affordance + chevron.
        </p>
        <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--color-bg-hover)' }}>
          <SideCard title="Instructions" defaultOpen>
            <p className="type-caption text-text-primary">Write guidance for how the assistant should act in this project.</p>
          </SideCard>
          <SideCard title="Scheduled" hasAdd>
            <p className="type-caption text-text-primary">Recurring briefings and workflows.</p>
          </SideCard>
          <SideCard title="Files">
            <p className="type-caption text-text-primary">Attached documents.</p>
          </SideCard>
        </div>
        <div className="type-caption text-text-primary mt-3">
          <strong>Props:</strong> <code className="font-mono type-caption">title</code>, <code className="font-mono type-caption">icon</code>, <code className="font-mono type-caption">hasAdd</code>, <code className="font-mono type-caption">defaultOpen</code>
        </div>
      </LayoutCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Tab 3 — Component Library
   Every shared component, its states, and where it's used.
   ═══════════════════════════════════════════════════ */
type LibEntry = {
  name: string;
  description: string;
  usedIn: string[];
  preview: React.ReactNode;
};

/* ─── Live-preview helpers ────────────────────────────
   Everything below renders the REAL component from the
   app (not a screenshot or mock), inside a constrained
   frame so it can coexist on this page. Foundations
   edits → propagate here automatically.
   ─────────────────────────────────────────────────── */

function LivePreviewFrame({
  height = 560,
  children,
  label = 'Live',
}: {
  height?: number;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider pointer-events-none"
           style={{ background: 'var(--color-accent-green-bg)', color: 'var(--color-accent-green)' }}>
        ● {label}
      </div>
      <div
        className="relative w-full overflow-auto rounded-xl border border-stroke-outline"
        style={{ height, background: 'var(--color-bg-page)' }}
      >
        <div className="relative min-h-full flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Demo fixture data ─── */
const DEMO_USER_MSG: Message = {
  id: 'ds-user-1',
  role: 'user',
  content: 'Can you summarize yesterday\'s design sync?',
  timestamp: new Date(),
};

const DEMO_ASSISTANT_MSG: Message = {
  id: 'ds-assistant-1',
  role: 'assistant',
  content: 'Here\'s the **design sync** summary. We aligned on the onboarding flow, confirmed the review queue approach, and agreed to document tokens in Foundations before expanding the library.',
  timestamp: new Date(),
  chips: [
    { label: 'Create tickets', action: 'create-tickets' },
    { label: 'Share with team', action: 'share' },
  ],
};

const DEMO_CARDS: { key: string; label: string; card: CardData }[] = [
  { key: 'meeting', label: 'Meeting', card: { type: 'meeting', title: 'Design Sync — Mar 12', content: 'Discussed onboarding flow and component library alignment.\n\n**Action items**\n• Document foundations tokens\n• Wire Review Queue approvals' } },
  { key: 'research', label: 'Research', card: { type: 'research', title: 'Alcohol delivery failures', summary: '12 tickets in the last 30 days point to expired IDs and missing signatures. 60% resolve within 2h.', status: 'done', statusLabel: 'Done' } },
  { key: 'ticket', label: 'Ticket',   card: { type: 'ticket', title: 'Review queue approval states', description: 'Add approve / reject UI to new shared components.', assignee: 'Beibei', due: 'Fri', items: [{ text: 'Build Review tab', checked: true }, { text: 'Hook up approval flow', checked: false }], status: 'created', statusLabel: 'Created' } },
  { key: 'schedule', label: 'Schedule', card: { type: 'schedule', title: 'UX review w/ Stephen', date: 'Thu Mar 14', time: '2:00 PM', attendees: ['Stephen', 'Beibei', 'Jordan'], location: 'Zoom', status: 'pending', statusLabel: 'Pending' } },
  { key: 'agent', label: 'Agent',     card: { type: 'agent', title: 'Your new agent is ready', status: 'ready', agentName: 'Hana', agentIntro: 'Hi, I\'m Hana — here to keep your operations calm and organized.' } },
];

const DEMO_CHATS: Chat[] = [
  { id: 'alcohol-delivery', title: 'Alcohol Delivery Issues', lastMessage: 'Find reports about Spark drivers…', timestamp: new Date(), messages: [], isActive: true },
  { id: 'ux-meeting',        title: 'UX Meeting Minutes',      lastMessage: 'Summarize yesterday\'s meeting…',   timestamp: new Date(), messages: [] },
];

const DEMO_PROJECTS = [
  { id: 'proj-agent',   name: 'Agent Design' },
  { id: 'proj-driver',  name: 'Driver Onboarding Redesign' },
];

/* ─── Small live-render wrappers (stateful where needed) ─── */

function LiveSidebar() {
  const [activeChatId, setActiveChatId] = useState('alcohol-delivery');
  const [activeView, setActiveView]     = useState<'chat' | 'connectors' | 'design-system' | 'overview' | 'library' | 'memory' | 'software-update'>('chat');
  const [isDark, setIsDark]             = useState(false);
  return (
    <div className="w-[260px] h-full relative">
      <Sidebar
        chats={DEMO_CHATS}
        activeChatId={activeChatId}
        activeView={activeView}
        activeProjectId={null}
        projects={DEMO_PROJECTS}
        onChatSelect={setActiveChatId}
        onNewChat={() => {}}
        onNewProject={() => {}}
        onProjectSelect={() => {}}
        onViewChange={setActiveView}
        isDark={isDark}
        onToggleDark={() => setIsDark(v => !v)}
        onToggleSidebar={() => {}}
      />
    </div>
  );
}

function LiveMiniSidebar() {
  const [activeView, setActiveView] = useState<'chat' | 'connectors' | 'design-system' | 'overview' | 'library' | 'memory' | 'software-update'>('design-system');
  return (
    <div className="w-[64px] h-full relative">
      <MiniSidebar
        activeChatId=""
        activeView={activeView}
        onChatSelect={() => {}}
        onNewChat={() => {}}
        onViewChange={setActiveView}
        onToggleSidebar={() => {}}
      />
    </div>
  );
}

function LiveChatInput() {
  return (
    <ChatInput
      onSend={() => {}}
      placeholder="Message WorkPal"
      chatKey="ds-demo"
    />
  );
}

function LiveDetailPanel() {
  return (
    <DetailPanel
      title="Design Sync — Mar 12"
      content={
        '**Attendees**\nStephen, Beibei, Jordan\n\n**Agenda**\n• Onboarding flow alignment\n• Review queue states\n• Foundations rollout\n\n**Decisions**\n• Ship Foundations tab first\n• Keep Review queue opt-in per new component\n• Document tokens in src/index.css'
      }
      onClose={() => {}}
    />
  );
}

function LiveTaskContextPanel() {
  return <TaskContextPanel onClose={() => {}} useDemoDefaults folderMaterialized folderPath="~/WorkPal/2026-04-18-alcohol-delivery-issues/" />;
}

function LiveNewProjectDialog() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <PrimaryButton onClick={() => setOpen(true)}>Open &ldquo;New Project&rdquo; dialog</PrimaryButton>
      <p className="type-caption text-text-secondary">Modal mounts into a portal and overlays the page.</p>
      <NewProjectDialog open={open} onClose={() => setOpen(false)} onCreate={() => setOpen(false)} />
    </div>
  );
}

/** Live preview for PermissionPrompt across the 4 kinds it handles.
 *  Each button opens the modal with a different payload so reviewers can see
 *  how the title + body + target pill adapt to each scenario. */
function LivePermissionPrompt() {
  const [request, setRequest] = useState<PermissionRequest | null>(null);
  const [lastDecision, setLastDecision] = useState<string | null>(null);
  const variants: { kind: PermissionKind; label: string; payload: Omit<PermissionRequest, 'id'> }[] = [
    {
      kind: 'file-write',
      label: 'file-write',
      payload: {
        kind: 'file-write',
        target: '~/WorkPal/testing/',
        scope: 'testing',
        reason: 'Drafting migration scripts for the Agent Design component library.',
      },
    },
    {
      kind: 'file-read',
      label: 'file-read',
      payload: {
        kind: 'file-read',
        target: '~/Downloads/driver_reports.zip',
        scope: '~/Downloads/driver_reports.zip',
        reason: 'Needed to extract Q3 Spark driver incident data.',
      },
    },
    {
      kind: 'command',
      label: 'command',
      payload: {
        kind: 'command',
        target: 'npm run build && npm test',
        scope: 'npm run build && npm test',
      },
    },
    {
      kind: 'external-url',
      label: 'external-url',
      payload: {
        kind: 'external-url',
        target: 'https://api.openai.com/v1/embeddings',
        scope: 'api.openai.com',
        reason: 'Generating embeddings for 412 support tickets.',
      },
    },
  ];
  const decide = (label: string) => {
    setRequest(null);
    setLastDecision(label);
    window.setTimeout(() => setLastDecision(null), 2500);
  };
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        {variants.map(v => (
          <PrimaryButton key={v.kind} onClick={() => setRequest({ ...v.payload, id: `demo-${v.kind}` })}>
            Try {v.label}
          </PrimaryButton>
        ))}
      </div>
      <p className="type-caption text-text-secondary">
        Cancel / Always allow / Allow — mirrors the Claude Cowork permission prompt.
      </p>
      {lastDecision && (
        <p className="type-caption text-text-primary" aria-live="polite">
          Last decision: <span className="font-semibold">{lastDecision}</span>
        </p>
      )}
      <PermissionPrompt
        request={request}
        onAllow={() => decide('Allow')}
        onAlwaysAllow={() => decide('Always allow')}
        onCancel={() => decide('Cancel')}
      />
    </div>
  );
}

function LibraryEntry({ entry }: { entry: LibEntry }) {
  return (
    <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="type-detail-emphasized text-text-primary">{entry.name}</span>
        <span className="type-caption px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
      </div>
      <p className="type-caption text-text-primary mb-3">{entry.description}</p>
      <div className="p-4 rounded-xl mb-3">
        {entry.preview}
      </div>
      <div>
        <div className="type-footnote font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Used in</div>
        <div className="flex flex-wrap gap-2">
          {entry.usedIn.map(page => (
            <span key={page} className="type-caption px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">{page}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComponentsTab() {
  const entries: LibEntry[] = [
    {
      name: 'PrimaryButton · SecondaryButton · TertiaryButton',
      description: 'Three-tier button system, all h-[48px] · rounded-[4px] · type-detail-emphasized. Only ONE Primary per view. States: default, disabled, fullWidth.',
      usedIn: ['LoginScreen (Sign in)', 'PasswordModal', 'NewProjectDialog', 'MessageCard (confirm / cancel)', 'CompleteSessionModal', 'PermissionPrompt', 'VoiceMode', 'OverviewPage', 'MemoryPage', 'ConnectorsPage', 'TaskContextPanel'],
      preview: (
        <div className="flex flex-wrap gap-3 items-center">
          <PrimaryButton>Primary</PrimaryButton>
          <PrimaryButton disabled>Disabled</PrimaryButton>
          <SecondaryButton>Secondary</SecondaryButton>
          <SecondaryButton disabled>Disabled</SecondaryButton>
          <TertiaryButton>Tertiary</TertiaryButton>
          <TertiaryButton disabled>Disabled</TertiaryButton>
        </div>
      ),
    },
    {
      name: 'GhostPillButton',
      description: 'Pill-shaped bordered secondary action — h-10, rounded-full, optional leading icon. Sibling of TertiaryButton for page headers where a pill shape fits the surrounding chrome (FilterChip row, etc).',
      usedIn: ['MemoryPage (Add memory)', 'OverviewPage (Export report)'],
      preview: (
        <div className="flex flex-wrap gap-3 items-center">
          <GhostPillButton icon={<Plus size={16} />}>Add memory</GhostPillButton>
          <GhostPillButton>No icon</GhostPillButton>
          <GhostPillButton icon={<Plus size={16} />} disabled>Disabled</GhostPillButton>
        </div>
      ),
    },
    {
      name: 'HeaderIconButton',
      description: 'Square 40×40 rounded-xl icon-only button for page headers and modal-style close/toggle actions. Bigger and rounder than ToolbarIconButton (which is composer-scale: --toolbar-btn-h + rounded-full).',
      usedIn: ['HeaderBar (sidebar toggle, new session)', 'ChatPanel (context panel toggle)', 'MemoryPage (close add form)'],
      preview: (
        <div className="flex flex-wrap gap-3 items-center">
          <HeaderIconButton ariaLabel="Close"><X size={18} /></HeaderIconButton>
          <HeaderIconButton ariaLabel="New session"><SquarePen size={20} /></HeaderIconButton>
          <HeaderIconButton ariaLabel="Open panel"><Sparkles size={20} /></HeaderIconButton>
        </div>
      ),
    },
    {
      name: 'NavItem',
      description: 'Sidebar main-nav list-item button — pill-shaped full-width row with leading icon, flex-1 label, and optional trailing element. Active uses .gradient-ring; inactive uses hover:bg-bg-hover. reserveRightPadding leaves room for a hover-revealed row-menu.',
      usedIn: ['Sidebar (New Session · Overview · Search · New Project · project rows · chat rows)'],
      preview: (
        <div className="flex flex-col gap-1 p-3 rounded-xl" style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-stroke-outline)', width: 280 }}>
          <NavItem
            icon={<SquarePen size={20} className="shrink-0 text-text-primary" />}
            label="New Session"
            active
          />
          <NavItem
            icon={<LayoutDashboard size={20} className="shrink-0 text-text-primary" />}
            label="Overview"
          />
          <NavItem
            label="Untitled chat (reserveRightPadding)"
            reserveRightPadding
          />
        </div>
      ),
    },
    {
      name: 'AddRowButton',
      description: 'Inline "add a new row" button — full-width rounded-lg row with a leading Plus icon. Secondary text by default, darkens to primary on hover to signal "empty slot, click to fill". Sits at the end of an editable list (file list, tag list, etc).',
      usedIn: ['ProjectPage (Add file)'],
      preview: (
        <div className="flex flex-col gap-1 p-3 rounded-xl" style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-stroke-outline)', width: 280 }}>
          <AddRowButton icon={<Plus size={16} />}>Add file</AddRowButton>
          <AddRowButton icon={<Plus size={16} />} disabled>Disabled</AddRowButton>
        </div>
      ),
    },
    {
      name: 'StatusTag',
      description: 'Semantic status pill. 7 variants. States: with/without icon, size md/sm.',
      usedIn: ['MessageCard', 'ConnectorsPage'],
      preview: (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <StatusTag variant="pending"     label="Pending" />
            <StatusTag variant="in-progress" label="In progress" />
            <StatusTag variant="submitted"   label="Submitted" />
            <StatusTag variant="in-review"   label="In review" />
            <StatusTag variant="success"     label="Success" />
            <StatusTag variant="failed"      label="Failed" />
            <StatusTag variant="expired"     label="Expired" />
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusTag variant="success" label="Connected" size="sm" showIcon={false} />
            <StatusTag variant="pending" label="Pending"   size="sm" showIcon={false} />
            <StatusTag variant="failed"  label="Failed"    size="sm" showIcon={false} />
          </div>
        </div>
      ),
    },
    {
      name: 'Tag',
      description: 'Neutral display pill. States: filled (default), outline.',
      usedIn: ['Overview metric badges', 'Onboarding n/3 counter', 'ReviewItemCard', 'SolutionRow'],
      preview: (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Tag>😊 Relaxed</Tag>
            <Tag>2/3</Tag>
            <Tag>48/100 · Low</Tag>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag outline>针对：AI</Tag>
            <Tag outline>针对：Deadline</Tag>
          </div>
        </div>
      ),
    },
    {
      name: 'TimePill',
      description: 'Blue pill with user icon + time. Used for review-time estimates.',
      usedIn: ['ReviewItemCard', 'Overview Needs Review rows'],
      preview: (
        <div className="flex flex-wrap gap-2">
          <TimePill time="~3 min" />
          <TimePill time="~5 min" />
          <TimePill time="~16 min" />
        </div>
      ),
    },
    {
      name: 'FilterChip',
      description: 'Master filter chip. States: active, inactive, with icon, with count. Uses type-detail / gap-2 (filter-bar spec).',
      usedIn: ['Library', 'Tasks', 'Projects', 'Connectors'],
      preview: (
        <div className="flex flex-wrap gap-2 items-center">
          <FilterChip label="All" active count={9} />
          <FilterChip label="Reports" count={2} />
          <FilterChip label="Documents" />
          <FilterChip label="Active" active />
        </div>
      ),
    },
    {
      name: 'Chip',
      description: 'Inline-content chip. States: default, with icon, active (selected), removable, draggable. Uses type-h2 / gap-1 (inline-content spec — distinct from FilterChip).',
      usedIn: ['Onboarding trait picker', 'ChatInput quick chips', 'ChatInput action chips'],
      preview: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Chip label="Create performance goals" />
            <Chip label="Analyze doc(s)" />
            <Chip label="Visualize data" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="🛟 Stable" />
            <Chip label="🧠 Organized" active />
            <Chip label="🤗 Kind" active onRemove={() => {}} />
            <Chip label="🧘 Calm" draggable />
          </div>
        </div>
      ),
    },
    {
      name: 'UtilityChip',
      description: 'Mono utility pill for paths, IDs, and tool-surface labels. Solid bg-bg-hover on hover (not gradient) — deliberately distinct from Chip / FilterChip. Height locked to 32px so it aligns with FilterChip & DemoBadge in toolbars.',
      usedIn: ['ChatPanel header (session folder path chip)'],
      preview: (
        <div className="flex flex-wrap items-center gap-3">
          <UtilityChip icon={<Folder size={14} className="shrink-0" />} maxWidth={320}>
            ~/WorkPal/2026-04-18-alcohol-delivery-research
          </UtilityChip>
          <UtilityChip>ABC-1234</UtilityChip>
        </div>
      ),
    },
    {
      name: 'DemoBadge',
      description: 'Small "Demo" badge with Info icon. Click opens an explainer modal. Visible only when IS_DEMO is true (hidden on localhost / prod).',
      usedIn: ['HeaderBar (top-right across all pages in demo builds)'],
      preview: (
        <div className="flex items-center gap-3">
          <DemoBadge />
          <span className="text-[12px] text-text-secondary">(click to open modal)</span>
        </div>
      ),
    },
    {
      name: 'ConnectorCard',
      description: 'Compact row for an integration. Logo + name + Connect button / Connected tag. 80% bg fill lets the shell gradient show through.',
      usedIn: ['ConnectorsPage (Recommended / Apps / APIs grids)'],
      preview: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <ConnectorCard
            name="Slack"
            logo={
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-hover shrink-0">
                <Globe size={18} className="text-text-primary" />
              </div>
            }
          />
          <ConnectorCard
            name="Gmail"
            connected
            logo={
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-hover shrink-0">
                <Mail size={18} className="text-text-primary" />
              </div>
            }
          />
        </div>
      ),
    },
    {
      name: 'ProgressBar',
      description: 'Determinate progress bar. States: with/without label.',
      usedIn: ['TaskProgressCard', 'MessageCard'],
      preview: (
        <div className="flex flex-col gap-3">
          <ProgressBar value={62} showLabel />
          <ProgressBar value={35} />
        </div>
      ),
    },
    {
      name: 'CategoryBreakdown',
      description: 'Stacked percentage bar + color-dot legend. One visual unit for breakdowns where every category adds up to a whole.',
      usedIn: ['Overview stress analysis'],
      preview: (
        <CategoryBreakdown
          categories={[
            { label: 'Deadline pressure', pct: 35, color: 'var(--color-accent-red)' },
            { label: 'Keeping up with AI', pct: 28, color: 'var(--color-accent-amber)' },
            { label: 'Cross-team alignment', pct: 22, color: 'var(--color-accent-violet)' },
            { label: 'Context switching', pct: 15, color: 'var(--color-accent-blue)' },
          ]}
        />
      ),
    },
    {
      name: 'StepIndicator',
      description: 'Three states: done (check), in-progress (filled dot), pending (empty circle).',
      usedIn: ['TaskProgressCard steps'],
      preview: (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2"><StepIndicator status="done" /><span className="type-caption text-text-primary">Done</span></div>
          <div className="flex items-center gap-2"><StepIndicator status="in-progress" /><span className="type-caption text-text-primary">In progress</span></div>
          <div className="flex items-center gap-2"><StepIndicator status="pending" /><span className="type-caption text-text-primary">Pending</span></div>
        </div>
      ),
    },
    {
      name: 'MetricCard',
      description: 'Large centered number with title and subtitle.',
      usedIn: ['Overview metrics row'],
      preview: (
        <div className="flex gap-3">
          <div className="flex-1 bg-bg-page rounded-xl border border-stroke-outline p-3">
            <MetricCard title="Emotional value" value="10" subtitle="/10" />
          </div>
          <div className="flex-1 bg-bg-page rounded-xl border border-stroke-outline p-3">
            <MetricCard title="Time gained" value="+2h" subtitle="this week" />
          </div>
        </div>
      ),
    },
    {
      name: 'InsightCard',
      description: 'Callout card with sparkle icon, body text, and action buttons.',
      usedIn: ['(currently unused — was on Overview before refactor)'],
      preview: (
        <InsightCard body="Your focus time dropped 40% this week. Want me to protect morning blocks?" actions={[{ label: 'Yes, protect my mornings', secondary: true }, { label: 'Show data' }]} />
      ),
    },
    {
      name: 'TaskProgressCard',
      description: 'Clickable card with progress bar. Expands to show step list.',
      usedIn: ['Overview "Agents at Work" section'],
      preview: (
        <TaskProgressCard title="Analyzing Q2 metrics" progress={62} steps={['Pulling data from Sheets', 'Building charts', 'Formatting']} expanded />
      ),
    },
    {
      name: 'ReviewItemCard',
      description: 'Card with optional urgent accent bar, metadata, time pill, action button.',
      usedIn: ['Overview "Needs your eyes" section'],
      preview: (
        <div className="flex flex-col gap-2">
          <ReviewItemCard title="UX meeting summary — 6 action items" source="Zoom → Docs" type="Document" time="3 min ago" humanTime="~5 min" />
          <ReviewItemCard title="Weekly stakeholder email draft" source="Gmail" type="Email" time="2h ago" humanTime="~3 min" />
        </div>
      ),
    },
    {
      name: 'HealthDimensionRow',
      description: 'Lucide icon + label/desc + auto-colored status pill. Color/icon derive from value/target ratio.',
      usedIn: ['(currently unused — was on Overview before refactor)'],
      preview: (
        <div className="flex flex-col gap-2">
          <HealthDimensionRow icon={Brain} label="Focus Time" desc="9–11am blocked & protected" value={2} target={2} unit="h" />
          <HealthDimensionRow icon={Moon}  label="Sleep"      desc="Last night: 5h — a bit short" value={5} target={7} unit="h" />
          <HealthDimensionRow icon={Home}  label="Family Time" desc="No family time yet today" value={0} target={2} unit="h" />
        </div>
      ),
    },
    {
      name: 'SolutionRow',
      description: 'Row with emoji, title + description, and right-aligned category tag.',
      usedIn: ['(currently unused — was on Overview before refactor)'],
      preview: (
        <div>
          <SolutionRow icon="🎧" title="AI趋势速报" desc="每天3分钟音频" tag="针对：AI" />
          <SolutionRow icon="🧘" title="Focus Block" desc="自动拦截非紧急会议" tag="针对：Deadline" />
        </div>
      ),
    },
    {
      name: 'SummaryFooter',
      description: 'Right-aligned row with clock icon + summary text.',
      usedIn: ['Overview section footers'],
      preview: <SummaryFooter>Total review time: <strong>~16 min</strong> for 3 items</SummaryFooter>,
    },
    {
      name: 'SectionTitle',
      description: 'Emoji + bold title + optional count badge. Use across shared sections.',
      usedIn: ['Overview section headers'],
      preview: (
        <div className="flex flex-col gap-1">
          <SharedSectionTitle emoji="👀" title="Needs Your Eyes" count={3} />
          <SharedSectionTitle emoji="⚡" title="Agents at Work" />
        </div>
      ),
    },
    {
      name: 'SearchBox',
      description: 'Responsive search input. Desktop: expanded pill. Mobile: icon-only that expands on tap.',
      usedIn: ['Library', 'Connectors', 'ProjectPage'],
      preview: <SearchBoxDemo />,
    },
    {
      name: 'TextField',
      description: 'Filled labeled text input with optional label, leading icon, and inline error. Pass `autoComplete` for browser keychain hints (username / current-password).',
      usedIn: ['LoginScreen', 'PasswordModal'],
      preview: <TextFieldDemo />,
    },
    {
      name: 'Checkbox',
      description: 'Accessible checkbox row with label and optional hint text. Renders as a button with role="checkbox". States: checked, unchecked, disabled.',
      usedIn: ['CompleteSessionModal (merge targets)'],
      preview: <CheckboxDemo />,
    },
    {
      name: 'AreaChart',
      description: 'Responsive SVG area chart with Catmull-Rom smoothing. Auto-sizes to container width via ResizeObserver. Pass data as {label, value}[] and optional color.',
      usedIn: ['OverviewPage (weekly trends)'],
      preview: (
        <div className="max-w-[480px]">
          <AreaChart
            data={[
              { label: 'Mon', value: 3 },
              { label: 'Tue', value: 7 },
              { label: 'Wed', value: 5 },
              { label: 'Thu', value: 9 },
              { label: 'Fri', value: 6 },
            ]}
            color="var(--color-accent-blue)"
            height={120}
          />
        </div>
      ),
    },
    {
      name: 'ArtifactCard',
      description: 'Compact file card with icon derived from fileType (Web / Slides / Image / Video / File). Supports click-to-open (onClick) or external link (href). Non-interactive when neither is set.',
      usedIn: ['ChatMessage (claude-code outputs)', 'ProjectPage (Output section)'],
      preview: (
        <div className="flex flex-wrap gap-3">
          <ArtifactCard artifact={{ name: 'report.html', fileType: 'Web', source: 'claude-code' } as ArtifactRef} />
          <ArtifactCard artifact={{ name: 'deck.pptx', fileType: 'Slides', source: 'claude-code' } as ArtifactRef} />
          <ArtifactCard artifact={{ name: 'photo.png', fileType: 'Image', source: 'upload' } as ArtifactRef} />
        </div>
      ),
    },
    {
      name: 'EmptyState',
      description: 'Centered icon + title + optional description. Deliberately minimal — no CTA, no illustration. Reads as "nothing here yet, that\'s expected".',
      usedIn: ['ProjectPage (empty Output / empty Recents)'],
      preview: (
        <div className="flex gap-6">
          <EmptyState icon={Inbox} title="No outputs yet" description="Run a session to generate outputs" />
          <EmptyState icon={FolderOpen} title="No files" />
        </div>
      ),
    },
    {
      name: 'VersionRow',
      description: 'Single row in the Software Update dashboard. Shows component name, current → latest version, and a StatusTag. Loading state shows spinner instead of tag.',
      usedIn: ['SoftwareUpdatePage'],
      preview: (
        <div className="flex flex-col gap-2 max-w-[400px]">
          <VersionRow label="WorkPal Agent" current="0.1.11" latest="0.1.11" status="up-to-date" />
          <VersionRow label="Claude SDK" current="1.2.0" latest="1.3.0" status="update-available" />
          <VersionRow label="OpenAI SDK" current="4.0.0" latest={null} status="unknown" />
        </div>
      ),
    },
    {
      name: 'AgentRequiredHint',
      description: 'Notice shown on mobile when a feature needs the local WorkPal Agent. Two variants: "card" (full-width inline message) and "tip" (compact pill next to a disabled control).',
      usedIn: ['ChatPanel', 'ChatMessage', 'TaskContextPanel', 'ProjectPage', 'SoftwareUpdatePage'],
      preview: (
        <div className="flex flex-col gap-3 max-w-[480px]">
          <AgentRequiredHint variant="card" />
          <AgentRequiredHint variant="tip" message="Open on Mac to reveal this file" />
        </div>
      ),
    },
  ];

  /* ─── Chat & Messaging — live real components ─── */
  const chatEntries: LibEntry[] = [
    {
      name: 'ChatMessage',
      description: 'A single chat bubble — user or assistant. Renders markdown-lite, action chips, optional embedded card, and a feedback bar for AI replies. Real component from src/components/ChatMessage.tsx.',
      usedIn: ['ChatPanel'],
      preview: (
        <div className="flex flex-col gap-2" style={{ background: 'var(--color-bg-page)' }}>
          <ChatMessage message={DEMO_USER_MSG} />
          <ChatMessage message={DEMO_ASSISTANT_MSG} isLastAssistant />
        </div>
      ),
    },
    {
      name: 'ChatInput',
      description: 'Text composer — textarea, attachment menu, voice input. Single input surface: the AI decides when to escalate a message into a complex task and auto-opens the inspector panel.',
      usedIn: ['ChatPanel', 'Onboarding', 'ProjectPage'],
      preview: <LiveChatInput />,
    },
    {
      name: 'MessageCard — 5 variants',
      description: 'Polymorphic card embedded inside an AI message. Switches renderer based on the `type` field: meeting | research | ticket | schedule | agent.',
      usedIn: ['ChatMessage'],
      preview: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEMO_CARDS.map(c => (
            <div key={c.key}>
              <div className="type-footnote uppercase font-semibold tracking-[0.5px] text-text-secondary mb-1">{c.label}</div>
              <MessageCard card={c.card} />
            </div>
          ))}
        </div>
      ),
    },
  ];

  /* ─── Navigation — live ─── */
  const navEntries: LibEntry[] = [
    {
      name: 'Sidebar',
      description: 'Full left navigation: search, primary links, projects, recents, theme toggle, profile. Real component rendered with demo chat / project state.',
      usedIn: ['App (desktop expanded)'],
      preview: (
        <LivePreviewFrame height={600}>
          <LiveSidebar />
        </LivePreviewFrame>
      ),
    },
    {
      name: 'MiniSidebar',
      description: 'Icon-only collapsed rail shown on desktop when the sidebar is closed. Exports the same view-change callbacks as Sidebar.',
      usedIn: ['App (desktop collapsed)'],
      preview: (
        <LivePreviewFrame height={420}>
          <LiveMiniSidebar />
        </LivePreviewFrame>
      ),
    },
  ];

  /* ─── Side panels & dialogs — live ─── */
  const panelEntries: LibEntry[] = [
    {
      name: 'DetailPanel',
      description: 'Right-hand document panel with AI transform buttons (Shorter / Extend / Formal / Translate). Real component.',
      usedIn: ['ChatPanel (when a card is opened)', 'ProjectPage'],
      preview: (
        <LivePreviewFrame height={560}>
          <LiveDetailPanel />
        </LivePreviewFrame>
      ),
    },
    {
      name: 'TaskContextPanel',
      description: 'Inspector panel — progress steps + folder / context / tools file lists. Shows what WorkPal is doing for a task in flight. Auto-opens when the AI invokes its first tool in a chat.',
      usedIn: ['ChatPanel (when AI uses a tool)'],
      preview: (
        <LivePreviewFrame height={560}>
          <LiveTaskContextPanel />
        </LivePreviewFrame>
      ),
    },
    {
      name: 'NewProjectDialog',
      description: 'Modal for creating a new project (name + description). Click the button to live-open and close it.',
      usedIn: ['App (via Sidebar + New Project)'],
      preview: <LiveNewProjectDialog />,
    },
    {
      name: 'PermissionPrompt',
      description: 'Phase 4 permission gate — modeled on Claude Cowork. Cancel / Always allow / Allow, with scope-aware title and body across 4 kinds (file-write, file-read, command, external-url). Rendered via portal; Esc cancels.',
      usedIn: ['App (requestPermission for tool use & external file access)'],
      preview: <LivePermissionPrompt />,
    },
  ];

  /* ─── Project Page · shared layout primitives ─── */
  const projectPageEntries: LibEntry[] = [
    {
      name: 'PageLayout',
      description: 'Canonical page shell used by ProjectPage: toggle bar + H1 + optional filters + scrollable body. One spec in shared.tsx, every page inherits it.',
      usedIn: ['ProjectPage', 'OverviewPage', 'LibraryPage', 'ConnectorsPage', 'DesignSystemPage', 'Onboarding', 'ComingSoonPage'],
      preview: <PageLayoutDemo />,
    },
    {
      name: 'SplitView',
      description: 'Main column + collapsible side column. Auto-switches to overlay mode when the viewport is too narrow to fit both inline. Drives the ProjectPage main/side layout.',
      usedIn: ['ProjectPage', 'LibraryPage (detail panel)'],
      preview: <SplitViewDemo />,
    },
    {
      name: 'SidePanelHeader',
      description: 'Shared header row for any side panel. Unifies close-button size (40px rounded-xl), hover, and typography across every panel. Supports `x` and `panel-right` close icons.',
      usedIn: ['ProjectPage side panel', 'TaskContextPanel', 'DetailPanel'],
      preview: (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg overflow-hidden border border-stroke-outline" style={{ background: 'var(--color-bg-page)' }}>
            <SidePanelHeader title="Panel title" onClose={() => {}} closeIcon="x" />
          </div>
          <div className="rounded-lg overflow-hidden border border-stroke-outline" style={{ background: 'var(--color-bg-page)' }}>
            <SidePanelHeader title="With panel-right toggle" onClose={() => {}} closeIcon="panel-right" />
          </div>
        </div>
      ),
    },
    {
      name: 'SideCard',
      description: 'Collapsible card for right-column side panels. Header with title + optional icon + optional add affordance + chevron. Used for Instructions / Scheduled / Files / Context in ProjectPage.',
      usedIn: ['ProjectPage (Instructions/Scheduled/Files/Context)', 'TaskContextPanel'],
      preview: (
        <div className="flex flex-col gap-2">
          <SideCard title="Instructions" defaultOpen>
            <p className="type-caption text-text-primary">Write guidance for how the assistant should act in this project.</p>
          </SideCard>
          <SideCard title="Scheduled" hasAdd>
            <p className="type-caption text-text-primary">Recurring briefings and workflows.</p>
          </SideCard>
          <SideCard title="Files">
            <p className="type-caption text-text-primary">Attached documents.</p>
          </SideCard>
        </div>
      ),
    },
  ];

  return (
    <div>
      <p className="type-caption text-text-primary mb-5">
        All components below are <strong>rendered live</strong> from the real WorkPal codebase — not screenshots or mocks.
        Foundations changes (colors, typography, spacing, radius) propagate here automatically. Shared primitives live in
        <code className="type-caption font-mono px-1.5 py-0.5 rounded mx-1" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-blue)' }}>src/components/shared.tsx</code>;
        feature components (chat, panels, pages) live next to them in
        <code className="type-caption font-mono px-1.5 py-0.5 rounded mx-1" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-blue)' }}>src/components/*</code>.
        <strong> Always check this library first</strong> before building anything new.
      </p>

      <SectionTitle id="ds-lib-foundations">Foundations · Shared Primitives</SectionTitle>
      <div className="flex flex-col gap-4 mb-8">
        {entries.map(e => <LibraryEntry key={e.name} entry={e} />)}
      </div>

      <SectionTitle id="ds-lib-chat">Chat &amp; Messaging</SectionTitle>
      <div className="flex flex-col gap-4 mb-8">
        {chatEntries.map(e => <LibraryEntry key={e.name} entry={e} />)}
      </div>

      <SectionTitle id="ds-lib-nav">Navigation</SectionTitle>
      <div className="flex flex-col gap-4 mb-8">
        {navEntries.map(e => <LibraryEntry key={e.name} entry={e} />)}
      </div>

      <SectionTitle id="ds-lib-panels">Side Panels &amp; Dialogs</SectionTitle>
      <div className="flex flex-col gap-4 mb-8">
        {panelEntries.map(e => <LibraryEntry key={e.name} entry={e} />)}
      </div>

      <SectionTitle id="ds-lib-project">ProjectPage · Shared Layout</SectionTitle>
      <div className="flex flex-col gap-4 mb-8">
        {projectPageEntries.map(e => <LibraryEntry key={e.name} entry={e} />)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Tab 5 — Agent Videos
   Media assets used by the welcome-state avatars.
   One user-facing action per row:
     - Switch [Active | Inactive] — flips localStorage
       state. Inactive = file kept on disk but skipped
       from the random pool. ChatPanel honors this in
       real time via the same useAgentVideoStatus hook.
   ═══════════════════════════════════════════════════ */

function AgentVideoRow({
  src,
  mode,
  status,
  onSetStatus,
  readOnly,
}: {
  src: string;
  mode: 'light' | 'dark';
  status: VideoStatus;
  onSetStatus: (next: VideoStatus) => void;
  readOnly?: boolean;
}) {
  const fileName  = src.split('/').pop() ?? src;
  const previewBg = mode === 'dark' ? '#1B1B1B' : 'var(--color-bg-hover)';
  const isActive  = status === 'active';
  const videoRef  = useRef<HTMLVideoElement>(null);

  // Keep the preview in sync with `status`. HTMLVideoElement doesn't react to
  // autoPlay prop changes after mount, so we drive play/pause imperatively.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) el.play().catch(() => { /* autoplay may be blocked; harmless */ });
    else el.pause();
  }, [isActive]);

  return (
    <div
      className="rounded-2xl border border-stroke-outline p-4 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: 'var(--color-bg-page)' }}
    >
      {/* Video + metadata cluster — always horizontal, takes the leading
       *  space. Below the sm breakpoint the controls drop to a second row,
       *  so this cluster can keep its natural `gap-4` without competing
       *  with the Switch for width. */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Looping preview — muted thumbnail */}
        <div
          className="w-[72px] h-[72px] rounded-full overflow-hidden shrink-0 relative"
          style={{ background: previewBg }}
        >
          <video
            ref={videoRef}
            src={src}
            autoPlay={isActive}
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ opacity: isActive ? 1 : 0.4 }}
          />
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
              <Pause size={24} className="text-white" />
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="type-caption font-mono text-text-primary truncate">{fileName}</span>
            <span className="type-caption px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary capitalize">
              {mode}
            </span>
          </div>
          <p className="type-caption text-text-secondary font-mono truncate">{src}</p>
        </div>
      </div>

      {/* Controls — wraps below on narrow screens (<sm) and aligns to the
       *  same left edge as the video so the row reads as two stacked
       *  sub-rows rather than orphaned floating buttons. */}
      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
        <Switch<'active' | 'inactive'>
          value={isActive ? 'active' : 'inactive'}
          onChange={next => onSetStatus(next)}
          segments={[
            { value: 'active',   label: 'Active'   },
            { value: 'inactive', label: 'Inactive' },
          ]}
          ariaLabel={`Activation state for ${fileName}`}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

function AgentVideosTab() {
  const { getStatus, setStatus } = useAgentVideoStatus();

  const totals = useMemo(() => {
    let active = 0, inactive = 0;
    for (const agent of AGENTS) {
      for (const v of agent.videos) {
        const s = getStatus(v.src);
        if (s === 'active')        active++;
        else if (s === 'inactive') inactive++;
      }
    }
    return { active, inactive, total: active + inactive };
  }, [getStatus]);

  /** Drop deleted entries — they may be physically gone from historical
   *  deletes, no point rendering a broken `<video src>` for them. */
  const visibleVideos = (mode: 'light' | 'dark', videos: AgentVideo[]) =>
    videos.filter(v => v.mode === mode && getStatus(v.src) !== 'deleted');

  return (
    <div>
      {/* Intro card */}
      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Video size={16} className="text-text-primary" />
          <span className="type-h2-emphasized text-text-primary">Welcome-state avatar videos</span>
        </div>
        <p className="type-caption text-text-primary mb-3">
          Each agent has a pool of idle videos that play in the welcome state of a new chat. One is picked at random per
          session (separately for light / dark mode). The toggle on each row flips between <strong>Active</strong>{' '}
          (in rotation) and <strong>Inactive</strong> (skipped). State syncs across browsers and across deployments via
          Supabase, with a local cache for offline use, and applies in real time everywhere the avatar renders.
        </p>
        {IS_DEMO && (
          <p className="type-caption text-text-secondary mb-3">
            Read-only on this demo deployment — the toggles mirror the curated pool from the main control surface.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <StatusTag variant="success" label={`${totals.active} active`}    size="sm" showIcon={false} />
          <StatusTag variant="pending" label={`${totals.inactive} inactive`} size="sm" showIcon={false} />
          <span className="type-caption text-text-secondary self-center">of {totals.total} total</span>
        </div>
      </div>

      {AGENTS.map(agent => {
        const lightVideos = visibleVideos('light', agent.videos);
        const darkVideos  = visibleVideos('dark',  agent.videos);
        if (lightVideos.length === 0 && darkVideos.length === 0) return null;
        return (
          <div key={agent.id} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--color-bg-hover)' }}>
                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="type-h1--emphasized text-text-primary">{agent.name}</h2>
                <p className="type-caption text-text-secondary">
                  {lightVideos.length} light · {darkVideos.length} dark
                </p>
              </div>
            </div>

            {lightVideos.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2 mt-4">
                  <Sun size={14} className="text-text-primary" />
                  <span className="type-footnote font-semibold text-text-primary uppercase tracking-[0.5px]">Light mode</span>
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  {lightVideos.map(v => (
                    <AgentVideoRow
                      key={v.src}
                      src={v.src}
                      mode="light"
                      status={getStatus(v.src)}
                      onSetStatus={next => setStatus(v.src, next)}
                      readOnly={IS_DEMO}
                    />
                  ))}
                </div>
              </>
            )}

            {darkVideos.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2 mt-4">
                  <Moon size={14} className="text-text-primary" />
                  <span className="type-footnote font-semibold text-text-primary uppercase tracking-[0.5px]">Dark mode</span>
                </div>
                <div className="flex flex-col gap-2">
                  {darkVideos.map(v => (
                    <AgentVideoRow
                      key={v.src}
                      src={v.src}
                      mode="dark"
                      status={getStatus(v.src)}
                      onSetStatus={next => setStatus(v.src, next)}
                      readOnly={IS_DEMO}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Tab 6 — Review Queue
   New components built because no existing one could
   meet the need. Approve → promote to shared.tsx.
   Reject → remove, revert to existing component.
   ═══════════════════════════════════════════════════ */
type ReviewStatus = 'pending' | 'approved' | 'rejected';
type ReviewItem = {
  id: string;
  name: string;
  builtFor: string;
  reason: string;
  closestExisting: string;
  preview: React.ReactNode;
  status: ReviewStatus;
};

/** Stateful preview for ToolbarSegmented (it's a controlled component). */
function ToolbarSegmentedPreview() {
  const [mode, setMode] = useState<'Chat' | 'Tasks' | 'Code'>('Chat');
  return (
    <ToolbarSegmented<'Chat' | 'Tasks' | 'Code'>
      value={mode}
      onChange={setMode}
      segments={[
        { value: 'Chat',  icon: <MessageSquare size={16} className="shrink-0" />, label: 'Chat' },
        { value: 'Tasks', icon: <CheckSquare  size={16} className="shrink-0" />, label: 'Tasks' },
        { value: 'Code',  icon: <Code2        size={16} className="shrink-0" />, label: 'Code'  },
      ]}
    />
  );
}

/** Stateful preview for Switch (it's a controlled component). */
function SwitchPreview() {
  const [v, setV] = useState<'active' | 'inactive'>('active');
  return (
    <Switch<'active' | 'inactive'>
      value={v}
      onChange={setV}
      segments={[
        { value: 'active',   label: 'Active'   },
        { value: 'inactive', label: 'Inactive' },
      ]}
      ariaLabel="Switch demo"
    />
  );
}

function ReviewTab() {
  const [items, setItems] = useState<ReviewItem[]>([
    {
      id: 'toolbar-pill',
      name: 'ToolbarPill',
      builtFor: 'Toolbar row primitive — pill-shaped button / label with leading + trailing slots, locked to --toolbar-btn-h. Available for future reuse; the Task/Code mode pickers that originally used it were removed when the app collapsed to a single chat input.',
      reason: 'The same pill shell (rounded border, --toolbar-btn-h height, hover gradient, leading-icon + truncated-label + trailing-chevron) was copy-pasted 3× with near-identical className strings. Different enough from FilterChip — this one locks to the toolbar height token and needs a leading/trailing slot pattern plus a label-variant for wrapping a checkbox.',
      closestExisting: 'FilterChip / Tag (both rounded-full, but fixed-height: Chip is 32/28, Tag is 22) — neither matches --toolbar-btn-h or offers leading/trailing slots.',
      preview: (
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarPill
            leading={<Folder size={14} className="shrink-0" />}
            trailing={<ChevronDown size={12} className="shrink-0 icon-theme" />}
            className="max-w-[180px]"
          >
            ~/Projects/WorkPal
          </ToolbarPill>
          <ToolbarPill
            leading={<GitBranch size={14} className="shrink-0" />}
            trailing={<ChevronDown size={12} className="shrink-0 icon-theme" />}
            className="max-w-[160px]"
          >
            main
          </ToolbarPill>
          <ToolbarPill
            as="label"
            leading={
              <input
                type="checkbox"
                defaultChecked
                className="worktree-checkbox w-3.5 h-3.5 rounded cursor-pointer"
              />
            }
          >
            Worktree
          </ToolbarPill>
        </div>
      ),
      status: 'pending',
    },
    {
      id: 'toolbar-icon-button',
      name: 'ToolbarIconButton',
      builtFor: 'ChatInput toolbar row — the `+` attach button (and any future icon-only peer in the same row).',
      reason: 'Sibling of ToolbarPill. Same --toolbar-btn-h height, same border/hover tokens, but a square shape (width === height === --toolbar-btn-h) with a single icon slot. Extracting it makes the "toolbar controls" family complete and locks every icon-only button to the same size and border treatment.',
      closestExisting: 'ToolbarPill (wrong shape — pills are horizontal with a label slot) and TertiaryButton (wrong height/shape — standalone rectangular CTA, not a toolbar peer).',
      preview: (
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip label="Attach">
            <ToolbarIconButton ariaLabel="Attach">
              <Plus size={16} className="shrink-0" />
            </ToolbarIconButton>
          </Tooltip>
          <Tooltip label="Mic">
            <ToolbarIconButton ariaLabel="Mic">
              <Mic size={16} className="shrink-0" />
            </ToolbarIconButton>
          </Tooltip>
        </div>
      ),
      status: 'pending',
    },
    {
      id: 'toolbar-segmented',
      name: 'ToolbarSegmented',
      builtFor: 'Connected segmented pill primitive. Originally built for a Chat / Tasks / Code mode selector in ChatInput; the selector was removed when the app collapsed to a single input, but the primitive itself is kept available for future multi-segment toggles.',
      reason: 'Third sibling in the toolbar family. A row of three ToolbarPills would give each one its own border — wrong look. This component keeps a single outer border and shares it across inner segments, preserving the connected-segment visual. Generic over the segment-value type so callers stay type-safe (e.g. `ToolbarSegmented<InputMode>`).',
      closestExisting: 'FilterChip row (wrong: separate borders per chip, not connected) and the browser-native `<select>` (wrong: not a peer of the toolbar pills).',
      preview: (
        <div className="flex flex-wrap items-center gap-3">
          <ToolbarSegmentedPreview />
          <span className="type-caption text-text-secondary">
            Click a segment — selected widens to show its label, others show tooltip on hover.
          </span>
        </div>
      ),
      status: 'pending',
    },
    {
      id: 'switch',
      name: 'Switch',
      builtFor: 'Binary state toggle that lives inside a row of metadata. Originally built for AgentVideoRow on the Agent Videos tab — each row needs an Active|Inactive flip that reads at a glance and is easy to operate without ambiguity (vs a single-button "Pause" that requires reading the icon to know the current state).',
      reason: 'Same connected-pill visual language as ToolbarSegmented (one outer border, shared inner segments, --color-selected-* tokens), but smaller (h-8) so it fits in a compact row, and both segments always show their label (no icon-only collapse — a binary control is unambiguous only when both options are visible). Generic over the value type so it can be reused for any binary control.',
      closestExisting: 'ToolbarSegmented (wrong size for non-toolbar contexts; uses icon-only collapse for unselected segments which obscures binary state) and FilterChip pair (wrong: unconnected, no clear "this is one mutually-exclusive control" affordance).',
      preview: (
        <div className="flex flex-wrap items-center gap-3">
          <SwitchPreview />
          <span className="type-caption text-text-secondary">
            Click either segment — selected uses --color-selected-bg / --color-selected-text.
          </span>
        </div>
      ),
      status: 'pending',
    },
  ]);

  const pending  = items.filter(i => i.status === 'pending');
  const approved = items.filter(i => i.status === 'approved');
  const rejected = items.filter(i => i.status === 'rejected');

  const setStatus = (id: string, status: ReviewStatus) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="type-body">🧪</span>
          <span className="type-h2-emphasized text-text-primary">How the review queue works</span>
        </div>
        <ol className="list-decimal pl-5 type-caption text-text-primary space-y-1">
          <li>When building a feature, I always check the <strong>Component Library</strong> first.</li>
          <li>Whenever possible, I reuse an existing shared component.</li>
          <li>If nothing fits, I build a new component and <strong>add it here</strong> so you can review.</li>
          <li>You <strong>Approve</strong> (promote to <code className="font-mono type-caption px-1 rounded text-accent-blue" style={{ background: 'var(--color-bg-hover)' }}>shared.tsx</code> permanently) or <strong>Reject</strong> (I remove it and switch back to the closest existing component).</li>
        </ol>
      </div>

      {/* Pending */}
      <SharedSectionTitle emoji="⏳" title="Pending review" count={pending.length} />
      {pending.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-stroke-outline p-8 text-center" style={{ background: 'var(--color-bg-page)' }}>
          <p className="type-detail text-text-primary mb-1">No components awaiting review</p>
          <p className="type-caption text-text-secondary">When I build something new that isn't in the library yet, it will show up here for your approval.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {pending.map(item => (
            <div key={item.id} className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="type-detail-emphasized text-text-primary">{item.name}</span>
                <StatusTag variant="in-review" label="Pending review" size="sm" />
              </div>
              <p className="type-caption text-text-primary mb-1"><strong>Built for:</strong> {item.builtFor}</p>
              <p className="type-caption text-text-primary mb-1"><strong>Reason new component was needed:</strong> {item.reason}</p>
              <p className="type-caption text-text-primary mb-3"><strong>Closest existing component:</strong> {item.closestExisting}</p>
              <div className="p-4 rounded-xl mb-3" style={{ background: 'var(--color-bg-hover)' }}>{item.preview}</div>
              <div className="flex gap-2">
                <PrimaryButton onClick={() => setStatus(item.id, 'approved')}>Approve</PrimaryButton>
                <TertiaryButton onClick={() => setStatus(item.id, 'rejected')}>Reject</TertiaryButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <>
          <SharedSectionTitle emoji="✅" title="Approved (promoted to shared.tsx)" count={approved.length} />
          <div className="flex flex-col gap-3 mb-6">
            {approved.map(item => (
              <div key={item.id} className="rounded-2xl border border-stroke-outline p-4 flex items-center gap-3" style={{ background: 'var(--color-bg-page)' }}>
                <StatusTag variant="success" label="Approved" size="sm" />
                <span className="type-detail-emphasized text-text-primary">{item.name}</span>
                <span className="type-caption text-text-secondary flex-1">{item.builtFor}</span>
                <TertiaryButton onClick={() => setStatus(item.id, 'pending')}>Move back to pending</TertiaryButton>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <>
          <SharedSectionTitle emoji="🗑️" title="Rejected" count={rejected.length} />
          <div className="flex flex-col gap-3">
            {rejected.map(item => (
              <div key={item.id} className="rounded-2xl border border-stroke-outline p-4 flex items-center gap-3" style={{ background: 'var(--color-bg-page)' }}>
                <StatusTag variant="failed" label="Rejected" size="sm" />
                <span className="type-detail-emphasized text-text-primary">{item.name}</span>
                <span className="type-caption text-text-secondary flex-1">Switched back to: {item.closestExisting}</span>
                <TertiaryButton onClick={() => setStatus(item.id, 'pending')}>Move back to pending</TertiaryButton>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
