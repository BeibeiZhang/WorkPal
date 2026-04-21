/**
 * Shared UI Components
 * ====================
 * Single source of truth — used by both app pages and the Design System page.
 * Update a component here → it updates everywhere in the app.
 */
import { AlertTriangle, ArrowLeft, ArrowUpRight, BadgeCheck, Check, ChevronDown, ChevronRight, Clock, FileCode2, FileImage, FileText, Info, Mail, MonitorPlay, PanelLeft, PanelRight, Presentation, Ticket, Play, Plus, Search, Send, Smile, SquarePen, Timer, User, Sparkles, X, XCircle, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { IS_DEMO } from '../lib/demoMode';
import type { ArtifactRef, OutputType } from '../types';

/* ─── 0a. HeaderBar ───
 * Canonical top toolbar. Renders the sidebar-toggle button (when the sidebar
 * is closed) and an optional right-side slot. Used by every top-level shell:
 * `PageLayout` (internally) and `ChatPanel` (directly, because it has no
 * page title so it doesn't use PageLayout).
 *
 *   - sidebarOpen: hides the menu toggle when sidebar is already open.
 *   - onToggleSidebar: required for the menu toggle to render.
 *   - headerRight: content aligned to the right (e.g. SidePanel toggle).
 *   - onNewChat: when provided, renders a "New Session" edit-compose button at
 *     the left of the right-side group. Caller passes this only on mobile
 *     (sidebar hidden), so no CSS-based hiding is needed here.
 */
export function HeaderBar({
  sidebarOpen = true,
  onToggleSidebar,
  headerLeft,
  headerRight,
  onNewChat,
}: {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  /** Optional content aligned to the left, right after the sidebar toggle.
   *  Used by ChatPanel to show the session folder chip. */
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  onNewChat?: () => void;
}) {
  // DemoBadge auto-renders on the demo deployment. Placed here in HeaderBar
  // so every page that routes through `HeaderBar` (directly or via
  // PageLayout) picks it up without per-page plumbing — and `hasRight`
  // flips true even if the page has no other right-side content.
  const hasRight = onNewChat || headerRight || IS_DEMO;
  return (
    <div className="flex items-center gap-4 px-4 pt-6 shrink-0">
      {!sidebarOpen && onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors shrink-0 text-text-primary"
        >
          <PanelLeft size={20} />
        </button>
      )}
      {headerLeft}
      {hasRight && (
        <div className="ml-auto flex items-center gap-2">
          {IS_DEMO && <DemoBadge />}
          {onNewChat && (
            <button
              onClick={onNewChat}
              aria-label="New session"
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
            >
              <SquarePen size={20} />
            </button>
          )}
          {headerRight}
        </div>
      )}
    </div>
  );
}

/* ─── 0c. DemoBadge ───
 * Small "Demo" pill — only rendered when IS_DEMO is true. Click opens a
 * modal explaining what's mocked vs. real on the demo deployment.
 * Intentionally no visible footprint outside demo mode (real users and
 * localhost dev see nothing).
 */
export function DemoBadge() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About this demo"
        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium chip-gradient-hover transition-colors text-text-primary"
        style={{ border: '1px solid var(--color-stroke-outline)' }}
      >
        <span>Demo</span>
        <Info size={13} className="text-text-secondary" />
      </button>
      <DemoExplainerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* Modal opened by DemoBadge. Kept inline with the badge so callers that
 * import DemoBadge don't need a second import to render the modal. */
function DemoExplainerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="panel-border relative w-[460px] max-w-[90vw] rounded-[12px] p-7 shadow-2xl"
        style={{ background: 'var(--color-bg-page)' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors"
        >
          <X size={18} className="text-text-primary" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-bg-message)' }}
          >
            <Info size={18} className="text-text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-text-primary leading-tight">
              About this demo
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-[13px] text-text-primary leading-relaxed">
          <ul className="flex flex-col gap-2.5">
            <li className="flex gap-2.5">
              <span aria-hidden className="shrink-0">✨</span>
              <span>Combine OpenAI's natural language capabilities with Claude Cowork's task management, so you can seamlessly integrate your two favorite tools.</span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="shrink-0">📂</span>
              <span>Center everything around projects—tasks and conversations all take place within project folders, sharing project memory.</span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="shrink-0">🤖</span>
              <span>AI automatically determines your needs, so you don't have to manually distinguish between chats and tasks.</span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="shrink-0">📊</span>
              <span>Add an Overview page, giving you a complete view of the agent's work status and providing a reporting entry point.</span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="shrink-0">⚖️</span>
              <span>In a human-centered design, emphasize your personal needs in both Onboarding and Overview, balancing every aspect of your work and life.</span>
            </li>
          </ul>

          <div
            className="pt-3 text-[12px] text-text-secondary leading-relaxed"
            style={{ borderTop: '1px solid var(--color-stroke-outline)' }}
          >
            Both advanced voice chat and search functionalities are available. The local task management requires local installation. If you would like to experience the full product, please schedule with me, and I will provide a live demonstration.
          </div>

          <div className="text-text-secondary text-[12px]">
            Source /{' '}
            <a
              href="https://github.com/BeibeiZhang/WorkPal"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-text-primary"
            >
              github.com/BeibeiZhang/WorkPal
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── 0. PageLayout ───
 * Canonical page shell — every top-level app page renders through this.
 * Enforces uniform vertical rhythm and horizontal padding across the whole app.
 * Edit the spec here → every page updates.
 *
 * Slots:
 *   - title      — page H1 (required)
 *   - rightSlot  — search / actions on the same row as the title (optional)
 *   - filters    — filter pills / tabs row below the title (optional)
 *   - children   — main content
 *
 * Spec (change here to update every page):
 *   - Toggle bar        h-12 (48px)
 *   - Horizontal pad    px-4 sm:px-8 (16 → 32)
 *   - H1                text-[40px] / leading-[48px] / font-bold / tracking-[-0.5px]
 *   - Title → filters   mt-6 (24px)
 *   - Title/filters → content   mt-8 (32px)
 *   - Bottom pad        pb-10 (40px)
 *   - maxWidth          'full' (no limit)  |  'reading' (863px, centered)
 *
 * Special pages that DO NOT use PageLayout:
 *   - ChatPanel — conversation container (no page title, input at bottom)
 */
export function PageLayout({
  title,
  rightSlot,
  filters,
  maxWidth = 'full',
  sidebarOpen = true,
  onToggleSidebar,
  headerRight,
  onNewChat,
  footer,
  scrollContainerId,
  bgClass,
  children,
}: {
  title: ReactNode;
  /** Right-aligned content in the title row (SearchBox, actions). */
  rightSlot?: ReactNode;
  /** Filter chip row rendered below the title. */
  filters?: ReactNode;
  /** `'full'` = page-wide content. `'reading'` = capped at 863px, centered. */
  maxWidth?: 'full' | 'reading';
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  /** Right-aligned content in the top toggle bar (e.g. panel toggle). */
  headerRight?: ReactNode;
  /** When provided, renders a New Session (compose / edit-square) button in
   *  the header's right-side group, to the left of `headerRight`. Caller
   *  typically passes this only on mobile, where the sidebar is hidden. */
  onNewChat?: () => void;
  /** Pinned element at the bottom of the column, outside the scroll region
   *  (e.g. ChatInput). Honors the `maxWidth` prop. */
  footer?: ReactNode;
  /** Optional `id` attribute on the scrollable body. Needed when callers
   *  scroll to anchors via `element.scrollIntoView()` and the scroll
   *  context isn't `window`. */
  scrollContainerId?: string;
  /** Optional background utility class (e.g. `"app-bg"`).
   *  When omitted, uses `var(--color-bg-page)`. */
  bgClass?: string;
  children: ReactNode;
}) {
  const widthClass = maxWidth === 'reading' ? 'max-w-[863px] mx-auto w-full' : '';
  return (
    <div
      className={`flex-1 flex flex-col min-w-0 h-full ${bgClass ?? ''}`}
      style={bgClass ? undefined : { background: 'var(--color-bg-page)' }}
    >
      <HeaderBar sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} headerRight={headerRight} onNewChat={onNewChat} />

      {/* Scrollable body */}
      <div id={scrollContainerId} className="flex-1 overflow-y-auto min-h-0 scrollbar-autohide">
        <div className={`px-4 sm:px-8 pb-10 ${widthClass}`}>
          {/* Title row — wraps rightSlot to next line when space is tight */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1
              className="flex-1 min-w-[240px] text-[40px] font-bold text-text-primary leading-[48px] tracking-[-0.5px]"
              style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
            >
              {title}
            </h1>
            {rightSlot && <div className="shrink-0">{rightSlot}</div>}
          </div>

          {filters && <div className="mt-6">{filters}</div>}

          <div className="mt-8">{children}</div>
        </div>
      </div>

      {/* Pinned footer (outside scroll) */}
      {footer && (
        <div className="shrink-0 px-4 sm:px-8 pb-6 pt-2">
          <div className={widthClass}>{footer}</div>
        </div>
      )}
    </div>
  );
}

/* ─── 0b. SearchBox ───
 * Responsive search field, designed to sit in PageLayout's rightSlot.
 *
 *   Desktop (md+):  always shows a pill with Search icon + input.
 *   Mobile (< md):  shows only the icon. Tapping it opens a full-width
 *                    search bar that replaces the toggle bar, autofocuses
 *                    the input (keyboard appears), and offers a back/clear
 *                    button. Tapping back closes and clears the query.
 */
export function SearchBox({
  value,
  onChange,
  placeholder = 'Search',
  width = 260,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus();
  }, [mobileOpen]);

  const closeMobile = () => {
    setMobileOpen(false);
    onChange('');
  };

  return (
    <>
      {/* Desktop: always-expanded pill */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: 'var(--color-bg-hover)', width }}
      >
        <Search size={16} className="shrink-0 text-text-primary" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-text-primary placeholder-text-secondary"
        />
      </div>

      {/* Mobile collapsed: icon button only */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Search"
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors text-text-primary"
      >
        <Search size={20} />
      </button>

      {/* Mobile expanded: full-width overlay replacing the top bar */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-x-0 top-0 z-50 flex items-center gap-2 px-3 h-12 border-b border-stroke-outline"
          style={{ background: 'var(--color-bg-page)' }}
        >
          <button
            onClick={closeMobile}
            aria-label="Close search"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors text-text-primary shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div
            className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--color-bg-hover)' }}
          >
            <Search size={16} className="shrink-0 text-text-primary" />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={e => onChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-text-primary placeholder-text-secondary"
            />
            {value && (
              <button
                onClick={() => onChange('')}
                aria-label="Clear"
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-stroke-outline text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── 0b2. SplitView ───
 * Canonical two-column shell for pages that pair main content with a side panel.
 * Handles the inline ↔ overlay transition based on container (not viewport) width:
 *
 *   When container ≥ sideWidth + mainMinWidth  → side is rendered inline (flex row)
 *   When container <  sideWidth + mainMinWidth → side is rendered as full-area
 *                                                 overlay (absolute inset-0 z-30)
 *
 * The measurement uses ResizeObserver on SplitView's own element, so it's
 * agnostic of sidebar width, collapsed state, or viewport size.
 *
 * Used by: ProjectPage + side panel, ChatPanel + TaskContextPanel,
 *          ChatPanel + DetailPanel.
 *
 * Callers typically render the panel as a self-contained element with its
 * own scroll and background. When the panel needs different sizing inline vs
 * overlay, pass a render-prop for `side`:
 *
 *   <SplitView side={({ overlay }) => <Panel fullScreen={overlay} />}>...</SplitView>
 */
export function SplitView({
  children,
  side,
  sideOpen,
  onCloseSide,
  sideWidth,
  mainMinWidth = 420,
  bgClass,
}: {
  children: ReactNode;
  side: ReactNode | ((state: { overlay: boolean }) => ReactNode);
  sideOpen: boolean;
  onCloseSide?: () => void;
  sideWidth: number;
  /** Minimum width reserved for the main column before we switch to overlay mode. */
  mainMinWidth?: number;
  /** Optional background class applied to the outer shell (e.g. 'app-bg'). */
  bgClass?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [canFit, setCanFit] = useState(true);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = (w: number) => setCanFit(w >= sideWidth + mainMinWidth);
    update(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => update(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sideWidth, mainMinWidth]);

  const renderSide = typeof side === 'function' ? side : () => side;
  const inline = sideOpen && canFit;
  const overlay = sideOpen && !canFit;

  return (
    <div
      ref={rootRef}
      className={`flex flex-1 h-full min-w-0 relative ${bgClass ?? ''}`}
    >
      {children}
      {inline && (
        <div className="shrink-0 h-full" style={{ width: sideWidth }}>
          {renderSide({ overlay: false })}
        </div>
      )}
      {overlay && (
        <>
          {/* Dark overlay backdrop: dims the ConversationPanel behind the
              collapsed inspector. Tap to close. Solid-looking dim ensures no
              bleed-through and gives the overlay a clear modal affordance in
              both light and dark modes. */}
          <div
            className="absolute inset-0 z-20 panel-overlay-backdrop"
            onClick={onCloseSide}
            aria-hidden
          />
          {/* Panel docks to the right at its natural width, leaving the
              backdrop visible on the left. Panel uses `max-w-full` so it
              shrinks to fit very narrow viewports (true full-screen). */}
          <div className="absolute inset-y-0 right-0 z-30 max-w-full">
            {renderSide({ overlay: true })}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── 0c2. SidePanelHeader ───
 * Canonical header row for any side panel (TaskContextPanel, DetailPanel,
 * ProjectPage overlay). Unifies close-button size (40px rounded-xl), hover,
 * and typography. Body stays panel-specific so each panel keeps freedom
 * (DetailPanel's absolute popover, TaskContextPanel's SideCard stack).
 *
 *   - title (optional): bold, truncates, takes remaining row width.
 *   - onClose (optional): renders a trailing close button with the chosen icon.
 *   - closeIcon: 'x' (dismiss) | 'panel-right' (collapse toggle).
 *   - Children slot between title and close (e.g. extra header actions).
 *   - className controls horizontal padding so each panel keeps its own inset.
 */
export function SidePanelHeader({
  title,
  onClose,
  closeIcon = 'x',
  closeLabel = 'Close',
  className = 'px-3',
  children,
}: {
  title?: ReactNode;
  onClose?: () => void;
  closeIcon?: 'x' | 'panel-right';
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  const Icon = closeIcon === 'panel-right' ? PanelRight : X;
  return (
    <div className={`flex items-center gap-3 h-16 shrink-0 ${className}`}>
      {title ? (
        <p className="flex-1 min-w-0 font-bold text-base leading-[22px] text-text-primary truncate">
          {title}
        </p>
      ) : (
        <div className="flex-1" />
      )}
      {children}
      {onClose && (
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors shrink-0 text-text-primary"
        >
          <Icon size={20} />
        </button>
      )}
    </div>
  );
}

/* ─── 0d. SideCard ───
 * Collapsible card used inside right-column side panels.
 *   - Border + rounded-2xl + page-bg surface (works in light/dark)
 *   - Header: title (left) + optional icon slot + optional Plus affordance + chevron
 *   - Clicking the whole header toggles open/closed
 *   - Icon/Plus slots stop propagation so they remain independently clickable
 *
 * Used by: ProjectPage side panel (Instructions/Scheduled/Files/Context),
 *          TaskContextPanel (Progress/Folder/Context/Tools active).
 */
export function SideCard({
  title,
  icon,
  hasAdd = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  hasAdd?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="shrink-0 side-card-divider last:bg-none">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 w-full px-2 py-4 text-left transition-colors"
      >
        <span className="flex-1 text-[16px] font-bold text-text-primary">{title}</span>
        {icon && (
          <span className="text-text-primary" onClick={e => e.stopPropagation()}>
            {icon}
          </span>
        )}
        {hasAdd && (
          <span className="text-text-primary" onClick={e => e.stopPropagation()}>
            <Plus size={18} />
          </span>
        )}
        <ChevronDown
          size={16}
          className={`text-text-primary transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="px-2 pb-5">{children}</div>}
    </div>
  );
}

/* ─── 0e. ToolbarPill ───
 * Slim pill-shaped control sitting in the ChatInput toolbar row — folder
 * picker, branch picker, worktree checkbox, and any future peer that needs
 * to line up with them. Height is locked to the toolbar token
 * `--toolbar-btn-h` so every pill in the row matches across mobile/desktop.
 *
 * Slots (all `ReactNode` so callers control the exact element):
 *   - leading  — left side content: an inline SVG, an icon image, or a
 *                checkbox `<input>` (Worktree case). Required.
 *   - children — the visible label. Strings are auto-wrapped in
 *                `<span class="truncate">`; pass a node to skip that.
 *   - trailing — optional right side node, typically a chevron `<img>` for
 *                pills that open a dropdown.
 *
 * `as="label"` renders a `<label>` instead of a `<button>` (used to wrap the
 * Worktree checkbox so clicking the pill toggles the input).
 *
 * `className` is an escape hatch for responsive caps like
 * `max-w-[270px] md:max-w-[180px]` — kept out of the base so pills without a
 * cap (Worktree) don't pick one up.
 */
export function ToolbarPill({
  as = 'button',
  leading,
  children,
  trailing,
  className,
  onClick,
}: {
  as?: 'button' | 'label';
  leading: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const base =
    'flex items-center gap-[9px] md:gap-1.5 px-[18px] md:px-3 rounded-full border border-stroke-outline text-base text-text-primary hover:bg-bg-hover toolbar-gradient-hover transition-colors cursor-pointer';
  const merged = [base, as === 'label' ? 'select-none' : '', className].filter(Boolean).join(' ');
  const style = { height: 'var(--toolbar-btn-h)' } as React.CSSProperties;
  const body = (
    <>
      {leading}
      {typeof children === 'string' ? <span className="truncate">{children}</span> : children}
      {trailing}
    </>
  );
  if (as === 'label') {
    return (
      <label className={merged} style={style}>
        {body}
      </label>
    );
  }
  return (
    <button type="button" onClick={onClick} className={merged} style={style}>
      {body}
    </button>
  );
}

/* ─── 0f. Tooltip ───
 * Dark-background hover tooltip — black bg, white text, appears above the
 * trigger. Used on icon-only controls in the ChatInput toolbar (attach, mic,
 * unselected mode-selector segments) to surface their labels.
 */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-[#1a1a1a] text-white text-[11px] leading-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </div>
    </div>
  );
}

/* ─── 0g. ToolbarIconButton ───
 * Icon-only square control for the ChatInput toolbar (the `+` attach
 * button, and any future tool-icon peer). Width === height === the toolbar
 * height token `--toolbar-btn-h`, so it lines up vertically with
 * `ToolbarPill` and `ToolbarSegmented` in the same row.
 *
 * Pair with `Tooltip` on the caller side so the icon-only button announces
 * its purpose on hover.
 */
export function ToolbarIconButton({
  onClick,
  ariaLabel,
  children,
  className,
}: {
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const base =
    'flex items-center justify-center rounded-full border border-stroke-outline hover:bg-bg-hover toolbar-gradient-hover transition-all shrink-0 cursor-pointer text-text-primary';
  const merged = [base, className].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={merged}
      style={{ width: 'var(--toolbar-btn-h)', height: 'var(--toolbar-btn-h)' }}
    >
      {children}
    </button>
  );
}

/* ─── 0h. ToolbarSegmented ───
 * Connected-segment pill (one outer border, inner segments share it). Used
 * for the Chat / Tasks / Code mode selector in ChatInput. Every segment
 * locks to the toolbar height token `--toolbar-btn-h`.
 *
 * Behavior:
 *   - Selected segment: shows `icon + label`, uses `--color-selected-*`
 *     tokens. Content padded `px-3`; segment grows to fit its label.
 *   - Unselected segment: icon-only, fixed width `--mode-btn-unselected-w`,
 *     wrapped in a `Tooltip` so the label is still discoverable on hover.
 *   - Disabled segment: dimmed; the tooltip prefers `disabledTooltip` if
 *     provided so the caller can explain *why* it's disabled.
 *
 * Generic over segment-value type `T` (e.g. `'Chat' | 'Tasks' | 'Code'`) so
 * callers stay type-safe when wiring `value` / `onChange`.
 */
export function ToolbarSegmented<T extends string>({
  value,
  onChange,
  segments,
}: {
  value: T;
  onChange: (v: T) => void;
  segments: {
    value: T;
    icon: ReactNode;
    label: string;
    disabled?: boolean;
    disabledTooltip?: string;
  }[];
}) {
  return (
    <div className="flex items-center rounded-full border border-stroke-outline toolbar-gradient-hover">
      {segments.map((seg, i, arr) => {
        const isSelected = value === seg.value;
        const isFirst = i === 0;
        const isLast = i === arr.length - 1;
        const disabled = !!seg.disabled;
        const btn = (
          <button
            type="button"
            key={seg.value}
            onClick={() => {
              if (disabled) return;
              onChange(seg.value);
            }}
            className={`flex items-center justify-center gap-1 transition-all text-text-primary ${
              disabled
                ? 'opacity-30 cursor-not-allowed'
                : isSelected
                ? 'px-3 cursor-pointer'
                : 'hover:bg-bg-hover cursor-pointer'
            }`}
            style={{
              height: 'var(--toolbar-btn-h)',
              ...(!isSelected ? { width: 'var(--mode-btn-unselected-w)' } : {}),
              backgroundColor: isSelected ? 'var(--color-selected-bg)' : undefined,
              color: isSelected ? 'var(--color-selected-text)' : undefined,
              borderRadius: isFirst ? '9999px 0 0 9999px' : isLast ? '0 9999px 9999px 0' : '0',
            }}
          >
            {seg.icon}
            {isSelected && <span className="text-base font-medium">{seg.label}</span>}
          </button>
        );
        if (isSelected) return btn;
        const tip = disabled ? seg.disabledTooltip ?? seg.label : seg.label;
        return (
          <Tooltip key={seg.value} label={tip}>
            {btn}
          </Tooltip>
        );
      })}
    </div>
  );
}

/* ─── 0i. Switch ───
 * Binary segmented toggle. Same connected-pill visual language as
 * `ToolbarSegmented` (one outer border, segments share it, selected segment
 * uses `--color-selected-*`), but:
 *   - smaller height (h-8) — fits inside a row of metadata, not a toolbar.
 *   - both segments always show their label (no icon-only collapse).
 *   - generic over the value type so it's reusable for any binary control,
 *     not just Active|Inactive.
 *
 * Lives in the Design System Review Queue until promoted. Originally built
 * for AgentVideoRow's Active/Inactive control on the Agent Videos tab.
 */
export function Switch<T extends string>({
  value,
  onChange,
  segments,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  segments: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-full border border-stroke-outline h-8 shrink-0"
    >
      {segments.map((seg, i, arr) => {
        const isSelected = value === seg.value;
        const isFirst = i === 0;
        const isLast = i === arr.length - 1;
        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => {
              if (!isSelected) onChange(seg.value);
            }}
            className={`h-full px-3 text-[12px] transition-colors ${
              isSelected
                ? 'cursor-default'
                : 'text-text-primary hover:bg-bg-hover cursor-pointer'
            }`}
            style={{
              backgroundColor: isSelected ? 'var(--color-selected-bg)' : undefined,
              color: isSelected ? 'var(--color-selected-text)' : undefined,
              borderRadius: isFirst ? '9999px 0 0 9999px' : isLast ? '0 9999px 9999px 0' : '0',
            }}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── 1. SectionTitle ─── */
export function SectionTitle({
  emoji,
  title,
  count,
  size,
}: {
  emoji: string;
  title: string;
  count?: number;
  size?: number;
}) {
  const fontSize = size || 14;
  return (
    <div className="flex items-center gap-2 mb-4">
      {emoji && <span style={{ fontSize }}>{emoji}</span>}
      <span className="font-bold text-text-primary tracking-[-0.43px]" style={{ fontSize }}>{title}</span>
      {count !== undefined && (
        <span className="text-[12px] px-2 py-0.5 rounded-[4px] bg-bg-hover text-text-primary tracking-[-0.3px]">{count}</span>
      )}
    </div>
  );
}

/* ─── 2. ProgressBar ─── */
export function ProgressBar({
  value,
  color = 'var(--color-progress-bar, #142740)',
  height = 6,
  showLabel = false,
}: {
  value: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 rounded-full bg-bg-hover overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
        />
      </div>
      {showLabel && <span className="text-[14px] font-bold text-text-primary shrink-0">{value}%</span>}
    </div>
  );
}

/* ─── 3. CategoryBreakdown — stacked % bar + color-dot legend ───
   Used for stress analysis / workload breakdowns where every category adds
   up to a whole. One visual (stacked bar) + one legend row; kept as a pair
   because they share the same color mapping. */
export function CategoryBreakdown({
  categories,
}: {
  categories: Array<{ label: string; pct: number; color: string }>;
}) {
  return (
    <div>
      <div className="flex h-[10px] rounded-full overflow-hidden mb-3">
        {categories.map((c, i) => (
          <div
            key={i}
            className="h-full transition-[width] duration-700"
            style={{ width: `${c.pct}%`, background: c.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {categories.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
            <span className="text-[13px] text-text-secondary">{c.label}</span>
            <span className="text-[13px] font-bold text-text-primary">{c.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 4. CircularProgress ─── */
export function CircularProgress({
  value,
  max = 100,
  size: sizeProp,
  strokeWidth = 8,
  color = '#3171ff',
  innerPadding = 4,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  innerPadding?: number;
  children?: ReactNode;
}) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [autoSize, setAutoSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (sizeProp || !measureRef.current) return;
    const el = measureRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // Content rect diagonal must fit inside the inner circle (ring inner edge)
    // Inner circle diameter = size - 2*strokeWidth
    // Content diagonal + 2*padding <= inner circle diameter
    const diagonal = Math.sqrt(w * w + h * h);
    const needed = diagonal + innerPadding * 2 + strokeWidth * 2;
    // round up to even number for clean SVG
    setAutoSize(Math.ceil(needed / 2) * 2);
  }, [sizeProp, strokeWidth, innerPadding, children]);

  const size = sizeProp ?? autoSize ?? 100;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Hidden measurement element for auto-sizing */}
      {!sizeProp && children && (
        <span ref={measureRef} className="flex flex-col items-center justify-center" style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' }}>
          {children}
        </span>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-bg-hover)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${pct * circumference} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── 5. TimePill ───
 * Thin alias — renders StatusTag (neutral, sm) with a User icon.
 * Exists purely for readability at call sites ("time estimate" semantics).
 */
export function TimePill({ time, tooltip }: { time: string; tooltip?: string }) {
  return <StatusTag variant="success" label={time} size="sm" icon={User} tooltip={tooltip} />;
}

/* ─── 6. StepIndicator ─── */
export function StepIndicator({ status }: { status: 'done' | 'in-progress' | 'pending' }) {
  if (status === 'done') {
    return <Check size={14} className="text-text-primary shrink-0" />;
  }
  if (status === 'in-progress') {
    return (
      <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: 'var(--color-text-primary)' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-text-primary)' }} />
      </div>
    );
  }
  return <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0" style={{ borderColor: 'var(--color-stroke-outline)' }} />;
}

/* ─── 7a. StatusTag ───
 * THE canonical pill component. Every tag/badge/pill in the app renders through this.
 *   - `variant`  — semantic color + default icon (7 colored + `neutral`)
 *   - `size`     — "sm" (12px) for tight spots, "md" (14px) everywhere else
 *   - `showIcon` — hide the default icon in compact contexts
 *   - `icon`     — override the variant's default icon (e.g. User for TimePill)
 *   - `outline`  — bg-bg-page + border instead of variant bg (use inside tinted cards)
 *
 * Thin aliases: <Tag>, <TimePill> — read below, they just configure StatusTag.
 */
export type StatusVariant =
  | 'pending'
  | 'in-progress'
  | 'submitted'
  | 'in-review'
  | 'success'
  | 'failed'
  | 'expired'
  | 'neutral';

const STATUS_ICONS: Record<StatusVariant, LucideIcon> = {
  'pending':     AlertTriangle,
  'in-progress': Clock,
  'submitted':   Send,
  'in-review':   Smile,
  'success':     BadgeCheck,
  'failed':      XCircle,
  'expired':     Clock,
  'neutral':     Clock,
};

export function StatusTag({
  variant,
  label,
  showIcon = true,
  size = 'md',
  icon,
  outline = false,
  tooltip,
}: {
  variant: StatusVariant;
  label: ReactNode;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  outline?: boolean;
  tooltip?: string;
}) {
  const Icon = icon ?? STATUS_ICONS[variant];
  const isSmall = size === 'sm';
  // `status-{variant}` wires `--status-bg` / `--status-fg` through index.css.
  // Dark mode overrides collapse the bg to solid and the fg to white, so the
  // whole pill re-skins without touching this component.
  const surface = outline
    ? { background: 'var(--color-bg-page)', color: 'var(--status-fg)', border: '1px solid var(--color-stroke-outline)' }
    : { background: 'var(--status-bg)', color: 'var(--status-fg)' };
  return (
    <span
      className={`status-${variant} inline-flex items-center whitespace-nowrap shrink-0 rounded-[4px] tracking-[-0.3px] font-normal ${
        isSmall ? 'gap-1 px-2 py-0.5 text-[12px]' : 'gap-1.5 px-3 py-1 text-[14px] leading-[22px]'
      } ${tooltip ? 'cursor-help' : ''}`}
      style={surface}
      title={tooltip}
    >
      {showIcon && <Icon size={isSmall ? 12 : 14} strokeWidth={2} />}
      {label}
    </span>
  );
}

/* ─── 7. Tag ───
 * Thin alias — neutral StatusTag at size="sm", no icon. Supports outline.
 * Use for inline labels: emoji chips, metric badges, "n/3" counters, type labels.
 */
export function Tag({
  children,
  outline = false,
  tooltip,
}: {
  children: ReactNode;
  outline?: boolean;
  tooltip?: string;
}) {
  return (
    <StatusTag
      variant="neutral"
      label={children}
      size="sm"
      showIcon={false}
      outline={outline}
      tooltip={tooltip}
    />
  );
}

/* ─── 7b. PrimaryButton ─── Tier 1: gradient background, white text, strongest CTA. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  className: extra = '',
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`gradient-btn flex items-center justify-center px-5 py-2.5 rounded-[4px] text-white font-bold text-[14px] leading-[22px] cursor-pointer transition-opacity disabled:opacity-40 ${fullWidth ? 'w-full' : ''} ${extra}`}
    >
      {children}
    </button>
  );
}

/* ─── 7c. SecondaryButton ─── Tier 2: solid inverted surface
 * Light mode: black bg + white text. Dark mode: white bg + black text.
 * Color stays the same on hover — just picks up PrimaryButton's lift-shadow.
 */
export function SecondaryButton({
  children,
  onClick,
  disabled,
  className: extra = '',
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inverted-btn flex items-center justify-center px-5 py-2.5 rounded-[4px] font-bold text-[14px] leading-[22px] cursor-pointer disabled:opacity-40 ${fullWidth ? 'w-full' : ''} ${extra}`}
    >
      {children}
    </button>
  );
}

/* ─── 7d. TertiaryButton ─── Tier 3: bordered surface with default text color.
 * Lightest-weight option, subtle gradient-tinted border on hover.
 */
export function TertiaryButton({
  children,
  onClick,
  disabled,
  className: extra = '',
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-5 py-2.5 rounded-[4px] border border-stroke-outline text-text-primary font-semibold text-[14px] leading-[22px] cursor-pointer hover:bg-bg-hover chip-gradient-hover transition-colors disabled:opacity-40 ${fullWidth ? 'w-full' : ''} ${extra}`}
    >
      {children}
    </button>
  );
}

/* ─── 7e. ConnectorCard ───
 * Compact row card for a connector / integration (app, API, MCP).
 *   - Logo slot on the left (caller supplies any icon or img).
 *   - Name takes remaining width; truncates on overflow.
 *   - When `connected` is true, shows the green "Connected" StatusTag;
 *     otherwise shows a Connect button that calls `onConnect`.
 *   - When `connecting` is true, the button swaps to a small inline spinner
 *     and becomes non-interactive. Used during the mock 800ms delay + server
 *     round-trip so the user sees immediate feedback.
 *   - When `connected` + `onDisconnect` are both set, clicking the Connected
 *     pill opens a tiny dropdown with a Disconnect item.
 *
 * Fill matches the Overview-card pattern: `bg-bg-page` in light mode,
 * semi-transparent tint in dark mode so the shell gradient shows through.
 * Used by: ConnectorsPage (Recommended / Apps / APIs grids).
 */
export function ConnectorCard({
  name,
  logo,
  connected = false,
  connecting = false,
  onConnect,
  onDisconnect,
  connectLabel = 'Connect',
  connectedLabel = 'Connected',
}: {
  name: string;
  logo: ReactNode;
  connected?: boolean;
  connecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  connectLabel?: string;
  connectedLabel?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-stroke-outline bg-bg-page dark:bg-[rgba(226,243,255,0.05)]">
      {logo}
      <span
        className="flex-1 text-[14px] text-text-primary font-bold truncate"
        style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
      >
        {name}
      </span>
      {connecting ? (
        <span
          className="text-[11px] px-3 py-1 rounded-full border border-stroke-outline text-text-secondary inline-flex items-center gap-1.5"
          aria-live="polite"
        >
          <span
            className="inline-block w-3 h-3 rounded-full border-[1.5px] border-stroke-outline border-t-text-primary animate-spin"
            aria-hidden
          />
          Connecting
        </span>
      ) : connected ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={onDisconnect ? () => setMenuOpen((o) => !o) : undefined}
            className={onDisconnect ? 'cursor-pointer' : 'cursor-default'}
            aria-haspopup={onDisconnect ? 'menu' : undefined}
            aria-expanded={onDisconnect ? menuOpen : undefined}
          >
            <StatusTag variant="success" label={connectedLabel} size="sm" showIcon={false} />
          </button>
          {onDisconnect && menuOpen && (
            <div
              role="menu"
              className="panel-border absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-lg py-1 shadow-lg"
              style={{ background: 'var(--color-bg-page)' }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDisconnect();
                }}
                className="w-full px-3 py-1.5 text-left text-[13px] text-text-primary hover:bg-bg-hover transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onConnect}
          className="text-[11px] px-3 py-1 rounded-full border border-stroke-outline text-text-primary hover:bg-bg-hover transition-colors"
        >
          {connectLabel}
        </button>
      )}
    </div>
  );
}

/* ─── 7d. FilterChip ─── */
export function FilterChip({
  label,
  active = false,
  icon,
  count,
  onClick,
}: {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-2 px-3 py-1 rounded-full border text-[14px] leading-[22px] tracking-[-0.43px] transition-colors cursor-pointer ${
        active ? 'border-transparent font-medium' : 'chip-gradient-hover border-stroke-outline text-text-primary'
      }`}
      style={
        active
          ? { background: 'var(--color-selected-bg)', color: 'var(--color-selected-text)' }
          : undefined
      }
    >
      {icon && <span className="flex items-center">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span className={active ? '' : 'text-text-primary'}>{count}</span>
      )}
    </button>
  );
}

/* ─── 8. SolutionRow ─── */
export function SolutionRow({
  icon,
  title,
  desc,
  tag,
}: {
  icon: string;
  title: string;
  desc: string;
  tag: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-bg-hover mb-1.5">
      <span className="text-[16px]">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] font-bold text-text-primary">{title}</span>
        <span className="text-[14px] text-text-primary"> — {desc}</span>
      </div>
      <Tag outline>{tag}</Tag>
    </div>
  );
}

/* ─── 9. SummaryFooter ─── */
export function SummaryFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1.5 py-1.5 text-[14px] text-text-primary">
      <Clock size={12} />
      <span>{children}</span>
    </div>
  );
}

/* ─── 10. MetricCard ─── */
export function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="text-center mb-3.5">
      <div className="text-[14px] font-bold text-text-primary uppercase tracking-[0.5px] mb-1">{title}</div>
      <div className="text-[40px] font-bold text-text-primary leading-none">{value}</div>
      <div className="text-[14px] text-text-primary">{subtitle}</div>
    </div>
  );
}

/* ─── 11. InsightCard ─── */
export function InsightCard({
  body,
  actions,
}: {
  body: string;
  actions: { label: string; primary?: boolean; secondary?: boolean; onClick?: () => void }[];
}) {
  return (
    <div className="rounded-2xl p-7 bg-bg-hover">
      <div className="text-[14px] font-bold text-text-primary mb-3 flex items-center gap-1.5">
        <Sparkles size={14} className="text-text-primary" /> STEPHEN'S INSIGHT
      </div>
      <p className="text-[14px] text-text-primary leading-[1.7] mb-4 tracking-[-0.43px]">{body}</p>
      <div className="flex flex-wrap gap-2.5">
        {actions.map((a, i) =>
          a.primary ? (
            <PrimaryButton key={i} onClick={a.onClick}>{a.label}</PrimaryButton>
          ) : a.secondary ? (
            <SecondaryButton key={i} onClick={a.onClick}>{a.label}</SecondaryButton>
          ) : (
            <TertiaryButton key={i} onClick={a.onClick}>{a.label}</TertiaryButton>
          )
        )}
      </div>
    </div>
  );
}

/* ─── 12. AreaChart ───
 * Smooth (Catmull-Rom → cubic Bezier) area chart. Measures the actual container
 * width with ResizeObserver and uses that as the SVG viewBox — so the chart
 * fills the card edge-to-edge without stretching circles or text.
 */
export function AreaChart({
  data,
  color = '#3171ff',
  height = 140,
  gradientId,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  gradientId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth || 600);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cw = Math.round(e.contentRect.width);
        if (cw > 0) setWidth(cw);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(...data.map(d => d.value), 1);
  const labelSpace = 28;                     // reserved y for x-axis labels
  const plotH = height - labelSpace;
  const padX = 14;                           // side gutter so endpoint dots aren't clipped
  const padY = 10;
  const stepX = (width - padX * 2) / Math.max(1, data.length - 1);
  const gId = gradientId || `areaGrad-${Math.random().toString(36).slice(2, 8)}`;

  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + (plotH - padY * 2) * (1 - d.value / max),
  }));

  // Catmull-Rom-to-Bezier smoothing (tension 0.5 → silky flow).
  const tension = 0.5;
  let linePath = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    linePath += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  const areaPath = `${linePath} L${points[points.length - 1].x},${plotH} L${points[0].x},${plotH} Z`;

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            <text x={p.x} y={plotH + 18} textAnchor="middle" fill="var(--color-text-primary)" fontSize={13} fontFamily="Inter, sans-serif">
              {data[i].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─── 12b. MultiLineChart ───
 * Multiple overlapping smooth lines on one chart. Each series gets its own color,
 * optional area fill, and optional per-segment coloring (for stress-style lines
 * where color changes based on value thresholds).
 */
export type ChartSeries = {
  data: { label: string; value: number }[];
  color: string;
  gradientId?: string;
  showArea?: boolean;
  /** Per-segment coloring: returns stroke color for the segment between point i and i+1 */
  segmentColor?: (value: number, nextValue: number) => string;
  /** Vertical gradient stops for the stroke — top-to-bottom [{offset, color}] */
  strokeGradient?: { offset: string; color: string }[];
};

export function MultiLineChart({
  series,
  height = 160,
  labels,
}: {
  series: ChartSeries[];
  height?: number;
  labels: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth || 600);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cw = Math.round(e.contentRect.width);
        if (cw > 0) setWidth(cw);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allValues = series.flatMap(s => s.data.map(d => d.value));
  const max = Math.max(...allValues, 1);
  const labelSpace = 28;
  const plotH = height - labelSpace;
  const padX = 20;
  const padY = 12;
  const n = labels.length;
  const stepX = (width - padX * 2) / Math.max(1, n - 1);

  const getPoints = (data: { value: number }[]) =>
    data.map((d, i) => ({
      x: padX + i * stepX,
      y: padY + (plotH - padY * 2) * (1 - d.value / max),
    }));

  /* Monotone cubic Hermite spline — guaranteed smooth & no overshoot.
   * Produces one cubic bezier segment per data interval. */
  const smoothPath = (pts: { x: number; y: number }[]) => {
    const len = pts.length;
    if (len < 2) return `M${pts[0].x},${pts[0].y}`;

    // 1. Compute slopes (finite-difference, clamped at endpoints)
    const dx: number[] = [];
    const dy: number[] = [];
    const m: number[] = [];
    for (let i = 0; i < len - 1; i++) {
      dx.push(pts[i + 1].x - pts[i].x);
      dy.push(pts[i + 1].y - pts[i].y);
    }
    // tangent at each point
    m.push(dy[0] / dx[0]);
    for (let i = 1; i < len - 1; i++) {
      const s0 = dy[i - 1] / dx[i - 1];
      const s1 = dy[i] / dx[i];
      if (s0 * s1 <= 0) { m.push(0); }
      else { m.push((s0 + s1) / 2); }
    }
    m.push(dy[len - 2] / dx[len - 2]);

    // 2. Adjust tangents for monotonicity (Fritsch-Carlson)
    for (let i = 0; i < len - 1; i++) {
      const s = dy[i] / dx[i];
      if (Math.abs(s) < 1e-10) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / s;
      const b = m[i + 1] / s;
      const h = Math.hypot(a, b);
      if (h > 3) { const t = 3 / h; m[i] = t * a * s; m[i + 1] = t * b * s; }
    }

    // 3. Build SVG path
    let path = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < len - 1; i++) {
      const d = dx[i] / 3;
      const c1x = pts[i].x + d;
      const c1y = pts[i].y + m[i] * d;
      const c2x = pts[i + 1].x - d;
      const c2y = pts[i + 1].y - m[i + 1] * d;
      path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
    }
    return path;
  };

  /* Build per-segment sub-paths for series with segmentColor */
  const segmentPaths = (pts: { x: number; y: number }[], s: ChartSeries) => {
    if (!s.segmentColor) return null;
    const len = pts.length;
    const dx: number[] = [];
    const dy: number[] = [];
    const m: number[] = [];
    for (let i = 0; i < len - 1; i++) {
      dx.push(pts[i + 1].x - pts[i].x);
      dy.push(pts[i + 1].y - pts[i].y);
    }
    m.push(dy[0] / dx[0]);
    for (let i = 1; i < len - 1; i++) {
      const s0 = dy[i - 1] / dx[i - 1];
      const s1 = dy[i] / dx[i];
      m.push(s0 * s1 <= 0 ? 0 : (s0 + s1) / 2);
    }
    m.push(dy[len - 2] / dx[len - 2]);
    for (let i = 0; i < len - 1; i++) {
      const sl = dy[i] / dx[i];
      if (Math.abs(sl) < 1e-10) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / sl, b = m[i + 1] / sl, h = Math.hypot(a, b);
      if (h > 3) { const t = 3 / h; m[i] = t * a * sl; m[i + 1] = t * b * sl; }
    }

    const segs: { d: string; color: string }[] = [];
    for (let i = 0; i < len - 1; i++) {
      const d = dx[i] / 3;
      const c1x = pts[i].x + d, c1y = pts[i].y + m[i] * d;
      const c2x = pts[i + 1].x - d, c2y = pts[i + 1].y - m[i + 1] * d;
      segs.push({
        d: `M${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)} C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`,
        color: s.segmentColor(s.data[i].value, s.data[i + 1].value),
      });
    }
    return segs;
  };

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        <defs>
          {/* Vertical stroke gradients */}
          {series.map((s, si) => s.strokeGradient && (
            <linearGradient key={`sg${si}`} id={`strokeGrad${si}`} x1="0" y1="0" x2="0" y2="1">
              {s.strokeGradient.map((stop, j) => (
                <stop key={j} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          ))}
          {/* Gaussian blur glow filter per series */}
          {series.map((_, si) => (
            <filter key={`gf${si}`} id={`lineGlow${si}`} x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
            </filter>
          ))}
        </defs>

        {series.map((s, si) => {
          const pts = getPoints(s.data);
          const line = smoothPath(pts);
          const segs = s.segmentColor ? segmentPaths(pts, s) : null;
          const hasStrokeGrad = !!s.strokeGradient;
          const strokeRef = hasStrokeGrad ? `url(#strokeGrad${si})` : s.color;

          /* For strokeGradient dots: interpolate color from gradient stops by Y position */
          const dotColorForPt = (p: { x: number; y: number }) => {
            if (!s.strokeGradient) return segs ? s.segmentColor!(s.data[pts.indexOf(p)].value, s.data[Math.min(pts.indexOf(p), s.data.length - 2)].value) : s.color;
            const pct = (p.y - padY) / (plotH - padY * 2); // 0 = top, 1 = bottom
            const stops = s.strokeGradient;
            // find two surrounding stops
            for (let j = 0; j < stops.length - 1; j++) {
              const a = parseFloat(stops[j].offset) / 100;
              const b = parseFloat(stops[j + 1].offset) / 100;
              if (pct >= a && pct <= b) {
                const t = (pct - a) / (b - a);
                // simple hex lerp
                const c1 = stops[j].color, c2 = stops[j + 1].color;
                const r = Math.round(parseInt(c1.slice(1, 3), 16) * (1 - t) + parseInt(c2.slice(1, 3), 16) * t);
                const g = Math.round(parseInt(c1.slice(3, 5), 16) * (1 - t) + parseInt(c2.slice(3, 5), 16) * t);
                const bl = Math.round(parseInt(c1.slice(5, 7), 16) * (1 - t) + parseInt(c2.slice(5, 7), 16) * t);
                return `rgb(${r},${g},${bl})`;
              }
            }
            return stops[stops.length - 1].color;
          };

          return (
            <g key={si}>
              {/* Gaussian blur glow — fades smoothly outward */}
              <path d={line} fill="none" stroke={strokeRef} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} filter={`url(#lineGlow${si})`} />
              {/* Main line */}
              {segs && !hasStrokeGrad ? (
                segs.map((seg, j) => (
                  <path key={j} d={seg.d} fill="none" stroke={seg.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                ))
              ) : (
                <path d={line} fill="none" stroke={strokeRef} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* Dots */}
              {pts.map((p, i) => {
                const dc = dotColorForPt(p);
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={6} fill={dc} opacity={0.12} />
                    <circle cx={p.x} cy={p.y} r={2.5} fill="var(--color-bg-page, #fff)" stroke={dc} strokeWidth={1.5} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* X-axis labels */}
        {labels.map((lbl, i) => (
          <text key={i} x={padX + i * stepX} y={plotH + 18} textAnchor="middle" fill="var(--color-text-primary)" opacity={0.5} fontSize={12} fontWeight={500} fontFamily="Inter, sans-serif">
            {lbl}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ─── 13. TaskProgressCard ─── */
export function TaskProgressCard({
  title,
  progress,
  eta,
  steps,
  icon: IconComp,
  expanded = false,
  onClick,
}: {
  title: string;
  progress: number;
  eta: string;
  steps: string[];
  icon?: LucideIcon;
  expanded?: boolean;
  onClick?: () => void;
}) {
  const Ic = IconComp || Play;
  return (
    <button
      onClick={onClick}
      className="px-5 py-4 text-left transition-colors w-full border-b border-dashed border-stroke-outline last:border-0 flex items-center gap-3.5"
    >
      <Ic size={22} strokeWidth={1.75} className="text-text-primary shrink-0 icon-theme" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3.5">
          <div className="flex-1 min-w-0 text-[14px] font-bold text-text-primary">{title}</div>
          <StatusTag variant="submitted" size="sm" icon={Timer} label={eta} tooltip={`Agent estimates ${eta} to complete this task`} />
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex-1"><ProgressBar value={progress} height={6} /></div>
          <span className="text-[14px] text-text-primary shrink-0">{progress}%</span>
        </div>
      </div>
      <ChevronRight size={16} className="text-text-primary shrink-0" />
      {expanded && (
        <div className="mt-3.5 p-3.5 bg-bg-hover rounded-xl text-[14px] text-text-primary leading-[1.8] ml-[52px]">
          <div className="font-bold text-text-primary mb-1">Steps:</div>
          {steps.map((s, j) => (
            <div key={j} className="flex items-center gap-2">
              <StepIndicator status={j < steps.length - 1 ? 'done' : 'in-progress'} />
              <span className="text-text-primary">{s}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

/* ─── 13b. HealthDimensionRow ───
 * Lucide icon + label/description on the left, auto-colored status pill on the right.
 * Tag color + icon derive from completion ratio:
 *   ≥100% → in-progress (light blue) + Check      // "done"
 *   ≥50%  → pending     (orange)     + AlertTriangle
 *   <50%  → failed      (red)        + XCircle
 * Items with no `target` (e.g. Workload) are treated as done.
 */
export function HealthDimensionRow({
  icon: Icon,
  label,
  desc,
  value,
  target,
  unit,
  status,
}: {
  icon: LucideIcon;
  label: string;
  desc: string;
  value: number;
  target?: number | null;
  unit: string;
  status?: string;
}) {
  const pct = target ? value / target : 1;
  const tagProps =
    pct >= 1   ? { variant: 'in-progress' as const, icon: Check }
    : pct >= 0.5 ? { variant: 'pending'     as const, icon: AlertTriangle }
    :              { variant: 'failed'      as const, icon: XCircle };
  return (
    <div
      className="px-5 py-4 flex items-center gap-3.5 border-b border-dashed border-stroke-outline last:border-0"
    >
      <Icon size={22} strokeWidth={1.75} className="text-text-primary shrink-0 icon-theme" />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-text-primary">{label}</div>
        <div className="text-[14px] text-text-primary mt-0.5">{desc}</div>
      </div>
      <StatusTag
        variant={tagProps.variant}
        icon={tagProps.icon}
        size="sm"
        label={target ? `${value}/${target}${unit}` : `${value} ${unit} · ${status ?? ''}`}
        tooltip={target ? `${label}: ${value} of ${target}${unit} goal reached` : `${label}: ${value} ${unit}, ${status}`}
      />
    </div>
  );
}

/* ─── 14. ReviewItemCard ───
 * Leading icon is auto-derived from `type` (Document → FileText, Tickets → Ticket,
 * Email → Mail). Override with the explicit `icon` prop for other content types.
 */
const REVIEW_TYPE_ICONS: Record<string, LucideIcon> = {
  Document: FileText,
  Tickets: Ticket,
  Email: Mail,
};

export function ReviewItemCard({
  title,
  type,
  time,
  humanTime,
  done = false,
  icon,
}: {
  title: string;
  source?: string;
  type: string;
  time: string;
  humanTime: string;
  done?: boolean;
  onToggle?: () => void;
  icon?: LucideIcon;
}) {
  const Icon = icon ?? REVIEW_TYPE_ICONS[type] ?? FileText;
  return (
    <div
      className={`px-5 py-4 flex items-center gap-3.5 transition-all ${done ? 'opacity-50' : ''}`}
    >
      <Icon size={22} strokeWidth={1.75} className="text-text-primary shrink-0 icon-theme" />
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-bold text-text-primary ${done ? 'line-through' : ''}`}>
          {title}
        </div>
        <div className="text-[14px] text-text-primary mt-1">
          {type} · {time}
        </div>
      </div>
      <TimePill time={humanTime} tooltip={`Estimated ${humanTime} for you to review`} />
      <ChevronRight size={16} className="text-text-primary shrink-0" />
    </div>
  );
}

/* ─── 15. ArtifactCard ───
 * Clickable reference to a produced file / document. Rendered inline under an
 * assistant chat message (when Claude Code writes a file, or when the #3
 * artifact primitive returns a hosted URL). Uses the CardShell + CardHeader
 * visual language shared with research / meeting cards: title bar with icon +
 * file name + open chevron, soft divider, body row with the file-type label.
 *
 *   - Icon is derived from `artifact.fileType` via `outputIconFor` so the same
 *     mapping powers the Project Output grid.
 *   - Click behavior: `href` wins (opens in a new tab — used by hosted
 *     artifacts); else `onClick` (chat card for Claude-Code files calls the
 *     open-file endpoint); else it's a non-interactive display card.
 */

const OUTPUT_ICON: Record<OutputType, LucideIcon> = {
  Web: FileCode2,
  Slides: Presentation,
  Image: FileImage,
  Video: MonitorPlay,
  File: FileText,
};

export function outputIconFor(type: OutputType): LucideIcon {
  return OUTPUT_ICON[type] ?? FileText;
}

export function ArtifactCard({
  artifact,
  onClick,
}: {
  artifact: ArtifactRef;
  /** Called when the card is clicked and no `href` is set. The chat-bubble
   *  site wires this to POST /api/claude-chat/open-file → `open` on macOS →
   *  the OS opens the file in the default app (HTML → browser). */
  onClick?: (artifact: ArtifactRef) => void;
}) {
  const Icon = outputIconFor(artifact.fileType);
  const isInteractive = !!artifact.href || !!onClick;
  const inner = (
    <div
      className={`rounded-lg overflow-hidden w-full max-w-[320px]${
        isInteractive ? ' card-hover-shadow' : ''
      }`}
      style={{ background: 'var(--color-card-panel-bg)' }}
    >
      <div className="flex items-center gap-2 px-4 h-[61px]">
        <div className="w-6 h-6 shrink-0 flex items-center justify-center text-text-primary">
          <Icon size={18} className="icon-theme" />
        </div>
        <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">{artifact.name}</p>
        {isInteractive && <ArrowUpRight size={18} className="text-text-primary shrink-0" />}
      </div>
    </div>
  );
  const wrapperClass = `inline-block max-w-full text-left no-underline${
    isInteractive ? ' cursor-pointer' : ''
  }`;
  if (artifact.href) {
    return (
      <a href={artifact.href} target="_blank" rel="noreferrer" className={wrapperClass}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={() => onClick(artifact)} className={wrapperClass}>
        {inner}
      </button>
    );
  }
  return <div className={wrapperClass}>{inner}</div>;
}

/* ─── 16. EmptyState ───
 * Centered icon + title + optional description. Used when a section has no
 * content yet (new-project Output / Recents). Deliberately minimal — no CTA,
 * no illustration — so it reads as "nothing here yet, that's expected"
 * rather than a prompt to do something specific.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 px-4 text-center ${className}`}>
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-hover text-text-secondary">
        <Icon size={20} strokeWidth={1.5} className="icon-theme" />
      </div>
      <div className="text-[14px] text-text-primary font-medium">{title}</div>
      {description && (
        <div className="text-[13px] text-text-secondary leading-relaxed max-w-[280px]">{description}</div>
      )}
    </div>
  );
}
