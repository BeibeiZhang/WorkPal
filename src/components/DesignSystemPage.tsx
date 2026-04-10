import { useState } from 'react';
import {
  Menu, LayoutDashboard, Plus, Link, BookOpen, Search, ChevronDown,
  ChevronRight, Code2, FileCode2, FileText, FolderOpen, FolderPlus,
  MessageCircle, MoreVertical, PanelRight, Palette, Pen, Star, X,
  MessageSquare, CheckSquare, AtSign, Folder, GitBranch, Mic, Activity,
} from 'lucide-react';
import {
  iconSun, iconMoon, iconSpinner, iconMicrophone, iconVoice, iconSend,
  iconCopy, iconShare, iconThumbsUp, iconRefresh,
  iconAsana, iconDoc20, iconGmail, iconUsers, iconPin, iconClock,
  iconSheet, iconZoom, iconApps, iconChevronDown, iconEditNew,
  iconAdd, iconPhoto, iconCamera, iconUpload, iconSendActive,
  iconGoals, iconDoc16, iconBarChart, iconDocList,
  iconBackArrow, iconShorter, iconExtend, iconFormal, iconTranslate,
  iconCalendar,
  avatarBlackWoman, avatarWhiteManSayhi,
} from '../assets';

interface DesignSystemPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/* ---- Color swatch data ---- */
const COLORS = [
  { name: 'Text Primary', var: '--color-text-primary', light: '#142740', dark: '#FFFFFF' },
  { name: 'Text Secondary', var: '--color-text-secondary', light: 'rgba(20,39,64,0.7)', dark: 'rgba(226,243,255,0.8)' },
  { name: 'Text Tertiary', var: '--color-text-tertiary', light: 'rgba(20,39,64,0.4)', dark: 'rgba(226,243,255,0.4)' },
  { name: 'Background Page', var: '--color-bg-page', light: '#FFFFFF', dark: '#001424' },
  { name: 'Background Hover / Message', var: '--color-bg-hover', light: '#F2F3F4', dark: 'rgba(226,243,255,0.1)' },
  { name: 'Sidebar Background', var: '--color-sidebar-bg', light: '#f2f3f4', dark: '#0d2136' },
  { name: 'Stroke Outline', var: '--color-stroke-outline', light: '#E8E8E8', dark: 'rgba(115,178,255,0.2)' },
  { name: 'Stroke Toggle', var: '--color-stroke-toggle', light: '#e6e8ea', dark: 'rgba(115,178,255,0.2)' },
  { name: 'Icon Primary', var: '--color-icon-primary', light: '#001424', dark: '#FFFFFF' },
];

const SPECIAL_COLORS = [
  { name: 'Status Tag BG', value: 'rgba(2,137,1,0.1)', preview: 'rgba(2,137,1,0.1)' },
  { name: 'Status Tag Text', value: '#028901', preview: '#028901' },
  { name: 'Link / @Mention', value: '#3171ff', preview: '#3171ff' },
  { name: 'Selected Chip BG', value: 'var(--color-selected-bg)', preview: 'var(--color-selected-bg)' },
  { name: 'Agent Profile BG', value: '#E5E9F1', preview: '#E5E9F1' },
];

const TYPOGRAPHY = [
  { style: 'Body / Regular', font: 'SF Pro', size: '17px', weight: 400, lineHeight: '22px', spacing: '-0.43px' },
  { style: 'Body / Emphasized', font: 'SF Pro', size: '16px', weight: 700, lineHeight: '32px', spacing: '-0.43px' },
  { style: 'Detail / Regular', font: 'SF Pro', size: '16px', weight: 400, lineHeight: '22px', spacing: '0px' },
  { style: 'Headline / Regular', font: 'SF Pro', size: '17px', weight: 590, lineHeight: '22px', spacing: '-0.43px' },
];

const SPACING = [
  { token: 'spacing/1', value: '4px', tw: 'p-1, gap-1' },
  { token: 'spacing/2', value: '8px', tw: 'p-2, gap-2' },
  { token: 'spacing/4', value: '16px', tw: 'p-4, gap-4' },
  { token: 'spacing/5', value: '24px', tw: 'p-6, gap-6' },
  { token: 'spacing/6', value: '32px', tw: 'p-8, gap-8' },
];

const RADII = [
  { token: 'radius/xl', value: '100px', tw: 'rounded-full' },
  { token: 'radius/full', value: '1000px', tw: 'rounded-full' },
  { token: 'Outer shell', value: '40px', tw: 'rounded-[40px]' },
];

/* ── Reusable mini-components for live previews ── */

function MiniCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-stroke-outline rounded-lg overflow-hidden w-full max-w-[370px]" style={{ background: 'var(--color-bg-page)' }}>
      {children}
    </div>
  );
}

function MiniCardHeader({ icon, title, rightElement, borderBottom = false }: {
  icon: string; title: string; rightElement?: React.ReactNode; borderBottom?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-4 h-[50px] ${borderBottom ? 'border-b border-stroke-outline' : ''}`}>
      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
        <img src={icon} alt="" className="w-[16px] h-[16px] object-contain" />
      </div>
      <p className="font-bold text-[13px] leading-[18px] text-text-primary flex-1 truncate">{title}</p>
      {rightElement}
    </div>
  );
}

function MiniStatusTag({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-semibold whitespace-nowrap px-2 py-0.5 rounded shrink-0"
      style={{ background: 'rgba(2, 137, 1, 0.1)', color: '#00c7be' }}>{label}</span>
  );
}

function MiniGradientButton({ label }: { label: string }) {
  return (
    <button className="gradient-btn w-full flex items-center justify-center h-10 px-4 rounded text-white font-bold text-[13px] leading-[18px] cursor-default">
      {label}
    </button>
  );
}

function MiniInfoRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
        <img src={icon} alt="" className="w-[14px] h-[14px] object-contain" />
      </div>
      <p className="flex-1 text-[13px] leading-[18px] text-text-primary">{children}</p>
    </div>
  );
}

function MiniGradientProgressBar() {
  return (
    <div className="w-full h-[3px] rounded-full overflow-hidden bg-[#E8E8E8]">
      <div className="h-full rounded-full animate-progress-bar"
        style={{ backgroundImage: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)' }} />
    </div>
  );
}

function GradientWIcon() {
  return (
    <div className="w-5 h-5 shrink-0 rounded-full overflow-hidden flex items-center justify-center"
      style={{ backgroundImage: 'linear-gradient(64deg, #7652B9 3%, #B46470 36%, #CA9D8C 80%)' }}>
      <svg width="12" height="7" viewBox="0 0 18 10" fill="none">
        <path d="M1 1L4.5 9L9 3L13.5 9L17 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const CSS_UTILITIES = [
  { cls: '.gradient-text', desc: 'Brand gradient text (31.6deg, #7652B9 -> #B46470 -> #CA9D8C)' },
  { cls: '.gradient-btn', desc: 'Gradient fill for buttons (74deg) + box-shadow' },
  { cls: '.app-bg', desc: 'Page background with radial gradient blobs (light & dark)' },
  { cls: '.chip-gradient-hover', desc: 'Gradient border on hover for unselected chips' },
  { cls: '.onboarding-chip-selected', desc: 'Selected chip with ::before gradient ring on hover' },
  { cls: '.input-gradient-hover', desc: 'Gradient border on hover for input fields' },
  { cls: '.animate-progress-bar', desc: 'Progress bar fill animation (0% -> 100% over 2.5s)' },
  { cls: '.loading-dot', desc: 'Animated dot (use 3 in sequence for loading indicator)' },
  { cls: '.message-appear', desc: 'Fade-in-up animation for new messages' },
  { cls: '.icon-theme', desc: 'Auto-invert icons in dark mode (brightness(0) invert(1))' },
  { cls: '.toolbar-gradient-hover', desc: 'Dark-mode-only gradient border on hover for toolbar buttons' },
];

/* ── Component section wrapper ── */
function ComponentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-[15px] font-bold text-text-primary mb-4">{title}</h3>
      <div className="p-5 rounded-xl flex flex-wrap gap-4 items-start" style={{ border: '1px solid var(--color-stroke-outline)', background: 'var(--color-bg-page)' }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Live Component Showcase
   ═══════════════════════════════════════════════════ */
function ComponentShowcase() {
  const [selectedChip, setSelectedChip] = useState<string | null>('\u{1F9E0} Organized');
  return (
    <div className="flex flex-col">

      {/* ── Sidebar ── */}
      <ComponentSection title="Sidebar">
        <div className="flex flex-col gap-1 w-[260px] p-3 rounded-xl" style={{ background: 'var(--color-sidebar-bg)' }}>
          {/* Search */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full border text-[13px]"
            style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-toggle)', color: 'var(--color-text-secondary)' }}>
            <Search size={14} className="shrink-0 text-text-primary" />
            <span className="text-text-secondary text-[13px]">Search</span>
          </div>

          {/* Nav items */}
          <div className="flex flex-col gap-0.5 mt-2">
            <button className="flex items-center gap-3 w-full px-3 py-1.5 rounded-full hover:bg-bg-hover transition-colors text-left">
              <LayoutDashboard size={16} className="shrink-0 text-text-primary" />
              <span className="text-[13px] text-text-primary">Overview</span>
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-1.5 rounded-full hover:bg-bg-hover transition-colors text-left">
              <Plus size={16} className="shrink-0 text-text-primary" />
              <span className="text-[13px] text-text-primary">New Session</span>
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-1.5 rounded-full text-left"
              style={{ border: '1px solid transparent', background: 'linear-gradient(var(--color-sidebar-bg), var(--color-sidebar-bg)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box' }}>
              <Link size={16} className="shrink-0 text-text-primary" />
              <span className="text-[13px] text-text-primary font-medium flex-1">Connectors</span>
              <div className="flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
                <div className="animate-spin" style={{ width: 16, height: 16, background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)', WebkitMaskImage: `url(${iconSpinner})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: `url(${iconSpinner})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', animationDuration: '1.5s' }} />
              </div>
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-1.5 rounded-full hover:bg-bg-hover transition-colors text-left">
              <BookOpen size={16} className="shrink-0 text-text-primary" />
              <span className="text-[13px] text-text-primary">Library</span>
            </button>
          </div>

          {/* Section accordion */}
          <div className="mt-2">
            <button className="px-3 flex items-center justify-between w-full rounded-full" style={{ height: 28 }}>
              <p className="text-[13px] font-bold text-text-primary">Projects</p>
              <ChevronDown size={12} className="text-text-primary" />
            </button>
          </div>

          {/* Account footer */}
          <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-stroke-outline)' }}>
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: 28, height: 28 }}>
              <img src="/icons/user-profile.png" alt="User" className="w-full h-full object-cover" />
            </div>
            <p className="text-[13px] font-bold text-text-primary flex-1">Beibei Zhang</p>
            {/* Dark toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-full border" style={{ background: 'var(--color-stroke-toggle)', borderColor: 'var(--color-stroke-toggle)' }}>
              <span className="flex items-center justify-center p-0.5 rounded-full" style={{ background: 'var(--color-bg-page)' }}>
                <img src={iconSun} alt="Light" className="w-4 h-4 icon-theme" />
              </span>
              <span className="flex items-center justify-center p-0.5 rounded-full">
                <img src={iconMoon} alt="Dark" className="w-4 h-4 icon-theme" />
              </span>
            </div>
          </div>
        </div>
      </ComponentSection>

      {/* ── Chat Input ── */}
      <ComponentSection title="Chat Input">
        <div className="flex flex-col gap-6 w-full">

          {/* ── Text Field States ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Text Field States</p>
            <div className="flex flex-col gap-3 max-w-[480px]">
              {/* Default / Empty */}
              <p className="text-[11px] text-text-tertiary mt-1">Default (empty)</p>
              <div className="input-gradient-hover flex items-center gap-2 px-4 py-3 rounded-full" style={{ background: 'var(--color-bg-message)', border: '2px solid transparent' }}>
                <span className="text-text-tertiary text-[14px] flex-1">Message WorkPal</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 flex items-center justify-center rounded-full">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><rect x="9" y="1" width="6" height="11" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                  </div>
                  <div className="w-7 h-7 flex items-center justify-center rounded-full">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><line x1="4" y1="8" x2="4" y2="16" /><line x1="8" y1="5" x2="8" y2="19" /><line x1="12" y1="2" x2="12" y2="22" /><line x1="16" y1="5" x2="16" y2="19" /><line x1="20" y1="8" x2="20" y2="16" /></svg>
                  </div>
                </div>
              </div>

              {/* Focused / No text — gradient border, send icon (inactive) */}
              <p className="text-[11px] text-text-tertiary mt-1">Focused (no text)</p>
              <div className="flex items-center gap-2 px-4 py-3 rounded-full" style={{ background: 'linear-gradient(var(--color-bg-page), var(--color-bg-page)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box', border: '2px solid transparent' }}>
                <span className="text-text-tertiary text-[14px] flex-1">Message WorkPal</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 flex items-center justify-center rounded-full">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><rect x="9" y="1" width="6" height="11" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                  </div>
                  <div className="w-7 h-7 flex items-center justify-center rounded-full">
                    <img src={iconSend} alt="Send" className="w-4 h-4 icon-theme" />
                  </div>
                </div>
              </div>

              {/* With text — gradient border, gradient send button */}
              <p className="text-[11px] text-text-tertiary mt-1">With text (active)</p>
              <div className="flex items-center gap-2 px-4 py-3 rounded-full" style={{ background: 'linear-gradient(var(--color-bg-page), var(--color-bg-page)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box', border: '2px solid transparent' }}>
                <span className="text-text-primary text-[14px] flex-1">Summarize yesterday's meeting</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 flex items-center justify-center rounded-full">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><rect x="9" y="1" width="6" height="11" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                  </div>
                  <div className="w-7 h-7 flex items-center justify-center rounded-full" style={{ background: 'linear-gradient(183.55deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%)' }}>
                    <img src={iconSendActive} alt="Send" className="w-3.5 h-3.5 brightness-0 invert" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Action Chips ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Action Chips</p>
            <div className="flex flex-wrap gap-2">
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>Set Up Meeting</span>
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>Explore Solutions</span>
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>View Report</span>
            </div>
          </div>

          {/* ── Quick Chips (with icons) ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Quick Chips (with icons)</p>
            <div className="flex flex-wrap gap-2">
              <span className="chip-gradient-hover flex items-center gap-1 rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>
                <div className="relative overflow-hidden w-4 h-4 shrink-0 flex items-center justify-center"><img src={iconGoals} alt="" className="max-w-full max-h-full object-contain opacity-70 icon-theme" /></div>
                Create performance goals
              </span>
              <span className="chip-gradient-hover flex items-center gap-1 rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>
                <div className="relative overflow-hidden w-4 h-4 shrink-0 flex items-center justify-center"><img src={iconDoc16} alt="" className="max-w-full max-h-full object-contain opacity-70 icon-theme" /></div>
                Analyze doc(s)
              </span>
              <span className="chip-gradient-hover flex items-center gap-1 rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>
                <div className="relative overflow-hidden w-4 h-4 shrink-0 flex items-center justify-center"><img src={iconBarChart} alt="" className="max-w-full max-h-full object-contain opacity-70 icon-theme" /></div>
                Visualize data
              </span>
            </div>
          </div>

          {/* ── Toolbar: Chat Mode ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Toolbar — Chat Mode</p>
            <div className="flex items-center gap-2">
              <button className="flex items-center justify-center rounded-full border border-stroke-outline hover:bg-bg-hover toolbar-gradient-hover transition-all shrink-0 cursor-pointer text-text-primary" style={{ width: 32, height: 32 }}>
                <img src={iconAdd} alt="Add" className="w-4 h-4 icon-theme" />
              </button>
              <div className="flex items-center rounded-full border border-stroke-outline overflow-hidden toolbar-gradient-hover">
                <div className="flex items-center gap-1 px-3 cursor-pointer" style={{ height: 32, backgroundColor: 'var(--color-selected-bg)', color: 'var(--color-selected-text)', borderRadius: '9999px 0 0 9999px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  <span className="text-xs font-medium">Chat</span>
                </div>
                <div className="flex items-center justify-center cursor-pointer text-text-primary hover:bg-bg-hover" style={{ width: 32, height: 32 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                </div>
                <div className="flex items-center justify-center cursor-pointer text-text-primary hover:bg-bg-hover" style={{ width: 32, height: 32, borderRadius: '0 9999px 9999px 0' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* ── Toolbar: Tasks Mode ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Toolbar — Tasks Mode</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="flex items-center justify-center rounded-full border border-stroke-outline hover:bg-bg-hover toolbar-gradient-hover transition-all shrink-0 cursor-pointer text-text-primary" style={{ width: 32, height: 32 }}>
                <img src={iconAdd} alt="Add" className="w-4 h-4 icon-theme" />
              </button>
              <div className="flex items-center rounded-full border border-stroke-outline overflow-hidden toolbar-gradient-hover">
                <div className="flex items-center justify-center cursor-pointer text-text-primary hover:bg-bg-hover" style={{ width: 32, height: 32, borderRadius: '9999px 0 0 9999px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                <div className="flex items-center gap-1 px-3 cursor-pointer" style={{ height: 32, backgroundColor: 'var(--color-selected-bg)', color: 'var(--color-selected-text)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                  <span className="text-xs font-medium">Tasks</span>
                </div>
                <div className="flex items-center justify-center cursor-pointer text-text-primary hover:bg-bg-hover" style={{ width: 32, height: 32, borderRadius: '0 9999px 9999px 0' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                </div>
              </div>
              {/* Folder picker */}
              <button className="flex items-center gap-1.5 px-3 rounded-full border border-stroke-outline text-xs text-text-primary hover:bg-bg-hover toolbar-gradient-hover transition-colors cursor-pointer" style={{ height: 32 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-3.5 h-3.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                <span className="truncate">~/Projects/Work...</span>
                <img src={iconChevronDown} alt="" className="w-3 h-3 icon-theme shrink-0" />
              </button>
            </div>
          </div>

          {/* ── Toolbar: Code Mode ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Toolbar — Code Mode</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="flex items-center justify-center rounded-full border border-stroke-outline hover:bg-bg-hover toolbar-gradient-hover transition-all shrink-0 cursor-pointer text-text-primary" style={{ width: 32, height: 32 }}>
                <img src={iconAdd} alt="Add" className="w-4 h-4 icon-theme" />
              </button>
              <div className="flex items-center rounded-full border border-stroke-outline overflow-hidden toolbar-gradient-hover">
                <div className="flex items-center justify-center cursor-pointer text-text-primary hover:bg-bg-hover" style={{ width: 32, height: 32, borderRadius: '9999px 0 0 9999px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                <div className="flex items-center justify-center cursor-pointer text-text-primary hover:bg-bg-hover" style={{ width: 32, height: 32 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                </div>
                <div className="flex items-center gap-1 px-3 cursor-pointer" style={{ height: 32, backgroundColor: 'var(--color-selected-bg)', color: 'var(--color-selected-text)', borderRadius: '0 9999px 9999px 0' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                  <span className="text-xs font-medium">Code</span>
                </div>
              </div>
              {/* Folder picker */}
              <button className="flex items-center gap-1.5 px-3 rounded-full border border-stroke-outline text-xs text-text-primary hover:bg-bg-hover toolbar-gradient-hover transition-colors cursor-pointer" style={{ height: 32 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-3.5 h-3.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                <span className="truncate">~/Projects/Work...</span>
                <img src={iconChevronDown} alt="" className="w-3 h-3 icon-theme shrink-0" />
              </button>
              {/* Branch selector */}
              <button className="flex items-center gap-1.5 px-3 rounded-full border border-stroke-outline text-xs text-text-primary hover:bg-bg-hover toolbar-gradient-hover transition-colors cursor-pointer" style={{ height: 32 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-3.5 h-3.5"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                <span className="truncate">main</span>
                <img src={iconChevronDown} alt="" className="w-3 h-3 icon-theme shrink-0" />
              </button>
              {/* Worktree toggle */}
              <label className="flex items-center gap-1.5 px-3 rounded-full border border-stroke-outline text-xs text-text-primary cursor-pointer select-none hover:bg-bg-hover toolbar-gradient-hover transition-colors" style={{ height: 32 }}>
                <input type="checkbox" className="worktree-checkbox w-3.5 h-3.5 rounded cursor-pointer" readOnly />
                Worktree
              </label>
            </div>
          </div>

          {/* ── Send Button States ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Send Button States</p>
            <div className="flex items-center gap-4">
              {/* Voice (default) */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><line x1="4" y1="8" x2="4" y2="16" /><line x1="8" y1="5" x2="8" y2="19" /><line x1="12" y1="2" x2="12" y2="22" /><line x1="16" y1="5" x2="16" y2="19" /><line x1="20" y1="8" x2="20" y2="16" /></svg>
                </div>
                <span className="text-[10px] text-text-tertiary">Voice</span>
              </div>
              {/* Send (inactive) */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full">
                  <img src={iconSend} alt="Send" className="w-4 h-4 icon-theme" />
                </div>
                <span className="text-[10px] text-text-tertiary">Inactive</span>
              </div>
              {/* Send (active/gradient) */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: 'linear-gradient(183.55deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%)' }}>
                  <img src={iconSendActive} alt="Send" className="w-3.5 h-3.5 brightness-0 invert" />
                </div>
                <span className="text-[10px] text-text-tertiary">Active</span>
              </div>
              {/* Mic */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><rect x="9" y="1" width="6" height="11" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                </div>
                <span className="text-[10px] text-text-tertiary">Mic</span>
              </div>
            </div>
          </div>

          {/* ── Attach Menu (static preview) ── */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Attach Menu</p>
            <div className="w-48 bg-bg-page border border-stroke-outline rounded-xl shadow-lg py-2">
              {[
                { label: 'Mention', isSvg: true },
                { icon: iconPhoto, label: 'Photo' },
                { icon: iconCamera, label: 'Camera' },
                { icon: iconUpload, label: 'Upload File' },
              ].map(item => (
                <div key={item.label} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition-colors text-text-primary text-sm cursor-pointer">
                  {'isSvg' in item ? (
                    <div className="flex items-center justify-center shrink-0 w-4 h-4">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-text-primary"><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" /></svg>
                    </div>
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <img src={item.icon} alt={item.label} className="w-full h-full icon-theme" />
                    </div>
                  )}
                  {item.label}
                </div>
              ))}
            </div>
          </div>

        </div>
      </ComponentSection>

      {/* ── Chat Messages ── */}
      <ComponentSection title="Chat Messages">
        <div className="flex flex-col gap-3 w-full max-w-[420px]">
          {/* User bubble */}
          <div className="flex justify-end">
            <div className="px-4 py-2 rounded-[20px] max-w-[80%]" style={{ background: 'var(--color-bg-message)' }}>
              <p className="text-[13px] text-text-primary leading-[18px]">Summarize yesterday's design sync meeting</p>
            </div>
          </div>
          {/* AI bubble */}
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-text-primary leading-[18px]">
              Looks like there were two meetings yesterday about Pickup and Drop-off: <strong>Design Sync</strong> and <strong>Pain Point Review</strong>. Which one should I summarize?
            </p>
            {/* Action chips */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="chip-gradient-hover rounded-full border px-2.5 py-0.5 text-text-primary text-[12px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>Design Sync</span>
              <span className="chip-gradient-hover rounded-full border px-2.5 py-0.5 text-text-primary text-[12px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>Pain Point Review</span>
            </div>
            {/* Feedback bar */}
            <div className="flex items-center gap-1 mt-1">
              {[{ src: iconCopy, label: 'Copy' }, { src: iconShare, label: 'Share' }, { src: iconThumbsUp, label: 'Good' }, { src: iconThumbsUp, label: 'Bad', flip: true }, { src: iconRefresh, label: 'Retry' }].map(({ src, label, flip }) => (
                <button key={label} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors">
                  <img src={src} alt={label} className={`w-3.5 h-3.5 object-contain opacity-40 hover:opacity-70 icon-theme ${flip ? 'scale-y-[-1]' : ''}`} />
                </button>
              ))}
            </div>
          </div>
          {/* Loading indicator */}
          <div className="flex items-center gap-1 py-1 px-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </ComponentSection>

      {/* ── Message Cards ── */}
      <ComponentSection title="Message Cards">
        <div className="flex flex-wrap gap-4 items-start">

          {/* Meeting card */}
          <MiniCardShell>
            <div className="p-4">
              <p className="font-bold text-[13px] leading-[18px] text-text-primary mb-2">Meeting Minutes</p>
              <p className="font-bold text-[12px] text-text-primary">Objective</p>
              <p className="text-[12px] text-text-primary leading-[16px] mb-2">Identify and resolve friction points in the alcohol delivery experience.</p>
              <p className="font-bold text-[12px] text-text-primary">Design Optimization Points</p>
              <ul className="list-disc pl-4">
                <li className="text-[12px] text-text-primary leading-[16px]">Clarify ID verification steps</li>
                <li className="text-[12px] text-text-primary leading-[16px]">Standardize error messaging</li>
              </ul>
            </div>
          </MiniCardShell>

          {/* Research card */}
          <MiniCardShell>
            <MiniCardHeader icon={iconDoc20} title="Summary Report: Spark Driver" borderBottom />
            <div className="p-4">
              <p className="text-[12px] leading-[16px] text-text-primary">Alcohol delivery introduces a higher <strong>regulatory and reputational risk</strong> for delivery platforms.</p>
            </div>
          </MiniCardShell>

          {/* Ticket card — created */}
          <MiniCardShell>
            <MiniCardHeader icon={iconAsana} title="Illustration Request Ticket" borderBottom />
            <div className="p-4">
              <p className="text-[12px] leading-[16px] text-text-primary">
                <span className="text-[#3171ff]">@Kai</span> Create illustration to explain how to scan an ID. &ndash; <span className="text-[#3171ff]">Thursday, April 10</span>
              </p>
            </div>
            <div className="px-4 pb-4">
              <MiniGradientButton label="Create" />
            </div>
          </MiniCardShell>

          {/* Ticket card — in progress */}
          <MiniCardShell>
            <div className="flex items-center gap-2 px-4 h-[50px]">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <img src={iconAsana} alt="" className="w-[16px] h-[16px] object-contain" />
              </div>
              <p className="font-bold text-[13px] leading-[18px] text-text-primary flex-1 truncate">Creating a Ticket...</p>
            </div>
            <MiniGradientProgressBar />
          </MiniCardShell>

          {/* Ticket card — sent */}
          <MiniCardShell>
            <MiniCardHeader icon={iconAsana} title="Illustration Request Ticket" borderBottom rightElement={<MiniStatusTag label="Sent" />} />
            <div className="p-4">
              <p className="text-[12px] leading-[16px] text-text-primary">
                <span className="text-[#3171ff]">@Kai</span> Create illustration to explain how to scan an ID.
              </p>
            </div>
          </MiniCardShell>

          {/* Schedule card */}
          <MiniCardShell>
            <MiniCardHeader icon={iconGmail} title="Pickup & Drop-off UX review" borderBottom />
            <div className="p-4 flex flex-col gap-2">
              <MiniInfoRow icon={iconPin}>Google Meet</MiniInfoRow>
              <MiniInfoRow icon={iconUsers}><span className="text-[#3171ff]">@Beibei Z. @Kai G. @Stephen G.</span></MiniInfoRow>
              <MiniInfoRow icon={iconClock}>Friday, April 4, 10:00 AM</MiniInfoRow>
              <div className="border-t border-stroke-outline my-1" />
              <p className="font-bold text-[12px] text-text-primary">Scheduling</p>
              <div className="flex items-center gap-3 px-3 py-1.5 rounded" style={{ background: 'rgba(49,113,255,0.1)' }}>
                <div className="flex-1 flex flex-col text-[12px] text-text-primary">
                  <span>Friday, April 4</span>
                  <span className="font-bold">10:00 AM-10:30 AM</span>
                </div>
                <div className="w-4 h-4 rounded-full border-2 border-[#3171ff] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3171ff]" />
                </div>
              </div>
              <div className="flex items-center gap-3 px-3 py-1.5 rounded bg-bg-hover">
                <div className="flex-1 flex flex-col text-[12px] text-text-primary">
                  <span>Friday, April 4</span>
                  <span className="font-bold">10:30 AM-11:00 AM</span>
                </div>
                <div className="w-4 h-4 rounded-full border-2 border-[#c4c4c4]" />
              </div>
            </div>
            <div className="px-4 pb-4">
              <MiniGradientButton label="Send" />
            </div>
          </MiniCardShell>

          {/* Agent card — creating */}
          <MiniCardShell>
            <div className="flex items-center gap-2 px-4 h-[50px]">
              <GradientWIcon />
              <p className="font-bold text-[13px] leading-[18px] text-text-primary flex-1 truncate">Creating your agent...</p>
            </div>
            <MiniGradientProgressBar />
          </MiniCardShell>

          {/* Agent card — ready */}
          <MiniCardShell>
            <div className="flex items-center gap-2 px-4 h-[50px] border-b border-stroke-outline">
              <GradientWIcon />
              <p className="font-bold text-[13px] leading-[18px] text-text-primary flex-1 truncate">My WorkPal Agent</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded overflow-hidden" style={{ background: '#E5E9F1' }}>
                <div className="w-[80px] h-[80px] shrink-0">
                  {avatarBlackWoman.endsWith('.mp4') ? (
                    <video src={avatarBlackWoman} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={avatarBlackWoman} alt="Maya" className="w-full h-full object-cover" />
                  )}
                </div>
                <p className="flex-1 text-[12px] leading-[16px] text-text-primary pr-2">Hi, I'm Maya. I've got your back! Let's make your workday brighter</p>
              </div>
              <MiniGradientButton label="Set as my agent" />
            </div>
          </MiniCardShell>

          {/* Agent card — saved */}
          <MiniCardShell>
            <div className="flex items-center gap-2 px-4 h-[50px] border-b border-stroke-outline">
              <GradientWIcon />
              <p className="font-bold text-[13px] leading-[18px] text-text-primary flex-1 truncate">My WorkPal Agent</p>
              <MiniStatusTag label="Saved" />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 rounded overflow-hidden" style={{ background: '#E5E9F1' }}>
                <div className="w-[80px] h-[80px] shrink-0">
                  {avatarBlackWoman.endsWith('.mp4') ? (
                    <video src={avatarBlackWoman} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={avatarBlackWoman} alt="Maya" className="w-full h-full object-cover" />
                  )}
                </div>
                <p className="flex-1 text-[12px] leading-[16px] text-text-primary pr-2">Hi, I'm Maya. I've got your back! Let's make your workday brighter</p>
              </div>
            </div>
          </MiniCardShell>
        </div>
      </ComponentSection>

      {/* ── Welcome State ── */}
      <ComponentSection title="Welcome State">
        <div className="flex flex-col items-center gap-3 w-full max-w-[360px] mx-auto">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-bg-hover flex items-center justify-center overflow-hidden">
            <video src={avatarWhiteManSayhi} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          </div>
          <h2 className="gradient-text text-[20px] font-semibold">Hi, Beibei</h2>
          <p className="text-text-secondary text-[13px] text-center">How can I help you today?</p>
          {/* Quick chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[12px] cursor-pointer flex items-center gap-1" style={{ borderColor: 'var(--color-stroke-outline)' }}>Summarize Meeting</span>
            <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[12px] cursor-pointer flex items-center gap-1" style={{ borderColor: 'var(--color-stroke-outline)' }}>Create Goals</span>
            <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[12px] cursor-pointer flex items-center gap-1" style={{ borderColor: 'var(--color-stroke-outline)' }}>Analyze Doc</span>
          </div>
        </div>
      </ComponentSection>

      {/* ── Onboarding ── */}
      <ComponentSection title="Onboarding">
        <div className="flex flex-col gap-3 w-full max-w-[400px]">
          <h2 className="text-[18px] font-bold text-text-primary">Welcome to WorkPal</h2>
          <p className="text-[13px] text-text-secondary leading-[18px]">Select the traits that matter to you, and we'll build your ideal partner.</p>
          <div className="flex flex-wrap gap-2">
            {['\u{1F6DF} Stable', '\u{1F9E0} Organized', '\u{1F917} Kind', '\u{1F9D8} Calm', '\u{1F331} Open-minded'].map(trait => {
              const isSelected = selectedChip === trait;
              return (
                <button
                  key={trait}
                  onClick={() => setSelectedChip(isSelected ? null : trait)}
                  className={`flex items-center gap-1 rounded-full transition-all cursor-pointer ${isSelected ? '' : 'chip-gradient-hover'}`}
                  style={{
                    padding: '4px 12px',
                    border: isSelected ? '1px solid transparent' : '1px solid var(--color-stroke-outline)',
                    background: isSelected ? 'var(--color-selected-bg)' : 'transparent',
                    color: isSelected ? 'var(--color-selected-text)' : 'var(--color-text-primary)',
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: 16,
                    fontWeight: 400,
                    lineHeight: '22px',
                    letterSpacing: '0px',
                  }}
                >
                  {trait}
                </button>
              );
            })}
          </div>
        </div>
      </ComponentSection>

      {/* ── Connectors ── */}
      <ComponentSection title="Connectors Page">
        <div className="flex flex-col gap-3 w-full max-w-[400px]">
          {/* Tab bar */}
          <div className="flex gap-0 rounded-full overflow-hidden border border-stroke-outline w-fit">
            <span className="text-[12px] px-4 py-1.5 font-medium text-white" style={{ background: 'var(--color-text-primary)' }}>Apps</span>
            <span className="text-[12px] px-4 py-1.5 text-text-secondary border-l border-stroke-outline">Custom API</span>
            <span className="text-[12px] px-4 py-1.5 text-text-secondary border-l border-stroke-outline">Custom MCP</span>
          </div>
          {/* App cards */}
          <div className="flex flex-col gap-2">
            {[
              { name: 'Google Docs', icon: iconDoc20, connected: true },
              { name: 'Gmail', icon: iconGmail, connected: false },
              { name: 'Asana', icon: iconAsana, connected: false },
            ].map(app => (
              <div key={app.name} className="flex items-center gap-3 p-3 rounded-lg border border-stroke-outline" style={{ background: 'var(--color-bg-page)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-hover">
                  <img src={app.icon} alt={app.name} className="w-5 h-5 object-contain" />
                </div>
                <span className="flex-1 text-[13px] text-text-primary font-medium">{app.name}</span>
                {app.connected ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(2,137,1,0.1)', color: '#028901' }}>Connected</span>
                ) : (
                  <button className="text-[11px] px-3 py-1 rounded-full border border-stroke-outline text-text-secondary hover:bg-bg-hover">Connect</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </ComponentSection>

    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.43px] mt-8 mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
      {children}
    </h2>
  );
}

export default function DesignSystemPage({ sidebarOpen, onToggleSidebar }: DesignSystemPageProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full" style={{ background: 'var(--color-bg-page)' }}>
      {/* Header — toggle only */}
      <div className="flex items-center gap-4 px-4 h-12 shrink-0">
        {!sidebarOpen && (
          <button onClick={onToggleSidebar} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary">
            <Menu size={20} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-12 scrollbar-autohide">
        <h1
          className="text-[40px] font-bold text-text-primary leading-[48px] tracking-[-0.5px] mb-2"
          style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          Design System
        </h1>
        {/* Brand Gradient */}
        <SectionTitle>Brand Gradient</SectionTitle>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <div className="gradient-btn rounded-xl" style={{ width: 200, height: 60 }} />
            <p className="text-text-secondary text-[13px]">#7652B9 → #B46470 → #CA9D8C</p>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <span className="gradient-text text-[24px] font-bold">Gradient Text</span>
            <p className="text-text-secondary text-[13px]">.gradient-text (31.6deg)</p>
          </div>
        </div>

        {/* Colors */}
        <SectionTitle>Color Tokens</SectionTitle>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {COLORS.map(c => (
            <div key={c.var} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="shrink-0 rounded-lg" style={{ width: 36, height: 36, background: `var(${c.var})`, border: '1px solid var(--color-stroke-outline)' }} />
              <div className="min-w-0">
                <p className="text-text-primary font-medium text-[13px] truncate">{c.name}</p>
                <p className="text-text-tertiary text-[12px] truncate">{c.var}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-[15px] font-semibold text-text-primary mt-6 mb-3">Special Colors</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {SPECIAL_COLORS.map(c => (
            <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="shrink-0 rounded-lg" style={{ width: 36, height: 36, background: c.preview, border: '1px solid var(--color-stroke-outline)' }} />
              <div className="min-w-0">
                <p className="text-text-primary font-medium text-[13px] truncate">{c.name}</p>
                <p className="text-text-tertiary text-[12px] truncate">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <SectionTitle>Typography</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                {['Style', 'Font', 'Size', 'Weight', 'Line Height', 'Spacing'].map(h => (
                  <th key={h} className="text-text-secondary font-medium text-[13px] py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TYPOGRAPHY.map(t => (
                <tr key={t.style} style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 pr-4">{t.style}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.font}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.size}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.weight}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.lineHeight}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.spacing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Spacing & Radii */}
        <SectionTitle>Spacing & Border Radius</SectionTitle>
        <div className="flex flex-wrap gap-8">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary mb-3">Spacing</h3>
            <div className="flex flex-col gap-2">
              {SPACING.map(s => (
                <div key={s.token} className="flex items-center gap-4">
                  <div className="rounded" style={{ width: parseInt(s.value), height: 16, background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)', minWidth: 4 }} />
                  <span className="text-text-primary text-[13px] font-medium w-20">{s.value}</span>
                  <span className="text-text-tertiary text-[12px]">{s.tw}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary mb-3">Border Radius</h3>
            <div className="flex flex-wrap gap-4">
              {RADII.map(r => (
                <div key={r.token} className="flex flex-col items-center gap-2">
                  <div style={{ width: 48, height: 48, borderRadius: r.value === '1000px' || r.value === '100px' ? '50%' : r.value, border: '2px solid var(--color-stroke-outline)', background: 'var(--color-bg-hover)' }} />
                  <span className="text-text-primary text-[12px] font-medium">{r.value}</span>
                  <span className="text-text-tertiary text-[11px]">{r.tw}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Icon Library */}
        <SectionTitle>Icon Library</SectionTitle>
        <p className="text-text-secondary text-[14px] leading-[20px] mb-4">
          All icons used across the app, organized by category. Custom SVG assets are from Figma; Lucide icons are from <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>lucide-react</code>.
        </p>

        {/* Custom SVG Icons */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Custom SVG Assets</h3>
        {([
          { label: 'App Icons', desc: 'Third-party app logos used in sidebar & cards', items: [
            { name: 'Asana', src: iconAsana, file: 'asana.svg' },
            { name: 'Google Docs', src: iconDoc20, file: 'doc20.svg' },
            { name: 'Google Sheets', src: iconSheet, file: 'sheet.svg' },
            { name: 'Gmail', src: iconGmail, file: 'gmail.svg' },
            { name: 'Zoom', src: iconZoom, file: 'zoom.svg' },
            { name: 'Apps', src: iconApps, file: 'apps.svg' },
          ]},
          { label: 'UI Chrome', desc: 'Theme toggle, navigation, editing', items: [
            { name: 'Sun', src: iconSun, file: 'sun.svg' },
            { name: 'Moon', src: iconMoon, file: 'moon.svg' },
            { name: 'Chevron Down', src: iconChevronDown, file: 'chevron-down.svg' },
            { name: 'Edit New', src: iconEditNew, file: 'edit-new.svg' },
            { name: 'Spinner', src: iconSpinner, file: 'spinner.svg' },
            { name: 'Back Arrow', src: iconBackArrow, file: 'back-arrow.svg' },
          ]},
          { label: 'Input Toolbar', desc: 'Chat input action buttons', items: [
            { name: 'Add (@)', src: iconAdd, file: 'add.svg' },
            { name: 'Photo', src: iconPhoto, file: 'photo.svg' },
            { name: 'Camera', src: iconCamera, file: 'camera.svg' },
            { name: 'Upload', src: iconUpload, file: 'upload.svg' },
            { name: 'Microphone', src: iconMicrophone, file: 'microphone.svg' },
            { name: 'Voice', src: iconVoice, file: 'voice.svg' },
            { name: 'Send', src: iconSend, file: 'send.svg' },
            { name: 'Send Active', src: iconSendActive, file: 'send-active.svg' },
          ]},
          { label: 'Feedback Bar', desc: 'Message action icons (16px)', items: [
            { name: 'Copy', src: iconCopy, file: 'copy.svg' },
            { name: 'Share', src: iconShare, file: 'share.svg' },
            { name: 'Thumbs Up', src: iconThumbsUp, file: 'thumbs-up.svg' },
            { name: 'Refresh', src: iconRefresh, file: 'refresh.svg' },
          ]},
          { label: 'Quick Chip Icons', desc: 'Chip / quick-action icons (16px)', items: [
            { name: 'Goals', src: iconGoals, file: 'goals.svg' },
            { name: 'Doc 16', src: iconDoc16, file: 'doc16.svg' },
            { name: 'Bar Chart', src: iconBarChart, file: 'bar-chart.svg' },
            { name: 'Doc List', src: iconDocList, file: 'doc-list.svg' },
          ]},
          { label: 'Detail Panel', desc: 'Text editing action icons', items: [
            { name: 'Shorter', src: iconShorter, file: 'shorter.svg' },
            { name: 'Extend', src: iconExtend, file: 'extend.svg' },
            { name: 'Formal', src: iconFormal, file: 'formal.svg' },
            { name: 'Translate', src: iconTranslate, file: 'translate.svg' },
          ]},
          { label: 'Card / Schedule', desc: 'Calendar & meeting card icons', items: [
            { name: 'Calendar', src: iconCalendar, file: 'calendar.svg' },
            { name: 'Users', src: iconUsers, file: 'users.svg' },
            { name: 'Pin', src: iconPin, file: 'pin.svg' },
            { name: 'Clock', src: iconClock, file: 'clock.svg' },
          ]},
        ] as { label: string; desc: string; items: { name: string; src: string; file: string }[] }[]).map(group => (
          <div key={group.label} className="mb-5">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-text-primary font-medium text-[13px]">{group.label}</span>
              <span className="text-text-tertiary text-[12px]">{group.desc}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {group.items.map(icon => (
                <div key={icon.file} className="flex flex-col items-center gap-1.5 p-3 rounded-xl w-[90px]" style={{ border: '1px solid var(--color-stroke-outline)' }}>
                  <div className="w-8 h-8 flex items-center justify-center">
                    <img src={icon.src} alt={icon.name} className="max-w-[24px] max-h-[24px] object-contain icon-theme" />
                  </div>
                  <span className="text-text-primary text-[11px] text-center leading-tight">{icon.name}</span>
                  <span className="text-text-tertiary text-[10px] text-center leading-tight truncate w-full">{icon.file}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Inline SVG Icons (ChatInput) */}
        <h3 className="text-[15px] font-semibold text-text-primary mt-6 mb-3">Inline SVG Icons (ChatInput)</h3>
        <p className="text-text-secondary text-[13px] leading-[18px] mb-3">
          Mode selector, input field, and toolbar inline SVGs rendered directly in <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>ChatInput.tsx</code>.
        </p>
        <div className="flex flex-wrap gap-3">
          {([
            { name: 'Chat', Icon: MessageSquare, usage: 'Mode — Chat' },
            { name: 'Tasks', Icon: CheckSquare, usage: 'Mode — Tasks' },
            { name: 'Code', Icon: Code2, usage: 'Mode — Code' },
            { name: 'Mic (stroke)', Icon: Mic, usage: 'Input — Microphone' },
            { name: 'Voice (stroke)', Icon: Activity, usage: 'Input — Voice' },
            { name: 'Mention (@)', Icon: AtSign, usage: 'Attach — Mention' },
            { name: 'Folder', Icon: Folder, usage: 'Toolbar — Folder' },
            { name: 'Git Branch', Icon: GitBranch, usage: 'Toolbar — Branch' },
          ] as { name: string; Icon: React.FC<{ size?: number; className?: string }>; usage: string }[]).map(({ name, Icon, usage }) => (
            <div key={name} className="flex flex-col items-center gap-1.5 p-3 rounded-xl w-[90px]" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="w-8 h-8 flex items-center justify-center">
                <Icon size={20} className="text-text-primary" />
              </div>
              <span className="text-text-primary text-[11px] text-center leading-tight">{name}</span>
              <span className="text-text-tertiary text-[10px] text-center leading-tight truncate w-full" title={usage}>{usage}</span>
            </div>
          ))}
        </div>

        {/* Lucide React Icons */}
        <h3 className="text-[15px] font-semibold text-text-primary mt-6 mb-3">Lucide React Icons</h3>
        <p className="text-text-secondary text-[13px] leading-[18px] mb-3">
          From <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>lucide-react</code> package. Rendered as inline SVG at 20px.
        </p>
        <div className="flex flex-wrap gap-3">
          {([
            { name: 'BookOpen', Icon: BookOpen, usage: 'Sidebar — Library' },
            { name: 'ChevronDown', Icon: ChevronDown, usage: 'Accordions, dropdowns' },
            { name: 'ChevronRight', Icon: ChevronRight, usage: 'Tree expand' },
            { name: 'Code2', Icon: Code2, usage: 'Code view tab' },
            { name: 'FileCode2', Icon: FileCode2, usage: 'File type icon' },
            { name: 'FileText', Icon: FileText, usage: 'Document reference' },
            { name: 'FolderOpen', Icon: FolderOpen, usage: 'Open folder' },
            { name: 'FolderPlus', Icon: FolderPlus, usage: 'New folder' },
            { name: 'LayoutDashboard', Icon: LayoutDashboard, usage: 'Sidebar — Overview' },
            { name: 'Link', Icon: Link, usage: 'Sidebar — Connectors' },
            { name: 'Menu', Icon: Menu, usage: 'Sidebar toggle' },
            { name: 'MessageCircle', Icon: MessageCircle, usage: 'Comments' },
            { name: 'MoreVertical', Icon: MoreVertical, usage: 'Overflow menu' },
            { name: 'Palette', Icon: Palette, usage: 'Design System nav' },
            { name: 'PanelRight', Icon: PanelRight, usage: 'Side panel toggle' },
            { name: 'Pen', Icon: Pen, usage: 'Edit action' },
            { name: 'Plus', Icon: Plus, usage: 'New session / add' },
            { name: 'Search', Icon: Search, usage: 'Search bar' },
            { name: 'Star', Icon: Star, usage: 'Favorites' },
            { name: 'X', Icon: X, usage: 'Close / dismiss' },
          ] as { name: string; Icon: React.FC<{ size?: number; className?: string }>; usage: string }[]).map(({ name, Icon, usage }) => (
            <div key={name} className="flex flex-col items-center gap-1.5 p-3 rounded-xl w-[90px]" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="w-8 h-8 flex items-center justify-center">
                <Icon size={20} className="text-text-primary" />
              </div>
              <span className="text-text-primary text-[11px] text-center leading-tight">{name}</span>
              <span className="text-text-tertiary text-[10px] text-center leading-tight truncate w-full" title={usage}>{usage}</span>
            </div>
          ))}
        </div>

        {/* Components */}
        <SectionTitle>Components</SectionTitle>
        <ComponentShowcase />

        {/* CSS Utility Classes */}
        <SectionTitle>CSS Utility Classes</SectionTitle>
        <div className="flex flex-col gap-2">
          {CSS_UTILITIES.map(u => (
            <div key={u.cls} className="flex items-start gap-4 py-2" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
              <code className="text-[13px] font-mono shrink-0 px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff', minWidth: 200 }}>
                {u.cls}
              </code>
              <span className="text-text-secondary text-[13px]">{u.desc}</span>
            </div>
          ))}
        </div>

        {/* Live Samples */}
        <SectionTitle>Live Samples</SectionTitle>
        <div className="flex flex-wrap gap-6 items-start">
          {/* Chips */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Chips</h3>
            <div className="flex flex-wrap gap-2">
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>
                Default Chip
              </span>
              <span className="rounded-full px-3 py-1 cursor-pointer" style={{ background: 'var(--color-selected-bg)', color: 'var(--color-selected-text)' }}>
                Selected Chip
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Gradient Button</h3>
            <button className="gradient-btn text-white font-medium rounded-xl px-6 py-3 text-[14px]">
              Action Button
            </button>
          </div>

          {/* Status Tag */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Status Tag</h3>
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium" style={{ background: 'rgba(2,137,1,0.1)', color: '#028901' }}>
              Saved
            </span>
          </div>

          {/* Loading Dots */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Loading Dots</h3>
            <div className="flex items-center gap-1.5">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col gap-3 w-48">
            <h3 className="text-[15px] font-semibold text-text-primary">Progress Bar</h3>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--color-bg-hover)' }}>
              <div className="h-full rounded-full animate-progress-bar" style={{ background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)' }} />
            </div>
          </div>
        </div>

        {/* Dark Mode */}
        <SectionTitle>Dark Mode</SectionTitle>
        <p className="text-text-secondary text-[14px] leading-[20px]">
          Dark mode is toggled via the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.dark</code> class on <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>&lt;html&gt;</code>. All components use CSS variables that automatically switch. Monochrome icons use the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.icon-theme</code> class for auto-inversion. Gradient elements (avatars, spinner, buttons) do NOT use <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.icon-theme</code>.
        </p>

        {/* Figma vs Code Diff */}
        <SectionTitle>Figma vs Code Diff</SectionTitle>
        <p className="text-text-secondary text-[14px] leading-[20px] mb-4">
          Comparison between Figma design system variables (WorkPal library, <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>L&DMode</code> collection) and the current code implementation.
        </p>

        {/* Figma tokens missing from code */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Figma Tokens Not Implemented as CSS Variables</h3>
        <p className="text-text-secondary text-[13px] leading-[18px] mb-3">These Figma variables exist in the WorkPal library but are either hardcoded inline or missing in code.</p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                {['Figma Variable', 'Status in Code', 'Notes'].map(h => (
                  <th key={h} className="text-text-secondary font-medium text-[13px] py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { figma: 'Color/Background/Card', status: 'Missing', note: 'No CSS variable; cards use bg-bg-page or inline styles' },
                { figma: 'Color/Background/Detail', status: 'Missing', note: 'No CSS variable; not referenced in components' },
                { figma: 'Color/Text/Callout', status: 'Hardcoded', note: 'Used inline as #3171ff (links, @mentions, selected chips)' },
                { figma: 'Color/Text/Button', status: 'Hardcoded', note: 'Gradient buttons use text-white directly' },
                { figma: 'Color/Stroke/Dot', status: 'Missing', note: 'No CSS variable; not referenced in components' },
                { figma: 'Font/Detail/Letter spacing', status: 'Hardcoded', note: 'Used inline as letterSpacing: 0px in Detail style' },
              ].map(row => (
                <tr key={row.figma} style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 pr-4 font-mono">{row.figma}</td>
                  <td className="py-3 pr-4">
                    <span className="text-[12px] font-semibold px-2 py-0.5 rounded" style={{
                      background: row.status === 'Missing' ? 'rgba(220,38,38,0.1)' : 'rgba(234,179,8,0.15)',
                      color: row.status === 'Missing' ? '#dc2626' : '#a16207',
                    }}>{row.status}</span>
                  </td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Code tokens not in Figma */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Code Tokens Not in Figma Variables</h3>
        <p className="text-text-secondary text-[13px] leading-[18px] mb-3">These CSS variables exist in code but have no corresponding Figma variable in the WorkPal library.</p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                {['CSS Variable', 'Light Value', 'Dark Value', 'Notes'].map(h => (
                  <th key={h} className="text-text-secondary font-medium text-[13px] py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { css: '--color-text-tertiary', light: 'rgba(20,39,64,0.4)', dark: 'rgba(226,243,255,0.4)', note: 'No Figma variable; used for placeholder text & subtle labels' },
                { css: '--color-icon-primary', light: '#001424', dark: '#FFFFFF', note: 'No Figma variable; icon fill color derived from text/primary' },
                { css: '--color-outer-bg', light: '#f5f5f7', dark: '#001424', note: 'No Figma variable; outer shell background behind the app frame' },
                { css: '--color-outer-border', light: '#f5f5f7', dark: '#001424', note: 'No Figma variable; outer shell border color' },
              ].map(row => (
                <tr key={row.css} style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 pr-4 font-mono">{row.css}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4 font-mono">{row.light}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4 font-mono">{row.dark}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Value discrepancies */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Value Discrepancies</h3>
        <p className="text-text-secondary text-[13px] leading-[18px] mb-3">Tokens that exist in both Figma and code but may differ in value or naming.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                {['Token', 'Discrepancy'].map(h => (
                  <th key={h} className="text-text-secondary font-medium text-[13px] py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { token: 'Sidebar BG (dark)', desc: 'Code uses #0d2136; Figma "Color/Background/Web Menu" dark mode may use rgba(226,243,255,0.1) — same as bg-hover' },
                { token: 'StatusTag color', desc: 'DesignSystemPage MiniStatusTag uses #00c7be (teal) while the main app & DESIGN_SYSTEM.md use #028901 (green)' },
                { token: 'Body/Emphasized line-height', desc: 'DESIGN_SYSTEM.md says 32px; typical Figma body emphasized is 22px — verify in Figma source' },
              ].map(row => (
                <tr key={row.token} style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 pr-4 whitespace-nowrap">{row.token}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Responsive Rules */}
        <SectionTitle>Responsive Rules (Mobile vs Desktop)</SectionTitle>
        <p className="text-text-secondary text-[14px] leading-[20px] mb-4">
          The app uses a <strong className="text-text-primary">mobile-first</strong> approach. Base styles target mobile ({'<'}768px), and desktop overrides kick in at the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>md:</code> breakpoint (768px+) via Tailwind and <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>@media (min-width: 768px)</code>.
        </p>

        {/* Global overrides */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Global CSS Overrides (index.css)</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                {['Property', 'Mobile (< 768px)', 'Desktop (≥ 768px)'].map(h => (
                  <th key={h} className="text-text-secondary font-medium text-[13px] py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { prop: 'Root font-size', mobile: '16px', desktop: '14px' },
                { prop: '--toolbar-btn-h', mobile: '39px', desktop: '26px' },
                { prop: '--mode-btn-unselected-w', mobile: '54px', desktop: '26px' },
                { prop: '--toolbar-icon-size', mobile: '24px', desktop: '16px' },
                { prop: '--input-btn-size', mobile: '36px', desktop: '24px' },
                { prop: '.toolbar-icon-scale', mobile: 'scale(1.5)', desktop: 'scale(1)' },
              ].map(row => (
                <tr key={row.prop} style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 pr-4 font-mono">{row.prop}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4 font-mono">{row.mobile}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4 font-mono">{row.desktop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Component-level patterns */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Component-Level Tailwind Patterns</h3>
        <p className="text-text-secondary text-[13px] leading-[18px] mb-3">Common <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>md:</code> responsive patterns used across components.</p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                {['Category', 'Mobile', 'Desktop (md:)', 'Example Component'].map(h => (
                  <th key={h} className="text-text-secondary font-medium text-[13px] py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { cat: 'Icon sizes', mobile: '24px', desktop: '16px', comp: 'ChatInput toolbar icons' },
                { cat: 'Gaps', mobile: 'gap-4 (16px)', desktop: 'gap-2 (8px)', comp: 'ChatInput icon row' },
                { cat: 'Padding', mobile: 'px-6 py-3', desktop: 'px-4 py-2', comp: 'ChatInput wrapper' },
                { cat: 'Text size', mobile: 'text-[18px]', desktop: 'text-xs (12px)', comp: 'Mode selector labels' },
                { cat: 'Width', mobile: 'w-72 (288px)', desktop: 'w-48 (192px)', comp: 'Dropdown menus' },
                { cat: 'Max-width', mobile: 'max-w-[270px]', desktop: 'max-w-[180px]', comp: 'Chip containers' },
                { cat: 'Border radius', mobile: 'rounded-2xl', desktop: 'rounded-xl', comp: 'Quick chip row' },
                { cat: 'Margin', mobile: 'mb-3', desktop: 'mb-2', comp: 'Chip section spacing' },
                { cat: 'Layout direction', mobile: 'flex-col', desktop: 'flex-row', comp: 'ConnectorsPage filter bar' },
                { cat: 'Grid columns', mobile: 'grid-cols-1', desktop: 'grid-cols-2', comp: 'ConnectorsPage cards' },
              ].map(row => (
                <tr key={row.cat} style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 pr-4">{row.cat}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4 font-mono">{row.mobile}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4 font-mono">{row.desktop}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{row.comp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Design principles */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Design Principles</h3>
        <div className="flex flex-col gap-2">
          {[
            { label: 'Touch targets', desc: 'Mobile uses larger tap targets (39px buttons, 24px icons) for finger interaction; desktop shrinks to mouse-friendly sizes (26px buttons, 16px icons).' },
            { label: 'Font scaling', desc: 'Root font-size is 16px on mobile for readability, 14px on desktop where screens are larger. All text inherits via font-size: inherit.' },
            { label: 'Layout stacking', desc: 'Multi-column layouts (flex-row, grid-cols-2) on desktop collapse to single-column (flex-col, grid-cols-1) on mobile.' },
            { label: 'Spacing compression', desc: 'Padding and gaps are 1.5× larger on mobile (e.g., gap-4 → gap-2, px-6 → px-4) for comfortable touch spacing.' },
            { label: 'Width constraints', desc: 'Dropdowns and chip containers are wider on mobile (w-72) for full-width usability, narrower on desktop (w-48).' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
              <span className="text-text-primary font-medium text-[13px] shrink-0 w-40">{item.label}</span>
              <span className="text-text-secondary text-[13px]">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
