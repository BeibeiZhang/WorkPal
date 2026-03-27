import { useState } from 'react';
import { Chat } from '../types';
import {
  iconAsana, iconGmail, iconSheet, iconDoc20, iconZoom, iconApps,
  iconSun, iconMoon, iconEditNew, iconSpinner,
} from '../assets';

const USER_PROFILE_IMG = '/icons/user-profile.png';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  activeView?: 'chat' | 'tasks';
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  onViewChange?: (view: 'chat' | 'tasks') => void;
  isDark: boolean;
  onToggleDark: () => void;
  onToggleSidebar?: () => void;
}

// Natural pixel dimensions of each icon within its 22×22 container (from Figma)
const APP_ICONS: Array<{ id: string; name: string; icon: string; url: string; w: number; h: number; offsetY?: number }> = [
  { id: 'asana',  name: 'Asana',        icon: 'asana',  url: iconAsana,  w: 18.392, h: 17,   offsetY: 0.5 },
  { id: 'docs',   name: 'Docs',         icon: 'docs',   url: iconDoc20,  w: 14.545, h: 20,   offsetY: 0 },
  { id: 'sheets', name: 'Sheets',       icon: 'sheets', url: iconSheet,  w: 14.545, h: 20,   offsetY: 0 },
  { id: 'gmail',  name: 'Gmail',        icon: 'gmail',  url: iconGmail,  w: 18.662, h: 14,   offsetY: 0 },
  { id: 'zoom',   name: 'Zoom',         icon: 'zoom',   url: iconZoom,   w: 18.857, h: 11,   offsetY: 0.5 },
];

/** Renders an icon at its exact Figma pixel dimensions, centered in a 22×22 container. */
function AppIcon({ url, w, h, name, offsetY = 0 }: { url: string; w: number; h: number; name: string; offsetY?: number }) {
  return (
    <div className="overflow-hidden relative shrink-0" style={{ width: 22, height: 22 }}>
      <div
        className="absolute"
        style={{
          width: w,
          height: h,
          left: '50%',
          top: `calc(50% + ${offsetY}px)`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <img className="absolute block max-w-none w-full h-full" src={url} alt={name} />
      </div>
    </div>
  );
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

export default function Sidebar({ chats, activeChatId, activeView = 'chat', onChatSelect, onNewChat, onViewChange, isDark, onToggleDark, onToggleSidebar }: SidebarProps) {
  const [search, setSearch] = useState('');

  const filteredChats = chats.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-[336px] select-none shrink-0" style={{ background: 'var(--color-sidebar-bg)', borderRight: '1px solid var(--color-stroke-outline)' }}>

      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 h-16 shrink-0">
        {/* Hamburger nav — closes sidebar */}
        <button onClick={onToggleSidebar} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" style={{ color: 'var(--color-icon-primary)' }}>
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <rect width="22" height="2" rx="1" fill="currentColor"/>
            <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
          </svg>
        </button>
        {/* New chat / edit */}
        <button
          onClick={onNewChat}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors"
          title="New Chat"
        >
          <div className="overflow-clip relative" style={{ width: 24, height: 24 }}>
            <div className="absolute" style={{ inset: '7.83% 7.83% 8.33% 8.33%' }}>
              <div className="absolute" style={{ inset: '-4.97%' }}>
                <img src={iconEditNew} alt="New Chat" className="block max-w-none w-full h-full icon-theme" />
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="pl-4 pr-2 pt-0.5 shrink-0">
        <div
          className="flex items-center gap-4 px-4 py-[7px] rounded-full border text-[17px] leading-[22px]"
          style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-toggle)', color: 'var(--color-text-secondary)' }}
        >
          <span style={{ width: 25 }}>􀊫</span>
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

        {/* Recently used apps */}
        <div className="px-4 py-[10px] flex flex-col gap-1">
          {/* Section title */}
          <div className="px-4 flex items-center" style={{ height: 32 }}>
            <p className="text-base font-bold text-text-primary tracking-[-0.43px]">Recently used</p>
          </div>

          {APP_ICONS.map(app => (
            <button
              key={app.id}
              className="flex items-center gap-4 w-full px-4 py-2 rounded-full hover:bg-bg-hover transition-colors text-left"
            >
              <AppIcon url={app.url} w={app.w} h={app.h} name={app.name} offsetY={app.offsetY} />
              <span
                className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400 }}
              >
                {app.name}
              </span>
            </button>
          ))}

          {/* Explore Apps */}
          <button className="flex items-center gap-4 w-full px-4 py-2 rounded-full hover:bg-bg-hover transition-colors text-left">
            <div className="overflow-hidden relative shrink-0" style={{ width: 22, height: 22 }}>
              <div className="absolute" style={{ width: 18, height: 18, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
                <img className="absolute block max-w-none w-full h-full icon-theme" src={iconApps} alt="Apps" />
              </div>
            </div>
            <span
              className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400 }}
            >
              Explore Apps
            </span>
          </button>
        </div>

        {/* Tasks */}
        <div className="px-4 py-[10px] flex flex-col gap-1">
          <div className="px-4 flex items-center" style={{ height: 32 }}>
            <p className="text-base font-bold text-text-primary tracking-[-0.43px]">Views</p>
          </div>
          <button
            onClick={() => onViewChange?.('tasks')}
            className={`flex items-center gap-4 w-full px-4 py-2 rounded-full transition-colors text-left ${
              activeView === 'tasks' ? '' : 'hover:bg-[#e6e8ea] dark:hover:bg-bg-hover'
            }`}
            style={activeView === 'tasks' ? {
              border: '1px solid transparent',
              background: `linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box`,
            } : { border: '1px solid transparent' }}
          >
            <div className="overflow-hidden relative shrink-0" style={{ width: 22, height: 22 }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="icon-theme">
                <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="3" y="13" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="13" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="13" y="13" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <span
              className="flex-1 text-[16px] leading-[22px] text-text-primary tracking-[0px]"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400 }}
            >
              Tasks
            </span>
          </button>
        </div>

        {/* Chats */}
        <div className="px-4 py-[10px] flex flex-col gap-1">
          {/* Section title */}
          <div className="px-4 flex items-center" style={{ height: 32 }}>
            <p className="text-base font-bold text-text-primary tracking-[-0.43px]">Chats</p>
          </div>

          {filteredChats.map(chat => {
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
                  style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400 }}
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
            style={{ lineHeight: '32px', fontFamily: 'SF Pro, system-ui, sans-serif' }}
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
