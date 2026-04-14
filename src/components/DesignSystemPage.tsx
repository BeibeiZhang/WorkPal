import { useMemo, useState } from 'react';
import {
  Menu, LayoutDashboard, Plus, Link, BookOpen, Search, ChevronDown,
  ChevronRight, Code2, FileCode2, FileText, FolderOpen, FolderPlus,
  MessageCircle, MoreVertical, PanelRight, Palette, Pen, Star, X,
  MessageSquare, CheckSquare, AtSign, Folder, GitBranch, Mic, Activity,
  Brain, Moon, Home, Zap,
  // Additional icons referenced in the live Icon Library showcase
  AlertTriangle, Check, Clock, BadgeCheck, XCircle, Send, Smile, Eye,
  Download, File, Presentation, Video, Image as ImageIcon, FileSpreadsheet,
  StickyNote, Ticket, Mail, MoreHorizontal, Sparkles, Play, Timer, User,
  Globe, ArrowLeft, Sun,
} from 'lucide-react';
import {
  SectionTitle as SharedSectionTitle, ProgressBar, LabeledBar, CircularProgress,
  TimePill, StepIndicator, Tag, FilterChip, PrimaryButton, SecondaryButton, TertiaryButton,
  SolutionRow, SummaryFooter,
  MetricCard, InsightCard, AreaChart, TaskProgressCard, ReviewItemCard,
  StatusTag, HealthDimensionRow, SearchBox, PageLayout,
  HeaderBar, SplitView, SidePanelHeader, SideCard,
} from './shared';
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
import OverviewPage from './OverviewPage';
import LibraryPage from './LibraryPage';
import ConnectorsPage from './ConnectorsPage';
import ComingSoonPage from './ComingSoonPage';
import Onboarding from './Onboarding';
import type { Chat, Message, CardData } from '../types';

interface DesignSystemPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/* ---- Color swatch data ---- */
const COLORS = [
  { name: 'Text & Icon Primary', var: '--color-text-primary', light: '#142740', dark: '#FFFFFF', usage: 'Headings, body copy, and all primary icons', examples: 'Page titles, task names, chat messages, nav labels, card titles, sidebar nav icons, toolbar icons, hamburger menu, close buttons' },
  { name: 'Text Secondary', var: '--color-text-secondary', light: 'rgba(20,39,64,0.7)', dark: 'rgba(226,243,255,0.8)', usage: 'Descriptions, captions, helper text', examples: 'Task due dates, "open/completed" counters, chip footnotes, sidebar timestamps' },
  { name: 'Text Tertiary', var: '--color-text-tertiary', light: 'rgba(20,39,64,0.4)', dark: 'rgba(226,243,255,0.4)', usage: 'Disabled labels, muted metadata', examples: 'Completed task text (strikethrough), empty-state messages, placeholder text' },
  { name: 'Background Page', var: '--color-bg-page', light: '#FFFFFF', dark: '#001424', usage: 'Main app surface, content panels', examples: 'Chat panel, task cards, message cards, dialog backgrounds' },
  { name: 'Background Hover / Message', var: '--color-bg-hover', light: '#F2F3F4', dark: 'rgba(226,243,255,0.1)', usage: 'Hover states, message bubbles', examples: 'AI message bubbles, sidebar hover, table row zebra stripes, input fields' },
  { name: 'Sidebar Background', var: '--color-sidebar-bg', light: '#f2f3f4', dark: '#0d2136', usage: 'Left navigation panel surface', examples: 'Sidebar container, search bar area, profile section' },
  { name: 'Stroke Outline', var: '--color-stroke-outline', light: '#E8E8E8', dark: 'rgba(115,178,255,0.2)', usage: 'Card borders, dividers, chip outlines', examples: 'Task group cards, message cards, filter chip borders, section dividers' },
  { name: 'Stroke Toggle', var: '--color-stroke-toggle', light: '#e6e8ea', dark: 'rgba(115,178,255,0.2)', usage: 'Toggle and input field borders', examples: 'Dark mode toggle pill, chat input border, text field outlines' },
];

const SPECIAL_COLORS = [
  { name: 'StatusTag · success bg', value: 'rgba(2,137,1,0.1)', preview: 'rgba(2,137,1,0.1)', usage: 'StatusTag success variant background', examples: '"Connected", "Sent", "Done", "Saved" status badges' },
  { name: 'StatusTag · success text', value: '#028901', preview: '#028901', usage: 'StatusTag success variant label', examples: 'Success StatusTag text in message cards, task rows, connector list' },
  { name: 'StatusTag · pending bg / text', value: 'rgba(245,158,11,0.15) · #B8541A', preview: '#B8541A', usage: 'StatusTag pending variant', examples: '"To Do", "Pending" status badges' },
  { name: 'StatusTag · in-progress bg / text', value: 'rgba(49,113,255,0.1) · #3171FF', preview: '#3171FF', usage: 'StatusTag in-progress variant', examples: '"In Progress" task status badges' },
  { name: 'StatusTag · submitted bg / text', value: 'rgba(118,82,185,0.15) · #6B54E6', preview: '#6B54E6', usage: 'StatusTag submitted variant', examples: '"Submitted" review/approval badges' },
  { name: 'StatusTag · in-review bg / text', value: 'rgba(234,179,8,0.18) · #A87725', preview: '#A87725', usage: 'StatusTag in-review variant', examples: '"In Review" approval-pending badges' },
  { name: 'StatusTag · failed bg / text', value: 'rgba(220,38,38,0.12) · #C93838', preview: '#C93838', usage: 'StatusTag failed variant', examples: '"Failed" error/rejection badges' },
  { name: 'StatusTag · expired bg / text', value: 'rgba(107,114,128,0.15) · #6B7280', preview: '#6B7280', usage: 'StatusTag expired variant', examples: '"Expired" stale/timed-out badges' },
  { name: 'Link / @Mention', value: '#3171ff', preview: '#3171ff', usage: 'Inline links and @mentions', examples: '@assignee names in tasks, "In Progress" badges, callout highlights' },
  { name: 'Selected Chip BG', value: 'var(--color-selected-bg)', preview: 'var(--color-selected-bg)', usage: 'Active chip / filter background', examples: 'Active filter chips on Tasks page, Design System nav chips' },
  { name: 'Agent Profile BG', value: '#E5E9F1', preview: '#E5E9F1', usage: 'Agent avatar circle background', examples: 'AI assistant avatar in chat messages' },
  { name: 'Warning / Orange', value: '#F59E0B', preview: '#F59E0B', usage: 'Medium-risk progress, caution indicators', examples: 'CircularProgress at ~50%, stress category bars' },
  { name: 'Danger / Red', value: '#EF4444', preview: '#EF4444', usage: 'Low progress, high-risk indicators', examples: 'CircularProgress at ~30%, deadline pressure bars' },
];

const TYPOGRAPHY = [
  { style: 'Page Title', font: 'SF Pro', size: '40px', weight: 700, lineHeight: '48px', spacing: '-0.5px' },
  { style: 'Body / Regular', font: 'SF Pro', size: '16px', weight: 400, lineHeight: '32px', spacing: '-0.43px' },
  { style: 'Body / Emphasized', font: 'SF Pro', size: '16px', weight: 700, lineHeight: '32px', spacing: '-0.43px' },
  { style: 'Detail / Regular', font: 'SF Pro', size: '14px', weight: 400, lineHeight: '22px', spacing: '0px' },
  { style: 'Detail / Emphasized', font: 'SF Pro', size: '14px', weight: 700, lineHeight: '22px', spacing: '0px' },
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

/** Compact StatusTag wrapper for mini-card previews. Maps common labels to
 *  the shared StatusTag variant — keeps demos aligned with the app's
 *  design system pill style (rounded-full, no icon for tight card headers). */
function MiniStatusTag({ label }: { label: string }) {
  const k = label.trim().toLowerCase();
  const variant: import('./shared').StatusVariant =
    k === 'pending' ? 'pending'
    : k === 'in progress' || k === 'in-progress' ? 'in-progress'
    : k === 'submitted' ? 'submitted'
    : k === 'in review' || k === 'in-review' ? 'in-review'
    : k === 'failed' ? 'failed'
    : k === 'expired' ? 'expired'
    : 'success'; // Sent / Done / Saved / Connected
  return <StatusTag variant={variant} label={label} size="sm" showIcon={false} />;
}

function MiniGradientButton({ label }: { label: string }) {
  return <PrimaryButton fullWidth className="h-10 text-[13px] leading-[18px] cursor-default">{label}</PrimaryButton>;
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
            style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-toggle)', color: 'var(--color-text-primary)' }}>
            <Search size={14} className="shrink-0 text-text-primary" />
            <span className="text-text-primary text-[13px]">Search</span>
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
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Text Field States</p>
            <div className="flex flex-col gap-3 max-w-[480px]">
              {/* Default / Empty */}
              <p className="text-[11px] text-text-primary mt-1">Default (empty)</p>
              <div className="input-gradient-hover flex items-center gap-2 px-4 py-3 rounded-full" style={{ background: 'var(--color-bg-message)', border: '2px solid transparent' }}>
                <span className="text-text-primary text-[14px] flex-1">Message WorkPal</span>
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
              <p className="text-[11px] text-text-primary mt-1">Focused (no text)</p>
              <div className="flex items-center gap-2 px-4 py-3 rounded-full" style={{ background: 'linear-gradient(var(--color-bg-page), var(--color-bg-page)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box', border: '2px solid transparent' }}>
                <span className="text-text-primary text-[14px] flex-1">Message WorkPal</span>
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
              <p className="text-[11px] text-text-primary mt-1">With text (active)</p>
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
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Action Chips</p>
            <div className="flex flex-wrap gap-2">
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>Set Up Meeting</span>
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>Explore Solutions</span>
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary text-[13px] cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>View Report</span>
            </div>
          </div>

          {/* ── Quick Chips (with icons) ── */}
          <div>
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Quick Chips (with icons)</p>
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
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Toolbar — Chat Mode</p>
            <div className="flex items-center gap-2">
              <button className="flex items-center justify-center rounded-full border border-stroke-outline hover:bg-bg-hover toolbar-gradient-hover transition-all shrink-0 cursor-pointer text-text-primary" style={{ width: 32, height: 32 }}>
                <img src={iconAdd} alt="Add" className="w-4 h-4 icon-theme" />
              </button>
              <div className="flex items-center rounded-full border border-stroke-outline overflow-hidden toolbar-gradient-hover">
                <div className="flex items-center gap-1 px-3 cursor-pointer" style={{ height: 32, backgroundColor: 'var(--color-selected-bg)', color: 'var(--color-selected-text)', borderRadius: '9999px 0 0 9999px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  <span className="text-[16px] sm:text-[14px] font-medium">Chat</span>
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
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Toolbar — Tasks Mode</p>
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
                  <span className="text-[16px] sm:text-[14px] font-medium">Tasks</span>
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
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Toolbar — Code Mode</p>
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
                  <span className="text-[16px] sm:text-[14px] font-medium">Code</span>
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
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Send Button States</p>
            <div className="flex items-center gap-4">
              {/* Voice (default) */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><line x1="4" y1="8" x2="4" y2="16" /><line x1="8" y1="5" x2="8" y2="19" /><line x1="12" y1="2" x2="12" y2="22" /><line x1="16" y1="5" x2="16" y2="19" /><line x1="20" y1="8" x2="20" y2="16" /></svg>
                </div>
                <span className="text-[10px] text-text-primary">Voice</span>
              </div>
              {/* Send (inactive) */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full">
                  <img src={iconSend} alt="Send" className="w-4 h-4 icon-theme" />
                </div>
                <span className="text-[10px] text-text-primary">Inactive</span>
              </div>
              {/* Send (active/gradient) */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: 'linear-gradient(183.55deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%)' }}>
                  <img src={iconSendActive} alt="Send" className="w-3.5 h-3.5 brightness-0 invert" />
                </div>
                <span className="text-[10px] text-text-primary">Active</span>
              </div>
              {/* Mic */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-full">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-text-primary"><rect x="9" y="1" width="6" height="11" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                </div>
                <span className="text-[10px] text-text-primary">Mic</span>
              </div>
            </div>
          </div>

          {/* ── Attach Menu (static preview) ── */}
          <div>
            <p className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider">Attach Menu</p>
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
              <div key={i} className="w-2 h-2 rounded-full loading-dot" style={{ animationDelay: `${i * 0.2}s` }} />
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
          <p className="text-text-primary text-[13px] text-center">How can I help you today?</p>
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
          <p className="text-[13px] text-text-primary leading-[18px]">Select the traits that matter to you, and we'll build your ideal partner.</p>
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
            <span className="text-[12px] px-4 py-1.5 text-text-primary border-l border-stroke-outline">Custom API</span>
            <span className="text-[12px] px-4 py-1.5 text-text-primary border-l border-stroke-outline">Custom MCP</span>
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
                  <StatusTag variant="success" label="Connected" size="sm" showIcon={false} />
                ) : (
                  <button className="text-[11px] px-3 py-1 rounded-full border border-stroke-outline text-text-primary hover:bg-bg-hover">Connect</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </ComponentSection>

    </div>
  );
}

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-[18px] font-bold text-text-primary tracking-[-0.43px] mt-8 mb-6 scroll-mt-[120px]">
      {children}
    </h2>
  );
}

type TabId = 'all' | 'foundations' | 'principles' | 'layouts' | 'components' | 'review';

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'all',         label: 'All',                         hint: 'Everything in one scroll — foundations, principles, layouts, components, and review queue' },
  { id: 'foundations', label: 'Foundations',                 hint: 'Color, typography, spacing, radius, and icons — the single source of truth everything else builds on' },
  { id: 'principles',  label: 'Principles & Requirements',   hint: 'Rules and guidelines I follow when building' },
  { id: 'layouts',     label: 'Layout Templates',            hint: 'Layout shells we use across the app' },
  { id: 'components',  label: 'Component Library',           hint: 'All shared components, states, and where they are used' },
  { id: 'review',      label: 'Review Queue',                hint: 'New components awaiting your approval' },
];

function SearchBoxDemo() {
  const [q, setQ] = useState('');
  return <SearchBox value={q} onChange={setQ} placeholder="Search artifacts" width={220} />;
}

export default function DesignSystemPage({ sidebarOpen, onToggleSidebar }: DesignSystemPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const activeTabMeta = useMemo(
    () => TABS.find(t => t.id === activeTab) ?? TABS[0],
    [activeTab]
  );

  const handleTabClick = (id: TabId) => {
    setActiveTab(id);
    const scrollEl = document.getElementById('ds-scroll-container');
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PageLayout
      title="Design System"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      scrollContainerId="ds-scroll-container"
      filters={
        <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible scrollbar-autohide -mx-4 sm:mx-0 px-4 sm:px-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[14px] transition-colors border ${
                activeTab === tab.id
                  ? 'border-transparent'
                  : 'border-stroke-outline text-text-primary hover:bg-bg-hover chip-gradient-hover'
              }`}
              style={activeTab === tab.id ? { background: 'var(--color-selected-bg)', color: 'var(--color-selected-text)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
        {/* Tab hint */}
        <p className="text-[13px] text-text-secondary leading-[20px] -mt-4 mb-6">{activeTabMeta.hint}</p>

        {(activeTab === 'foundations' || activeTab === 'all') && <FoundationsTab />}

        {(activeTab === 'principles' || activeTab === 'all') && (<>
        {/* ━━━ DESIGN PRINCIPLES ━━━ */}
        <SectionTitle id="ds-principles">Design Principles</SectionTitle>

        {/* 5.0 Page Layout Template */}
        <div id="ds-page-layout" className="mb-6 rounded-2xl border border-stroke-outline p-5 scroll-mt-4" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">📐</span>
            <span className="text-[16px] font-bold text-text-primary">Page Layout Template — shared.tsx · PageLayout</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-4">
            Every top-level app page renders through <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>&lt;PageLayout&gt;</code>.
            This enforces uniform vertical rhythm and horizontal padding across the entire app — edit the component once, every page updates.
            Zero per-page CSS for headers, paddings, or title sizes.
          </p>

          {/* Visual diagram */}
          <div className="rounded-lg border border-stroke-outline overflow-hidden mb-4" style={{ background: 'var(--color-bg-hover)' }}>
            <div className="p-6">
              {/* Toggle bar */}
              <div className="relative rounded border border-dashed border-stroke-outline flex items-center px-3" style={{ height: 48, background: 'var(--color-bg-page)' }}>
                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--color-bg-hover)' }}>
                  <svg width="14" height="10" viewBox="0 0 22 16" fill="none"><rect width="22" height="2" rx="1" fill="currentColor" /><rect width="15" height="2" rx="1" y="7" fill="currentColor" /></svg>
                </div>
                <span className="ml-3 text-[11px] font-mono text-text-secondary">Toggle bar · h-12 (48px) · px-4</span>
              </div>

              <div className="text-[11px] font-mono text-text-secondary text-center py-1">↕ (no gap — body scrolls from here)</div>

              {/* Title row */}
              <div className="relative rounded border border-dashed border-stroke-outline flex items-center gap-3 px-4 py-3" style={{ background: 'var(--color-bg-page)' }}>
                <div className="flex-1 text-[18px] font-bold text-text-primary leading-[22px]">Page Title</div>
                <div className="shrink-0 px-2 py-1 rounded text-[10px] font-mono text-text-secondary" style={{ background: 'var(--color-bg-hover)' }}>rightSlot?</div>
              </div>
              <div className="text-[11px] font-mono text-text-secondary pl-1 pt-1">H1 · text-[40px] / leading-[48px] / font-bold · tracking-[-0.5px]</div>

              <div className="text-[11px] font-mono text-text-secondary text-center py-2">↕ mt-6 (24px)</div>

              {/* Filters */}
              <div className="relative rounded border border-dashed border-stroke-outline flex items-center gap-2 px-3 py-3" style={{ background: 'var(--color-bg-page)' }}>
                <div className="px-3 py-1 rounded-full text-[11px] text-text-primary border border-stroke-outline">Filter A</div>
                <div className="px-3 py-1 rounded-full text-[11px] text-text-primary border border-stroke-outline">Filter B</div>
                <div className="flex-1" />
                <div className="shrink-0 px-2 py-1 rounded text-[10px] font-mono text-text-secondary" style={{ background: 'var(--color-bg-hover)' }}>filters? (optional)</div>
              </div>

              <div className="text-[11px] font-mono text-text-secondary text-center py-2">↕ mt-8 (32px)</div>

              {/* Content */}
              <div className="relative rounded border border-dashed border-stroke-outline flex items-center justify-center" style={{ background: 'var(--color-bg-page)', height: 140 }}>
                <span className="text-[12px] font-mono text-text-secondary">children · maxWidth: 'full' | 'reading' (863px)</span>
              </div>

              <div className="text-[11px] font-mono text-text-secondary text-center py-2">↕ pb-10 (40px)</div>
            </div>
          </div>

          {/* Spec table */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-text-primary mb-4">
            <div><strong>Toggle bar height:</strong> 48px (<code className="font-mono text-[12px]">h-12</code>)</div>
            <div><strong>Horizontal padding:</strong> <code className="font-mono text-[12px]">px-4 sm:px-8</code></div>
            <div><strong>H1:</strong> <code className="font-mono text-[12px]">text-[40px] / leading-[48px] / font-bold</code></div>
            <div><strong>Title → filters:</strong> 24px (<code className="font-mono text-[12px]">mt-6</code>)</div>
            <div><strong>Title/filters → content:</strong> 32px (<code className="font-mono text-[12px]">mt-8</code>)</div>
            <div><strong>Bottom padding:</strong> 40px (<code className="font-mono text-[12px]">pb-10</code>)</div>
            <div><strong>maxWidth 'full':</strong> no limit (dashboards, listings)</div>
            <div><strong>maxWidth 'reading':</strong> 863px (articles, forms)</div>
          </div>

          {/* Usage */}
          <div className="rounded-lg border border-stroke-outline p-3 mb-4" style={{ background: 'var(--color-bg-hover)' }}>
            <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Usage</div>
            <pre className="text-[12px] font-mono text-text-primary overflow-x-auto leading-[18px]">{`<PageLayout
  title="Library"
  rightSlot={<SearchBox value={q} onChange={setQ} />}   // optional
  filters={<FilterPills />}                              // optional
  maxWidth="full"                                        // 'full' | 'reading'
  sidebarOpen={sidebarOpen}
  onToggleSidebar={onToggleSidebar}
>
  {/* page content */}
</PageLayout>`}</pre>
          </div>

          {/* SearchBox demo */}
          <div className="rounded-lg border border-stroke-outline p-3 mb-4" style={{ background: 'var(--color-bg-hover)' }}>
            <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">SearchBox — shared.tsx (recommended for rightSlot)</div>
            <p className="text-[13px] text-text-primary leading-[20px] mb-3">
              <strong>Desktop:</strong> always-expanded pill with icon + input.{' '}
              <strong>Mobile (&lt; md):</strong> shows icon only. Tap → full-width search bar replaces the top bar, input autofocuses, keyboard appears. Back arrow clears and closes.
            </p>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-stroke-outline" style={{ background: 'var(--color-bg-page)' }}>
              <span className="text-[12px] font-mono text-text-secondary">Live:</span>
              <SearchBoxDemo />
              <span className="text-[11px] text-text-secondary ml-auto">Shrink viewport &lt; 768px to see the mobile behavior.</span>
            </div>
          </div>

          {/* Pages that use it */}
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Used by (8 pages)</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] text-text-primary">
              <div>• OverviewPage <span className="text-text-secondary">— full · no filters</span></div>
              <div>• LibraryPage <span className="text-text-secondary">— full · filters + search</span></div>
              <div>• ConnectorsPage <span className="text-text-secondary">— full · filters + search</span></div>
              <div>• DesignSystemPage <span className="text-text-secondary">— full · filters</span></div>
              <div>• ComingSoonPage <span className="text-text-secondary">— full · no filters</span></div>
              <div>• Onboarding <span className="text-text-secondary">— reading (863px)</span></div>
              <div>• ProjectPage <span className="text-text-secondary">— reading · rightSlot</span></div>
            </div>
          </div>

          {/* Special pages */}
          <div className="rounded-lg border p-3" style={{ background: 'rgba(220,38,38,0.04)', borderColor: 'rgba(220,38,38,0.2)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.5px] mb-2" style={{ color: '#C93838' }}>⚠ Pages that do NOT use PageLayout</div>
            <div className="text-[13px] text-text-primary leading-[20px]">
              <strong>ChatPanel</strong> — conversation container. No page title, messages scroll top-to-bottom with input docked at the bottom. Structurally different from title-led pages; keep standalone.
            </div>
          </div>
        </div>

        {/* 5.1 Button system (3 tiers) */}
        <div id="ds-buttons" className="mb-6 rounded-2xl border border-stroke-outline p-5 scroll-mt-4" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">1️⃣</span>
            <span className="text-[16px] font-bold text-text-primary">Button system (3 tiers) — shared.tsx</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-4">
            Three levels of visual weight. Only <strong>ONE</strong> Primary per page/view.
            Use Secondary for strong-but-not-hero actions; Tertiary for cancel / dismiss / low-weight options.
            Primary and Secondary share the same lift-shadow on hover; Tertiary picks up a subtle gradient-tinted border.
          </p>

          {/* Tier 1 — Primary */}
          <div className="mb-3 pt-3 border-t border-stroke-outline">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-bold text-text-primary uppercase tracking-[0.5px]">Tier 1 · PrimaryButton</span>
              <span className="text-[12px] text-text-primary">— gradient · hero CTA · max one per view</span>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <PrimaryButton>Primary Action</PrimaryButton>
              <PrimaryButton disabled>Disabled</PrimaryButton>
            </div>
          </div>

          {/* Tier 2 — Secondary (new) */}
          <div className="mb-3 pt-3 border-t border-stroke-outline">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-bold text-text-primary uppercase tracking-[0.5px]">Tier 2 · SecondaryButton</span>
              <span className="text-[12px] text-text-primary">— solid inverted surface (auto flips in dark mode) · lift-shadow on hover</span>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <SecondaryButton>Secondary</SecondaryButton>
              <SecondaryButton disabled>Disabled</SecondaryButton>
            </div>
          </div>

          {/* Tier 3 — Tertiary */}
          <div className="mb-2 pt-3 border-t border-stroke-outline">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-bold text-text-primary uppercase tracking-[0.5px]">Tier 3 · TertiaryButton</span>
              <span className="text-[12px] text-text-primary">— outlined · subtle gradient-tinted border on hover · cancel / dismiss</span>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <TertiaryButton>Tertiary</TertiaryButton>
              <TertiaryButton disabled>Disabled</TertiaryButton>
            </div>
          </div>

          <p className="text-[13px] text-text-primary mt-4 leading-[18px] pt-3 border-t border-stroke-outline">
            All three share the same props: <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>children</code>, <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>onClick</code>, <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>disabled</code>, <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>fullWidth</code>, <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>className</code>.
          </p>
        </div>

        {/* 5.2 Brand Color Budget */}
        <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">🎨</span>
            <span className="text-[16px] font-bold text-text-primary">Brand Color Budget — 1–2% Max</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-4">
            Brand gradient (<code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>#7652B9 → #B46470 → #CA9D8C</code>) must occupy ≤ 1–2% of any page.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stroke-outline p-3">
              <div className="text-[14px] font-bold text-text-primary mb-2">✅ Allowed</div>
              <ul className="text-[14px] text-text-primary leading-[22px] list-disc pl-4 space-y-1">
                <li>One <code className="text-[13px] px-1 rounded" style={{ background: 'var(--color-bg-hover)' }}>.gradient-btn</code> per page</li>
                <li>Active nav indicator</li>
                <li>Urgent accent bar (4px)</li>
                <li>Hero gradient text</li>
                <li>Loading dots</li>
              </ul>
            </div>
            <div className="rounded-xl border border-stroke-outline p-3">
              <div className="text-[14px] font-bold text-text-primary mb-2">🚫 Not Allowed</div>
              <ul className="text-[14px] text-text-primary leading-[22px] list-disc pl-4 space-y-1">
                <li>Text colors</li>
                <li>Icon colors</li>
                <li>Progress bars, badges, tags</li>
                <li>Multiple buttons per page</li>
                <li>Data visualizations</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 5.3 Default Text & Icon Colors */}
        <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">🔤</span>
            <span className="text-[16px] font-bold text-text-primary">Default Text & Icon Colors</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-3">
            All text and icons use system defaults. Never hardcode hex colors.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'var(--color-bg-hover)' }}>
              <div className="w-4 h-4 rounded-full" style={{ background: 'var(--color-text-primary)' }} />
              <code className="text-[13px] font-mono" style={{ color: '#3171ff' }}>text-text-primary</code>
              <span className="text-[14px] text-text-primary flex-1">— Headings, body, labels, icons</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'var(--color-bg-hover)' }}>
              <div className="w-4 h-4 rounded-full" style={{ background: 'var(--color-text-secondary)' }} />
              <code className="text-[13px] font-mono" style={{ color: '#3171ff' }}>text-text-secondary</code>
              <span className="text-[14px] text-text-primary flex-1">— Descriptions, captions, helper text</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'var(--color-bg-hover)' }}>
              <div className="w-4 h-4 rounded-full" style={{ background: 'var(--color-text-tertiary)' }} />
              <code className="text-[13px] font-mono" style={{ color: '#3171ff' }}>text-text-tertiary</code>
              <span className="text-[14px] text-text-primary flex-1">— Disabled, muted metadata</span>
            </div>
          </div>
        </div>

        {/* 5.4 Callout Color */}
        <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">💙</span>
            <span className="text-[16px] font-bold text-text-primary">Callout & Highlight Color — Blue #3171ff</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-3">
            For emphasis, selection, progress, and callouts — use blue, NOT the brand gradient.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border-transparent" style={{ background: 'var(--color-selected-bg)', color: 'var(--color-selected-text)' }}>
              <span className="text-[14px]">Selected Chip</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full" style={{ background: '#3171ff' }} />
              <span className="text-[14px] text-text-primary">Progress bar</span>
            </div>
            <span className="text-[14px]" style={{ color: '#3171ff' }}>@mention link</span>
          </div>
        </div>

        {/* 5.5 FilterChip (shared) */}
        <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">🔘</span>
            <span className="text-[16px] font-bold text-text-primary">FilterChip (shared)</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-3">
            Master filter chip used across Library, Tasks, Projects, Connectors. Supports optional <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>icon</code> and <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>count</code>.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <FilterChip label="All" active count={9} />
            <FilterChip label="Reports" icon={<FileText size={14} className="icon-theme" />} count={2} />
            <FilterChip label="Documents" />
            <FilterChip label="Active" active />
          </div>
        </div>

        {/* 5.8 Tags — single source of truth for every pill in the app */}
        <div id="ds-tags" className="mb-6 rounded-2xl border border-stroke-outline p-5 scroll-mt-4" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[16px]">🏷️</span>
            <span className="text-[16px] font-bold text-text-primary">Tags</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-4">
            Every pill/badge in the app comes from one of the three shared components below.
            Editing them in <code className="text-[13px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>src/components/shared.tsx</code> propagates instantly
            to every page that uses them (Overview metrics, Tasks, Message Cards, Connectors, Onboarding, Library, etc.).
            Never create an inline pill — extend one of these instead.
          </p>

          {/* ---- StatusTag ---- */}
          <div className="rounded-xl border border-stroke-outline p-4 mb-4" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">StatusTag</span>
              <span className="text-[11px] text-text-primary">— semantic status pill (7 variants)</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[20px] mb-3">
              Props: <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>variant</code>
              {' · '}
              <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>label</code>
              {' · '}
              <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>showIcon?</code>
              {' · '}
              <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>size?</code>
            </p>

            <div className="mb-3">
              <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">With icon · size="md" (default)</div>
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusTag variant="pending"     label="Pending" />
                <StatusTag variant="in-progress" label="In progress" />
                <StatusTag variant="submitted"   label="Submitted" />
                <StatusTag variant="in-review"   label="In review" />
                <StatusTag variant="success"     label="Success" />
                <StatusTag variant="failed"      label="Failed" />
                <StatusTag variant="expired"     label="Expired" />
              </div>
            </div>

            <div className="mb-3">
              <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">No icon — compact contexts (card headers)</div>
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusTag variant="pending"     label="Pending"     showIcon={false} />
                <StatusTag variant="in-progress" label="In progress" showIcon={false} />
                <StatusTag variant="submitted"   label="Submitted"   showIcon={false} />
                <StatusTag variant="in-review"   label="In review"   showIcon={false} />
                <StatusTag variant="success"     label="Sent"        showIcon={false} />
                <StatusTag variant="failed"      label="Failed"      showIcon={false} />
                <StatusTag variant="expired"     label="Expired"     showIcon={false} />
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">size="sm" — very tight spots (connector rows, inline metadata)</div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag variant="pending"     label="Pending"     size="sm" />
                <StatusTag variant="in-progress" label="In progress" size="sm" />
                <StatusTag variant="success"     label="Connected"   size="sm" showIcon={false} />
                <StatusTag variant="failed"      label="Failed"      size="sm" />
                <StatusTag variant="expired"     label="Expired"     size="sm" />
              </div>
            </div>

            <div className="mt-3 text-[12px] text-text-primary leading-[18px] pt-3 border-t border-stroke-outline">
              <strong>Used by:</strong> MessageCard (Sent / Saved / In progress), ConnectorsPage (Connected), DesignSystem MiniStatusTag
            </div>
          </div>

          {/* ---- Tag ---- */}
          <div className="rounded-xl border border-stroke-outline p-4 mb-4" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">Tag</span>
              <span className="text-[11px] text-text-primary">— neutral display pill (3 variants)</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[20px] mb-3">
              Props: <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>children</code>
              {' · '}
              <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>outline?</code>
            </p>

            <div className="mb-3">
              <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Filled (default) — for page backgrounds</div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag>😊 Relaxed evenings</Tag>
                <Tag>🎲 Board game night</Tag>
                <Tag>📚 Reading</Tag>
                <Tag>2/3</Tag>
                <Tag>2/2h</Tag>
                <Tag>48/100 · Low</Tag>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Outline — for use inside a tinted card (e.g. SolutionRow)</div>
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--color-bg-hover)' }}>
                <Tag outline>针对：AI</Tag>
                <Tag outline>针对：Deadline</Tag>
                <Tag outline>针对：跨团队</Tag>
              </div>
            </div>

            <div className="mt-3 text-[12px] text-text-primary leading-[18px] pt-3 border-t border-stroke-outline">
              <strong>Used by:</strong> OverviewPage metric badges & impact tags, Onboarding "n/3" counter, ReviewItemCard type label, SolutionRow category tag
            </div>
          </div>

          {/* ---- TimePill ---- */}
          <div className="rounded-xl border border-stroke-outline p-4" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">TimePill</span>
              <span className="text-[11px] text-text-primary">— neutral pill with user icon + time</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[20px] mb-3">
              Props: <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>time</code>
              {' — use for review-time estimates and similar effort metadata.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <TimePill time="~3 min" />
              <TimePill time="~5 min" />
              <TimePill time="~8 min" />
              <TimePill time="~16 min" />
            </div>

            <div className="mt-3 text-[12px] text-text-primary leading-[18px] pt-3 border-t border-stroke-outline">
              <strong>Used by:</strong> ReviewItemCard (review time per item), Overview Needs Review rows
            </div>
          </div>
        </div>

        {/* 5.8 Shared-First Development */}
        <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">🧩</span>
            <span className="text-[16px] font-bold text-text-primary">Shared-First Development</span>
          </div>
          <p className="text-[14px] text-text-primary leading-[22px] mb-4">
            Always build reusable UI in <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>shared.tsx</code> first. App pages import from shared — never duplicate component code inline.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stroke-outline p-3">
              <div className="text-[14px] font-bold text-text-primary mb-2">✅ Workflow</div>
              <ol className="text-[14px] text-text-primary leading-[22px] list-decimal pl-4 space-y-1">
                <li>Define component in <code className="text-[13px] px-1 rounded" style={{ background: 'var(--color-bg-hover)' }}>shared.tsx</code></li>
                <li>Import into app pages</li>
                <li>Monitor on Design System page</li>
                <li>Update once → updates everywhere</li>
              </ol>
            </div>
            <div className="rounded-xl border border-stroke-outline p-3">
              <div className="text-[14px] font-bold text-text-primary mb-2">🚫 Avoid</div>
              <ul className="text-[14px] text-text-primary leading-[22px] list-disc pl-4 space-y-1">
                <li>Inline one-off components in pages</li>
                <li>Copy-pasting component code</li>
                <li>Styling variants outside shared file</li>
                <li>Skipping Design System registration</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Brand Gradient */}
        <SectionTitle id="ds-colors">Brand Gradient</SectionTitle>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <div className="gradient-btn rounded-xl" style={{ width: 200, height: 60 }} />
            <p className="text-text-primary text-[13px]">#7652B9 → #B46470 → #CA9D8C</p>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <span className="gradient-text text-[24px] font-bold">Gradient Text</span>
            <p className="text-text-primary text-[13px]">.gradient-text (31.6deg)</p>
          </div>
        </div>

        {/* Colors */}
        <SectionTitle id="ds-color-tokens">Color Tokens</SectionTitle>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {COLORS.map(c => (
            <div key={c.var} className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-stroke-outline)', minHeight: 96 }}>
              <div className="w-1/3 shrink-0" style={{ background: `var(${c.var})` }} />
              <div className="w-2/3 min-w-0 p-3 flex flex-col justify-center gap-1">
                <p className="text-text-primary font-semibold text-[13px] truncate">{c.name}</p>
                <p className="text-text-primary text-[12px] leading-[16px]">{c.usage}</p>
                <p className="text-text-secondary text-[11px] leading-[15px]">e.g. {c.examples}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-[15px] font-semibold text-text-primary mt-6 mb-3">Special Colors</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {SPECIAL_COLORS.map(c => (
            <div key={c.name} className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-stroke-outline)', minHeight: 96 }}>
              <div className="w-1/3 shrink-0" style={{ background: c.preview }} />
              <div className="w-2/3 min-w-0 p-3 flex flex-col justify-center gap-1">
                <p className="text-text-primary font-semibold text-[13px] truncate">{c.name}</p>
                <p className="text-text-primary text-[12px] leading-[16px]">{c.usage}</p>
                <p className="text-text-secondary text-[11px] leading-[15px]">e.g. {c.examples}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <SectionTitle id="ds-typography">Typography</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Style', 'Font', 'Size', 'Weight', 'Line Height', 'Spacing'].map(h => (
                  <th key={h} className="text-text-primary font-semibold text-[13px] py-2 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TYPOGRAPHY.map((t, i) => (
                <tr key={t.style} style={{ background: i % 2 === 0 ? 'var(--color-bg-hover)' : 'transparent' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 px-4">{t.style}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{t.font}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{t.size}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{t.weight}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{t.lineHeight}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{t.spacing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Spacing & Radii */}
        <SectionTitle id="ds-spacing">Spacing & Border Radius</SectionTitle>
        <div className="flex flex-wrap gap-8">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary mb-3">Spacing</h3>
            <div className="flex flex-col gap-2">
              {SPACING.map(s => (
                <div key={s.token} className="flex items-center gap-4">
                  <div className="rounded" style={{ width: parseInt(s.value), height: 16, background: '#3171ff', minWidth: 4 }} />
                  <span className="text-text-primary text-[13px] font-medium w-20">{s.value}</span>
                  <span className="text-text-primary text-[12px]">{s.tw}</span>
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
                  <span className="text-text-primary text-[11px]">{r.tw}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Icon Library */}
        <SectionTitle id="ds-icons">Icon Library</SectionTitle>
        <p className="text-text-primary text-[14px] leading-[20px] mb-4">
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
              <span className="text-text-primary text-[12px]">{group.desc}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {group.items.map(icon => (
                <div key={icon.file} className="flex flex-col items-center gap-1.5 p-3 rounded-xl w-[90px]" style={{ border: '1px solid var(--color-stroke-outline)' }}>
                  <div className="w-8 h-8 flex items-center justify-center">
                    <img src={icon.src} alt={icon.name} className="max-w-[24px] max-h-[24px] object-contain icon-theme" />
                  </div>
                  <span className="text-text-primary text-[11px] text-center leading-tight">{icon.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Inline SVG Icons (ChatInput) */}
        <h3 className="text-[15px] font-semibold text-text-primary mt-6 mb-3">Inline SVG Icons (ChatInput)</h3>
        <p className="text-text-primary text-[13px] leading-[18px] mb-3">
          Mode selector, input field, and toolbar inline SVGs rendered directly in <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>ChatInput.tsx</code>.
        </p>
        <div className="flex flex-wrap gap-3">
          {([
            { name: 'Chat', Icon: MessageSquare },
            { name: 'Tasks', Icon: CheckSquare },
            { name: 'Code', Icon: Code2 },
            { name: 'Mic (stroke)', Icon: Mic },
            { name: 'Voice (stroke)', Icon: Activity },
            { name: 'Mention (@)', Icon: AtSign },
            { name: 'Folder', Icon: Folder },
            { name: 'Git Branch', Icon: GitBranch },
          ] as { name: string; Icon: React.FC<{ size?: number; className?: string }> }[]).map(({ name, Icon }) => (
            <div key={name} className="flex flex-col items-center gap-1.5 p-3 rounded-xl w-[90px]" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="w-8 h-8 flex items-center justify-center">
                <Icon size={20} className="text-text-primary" />
              </div>
              <span className="text-text-primary text-[11px] text-center leading-tight">{name}</span>
            </div>
          ))}
        </div>

        {/* Lucide React Icons */}
        <h3 className="text-[15px] font-semibold text-text-primary mt-6 mb-3">Lucide React Icons</h3>
        <p className="text-text-primary text-[13px] leading-[18px] mb-3">
          From <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>lucide-react</code> package. Rendered as inline SVG at 20px.
        </p>
        <div className="flex flex-wrap gap-3">
          {([
            { name: 'BookOpen', Icon: BookOpen },
            { name: 'ChevronDown', Icon: ChevronDown },
            { name: 'ChevronRight', Icon: ChevronRight },
            { name: 'Code2', Icon: Code2 },
            { name: 'FileCode2', Icon: FileCode2 },
            { name: 'FileText', Icon: FileText },
            { name: 'FolderOpen', Icon: FolderOpen },
            { name: 'FolderPlus', Icon: FolderPlus },
            { name: 'LayoutDashboard', Icon: LayoutDashboard },
            { name: 'Link', Icon: Link },
            { name: 'Menu', Icon: Menu },
            { name: 'MessageCircle', Icon: MessageCircle },
            { name: 'MoreVertical', Icon: MoreVertical },
            { name: 'Palette', Icon: Palette },
            { name: 'PanelRight', Icon: PanelRight },
            { name: 'Pen', Icon: Pen },
            { name: 'Plus', Icon: Plus },
            { name: 'Search', Icon: Search },
            { name: 'Star', Icon: Star },
            { name: 'X', Icon: X },
          ] as { name: string; Icon: React.FC<{ size?: number; className?: string }> }[]).map(({ name, Icon }) => (
            <div key={name} className="flex flex-col items-center gap-1.5 p-3 rounded-xl w-[90px]" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="w-8 h-8 flex items-center justify-center">
                <Icon size={20} className="text-text-primary" />
              </div>
              <span className="text-text-primary text-[11px] text-center leading-tight">{name}</span>
            </div>
          ))}
        </div>

        {/* Components */}
        <SectionTitle id="ds-components">Components</SectionTitle>
        <ComponentShowcase />

        {/* CSS Utility Classes */}
        <SectionTitle id="ds-css">CSS Utility Classes</SectionTitle>
        <div className="flex flex-col gap-2">
          {CSS_UTILITIES.map(u => (
            <div key={u.cls} className="flex items-start gap-4 py-2" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
              <code className="text-[13px] font-mono shrink-0 px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff', minWidth: 200 }}>
                {u.cls}
              </code>
              <span className="text-text-primary text-[13px]">{u.desc}</span>
            </div>
          ))}
        </div>

        {/* Live Samples */}
        <SectionTitle id="ds-samples">Live Samples</SectionTitle>
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
            <button className="gradient-btn text-white font-medium rounded-[4px] px-6 py-3 text-[14px]">
              Action Button
            </button>
          </div>

          {/* Status Tag */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Status Tag</h3>
            <div className="flex flex-wrap items-center gap-2">
              <StatusTag variant="in-progress" label="In progress" />
              <StatusTag variant="success" label="Saved" />
            </div>
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
        <SectionTitle id="ds-dark">Dark Mode</SectionTitle>
        <p className="text-text-primary text-[14px] leading-[20px]">
          Dark mode is toggled via the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.dark</code> class on <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>&lt;html&gt;</code>. All components use CSS variables that automatically switch. Monochrome icons use the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.icon-theme</code> class for auto-inversion. Gradient elements (avatars, spinner, buttons) do NOT use <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.icon-theme</code>.
        </p>

        {/* Figma vs Code Diff */}
        <SectionTitle id="ds-diff">Figma vs Code Diff</SectionTitle>
        <p className="text-text-primary text-[14px] leading-[20px] mb-4">
          Comparison between Figma design system variables (WorkPal library, <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>L&DMode</code> collection) and the current code implementation.
        </p>

        {/* Figma tokens missing from code */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Figma Tokens Not Implemented as CSS Variables</h3>
        <p className="text-text-primary text-[13px] leading-[18px] mb-3">These Figma variables exist in the WorkPal library but are either hardcoded inline or missing in code.</p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Figma Variable', 'Status in Code', 'Notes'].map(h => (
                  <th key={h} className="text-text-primary font-semibold text-[13px] py-2 px-4">{h}</th>
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
              ].map((row, i) => (
                <tr key={row.figma} style={{ background: i % 2 === 0 ? 'var(--color-bg-hover)' : 'transparent' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 px-4 font-mono">{row.figma}</td>
                  <td className="py-3 px-4">
                    <span className="text-[12px] font-semibold px-2 py-0.5 rounded" style={{
                      background: row.status === 'Missing' ? 'rgba(220,38,38,0.1)' : 'rgba(234,179,8,0.15)',
                      color: row.status === 'Missing' ? '#dc2626' : '#a16207',
                    }}>{row.status}</span>
                  </td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Code tokens not in Figma */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Code Tokens Not in Figma Variables</h3>
        <p className="text-text-primary text-[13px] leading-[18px] mb-3">These CSS variables exist in code but have no corresponding Figma variable in the WorkPal library.</p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['CSS Variable', 'Light Value', 'Dark Value', 'Notes'].map(h => (
                  <th key={h} className="text-text-primary font-semibold text-[13px] py-2 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { css: '--color-text-tertiary', light: 'rgba(20,39,64,0.4)', dark: 'rgba(226,243,255,0.4)', note: 'No Figma variable; used for placeholder text & subtle labels' },
                { css: '--color-icon-primary', light: '#142740', dark: '#FFFFFF', note: 'Merged with text/primary — same value in both light and dark modes' },
                { css: '--color-outer-bg', light: '#f5f5f7', dark: '#001424', note: 'No Figma variable; outer shell background behind the app frame' },
                { css: '--color-outer-border', light: '#f5f5f7', dark: '#001424', note: 'No Figma variable; outer shell border color' },
              ].map((row, i) => (
                <tr key={row.css} style={{ background: i % 2 === 0 ? 'var(--color-bg-hover)' : 'transparent' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 px-4 font-mono">{row.css}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4 font-mono">{row.light}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4 font-mono">{row.dark}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Value discrepancies */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Value Discrepancies</h3>
        <p className="text-text-primary text-[13px] leading-[18px] mb-3">Tokens that exist in both Figma and code but may differ in value or naming.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Token', 'Discrepancy'].map(h => (
                  <th key={h} className="text-text-primary font-semibold text-[13px] py-2 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { token: 'Sidebar BG (dark)', desc: 'Code uses #0d2136; Figma "Color/Background/Web Menu" dark mode may use rgba(226,243,255,0.1) — same as bg-hover' },
                { token: 'StatusTag color', desc: 'DesignSystemPage MiniStatusTag uses #00c7be (teal) while the main app & DESIGN_SYSTEM.md use #028901 (green)' },
                { token: 'Body/Emphasized line-height', desc: 'DESIGN_SYSTEM.md says 32px; typical Figma body emphasized is 22px — verify in Figma source' },
              ].map((row, i) => (
                <tr key={row.token} style={{ background: i % 2 === 0 ? 'var(--color-bg-hover)' : 'transparent' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 px-4 whitespace-nowrap">{row.token}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Responsive Rules */}
        <SectionTitle id="ds-responsive">Responsive Rules (Mobile vs Desktop)</SectionTitle>
        <p className="text-text-primary text-[14px] leading-[20px] mb-4">
          The app uses a <strong className="text-text-primary">mobile-first</strong> approach. Base styles target mobile ({'<'}768px), and desktop overrides kick in at the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>md:</code> breakpoint (768px+) via Tailwind and <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>@media (min-width: 768px)</code>.
        </p>

        {/* Global overrides */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Global CSS Overrides (index.css)</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Property', 'Mobile (< 768px)', 'Desktop (≥ 768px)'].map(h => (
                  <th key={h} className="text-text-primary font-semibold text-[13px] py-2 px-4">{h}</th>
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
              ].map((row, i) => (
                <tr key={row.prop} style={{ background: i % 2 === 0 ? 'var(--color-bg-hover)' : 'transparent' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 px-4 font-mono">{row.prop}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4 font-mono">{row.mobile}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4 font-mono">{row.desktop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Component-level patterns */}
        <h3 className="text-[15px] font-semibold text-text-primary mb-3">Component-Level Tailwind Patterns</h3>
        <p className="text-text-primary text-[13px] leading-[18px] mb-3">Common <code className="px-1 py-0.5 rounded text-[12px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>md:</code> responsive patterns used across components.</p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Category', 'Mobile', 'Desktop (md:)', 'Example Component'].map(h => (
                  <th key={h} className="text-text-primary font-semibold text-[13px] py-2 px-4">{h}</th>
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
              ].map((row, i) => (
                <tr key={row.cat} style={{ background: i % 2 === 0 ? 'var(--color-bg-hover)' : 'transparent' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 px-4">{row.cat}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4 font-mono">{row.mobile}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4 font-mono">{row.desktop}</td>
                  <td className="text-text-primary text-[13px] py-3 px-4">{row.comp}</td>
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
              <span className="text-text-primary text-[13px]">{item.desc}</span>
            </div>
          ))}
        </div>

        {/* Needs Review — custom patterns not yet in the design system */}
        <SectionTitle id="ds-review">Needs Review</SectionTitle>
        <p className="text-text-primary text-[14px] leading-[20px] mb-4">
          These UI patterns are used in the app but are <strong>not yet part of the design system</strong>. Each card shows a live sample, description, and the closest existing component. Review to decide: promote to design system, or replace with an existing pattern.
        </p>

        <div className="flex flex-col gap-4">
          {/* === All samples below use shared components from shared.tsx === */}
          {/* Update a component in shared.tsx → it updates here AND in the app */}

          {/* 1. Circular Score Ring */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">CircularProgress</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">SVG circle with stroke-dasharray progress + centered text overlay.</p>
            <div className="flex items-center gap-6 p-4 rounded-xl bg-bg-hover mb-3">
              <CircularProgress value={100} color="#3171ff">
                <span className="text-[16px] font-bold text-text-primary">4/4</span>
                <span className="text-[10px] text-text-primary">goals</span>
              </CircularProgress>
              <CircularProgress value={65} color="#3171ff">
                <span className="text-[16px] font-bold text-text-primary">65%</span>
              </CircularProgress>
              <CircularProgress value={50} color="#F59E0B">
                <span className="text-[16px] font-bold text-text-primary">50%</span>
              </CircularProgress>
              <CircularProgress value={30} color="#EF4444">
                <span className="text-[16px] font-bold text-text-primary">30%</span>
              </CircularProgress>
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'CircularProgress'}</code> from shared.tsx</p>
          </div>

          {/* 2. AreaChart */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">AreaChart</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">SVG area chart with gradient fill, data points, and labels.</p>
            <div className="p-4 rounded-xl bg-bg-hover mb-3">
              <AreaChart data={[{ label: 'M', value: 85 }, { label: 'T', value: 72 }, { label: 'W', value: 65 }, { label: 'T', value: 78 }, { label: 'F', value: 60 }, { label: 'S', value: 90 }]} color="#3171ff" height={70} gradientId="dsAreaGrad" />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'AreaChart'}</code> from shared.tsx</p>
          </div>

          {/* 3. ProgressBar */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">ProgressBar</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Determinate progress bar with configurable color and optional label.</p>
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-bg-hover mb-3">
              <ProgressBar value={62} showLabel />
              <ProgressBar value={35} showLabel />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'ProgressBar'}</code> from shared.tsx</p>
          </div>

          {/* 4. LabeledBar */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">LabeledBar</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Thin bar with label + percentage, custom color per category.</p>
            <div className="p-4 rounded-xl bg-bg-hover mb-3">
              <LabeledBar label="Deadline pressure" pct={35} color="#EF4444" />
              <LabeledBar label="Keeping up with AI" pct={28} color="#F59E0B" />
              <LabeledBar label="Cross-team alignment" pct={22} color="#7652B9" />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'LabeledBar'}</code> from shared.tsx</p>
          </div>

          {/* 5. SectionTitle */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">SectionTitle</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Emoji + bold title + optional count badge.</p>
            <div className="flex flex-col gap-1 p-4 rounded-xl bg-bg-hover mb-3">
              <SharedSectionTitle emoji="👀" title="Needs Your Eyes" count={3} />
              <SharedSectionTitle emoji="⚡" title="Maya is Working On" />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'SectionTitle'}</code> from shared.tsx</p>
          </div>

          {/* 6. ReviewItemCard */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">ReviewItemCard</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Card with optional urgent accent bar, metadata, time pill, and action button.</p>
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-bg-hover mb-3">
              <ReviewItemCard title="UX meeting summary — 6 action items" source="Zoom → Docs" type="Document" time="3 min ago" humanTime="~5 min" />
              <ReviewItemCard title="Weekly stakeholder email draft" source="Gmail" type="Email" time="2h ago" humanTime="~3 min" />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'ReviewItemCard'}</code> from shared.tsx</p>
          </div>

          {/* Greeting Banner — page-specific, not shared */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">Greeting Banner</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">OverviewPage</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Page-specific — full-width card with avatar, title, body, TTS button.</p>
            <div className="p-4 rounded-xl bg-bg-hover mb-3">
              <div className="flex gap-4 items-start">
                <div className="w-[48px] h-[48px] rounded-xl bg-bg-page shrink-0 overflow-hidden">
                  <img src={avatarBlackWoman} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-text-primary tracking-[0.5px] mb-0.5">MAYA · MORNING BRIEFING</div>
                  <div className="text-[13px] font-bold text-text-primary mb-1">Good morning! Today is a steady day</div>
                  <div className="text-[12px] text-text-primary leading-[18px]">Your schedule is clear and focus time is protected.</div>
                  <button className="mt-2 px-3 py-1 rounded-[4px] gradient-btn text-white text-[11px] font-semibold">Listen</button>
                </div>
              </div>
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Status:</strong> One-off for Overview page. Not extracted to shared.tsx.</p>
          </div>

          {/* 9. TaskProgressCard */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">TaskProgressCard</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Clickable card with progress bar, expands to show step list.</p>
            <div className="p-4 rounded-xl bg-bg-hover mb-3">
              <TaskProgressCard title="Analyzing Q2 metrics" progress={62} eta="~8 min" steps={['Pulling data from Sheets', 'Building charts', 'Formatting']} expanded />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'TaskProgressCard'}</code> from shared.tsx</p>
          </div>

          {/* 9b. HealthDimensionRow */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">HealthDimensionRow</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">
              Lucide icon + label/desc on the left, auto-colored status pill on the right. Color + icon derive from completion ratio (<code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>value / target</code>):
            </p>
            <ul className="text-[13px] text-text-primary leading-[20px] mb-3 list-disc pl-5">
              <li><strong>≥ 100%</strong> — light blue + check (done)</li>
              <li><strong>≥ 50%</strong> — orange + warning (half)</li>
              <li><strong>&lt; 50%</strong> — red + x (not started / failing)</li>
            </ul>
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-bg-hover mb-3">
              <HealthDimensionRow icon={Brain} label="Focus Time" desc="9–11am blocked & protected" value={2} target={2} unit="h" />
              <HealthDimensionRow icon={Moon} label="Sleep" desc="Last night: 5h — a bit short" value={5} target={7} unit="h" />
              <HealthDimensionRow icon={Home} label="Family Time" desc="No family time yet today" value={0} target={2} unit="h" />
              <HealthDimensionRow icon={Zap} label="Workload" desc="Manageable pace today" value={3} unit="tasks" status="balanced" />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'HealthDimensionRow'}</code> from shared.tsx</p>
          </div>

          {/* 10. StepIndicator */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">StepIndicator</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Three states: done (checkmark), in-progress (filled dot), pending (empty circle).</p>
            <div className="flex items-center gap-6 p-4 rounded-xl bg-bg-hover mb-3">
              <div className="flex items-center gap-2"><StepIndicator status="done" /><span className="text-[12px] text-text-primary">Done</span></div>
              <div className="flex items-center gap-2"><StepIndicator status="in-progress" /><span className="text-[12px] text-text-primary">In Progress</span></div>
              <div className="flex items-center gap-2"><StepIndicator status="pending" /><span className="text-[12px] text-text-primary">Pending</span></div>
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'StepIndicator'}</code> from shared.tsx</p>
          </div>

          {/* 11. InsightCard */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">InsightCard</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Callout card with sparkle icon, body text, and action buttons.</p>
            <div className="p-4 rounded-xl bg-bg-hover mb-3">
              <InsightCard body="Your focus time dropped 40% this week. Want me to protect morning blocks?" actions={[{ label: 'Yes, protect mornings', primary: true }, { label: 'Show data' }]} />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'InsightCard'}</code> from shared.tsx</p>
          </div>

          {/* 12. MetricCard */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">MetricCard</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Large centered number with title and subtitle.</p>
            <div className="flex gap-3 p-4 rounded-xl bg-bg-hover mb-3">
              <div className="flex-1 bg-bg-page rounded-xl border border-stroke-outline p-3">
                <MetricCard title="Emotional value" value="10" subtitle="/10" />
              </div>
              <div className="flex-1 bg-bg-page rounded-xl border border-stroke-outline p-3">
                <MetricCard title="Time gained" value="+2h" subtitle="this week" />
              </div>
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'MetricCard'}</code> from shared.tsx</p>
          </div>

          {/* SolutionRow */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">SolutionRow</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Row with emoji, title + description, and right-aligned category tag.</p>
            <div className="p-4 rounded-xl bg-bg-hover mb-3">
              <SolutionRow icon="🎧" title="AI趋势速报" desc="每天3分钟音频" tag="针对：AI" />
              <SolutionRow icon="🧘" title="Focus Block" desc="自动拦截非紧急会议" tag="针对：Deadline" />
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'SolutionRow'}</code> from shared.tsx</p>
          </div>

          {/* 15. SummaryFooter */}
          <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold text-text-primary">SummaryFooter</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
            </div>
            <p className="text-[13px] text-text-primary leading-[18px] mb-3">Right-aligned row with clock icon + summary text.</p>
            <div className="p-4 rounded-xl bg-bg-hover mb-3">
              <SummaryFooter>Total review time: <strong>~16 min</strong> for 3 items</SummaryFooter>
            </div>
            <p className="text-[13px] text-text-secondary leading-[18px]"><strong className="text-text-primary">Import:</strong> <code className="text-[12px] font-mono" style={{ color: '#3171ff' }}>{'SummaryFooter'}</code> from shared.tsx</p>
          </div>

        </div>
        </>)}

        {(activeTab === 'layouts'    || activeTab === 'all') && <LayoutsTab />}
        {(activeTab === 'components' || activeTab === 'all') && <ComponentsTab />}
        {(activeTab === 'review'     || activeTab === 'all') && <ReviewTab />}
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
  usage: string;
};

const SURFACE_TOKENS: ColorToken[] = [
  { name: 'Text · Primary',    cssVar: '--color-text-primary',    tailwind: 'text-text-primary',    usage: 'Headings, body, labels, icons' },
  { name: 'Text · Secondary',  cssVar: '--color-text-secondary',  tailwind: 'text-text-secondary',  usage: 'Descriptions, captions, helper text' },
  { name: 'Text · Tertiary',   cssVar: '--color-text-tertiary',   tailwind: 'text-text-tertiary',   usage: 'Disabled, muted metadata' },
  { name: 'Background · Page', cssVar: '--color-bg-page',         tailwind: 'bg-bg-page',           usage: 'Inner page surface' },
  { name: 'Background · Hover',cssVar: '--color-bg-hover',        tailwind: 'bg-bg-hover',          usage: 'Hover fill, subtle surfaces' },
  { name: 'Background · Outer',cssVar: '--color-outer-bg',        usage: 'App outer chrome' },
  { name: 'Sidebar',           cssVar: '--color-sidebar-bg',      usage: 'Left navigation surface' },
  { name: 'Stroke · Outline',  cssVar: '--color-stroke-outline',  tailwind: 'border-stroke-outline',usage: 'Default borders' },
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

function Swatch({ token, withBorder = true }: { token: ColorToken; withBorder?: boolean }) {
  return (
    <div className="rounded-xl border border-stroke-outline overflow-hidden" style={{ background: 'var(--color-bg-page)' }}>
      <div
        className={`h-16 w-full ${withBorder ? 'border-b border-stroke-outline' : ''}`}
        style={{ background: `var(${token.cssVar})` }}
      />
      <div className="p-3">
        <div className="text-[13px] font-bold text-text-primary leading-[18px]">{token.name}</div>
        <code className="block mt-1 text-[11px] font-mono text-text-secondary break-all">{token.cssVar}</code>
        {token.tailwind && (
          <code className="block mt-0.5 text-[11px] font-mono" style={{ color: 'var(--color-accent-blue)' }}>{token.tailwind}</code>
        )}
        <p className="mt-1 text-[11px] text-text-secondary leading-[15px]">{token.usage}</p>
      </div>
    </div>
  );
}

const TYPE_SCALE: { className: string; label: string; size: string; lh: string; weight: string; tracking: string; sample: string; usage: string }[] = [
  { className: 'type-title',              label: 'Page Title',          size: '40', lh: '48', weight: '700', tracking: '-0.5',  sample: 'Welcome to WorkPal', usage: 'Only one per page — H1 set by PageLayout' },
  { className: 'type-body-emphasized',    label: 'Body / Emphasized',   size: '16', lh: '32', weight: '700', tracking: '-0.43', sample: 'Section headings, scenario prompts', usage: 'Subheads, card titles, question prompts' },
  { className: 'type-body',               label: 'Body / Regular',      size: '16', lh: '32', weight: '400', tracking: '-0.43', sample: 'This is body copy — the workhorse size for paragraphs and chat bubbles.', usage: 'Paragraphs, chat messages, descriptions' },
  { className: 'type-detail-emphasized',  label: 'Detail / Emphasized', size: '14', lh: '22', weight: '700', tracking: '0',     sample: 'Form labels, small section heads', usage: 'Form labels, chip emphasis, metadata headings' },
  { className: 'type-detail',             label: 'Detail / Regular',    size: '14', lh: '22', weight: '400', tracking: '0',     sample: 'Helper text, captions, chip labels, inline hints.', usage: 'Helper text, captions, chip labels' },
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
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
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
    ],
  },
  {
    group: 'Actions & Controls',
    blurb: 'User-initiated operations — creating, searching, dismissing, sending.',
    icons: [
      { name: 'Plus',        Icon: Plus,        purpose: 'Create / add (new session, project, API)', usedIn: 'Sidebar, ConnectorsPage, shared' },
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
    ],
  },
];

// Flat helper for the size & color showcase at the top.
const SHOWCASE_ICON = Search;

function FoundationsTab() {
  return (
    <div>
      {/* Intro card */}
      <div className="mb-6 rounded-2xl border p-5" style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-outline)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[16px]">🎨</span>
          <span className="type-body-emphasized text-text-primary">Single source of truth</span>
        </div>
        <p className="type-detail text-text-primary">
          Every color, font size, spacing step, and radius below is a <strong>token</strong>, not a hardcoded value.
          Edit the CSS variable in <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-page)', color: 'var(--color-accent-blue)' }}>src/index.css</code> once and every component, page, and screen — onboarding, chat messages, cards, charts — picks up the change automatically through the Tailwind mapping in <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-page)', color: 'var(--color-accent-blue)' }}>tailwind.config.js</code>.
        </p>
        <p className="type-detail text-text-primary mt-2">
          <strong>Rule:</strong> never hardcode a hex, font size, or pixel spacing. If a token is missing, add it here first, then use it.
        </p>
      </div>

      {/* ─── Color palette ─── */}
      <SectionTitle id="ds-foundation-color">Color Palette</SectionTitle>

      <div className="mb-5 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-3">Surface & Text — bound to <code className="text-[12px] font-mono">--color-*</code>, mode-aware (light/dark)</div>
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
                <code className="block text-[11px] font-mono text-text-secondary">{s.cssVar}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Typography scale ─── */}
      <SectionTitle id="ds-foundation-type">Typography Scale</SectionTitle>

      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <p className="type-detail text-text-secondary mb-4">
          Five canonical styles, no more. Use the <code className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-blue)' }}>type-*</code> utility classes — never inline <code className="text-[12px] font-mono">text-[Xpx]</code>. Editing the <code className="text-[12px] font-mono">--font-*</code> variables in <code className="text-[12px] font-mono">src/index.css</code> updates every usage app-wide.
        </p>
        <div className="flex flex-col divide-y divide-stroke-outline">
          {TYPE_SCALE.map(row => (
            <div key={row.className} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-6 items-start">
              <div>
                <div className="type-detail-emphasized text-text-primary">{row.label}</div>
                <code className="block mt-1 text-[11px] font-mono" style={{ color: 'var(--color-accent-blue)' }}>.{row.className}</code>
                <div className="mt-1 text-[11px] font-mono text-text-secondary leading-[16px]">
                  {row.size}px / {row.lh}px / {row.weight} / {row.tracking}px
                </div>
                <p className="mt-1 text-[11px] text-text-secondary leading-[15px]">{row.usage}</p>
              </div>
              <div className={`${row.className} text-text-primary`}>{row.sample}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Spacing scale ─── */}
      <SectionTitle id="ds-foundation-space">Spacing Scale</SectionTitle>

      <div className="mb-6 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <p className="type-detail text-text-secondary mb-4">
          Mirrors the Tailwind spacing scale. Always snap to a step — never <code className="text-[12px] font-mono">gap-[9px]</code> or <code className="text-[12px] font-mono">p-[17px]</code>.
        </p>
        <div className="flex flex-col gap-3">
          {SPACING_SCALE.map(s => {
            const px = parseInt(s.css, 10);
            return (
              <div key={s.token} className="grid grid-cols-[120px_1fr_140px] md:grid-cols-[140px_1fr_180px_1fr] gap-3 items-center">
                <div>
                  <code className="text-[12px] font-mono text-text-primary">{s.token}</code>
                  <div className="text-[11px] font-mono text-text-secondary">{s.css}</div>
                </div>
                <div className="h-4 rounded" style={{ width: px, background: 'var(--color-accent-blue)' }} aria-hidden />
                <code className="text-[11px] font-mono text-text-secondary">{s.tailwind}</code>
                <p className="hidden md:block text-[12px] text-text-secondary leading-[16px]">{s.usage}</p>
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
              <code className="text-[12px] font-mono text-text-primary">{r.token}</code>
              <div className="text-[11px] font-mono text-text-secondary">{r.css}</div>
              <p className="mt-1 text-[11px] text-text-secondary leading-[15px]">{r.usage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Icon library ─── */}
      <SectionTitle id="ds-foundation-icons">Icon Library</SectionTitle>

      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <p className="type-detail text-text-primary mb-1"><strong>Library:</strong> <code className="text-[12px] font-mono" style={{ color: 'var(--color-accent-blue)' }}>lucide-react</code> — the single icon source.</p>
        <p className="type-detail text-text-secondary">
          Never import from any other icon library, and never inline custom SVGs in components. Icons inherit <code className="text-[12px] font-mono">currentColor</code> — size with the <code className="text-[12px] font-mono">size</code> prop; color via parent text color or a direct <code className="text-[12px] font-mono">color</code> style. Default stroke width is <code className="text-[12px] font-mono">2</code>.
        </p>
      </div>

      {/* Size ramp — real SVG rendered at every ramp step */}
      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Size ramp</div>
        <p className="type-detail text-text-secondary mb-4">
          Preferred sizes. Snap to one of these; avoid arbitrary values. Showcasing <code className="text-[12px] font-mono">&lt;Search /&gt;</code> at each step.
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
              <code className="text-[11px] font-mono text-text-primary">size={sz}</code>
              <span className="text-[11px] text-text-secondary">{sz === 16 ? 'default' : sz === 20 ? 'sidebar' : sz === 24 ? 'toolbar' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Color showcase — real SVG rendered with semantic tokens */}
      <div className="mb-4 rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
        <div className="type-detail-emphasized text-text-primary mb-1">Color</div>
        <p className="type-detail text-text-secondary mb-4">
          Icons render with <code className="text-[12px] font-mono">currentColor</code> — color comes from the text color of the parent, or an inline <code className="text-[12px] font-mono">color</code> style pointing at a token. Showcasing <code className="text-[12px] font-mono">&lt;BadgeCheck /&gt;</code>, <code className="text-[12px] font-mono">&lt;AlertTriangle /&gt;</code>, <code className="text-[12px] font-mono">&lt;XCircle /&gt;</code>, <code className="text-[12px] font-mono">&lt;Clock /&gt;</code>, <code className="text-[12px] font-mono">&lt;Sparkles /&gt;</code>.
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
                  <code className="block text-[11px] font-mono text-text-secondary truncate">{r.token}</code>
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
          Default is <code className="text-[12px] font-mono">2</code>. Heavier weights read better at very small sizes; lighter weights at large display sizes.
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
              <code className="text-[11px] font-mono text-text-primary">strokeWidth={sw}</code>
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
            Maya's insight
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
                <span className="text-[11px] text-text-secondary">· {g.blurb}</span>
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
                        <code className="block text-[12px] font-mono text-text-primary truncate">{ic.name}</code>
                        <p className="text-[11px] text-text-secondary leading-[14px] truncate">{ic.purpose}</p>
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
          <strong>Monochrome PNGs in dark mode:</strong> any <code className="text-[12px] font-mono">.png</code> logo uses the <code className="text-[12px] font-mono">.icon-theme</code> class for auto black→white inversion. Lucide SVGs inherit <code className="text-[12px] font-mono">currentColor</code> and need no inversion.
        </p>
      </div>

      {/* ─── Usage checklist ─── */}
      <div className="mb-6 rounded-2xl border p-5" style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-stroke-outline)' }}>
        <div className="type-body-emphasized text-text-primary mb-2">Foundation usage checklist</div>
        <ul className="list-disc pl-5 type-detail text-text-primary space-y-1">
          <li>Colors: use <code className="text-[12px] font-mono">text-text-*</code> / <code className="text-[12px] font-mono">bg-bg-*</code> / <code className="text-[12px] font-mono">border-stroke-outline</code>, or <code className="text-[12px] font-mono">var(--color-*)</code> inline. Never a raw hex.</li>
          <li>Typography: one of <code className="text-[12px] font-mono">type-title</code>, <code className="text-[12px] font-mono">type-body</code>, <code className="text-[12px] font-mono">type-body-emphasized</code>, <code className="text-[12px] font-mono">type-detail</code>, <code className="text-[12px] font-mono">type-detail-emphasized</code>.</li>
          <li>Spacing: Tailwind scale (<code className="text-[12px] font-mono">p-*, gap-*, mt-*</code>). No arbitrary <code className="text-[12px] font-mono">gap-[9px]</code>.</li>
          <li>Radius: <code className="text-[12px] font-mono">rounded-lg</code> for cards, <code className="text-[12px] font-mono">rounded-full</code> for pills, <code className="text-[12px] font-mono">rounded-[40px]</code> for the app shell.</li>
          <li>Icons: <code className="text-[12px] font-mono">lucide-react</code> only.</li>
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
        <span className="text-[16px] font-bold text-text-primary">{name}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-4 pt-3 border-t border-stroke-outline">
        <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Used by</div>
        <div className="flex flex-wrap gap-2">
          {pagesUsing.map(p => (
            <span key={p} className="text-[12px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">{p}</span>
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
      <LayoutCard name="PageLayout" pagesUsing={['OverviewPage', 'LibraryPage', 'ConnectorsPage', 'DesignSystemPage', 'Onboarding', 'ProjectPage', 'ComingSoonPage']}>
        <p className="text-[13px] text-text-primary leading-[20px] mb-3">
          Canonical page shell. Toggle bar + H1 + optional filters + scrollable body. Edit the spec in <code className="text-[12px] font-mono px-1 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>shared.tsx</code> once — every page updates.
        </p>
        <div className="rounded-lg border border-stroke-outline overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
          <div className="p-5">
            <div className="rounded border border-dashed border-stroke-outline flex items-center px-3" style={{ height: 40, background: 'var(--color-bg-page)' }}>
              <span className="text-[11px] font-mono text-text-secondary">Toggle bar · h-12</span>
            </div>
            <div className="mt-3 rounded border border-dashed border-stroke-outline px-4 py-3" style={{ background: 'var(--color-bg-page)' }}>
              <span className="text-[16px] font-bold text-text-primary">Page Title</span>
              <span className="ml-3 text-[11px] font-mono text-text-secondary">text-[40px] / 48 / 700</span>
            </div>
            <div className="mt-3 rounded border border-dashed border-stroke-outline flex items-center gap-2 px-3 py-2" style={{ background: 'var(--color-bg-page)' }}>
              <span className="px-3 py-1 rounded-full text-[11px] text-text-primary border border-stroke-outline">Filter A</span>
              <span className="px-3 py-1 rounded-full text-[11px] text-text-primary border border-stroke-outline">Filter B</span>
              <span className="ml-auto text-[11px] font-mono text-text-secondary">filters? (optional)</span>
            </div>
            <div className="mt-3 rounded border border-dashed border-stroke-outline flex items-center justify-center" style={{ background: 'var(--color-bg-page)', height: 100 }}>
              <span className="text-[12px] font-mono text-text-secondary">children · maxWidth: 'full' | 'reading' (863px)</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-text-primary mt-4">
          <div><strong>Toggle bar:</strong> h-12 (48px)</div>
          <div><strong>Horizontal pad:</strong> <code className="font-mono text-[12px]">px-4 sm:px-8</code></div>
          <div><strong>Title → filters:</strong> mt-6</div>
          <div><strong>Title/filters → content:</strong> mt-8</div>
          <div><strong>maxWidth 'full':</strong> no limit</div>
          <div><strong>maxWidth 'reading':</strong> 863px centered</div>
        </div>
      </LayoutCard>

      <LayoutCard name="HeaderBar" pagesUsing={['ChatPanel']}>
        <p className="text-[13px] text-text-primary leading-[20px] mb-3">
          Slim top bar — hamburger (when sidebar closed) + optional right slot. Used by pages that don't take PageLayout (mainly ChatPanel).
        </p>
        <div className="rounded-lg overflow-hidden border border-stroke-outline" style={{ background: 'var(--color-bg-page)' }}>
          <HeaderBar
            sidebarOpen={false}
            onToggleSidebar={() => {}}
            headerRight={<TertiaryButton>Panel</TertiaryButton>}
          />
        </div>
        <div className="text-[12px] text-text-primary leading-[18px] mt-3">
          <strong>Props:</strong> <code className="font-mono text-[12px]">sidebarOpen</code>, <code className="font-mono text-[12px]">onToggleSidebar</code>, <code className="font-mono text-[12px]">headerRight</code>
        </div>
      </LayoutCard>

      <LayoutCard name="SplitView" pagesUsing={['ProjectPage', 'LibraryPage (detail panel)']}>
        <p className="text-[13px] text-text-primary leading-[20px] mb-3">
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
                <p className="text-[12px] text-text-secondary">Side column content</p>
              </div>
            }
          >
            <div className="flex-1 p-4 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[13px] text-text-primary mb-2">Main column</p>
                {!sideOpen && (
                  <TertiaryButton onClick={() => setSideOpen(true)}>Open side panel</TertiaryButton>
                )}
              </div>
            </div>
          </SplitView>
        </div>
        <div className="text-[12px] text-text-primary leading-[18px]">
          <strong>Props:</strong> <code className="font-mono text-[12px]">side</code>, <code className="font-mono text-[12px]">sideOpen</code>, <code className="font-mono text-[12px]">onCloseSide</code>, <code className="font-mono text-[12px]">sideWidth</code>, <code className="font-mono text-[12px]">mainMinWidth</code>
        </div>
      </LayoutCard>

      <LayoutCard name="SidePanelHeader" pagesUsing={['ProjectPage side panel', 'TaskContextPanel', 'DetailPanel']}>
        <p className="text-[13px] text-text-primary leading-[20px] mb-3">
          Shared header row for any side panel. Unifies close-button size (40px rounded-xl), hover, and typography across every panel.
        </p>
        <div className="rounded-lg overflow-hidden border border-stroke-outline mb-3" style={{ background: 'var(--color-bg-page)' }}>
          <SidePanelHeader title="Panel title" onClose={() => {}} closeIcon="x" />
        </div>
        <div className="rounded-lg overflow-hidden border border-stroke-outline mb-3" style={{ background: 'var(--color-bg-page)' }}>
          <SidePanelHeader title="With panel-right toggle" onClose={() => {}} closeIcon="panel-right" />
        </div>
        <div className="text-[12px] text-text-primary leading-[18px]">
          <strong>Props:</strong> <code className="font-mono text-[12px]">title</code>, <code className="font-mono text-[12px]">onClose</code>, <code className="font-mono text-[12px]">closeIcon</code> ('x' | 'panel-right'), <code className="font-mono text-[12px]">closeLabel</code>
        </div>
      </LayoutCard>

      <LayoutCard name="SideCard" pagesUsing={['ProjectPage (Instructions/Scheduled/Files/Context)', 'TaskContextPanel']}>
        <p className="text-[13px] text-text-primary leading-[20px] mb-3">
          Collapsible card for right-column side panels. Header with title + optional icon + optional add affordance + chevron.
        </p>
        <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--color-bg-hover)' }}>
          <SideCard title="Instructions" defaultOpen>
            <p className="text-[13px] text-text-primary">Write guidance for how the assistant should act in this project.</p>
          </SideCard>
          <SideCard title="Scheduled" hasAdd>
            <p className="text-[13px] text-text-primary">Recurring briefings and workflows.</p>
          </SideCard>
          <SideCard title="Files">
            <p className="text-[13px] text-text-primary">Attached documents.</p>
          </SideCard>
        </div>
        <div className="text-[12px] text-text-primary leading-[18px] mt-3">
          <strong>Props:</strong> <code className="font-mono text-[12px]">title</code>, <code className="font-mono text-[12px]">icon</code>, <code className="font-mono text-[12px]">hasAdd</code>, <code className="font-mono text-[12px]">defaultOpen</code>
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
  { key: 'schedule', label: 'Schedule', card: { type: 'schedule', title: 'UX review w/ Maya', date: 'Thu Mar 14', time: '2:00 PM', attendees: ['Maya', 'Beibei', 'Jordan'], location: 'Zoom', status: 'pending', statusLabel: 'Pending' } },
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
  const [activeView, setActiveView]     = useState<'chat' | 'connectors' | 'design-system' | 'overview' | 'library'>('chat');
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
  const [activeView, setActiveView] = useState<'chat' | 'connectors' | 'design-system' | 'overview' | 'library'>('design-system');
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
        '**Attendees**\nMaya, Beibei, Jordan\n\n**Agenda**\n• Onboarding flow alignment\n• Review queue states\n• Foundations rollout\n\n**Decisions**\n• Ship Foundations tab first\n• Keep Review queue opt-in per new component\n• Document tokens in src/index.css'
      }
      onClose={() => {}}
    />
  );
}

function LiveTaskContextPanel() {
  return <TaskContextPanel onClose={() => {}} />;
}

function LiveNewProjectDialog() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <PrimaryButton onClick={() => setOpen(true)}>Open &ldquo;New Project&rdquo; dialog</PrimaryButton>
      <p className="text-[12px] text-text-secondary">Modal mounts into a portal and overlays the page.</p>
      <NewProjectDialog open={open} onClose={() => setOpen(false)} onCreate={() => setOpen(false)} />
    </div>
  );
}

function LiveOnboarding() {
  return (
    <Onboarding
      sidebarOpen={false}
      onToggleSidebar={() => {}}
      onComplete={() => {}}
    />
  );
}

function LiveOverviewPage() {
  return <OverviewPage sidebarOpen={false} onToggleSidebar={() => {}} />;
}

function LiveLibraryPage() {
  return <LibraryPage sidebarOpen={false} onToggleSidebar={() => {}} />;
}

function LiveConnectorsPage() {
  return <ConnectorsPage sidebarOpen={false} onToggleSidebar={() => {}} />;
}

function LiveComingSoonPage() {
  return <ComingSoonPage view="overview" sidebarOpen={false} onToggleSidebar={() => {}} />;
}

function LibraryEntry({ entry }: { entry: LibEntry }) {
  return (
    <div className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[14px] font-bold text-text-primary">{entry.name}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">shared.tsx</span>
      </div>
      <p className="text-[13px] text-text-primary leading-[18px] mb-3">{entry.description}</p>
      <div className="p-4 rounded-xl mb-3" style={{ background: 'var(--color-bg-hover)' }}>
        {entry.preview}
      </div>
      <div>
        <div className="text-[11px] font-semibold text-text-primary uppercase tracking-[0.5px] mb-2">Used in</div>
        <div className="flex flex-wrap gap-2">
          {entry.usedIn.map(page => (
            <span key={page} className="text-[12px] px-2 py-0.5 rounded-full border border-stroke-outline text-text-primary">{page}</span>
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
      description: 'Three-tier button system. Only ONE Primary per view. States: default, disabled, fullWidth.',
      usedIn: ['MessageCard (confirm / cancel)', 'InsightCard (actions)', 'Onboarding', 'Overview'],
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
      name: 'StatusTag',
      description: 'Semantic status pill. 7 variants. States: with/without icon, size md/sm.',
      usedIn: ['MessageCard', 'ConnectorsPage', 'Overview status rows'],
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
      description: 'Neutral pill with user icon + time. Used for review-time estimates.',
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
      description: 'Master filter chip. States: active, inactive, with icon, with count.',
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
      name: 'CircularProgress',
      description: 'SVG circle progress with stroke-dasharray + centered text overlay.',
      usedIn: ['Overview (score ring, health dimensions)'],
      preview: (
        <div className="flex items-center gap-6">
          <CircularProgress value={100} color="#3171ff"><span className="text-[16px] font-bold text-text-primary">4/4</span></CircularProgress>
          <CircularProgress value={65}  color="#3171ff"><span className="text-[16px] font-bold text-text-primary">65%</span></CircularProgress>
          <CircularProgress value={50}  color="#F59E0B"><span className="text-[16px] font-bold text-text-primary">50%</span></CircularProgress>
          <CircularProgress value={30}  color="#EF4444"><span className="text-[16px] font-bold text-text-primary">30%</span></CircularProgress>
        </div>
      ),
    },
    {
      name: 'ProgressBar',
      description: 'Determinate progress bar. States: with/without label.',
      usedIn: ['Overview', 'TaskProgressCard'],
      preview: (
        <div className="flex flex-col gap-3">
          <ProgressBar value={62} showLabel />
          <ProgressBar value={35} />
        </div>
      ),
    },
    {
      name: 'LabeledBar',
      description: 'Thin bar with label + percentage. Custom color per category.',
      usedIn: ['Overview stress / workload rows'],
      preview: (
        <div>
          <LabeledBar label="Deadline pressure" pct={35} color="#EF4444" />
          <LabeledBar label="Keeping up with AI" pct={28} color="#F59E0B" />
          <LabeledBar label="Cross-team alignment" pct={22} color="#7652B9" />
        </div>
      ),
    },
    {
      name: 'StepIndicator',
      description: 'Three states: done (check), in-progress (filled dot), pending (empty circle).',
      usedIn: ['TaskProgressCard steps'],
      preview: (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2"><StepIndicator status="done" /><span className="text-[12px] text-text-primary">Done</span></div>
          <div className="flex items-center gap-2"><StepIndicator status="in-progress" /><span className="text-[12px] text-text-primary">In progress</span></div>
          <div className="flex items-center gap-2"><StepIndicator status="pending" /><span className="text-[12px] text-text-primary">Pending</span></div>
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
      usedIn: ['Overview insights block'],
      preview: (
        <InsightCard body="Your focus time dropped 40% this week. Want me to protect morning blocks?" actions={[{ label: 'Yes, protect mornings', primary: true }, { label: 'Show data' }]} />
      ),
    },
    {
      name: 'AreaChart',
      description: 'SVG area chart with gradient fill, data points, and labels.',
      usedIn: ['Overview trend chart'],
      preview: (
        <AreaChart data={[{ label: 'M', value: 85 }, { label: 'T', value: 72 }, { label: 'W', value: 65 }, { label: 'T', value: 78 }, { label: 'F', value: 60 }, { label: 'S', value: 90 }]} color="#3171ff" height={70} gradientId="libAreaGrad" />
      ),
    },
    {
      name: 'TaskProgressCard',
      description: 'Clickable card with progress bar. Expands to show step list.',
      usedIn: ['Overview "Maya is working on" section'],
      preview: (
        <TaskProgressCard title="Analyzing Q2 metrics" progress={62} eta="~8 min" steps={['Pulling data from Sheets', 'Building charts', 'Formatting']} expanded />
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
      usedIn: ['Overview health dimensions'],
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
      usedIn: ['Overview suggested solutions'],
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
          <SharedSectionTitle emoji="⚡" title="Maya is Working On" />
        </div>
      ),
    },
    {
      name: 'SearchBox',
      description: 'Responsive search input. Desktop: expanded pill. Mobile: icon-only that expands on tap.',
      usedIn: ['Library', 'Connectors', 'ProjectPage'],
      preview: <SearchBoxDemo />,
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
      description: 'Text composer with mode selector (Chat / Tasks / Code), voice input, and attachments. Real component; foundations updates propagate on reload.',
      usedIn: ['ChatPanel', 'Onboarding (chatOnly)'],
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
              <div className="text-[11px] uppercase font-semibold tracking-[0.5px] text-text-secondary mb-1">{c.label}</div>
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
      description: 'Progress steps + folder / context / tools file lists. Shows what WorkPal is doing for a task in flight.',
      usedIn: ['ChatPanel (Tasks mode)'],
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
  ];

  /* ─── Pages — live ─── */
  const pageEntries: LibEntry[] = [
    {
      name: 'OverviewPage',
      description: 'Morning briefing dashboard: health index ring, stress analysis, insight card, tasks-in-progress, impact metrics. Rendered live below.',
      usedIn: ['App (Overview view)'],
      preview: (
        <LivePreviewFrame height={640}>
          <LiveOverviewPage />
        </LivePreviewFrame>
      ),
    },
    {
      name: 'LibraryPage',
      description: 'Masonry grid of AI-generated artifacts with filter chips and search. Real component.',
      usedIn: ['App (Library view)'],
      preview: (
        <LivePreviewFrame height={640}>
          <LiveLibraryPage />
        </LivePreviewFrame>
      ),
    },
    {
      name: 'ConnectorsPage',
      description: 'Connector directory split into Recommended / Apps / APIs. Uses SearchBox + FilterChip + StatusTag from shared.',
      usedIn: ['App (Connectors view)'],
      preview: (
        <LivePreviewFrame height={640}>
          <LiveConnectorsPage />
        </LivePreviewFrame>
      ),
    },
    {
      name: 'Onboarding',
      description: 'First-time drag-and-drop trait selector. Uses PageLayout (reading width) + ChatInput as the footer.',
      usedIn: ['App (before first chat)'],
      preview: (
        <LivePreviewFrame height={640}>
          <LiveOnboarding />
        </LivePreviewFrame>
      ),
    },
    {
      name: 'ComingSoonPage',
      description: 'Placeholder with video + coming-soon message. Used when a planned surface isn\'t ready yet.',
      usedIn: ['App (as Overview / Library fallback during rollout)'],
      preview: (
        <LivePreviewFrame height={520}>
          <LiveComingSoonPage />
        </LivePreviewFrame>
      ),
    },
  ];

  return (
    <div>
      <p className="text-[13px] text-text-primary leading-[20px] mb-5">
        All components below are <strong>rendered live</strong> from the real WorkPal codebase — not screenshots or mocks.
        Foundations changes (colors, typography, spacing, radius) propagate here automatically. Shared primitives live in
        <code className="text-[12px] font-mono px-1.5 py-0.5 rounded mx-1" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-blue)' }}>src/components/shared.tsx</code>;
        feature components (chat, panels, pages) live next to them in
        <code className="text-[12px] font-mono px-1.5 py-0.5 rounded mx-1" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-blue)' }}>src/components/*</code>.
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

      <SectionTitle id="ds-lib-pages">Pages</SectionTitle>
      <div className="flex flex-col gap-4 mb-8">
        {pageEntries.map(e => <LibraryEntry key={e.name} entry={e} />)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Tab 4 — Review Queue
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

function ReviewTab() {
  const [items, setItems] = useState<ReviewItem[]>([
    // Seed the queue empty. This array gets new entries whenever the assistant
    // has to build a brand-new shared component instead of reusing an existing one.
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
          <span className="text-[16px]">🧪</span>
          <span className="text-[16px] font-bold text-text-primary">How the review queue works</span>
        </div>
        <ol className="list-decimal pl-5 text-[13px] text-text-primary leading-[22px] space-y-1">
          <li>When building a feature, I always check the <strong>Component Library</strong> first.</li>
          <li>Whenever possible, I reuse an existing shared component.</li>
          <li>If nothing fits, I build a new component and <strong>add it here</strong> so you can review.</li>
          <li>You <strong>Approve</strong> (promote to <code className="font-mono text-[12px] px-1 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>shared.tsx</code> permanently) or <strong>Reject</strong> (I remove it and switch back to the closest existing component).</li>
        </ol>
      </div>

      {/* Pending */}
      <SharedSectionTitle emoji="⏳" title="Pending review" count={pending.length} />
      {pending.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-stroke-outline p-8 text-center" style={{ background: 'var(--color-bg-page)' }}>
          <p className="text-[14px] text-text-primary mb-1">No components awaiting review</p>
          <p className="text-[13px] text-text-secondary leading-[20px]">When I build something new that isn't in the library yet, it will show up here for your approval.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {pending.map(item => (
            <div key={item.id} className="rounded-2xl border border-stroke-outline p-5" style={{ background: 'var(--color-bg-page)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-bold text-text-primary">{item.name}</span>
                <StatusTag variant="in-review" label="Pending review" size="sm" />
              </div>
              <p className="text-[13px] text-text-primary leading-[20px] mb-1"><strong>Built for:</strong> {item.builtFor}</p>
              <p className="text-[13px] text-text-primary leading-[20px] mb-1"><strong>Reason new component was needed:</strong> {item.reason}</p>
              <p className="text-[13px] text-text-primary leading-[20px] mb-3"><strong>Closest existing component:</strong> {item.closestExisting}</p>
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
                <span className="text-[14px] font-bold text-text-primary">{item.name}</span>
                <span className="text-[12px] text-text-secondary flex-1">{item.builtFor}</span>
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
                <span className="text-[14px] font-bold text-text-primary">{item.name}</span>
                <span className="text-[12px] text-text-secondary flex-1">Switched back to: {item.closestExisting}</span>
                <TertiaryButton onClick={() => setStatus(item.id, 'pending')}>Move back to pending</TertiaryButton>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
