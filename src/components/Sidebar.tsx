import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Chat } from '../types';
import { LayoutDashboard, SquarePen, Link, BookOpen, FolderPlus, ChevronDown, Search, Palette, PanelLeft, MoreHorizontal, Trash2 } from 'lucide-react';
import { iconSun, iconMoon } from '../assets';

/**
 * Hover-visible "⋯" menu anchored to a sidebar row. Opens a small popover
 * with a Delete action; dismisses on outside click. Menu is portaled to
 * document.body so it escapes the sidebar's `overflow-y-auto` clipping.
 */
function RowMoreMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
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
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

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
          className="fixed min-w-[140px] rounded-xl py-1 border"
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
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); setOpen(false); }}
            className="mx-1 px-3 py-2 flex items-center gap-2 text-left text-[14px] leading-[18px] text-text-primary hover:bg-bg-hover transition-colors rounded-lg"
            style={{ width: 'calc(100% - 8px)' }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

const USER_PROFILE_IMG = '/icons/user-profile.png';

export interface Project {
  id: string;
  name: string;
  description?: string;
}

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  activeView?: 'chat' | 'connectors' | 'design-system' | 'overview' | 'library';
  activeProjectId?: string | null;
  projects: Project[];
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onProjectSelect: (id: string) => void;
  onViewChange?: (view: 'chat' | 'connectors' | 'design-system' | 'overview' | 'library') => void;
  onDeleteChat?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
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

export function MiniSidebar({ activeView, activeChatId, onViewChange, onNewChat, onToggleSidebar }: MiniSidebarProps) {
  const items: { id: string; label: string; Icon: typeof LayoutDashboard; onClick: () => void; active: boolean }[] = [
    { id: 'new', label: 'New Session', Icon: SquarePen, onClick: onNewChat, active: false },
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard, onClick: () => onViewChange?.('overview'), active: activeView === 'overview' && !activeChatId },
    { id: 'search', label: 'Search', Icon: Search, onClick: () => onToggleSidebar?.(), active: false },
    { id: 'connectors', label: 'Connectors', Icon: Link, onClick: () => onViewChange?.('connectors'), active: activeView === 'connectors' },
    { id: 'library', label: 'Library', Icon: BookOpen, onClick: () => onViewChange?.('library'), active: activeView === 'library' },
    { id: 'design-system', label: 'Design System', Icon: Palette, onClick: () => onViewChange?.('design-system'), active: activeView === 'design-system' },
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
        <div className="rounded-full overflow-hidden shrink-0" style={{ width: 35, height: 35 }}>
          <img src={USER_PROFILE_IMG} alt="Beibei Zhang" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ chats, activeChatId, activeView, activeProjectId, projects, onChatSelect, onNewChat, onNewProject, onProjectSelect, onViewChange, onDeleteChat, onDeleteProject, isDark, onToggleDark, onToggleSidebar }: SidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [extensionsOpen, setExtensionsOpen] = useState(true);

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

  // Auto-collapse Admin/Extensions when scrollable content overflows.
  // One-shot collapse (not derived) to avoid expand↔collapse flicker loop:
  // deriving `open` from `isOverflowing` causes oscillation because collapsing
  // removes overflow, which then re-expands and re-triggers overflow.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chats, projectsOpen, recentsOpen]);

  useEffect(() => {
    if (isOverflowing) {
      setOnboardingOpen(false);
      setExtensionsOpen(false);
    }
  }, [isOverflowing]);

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
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 py-4 scrollbar-autohide">

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
                {onDeleteChat && <RowMoreMenu onDelete={() => onDeleteChat(chat.id)} />}
              </div>
            );
          })}
        </div>

      </div>

      {/* 6. Extensions — pinned below scroll area, auto-collapses when Recents overflows */}
      <div className="px-4 pt-2 pb-1 shrink-0 flex flex-col gap-1">
        <button
          onClick={() => setExtensionsOpen(!extensionsOpen)}
          className="px-4 flex items-center justify-between hover:bg-bg-hover rounded-full transition-colors"
          style={{ height: 32 }}
        >
          <p className="text-base font-bold text-text-primary tracking-[-0.43px]">Extensions</p>
          <ChevronDown
            size={16}
            className={`text-text-primary transition-transform ${extensionsOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {extensionsOpen && (
          <>
            <button
              onClick={() => onViewChange?.('connectors')}
              className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'connectors' ? 'gradient-ring' : 'hover:bg-bg-hover'}`}
            >
              <Link size={18} className="shrink-0 text-text-primary" />
              <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
                Connectors
              </span>
            </button>
            <button
              onClick={() => onViewChange?.('library')}
              className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'library' ? 'gradient-ring' : 'hover:bg-bg-hover'}`}
            >
              <BookOpen size={18} className="shrink-0 text-text-primary" />
              <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
                Library
              </span>
            </button>
          </>
        )}
      </div>

      {/* 7. Admin section — pinned above account footer */}
      <div className="px-4 pt-2 pb-1 shrink-0 flex flex-col gap-1">
        <button
          onClick={() => setOnboardingOpen(!onboardingOpen)}
          className="px-4 flex items-center justify-between hover:bg-bg-hover rounded-full transition-colors"
          style={{ height: 32 }}
        >
          <p className="text-base font-bold text-text-primary tracking-[-0.43px]">Admin</p>
          <ChevronDown
            size={16}
            className={`text-text-primary transition-transform ${onboardingOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {onboardingOpen && (
          <>
            {/* Onboarding Experience */}
            {(() => {
              const isActive = activeChatId === 'my-workpal' && activeView === 'chat';
              return (
                <button
                  onClick={() => onChatSelect('my-workpal')}
                  className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${
                    isActive ? 'gradient-ring' : 'hover:bg-bg-hover'
                  }`}
                >
                  <span
                    className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px] truncate"
                    style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}
                  >
                    Onboarding Experience
                  </span>
                </button>
              );
            })()}

            {/* Design System */}
            <button
              onClick={() => onViewChange?.('design-system')}
              className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'design-system' ? 'gradient-ring' : 'hover:bg-bg-hover'}`}
            >
              <Palette size={18} className="shrink-0 text-text-primary" />
              <span
                className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px] truncate"
                style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}
              >
                Design System
              </span>
            </button>
          </>
        )}
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
        {/* Profile */}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className="rounded-full overflow-hidden shrink-0" style={{ width: 35, height: 35 }}>
            <img src={USER_PROFILE_IMG} alt="Beibei Zhang" className="w-full h-full object-cover" />
          </div>
          <p
            className="text-[16px] font-bold text-text-primary tracking-[-0.43px] truncate"
            style={{ lineHeight: '32px', fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            Beibei Zhang
          </p>
        </div>
        {/* Dark/Light toggle */}
        <DarkToggle isDark={isDark} onToggle={onToggleDark} />
      </div>
    </div>
  );
}
