import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Chat, Attachment, OutputItem } from '../types';
import { LayoutDashboard, SquarePen, Link, BookOpen, Brain, FolderPlus, ChevronDown, Search, Palette, PanelLeft, MoreHorizontal, Trash2, FolderInput, Check, Sparkles } from 'lucide-react';
import { iconSun, iconMoon } from '../assets';

/**
 * Hover-visible "⋯" menu anchored to a sidebar row. Opens a popover with
 * actions: "Move to…" (when moveTargets is provided) and "Delete".
 * Dismisses on outside click. Menu is portaled to document.body so it
 * escapes the sidebar's `overflow-y-auto` clipping.
 */
function RowMoreMenu({
  onDelete,
  moveTargets,
  currentProjectId,
  onMove,
  onPromote,
}: {
  onDelete: () => void;
  /** Projects the row can be filed into. Omit to hide the Move section. */
  moveTargets?: { id: string; name: string }[];
  /** Project the row currently belongs to — shown with a checkmark so the
   *  user can tell at a glance where it's filed. */
  currentProjectId?: string;
  /** Invoked with a project id, or null to remove from any project. */
  onMove?: (projectId: string | null) => void;
  /** Open the "Promote to Project" dialog for this row. Surfaced as the
   *  "New project…" entry at the bottom of the Move submenu. */
  onPromote?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setMoveOpen(false);
    };
    const handleScroll = () => { setOpen(false); setMoveOpen(false); };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  // Collapse the Move submenu whenever the outer menu closes so reopening
  // starts from the top-level menu, not the Move drill-down.
  useEffect(() => {
    if (!open) setMoveOpen(false);
  }, [open]);

  // Move submenu surfaces three things: existing projects to move into,
  // "Remove from project" (when currently filed), and "New project…" (via
  // onPromote). Available if any of those are actionable.
  const canMove = !!onMove && (!!moveTargets || !!onPromote);

  return (
    <div
      className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${
        open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
      }`}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label="More"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors text-text-primary"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed min-w-[180px] rounded-xl py-1 border"
          style={{
            top: pos.top,
            right: pos.right,
            zIndex: 1000,
            background: 'var(--color-bg-page)',
            borderColor: 'var(--color-stroke-outline)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!moveOpen ? (
            <>
              {canMove && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMoveOpen(true); }}
                  className="mx-1 px-3 py-2 flex items-center gap-2 text-left text-[14px] leading-[18px] text-text-primary hover:bg-bg-hover transition-colors rounded-lg"
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <FolderInput size={14} />
                  <span className="flex-1">Move to project</span>
                  <ChevronDown size={12} className="-rotate-90" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); setOpen(false); }}
                className="mx-1 px-3 py-2 flex items-center gap-2 text-left text-[14px] leading-[18px] text-text-primary hover:bg-bg-hover transition-colors rounded-lg"
                style={{ width: 'calc(100% - 8px)' }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMoveOpen(false); }}
                className="mx-1 px-3 py-1 flex items-center gap-2 text-left text-[12px] leading-[16px] text-text-secondary hover:bg-bg-hover transition-colors rounded-lg"
                style={{ width: 'calc(100% - 8px)' }}
              >
                <ChevronDown size={12} className="rotate-90" />
                <span>Back</span>
              </button>
              <div className="h-px my-1 mx-2" style={{ background: 'var(--color-stroke-outline)' }} />
              {moveTargets?.map(p => {
                const isCurrent = currentProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onMove!(p.id); setOpen(false); setMoveOpen(false); }}
                    className="mx-1 px-3 py-2 flex items-center gap-2 text-left text-[14px] leading-[18px] text-text-primary hover:bg-bg-hover transition-colors rounded-lg"
                    style={{ width: 'calc(100% - 8px)' }}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    {isCurrent && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })}
              {currentProjectId && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMove!(null); setOpen(false); setMoveOpen(false); }}
                  className="mx-1 px-3 py-2 flex items-center gap-2 text-left text-[14px] leading-[18px] text-text-primary hover:bg-bg-hover transition-colors rounded-lg"
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <span className="flex-1">Remove from project</span>
                </button>
              )}
              {onPromote && (
                <>
                  {(moveTargets?.length || currentProjectId) && (
                    <div className="h-px my-1 mx-2" style={{ background: 'var(--color-stroke-outline)' }} />
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPromote(); setOpen(false); setMoveOpen(false); }}
                    className="mx-1 px-3 py-2 flex items-center gap-2 text-left text-[14px] leading-[18px] text-text-primary hover:bg-bg-hover transition-colors rounded-lg"
                    style={{ width: 'calc(100% - 8px)' }}
                  >
                    <FolderPlus size={14} />
                    <span className="flex-1">New project…</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

const USER_PROFILE_IMG = '/icons/user-profile.png';

/**
 * Account dropdown anchored to the sidebar's profile row. Opens upward
 * (footer-anchored) with entries like "Memory" that jump to their page.
 * Dismisses on outside click or Escape.
 */
interface AvatarMenuProps {
  compact?: boolean;
  activeView?: SidebarProps['activeView'];
  activeChatId?: string;
  onViewChange?: SidebarProps['onViewChange'];
  onChatSelect?: (id: string) => void;
}

/**
 * Account/navigation hub anchored to the profile avatar. Opens upward with
 * entries for Connectors, Library, Memory, Onboarding Experience, and
 * Design System — destinations that no longer live in the left rail.
 * Dismisses on outside click or Escape.
 */
function AvatarMenu({ compact = false, activeView, activeChatId, onViewChange, onChatSelect }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Small grace period on mouse-leave so the cursor can cross the 8px gap
   *  between the avatar and the menu (mb-2 below) without the menu snapping
   *  shut mid-traverse. Cleared if the cursor re-enters either surface. */
  const closeTimerRef = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const items: { id: string; label: string; Icon: typeof Link; onClick: () => void; active: boolean }[] = [
    { id: 'connectors',    label: 'Connectors',            Icon: Link,     onClick: () => onViewChange?.('connectors'),    active: activeView === 'connectors' },
    { id: 'library',       label: 'Library',               Icon: BookOpen, onClick: () => onViewChange?.('library'),       active: activeView === 'library' },
    { id: 'memory',        label: 'Memory',                Icon: Brain,    onClick: () => onViewChange?.('memory'),        active: activeView === 'memory' },
    { id: 'onboarding',    label: 'Onboarding Experience', Icon: Sparkles, onClick: () => onChatSelect?.('my-workpal'),    active: activeChatId === 'my-workpal' && activeView === 'chat' },
    { id: 'design-system', label: 'Design System',         Icon: Palette,  onClick: () => onViewChange?.('design-system'), active: activeView === 'design-system' },
  ];

  return (
    <div
      className={compact ? 'relative' : 'relative flex-1 min-w-0'}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={
          compact
            ? 'block rounded-full overflow-hidden hover:opacity-80 transition-opacity'
            : 'flex items-center gap-6 w-full rounded-full hover:bg-bg-hover transition-colors text-left'
        }
        style={compact ? { width: 35, height: 35 } : undefined}
      >
        {compact ? (
          <img src={USER_PROFILE_IMG} alt="Beibei Zhang" className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: 35, height: 35 }}>
              <img src={USER_PROFILE_IMG} alt="Beibei Zhang" className="w-full h-full object-cover" />
            </div>
            <p
              className="text-[16px] font-bold text-text-primary tracking-[-0.43px] truncate"
              style={{ lineHeight: '32px', fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
            >
              Beibei Zhang
            </p>
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute bottom-full left-0 mb-2 min-w-[220px] py-1 rounded-xl overflow-hidden z-40"
          style={{
            background: 'var(--color-bg-page)',
            border: '1px solid var(--color-stroke-outline)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {items.map(({ id, label, Icon, onClick, active }) => (
            <button
              key={id}
              role="menuitem"
              onClick={() => { setOpen(false); onClick(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${active ? 'bg-bg-hover' : 'hover:bg-bg-hover'}`}
            >
              <Icon size={16} className="shrink-0 text-text-primary" />
              <span className="text-[14px] text-text-primary">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  /** Reference files attached to the project. Their content is prepended to
   *  every AI request in any chat scoped to this project — persistent
   *  cross-chat context. See buildAttachmentContextBlock(..., 'project'). */
  files?: Attachment[];
  /** Artifacts actually produced in this project (Claude Code file writes,
   *  and eventually #3 hosted artifacts). Rendered in the Output grid on
   *  the project page. Absent on freshly-created projects — they show an
   *  empty state until the first file is written. */
  outputs?: OutputItem[];
}

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  activeView?: 'chat' | 'connectors' | 'design-system' | 'overview' | 'library' | 'memory';
  activeProjectId?: string | null;
  projects: Project[];
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onProjectSelect: (id: string) => void;
  onViewChange?: (view: 'chat' | 'connectors' | 'design-system' | 'overview' | 'library' | 'memory') => void;
  onDeleteChat?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  /** File a chat into a project, or pass null to remove it from any project. */
  onMoveChat?: (chatId: string, projectId: string | null) => void;
  /** Open the "Promote to Project" dialog for the given chat. Shown on the
   *  row menu only for chats that don't already belong to a project. */
  onPromoteChat?: (chatId: string) => void;
  isDark: boolean;
  onToggleDark: () => void;
  onToggleSidebar?: () => void;
}

/** Sun/Moon dark-mode toggle matching Figma's pill toggle design */
function DarkToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 p-1 rounded-full border transition-colors"
      style={{ background: 'var(--color-stroke-toggle)', borderColor: 'var(--color-stroke-toggle)' }}
    >
      <span
        className="flex items-center justify-center p-1 rounded-full transition-colors"
        style={!isDark ? { background: 'var(--color-bg-page)' } : undefined}
      >
        <div className="overflow-clip relative" style={{ width: 24, height: 24 }}>
          <div className="absolute" style={{ width: 21.056, height: 21.057, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            <img src={iconSun} alt="Light" className="absolute block max-w-none w-full h-full icon-theme" />
          </div>
        </div>
      </span>
      <span
        className="flex items-center justify-center p-1 rounded-full transition-colors"
        style={isDark ? { background: 'rgba(0,0,0,0.3)' } : undefined}
      >
        <div className="overflow-clip relative" style={{ width: 24, height: 24 }}>
          <div className="absolute" style={{ width: 17.107, height: 15.895, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            <img src={iconMoon} alt="Dark" className="absolute block max-w-none w-full h-full icon-theme" />
          </div>
        </div>
      </span>
    </button>
  );
}

/* ─── Minimized icon-only sidebar (desktop collapsed) ─── */
interface MiniSidebarProps {
  activeView?: SidebarProps['activeView'];
  activeChatId: string;
  onViewChange?: SidebarProps['onViewChange'];
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onToggleSidebar?: () => void;
}

export function MiniSidebar({ activeView, activeChatId, onChatSelect, onViewChange, onNewChat, onToggleSidebar }: MiniSidebarProps) {
  const items: { id: string; label: string; Icon: typeof LayoutDashboard; onClick: () => void; active: boolean }[] = [
    { id: 'new', label: 'New Session', Icon: SquarePen, onClick: onNewChat, active: false },
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard, onClick: () => onViewChange?.('overview'), active: activeView === 'overview' && !activeChatId },
    { id: 'search', label: 'Search', Icon: Search, onClick: () => onToggleSidebar?.(), active: false },
  ];

  return (
    <div
      className="flex flex-col h-full w-[64px] select-none shrink-0 items-center bg-bg-sidebar dark:bg-transparent"
      style={{
        backgroundImage: 'linear-gradient(to bottom, transparent 0%, var(--color-stroke-outline) 20%, var(--color-stroke-outline) 80%, transparent 100%)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1px 100%',
        backgroundPosition: 'right',
      }}
    >
      {/* Top: hamburger to expand */}
      <div className="flex items-center justify-center pt-6 shrink-0">
        <button
          onClick={onToggleSidebar}
          title="Open sidebar"
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors"
          style={{ color: 'var(--color-icon-primary)' }}
        >
          <PanelLeft size={20} />
        </button>
      </div>

      {/* Nav icons */}
      <div className="flex-1 flex flex-col items-center gap-1 pt-2">
        {items.map(({ id, label, Icon, onClick, active }) => (
          <button
            key={id}
            onClick={onClick}
            title={label}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
              active ? 'gradient-ring' : 'hover:bg-bg-hover'
            }`}
          >
            <Icon size={20} className="text-text-primary" />
          </button>
        ))}
      </div>

      {/* Profile at bottom */}
      <div className="pb-10 shrink-0 flex items-center justify-center">
        <AvatarMenu
          compact
          activeView={activeView}
          activeChatId={activeChatId}
          onViewChange={onViewChange}
          onChatSelect={onChatSelect}
        />
      </div>
    </div>
  );
}

export default function Sidebar({ chats, activeChatId, activeView, activeProjectId, projects, onChatSelect, onNewChat, onNewProject, onProjectSelect, onViewChange, onDeleteChat, onDeleteProject, onMoveChat, onPromoteChat, isDark, onToggleDark, onToggleSidebar }: SidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);

  // Hide drafts (and any leftover empty "New Session" entries from older
  // sessions in localStorage) from the Recents list — they live under the
  // top "New Session" button until the user actually sends a message.
  const isDraftLike = (c: Chat) =>
    c.isDraft || (c.title === 'New Session' && c.messages.length === 0);

  const filteredChats = chats.filter(c =>
    c.id !== 'my-workpal' && !isDraftLike(c)
  );

  // The top "New Session" button shows as selected while a draft chat is the
  // active chat — i.e. the user has clicked it but hasn't sent a message yet.
  const activeChat = chats.find(c => c.id === activeChatId);
  const isNewSessionActive = activeView === 'chat' && !!activeChat && isDraftLike(activeChat);

  return (
    <div
      className="flex flex-col h-full w-[300px] select-none shrink-0 bg-bg-sidebar dark:bg-transparent"
      style={{
        backgroundImage: 'linear-gradient(to bottom, transparent 0%, var(--color-stroke-outline) 20%, var(--color-stroke-outline) 80%, transparent 100%)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1px 100%',
        backgroundPosition: 'right',
      }}
    >

      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 pt-6 shrink-0">
        {/* Hamburger nav — closes sidebar */}
        <button onClick={onToggleSidebar} title="Close sidebar" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors" style={{ color: 'var(--color-icon-primary)' }}>
          <PanelLeft size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 py-4 scrollbar-autohide">

        {/* Top menu items */}
        <div className="px-4 flex flex-col gap-1">
          {/* 1. New Session (default page) */}
          <button
            onClick={onNewChat}
            className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${
              isNewSessionActive ? 'gradient-ring' : 'hover:bg-bg-hover'
            }`}
          >
            <SquarePen size={20} className="shrink-0 text-text-primary" />
            <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
              New Session
            </span>
          </button>

          {/* 2. Overview */}
          <button
            onClick={() => onViewChange?.('overview')}
            className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'overview' ? 'gradient-ring' : 'hover:bg-bg-hover'}`}
          >
            <LayoutDashboard size={20} className="shrink-0 text-text-primary" />
            <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
              Overview
            </span>
          </button>

          {/* 3. Search */}
          <button
            className="flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left hover:bg-bg-hover"
          >
            <Search size={20} className="shrink-0 text-text-primary" />
            <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
              Search
            </span>
          </button>
        </div>

        {/* 4. Projects section */}
        <div className="px-4 pt-4 flex flex-col gap-1">
          <button
            onClick={() => setProjectsOpen(!projectsOpen)}
            className="px-4 flex items-center justify-between hover:bg-bg-hover rounded-full transition-colors"
            style={{ height: 32 }}
          >
            <p className="text-base font-bold text-text-primary tracking-[-0.43px]">Projects</p>
            <ChevronDown
              size={16}
              className={`text-text-primary transition-transform ${projectsOpen ? '' : '-rotate-90'}`}
            />
          </button>

          {projectsOpen && (
            <>
              {/* New Project */}
              <button
                onClick={onNewProject}
                className="flex items-center gap-4 w-full px-4 py-2 rounded-full hover:bg-bg-hover transition-colors text-left"
              >
                <FolderPlus size={18} className="shrink-0 text-text-primary" />
                <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
                  New Project
                </span>
              </button>

              {projects.map(proj => (
                <div key={proj.id} className="relative group">
                  <button
                    onClick={() => onProjectSelect(proj.id)}
                    className={`flex items-center gap-4 w-full pl-4 pr-10 py-2 rounded-full transition-colors text-left ${
                      activeProjectId === proj.id ? 'gradient-ring' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px] truncate" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
                      {proj.name}
                    </span>
                  </button>
                  {onDeleteProject && <RowMoreMenu onDelete={() => onDeleteProject(proj.id)} />}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Recents section */}
        <div className="px-4 pt-4 flex flex-col gap-1">
          <button
            onClick={() => setRecentsOpen(!recentsOpen)}
            className="px-4 flex items-center justify-between hover:bg-bg-hover rounded-full transition-colors"
            style={{ height: 32 }}
          >
            <p className="text-base font-bold text-text-primary tracking-[-0.43px]">Recents</p>
            <ChevronDown
              size={16}
              className={`text-text-primary transition-transform ${recentsOpen ? '' : '-rotate-90'}`}
            />
          </button>

          {recentsOpen && filteredChats.map(chat => {
            const isActive = activeChatId === chat.id && activeView === 'chat';
            return (
              <div key={chat.id} className="relative group">
                <button
                  onClick={() => onChatSelect(chat.id)}
                  className={`flex items-center gap-4 w-full pl-4 pr-10 py-2 rounded-full transition-colors text-left ${
                    isActive ? 'gradient-ring' : 'hover:bg-bg-hover'
                  }`}
                >
                  <span
                    className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px] truncate"
                    style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}
                  >
                    {chat.title}
                  </span>
                </button>
                {onDeleteChat && (
                  <RowMoreMenu
                    onDelete={() => onDeleteChat(chat.id)}
                    moveTargets={onMoveChat && projects.length > 0 ? projects.map(p => ({ id: p.id, name: p.name })) : undefined}
                    currentProjectId={chat.projectId}
                    onMove={onMoveChat ? (projectId) => onMoveChat(chat.id, projectId) : undefined}
                    onPromote={onPromoteChat ? () => onPromoteChat(chat.id) : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Account footer */}
      <div
        className="px-4 pt-4 pb-10 shrink-0 flex items-center gap-6"
        style={{
          backgroundImage: 'linear-gradient(to right, transparent 0%, var(--color-stroke-outline) 20%, var(--color-stroke-outline) 80%, transparent 100%)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 1px',
          backgroundPosition: 'top',
        }}
      >
        {/* Profile + account menu (Connectors · Library · Memory · Onboarding · Design System) */}
        <AvatarMenu
          activeView={activeView}
          activeChatId={activeChatId}
          onViewChange={onViewChange}
          onChatSelect={onChatSelect}
        />
        {/* Dark/Light toggle */}
        <DarkToggle isDark={isDark} onToggle={onToggleDark} />
      </div>
    </div>
  );
}
