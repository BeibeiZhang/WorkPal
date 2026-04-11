import { useState } from 'react';
import { Chat } from '../types';
import { LayoutDashboard, Plus, Link, BookOpen, FolderPlus, ChevronDown, Search, Palette } from 'lucide-react';
import {
  iconSun, iconMoon, iconSpinner,
} from '../assets';

const USER_PROFILE_IMG = '/icons/user-profile.png';

export interface Project {
  id: string;
  name: string;
  description?: string;
}

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  activeView?: 'chat' | 'tasks' | 'connectors' | 'design-system' | 'overview' | 'library';
  activeProjectId?: string | null;
  projects: Project[];
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onProjectSelect: (id: string) => void;
  onViewChange?: (view: 'chat' | 'tasks' | 'connectors' | 'design-system' | 'overview' | 'library') => void;
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
        style={isDark ? { background: 'var(--color-bg-page)' } : undefined}
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
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard, onClick: () => onViewChange?.('overview'), active: activeView === 'overview' && !activeChatId },
    { id: 'new', label: 'New Session', Icon: Plus, onClick: onNewChat, active: false },
    { id: 'connectors', label: 'Connectors', Icon: Link, onClick: () => onViewChange?.('connectors'), active: activeView === 'connectors' },
    { id: 'library', label: 'Library', Icon: BookOpen, onClick: () => onViewChange?.('library'), active: activeView === 'library' },
    { id: 'design-system', label: 'Design System', Icon: Palette, onClick: () => onViewChange?.('design-system'), active: activeView === 'design-system' },
  ];

  return (
    <div
      className="flex flex-col h-full w-[64px] select-none shrink-0 items-center"
      style={{ background: 'var(--color-sidebar-bg)', borderRight: '1px solid var(--color-stroke-outline)' }}
    >
      {/* Top: hamburger to expand */}
      <div className="flex items-center justify-center h-16 shrink-0">
        <button
          onClick={onToggleSidebar}
          title="Open sidebar"
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-[#e6e8ea] dark:hover:bg-bg-hover transition-colors"
          style={{ color: 'var(--color-icon-primary)' }}
        >
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <rect width="22" height="2" rx="1" fill="currentColor"/>
            <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
          </svg>
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
              active ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'
            }`}
            style={active ? {
              border: '1px solid transparent',
              background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
            } : { border: '1px solid transparent' }}
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

export default function Sidebar({ chats, activeChatId, activeView, activeProjectId, projects, onChatSelect, onNewChat, onNewProject, onProjectSelect, onViewChange, isDark, onToggleDark, onToggleSidebar }: SidebarProps) {
  const [search, setSearch] = useState('');
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);

  // Hide drafts (and any leftover empty "New Session" entries from older
  // sessions in localStorage) from the Recents list — they live under the
  // top "New Session" button until the user actually sends a message.
  const isDraftLike = (c: Chat) =>
    c.isDraft || (c.title === 'New Session' && c.messages.length === 0);

  const filteredChats = chats.filter(c =>
    c.id !== 'my-workpal' &&
    !isDraftLike(c) &&
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  // The top "New Session" button shows as selected while a draft chat is the
  // active chat — i.e. the user has clicked it but hasn't sent a message yet.
  const activeChat = chats.find(c => c.id === activeChatId);
  const isNewSessionActive = activeView === 'chat' && !!activeChat && isDraftLike(activeChat);

  return (
    <div className="flex flex-col h-full w-[300px] select-none shrink-0" style={{ background: 'var(--color-sidebar-bg)', borderRight: '1px solid var(--color-stroke-outline)' }}>

      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 h-16 shrink-0">
        {/* Hamburger nav — closes sidebar */}
        <button onClick={onToggleSidebar} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" style={{ color: 'var(--color-icon-primary)' }}>
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <rect width="22" height="2" rx="1" fill="currentColor"/>
            <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="pl-4 pr-2 pt-0.5 shrink-0">
        <div
          className="flex items-center gap-4 px-4 py-[7px] rounded-full border text-[17px] leading-[22px]"
          style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-toggle)', color: 'var(--color-text-secondary)' }}
        >
          <Search size={18} className="shrink-0 text-text-primary" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[17px] leading-[22px] text-text-primary placeholder-text-secondary tracking-[-0.43px] truncate"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 py-4">

        {/* Top menu items */}
        <div className="px-4 flex flex-col gap-1">
          {/* Overview */}
          <button
            onClick={() => onViewChange?.('overview')}
            className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'overview' ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'}`}
            style={activeView === 'overview' ? {
              border: '1px solid transparent',
              background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
            } : { border: '1px solid transparent' }}
          >
            <LayoutDashboard size={20} className="shrink-0 text-text-primary" />
            <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
              Overview
            </span>
          </button>

          {/* New Session — shows the gradient-border selected state while a
              draft chat is active (i.e. user clicked it but hasn't sent yet). */}
          <button
            onClick={onNewChat}
            className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${
              isNewSessionActive ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'
            }`}
            style={isNewSessionActive ? {
              border: '1px solid transparent',
              background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
            } : { border: '1px solid transparent' }}
          >
            <Plus size={20} className="shrink-0 text-text-primary" />
            <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
              New Session
            </span>
            {isNewSessionActive && (
              <div className="flex items-center justify-center shrink-0" style={{ width: 25, height: 25 }}>
                <div
                  className="animate-spin"
                  style={{
                    width: 23,
                    height: 23,
                    background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)',
                    WebkitMaskImage: `url(${iconSpinner})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskImage: `url(${iconSpinner})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    animationDuration: '1.5s',
                  }}
                />
              </div>
            )}
          </button>

          {/* Connectors */}
          <button
            onClick={() => onViewChange?.('connectors')}
            className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'connectors' ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'}`}
            style={activeView === 'connectors' ? {
              border: '1px solid transparent',
              background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
            } : { border: '1px solid transparent' }}
          >
            <Link size={20} className="shrink-0 text-text-primary" />
            <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
              Connectors
            </span>
          </button>

          {/* Library */}
          <button
            onClick={() => onViewChange?.('library')}
            className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'library' ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'}`}
            style={activeView === 'library' ? {
              border: '1px solid transparent',
              background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
            } : { border: '1px solid transparent' }}
          >
            <BookOpen size={20} className="shrink-0 text-text-primary" />
            <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
              Library
            </span>
          </button>
        </div>

        {/* Projects section */}
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
                <button
                  key={proj.id}
                  onClick={() => onProjectSelect(proj.id)}
                  className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${
                    activeProjectId === proj.id ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'
                  }`}
                  style={activeProjectId === proj.id ? {
                    border: '1px solid transparent',
                    background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
                  } : { border: '1px solid transparent' }}
                >
                  <span className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px] truncate" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}>
                    {proj.name}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Admin section */}
        <div className="px-4 pt-4 flex flex-col gap-1">
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
                const isActive = activeChatId === 'my-workpal';
                return (
                  <button
                    onClick={() => onChatSelect('my-workpal')}
                    className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${
                      isActive ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'
                    }`}
                    style={isActive ? {
                      border: '1px solid transparent',
                      background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
                    } : { border: '1px solid transparent' }}
                  >
                    <span
                      className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px] truncate"
                      style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}
                    >
                      Onboarding Experience
                    </span>
                    {isActive && (
                      <div className="flex items-center justify-center shrink-0" style={{ width: 25, height: 25 }}>
                        <div
                          className="animate-spin"
                          style={{
                            width: 23,
                            height: 23,
                            background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)',
                            WebkitMaskImage: `url(${iconSpinner})`,
                            WebkitMaskSize: 'contain',
                            WebkitMaskRepeat: 'no-repeat',
                            WebkitMaskPosition: 'center',
                            maskImage: `url(${iconSpinner})`,
                            maskSize: 'contain',
                            maskRepeat: 'no-repeat',
                            maskPosition: 'center',
                            animationDuration: '1.5s',
                          }}
                        />
                      </div>
                    )}
                  </button>
                );
              })()}

              {/* Design System */}
              <button
                onClick={() => onViewChange?.('design-system')}
                className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${activeView === 'design-system' ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'}`}
                style={activeView === 'design-system' ? {
                  border: '1px solid transparent',
                  background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
                } : { border: '1px solid transparent' }}
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
            const isActive = activeChatId === chat.id;
            return (
              <button
                key={chat.id}
                onClick={() => onChatSelect(chat.id)}
                className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${
                  isActive ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'
                }`}
                style={isActive ? {
                  border: '1px solid transparent',
                  background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
                } : { border: '1px solid transparent' }}
              >
                <span
                  className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px] truncate"
                  style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', fontWeight: 400 }}
                >
                  {chat.title}
                </span>
                {isActive && (
                  <div className="flex items-center justify-center shrink-0" style={{ width: 25, height: 25 }}>
                    <div
                      className="animate-spin"
                      style={{
                        width: 23,
                        height: 23,
                        background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)',
                        WebkitMaskImage: `url(${iconSpinner})`,
                        WebkitMaskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskImage: `url(${iconSpinner})`,
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        animationDuration: '1.5s',
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Account footer */}
      <div
        className="px-4 pt-4 pb-10 shrink-0 flex items-center gap-6"
        style={{ borderTop: '1px solid var(--color-stroke-outline)' }}
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
