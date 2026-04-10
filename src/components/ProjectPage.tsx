import { useState, useEffect, useSyncExternalStore } from 'react';
import { Project } from './Sidebar';
import ChatInput from './ChatInput';
import {
  ChevronDown, ChevronRight, Star, MoreVertical, Plus, PanelRight, X,
  FileCode2, MessageCircle, CheckSquare, Code2, Pen, File,
  MonitorPlay, Presentation,
} from 'lucide-react';

/** Breakpoint: right panel hides when viewport < this */
const PANEL_BREAKPOINT = 700;
const subscribeResize = (cb: () => void) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); };
const getIsNarrow = () => window.innerWidth < PANEL_BREAKPOINT;

interface ProjectPageProps {
  project: Project;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
}

/* ── Right-column collapsible card ── */
function SideCard({
  title,
  icon,
  hasAdd = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  hasAdd?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-stroke-outline rounded-2xl overflow-hidden bg-white dark:bg-[#1a1f2e]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 w-full px-5 py-4 text-left hover:bg-bg-hover transition-colors"
      >
        <span className="flex-1 text-[15px] font-semibold text-text-primary">{title}</span>
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
      {open && (
        <div className="px-5 pb-5 text-[14px] leading-relaxed text-text-secondary">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Demo data ── */
type OutputType = 'All' | 'Web' | 'Slides' | 'Image' | 'Video';

interface OutputItem {
  id: string;
  name: string;
  icon: typeof FileCode2;
  type: OutputType;
}

const DEMO_OUTPUTS: OutputItem[] = [
  { id: '1', name: 'Agent Design Component', icon: FileCode2, type: 'Web' },
  { id: '2', name: 'AI Product Info Architecture', icon: FileCode2, type: 'Web' },
  { id: '3', name: 'Agent UIUX Research', icon: MonitorPlay, type: 'Video' },
  { id: '4', name: 'Agent UIUX Research', icon: Presentation, type: 'Slides' },
  { id: '5', name: 'competitive analysis', icon: FileCode2, type: 'Web' },
];

const OUTPUT_FILTERS: OutputType[] = ['All', 'Web', 'Slides', 'Image', 'Video'];

type RecentType = 'Chat' | 'Task' | 'Code';

const DEMO_RECENTS: { id: string; title: string; description: string; time: string; outputTag?: string; type: RecentType }[] = [
  {
    id: '1',
    title: 'Compare UX architecture of four AI tools',
    description: 'Analyzed Grok, ChatGPT, Claude and Gemini UX patterns for navigation, onbo',
    time: '5 hour ago',
    outputTag: 'Agent Design Component Library',
    type: 'Chat',
  },
  {
    id: '2',
    title: 'Find AI product interface screenshots',
    description: 'Collected product screenshots for AI information architecture flow diagram ar',
    time: '18hour ago',
    outputTag: 'AI product info flow',
    type: 'Task',
  },
  {
    id: '3',
    title: 'Refactor agent response parser module',
    description: 'Restructured the streaming response handler to support multi-turn agent conversations and tool calls...',
    time: '1 day ago',
    type: 'Code',
  },
  {
    id: '4',
    title: 'Build component variant matrix for agent cards',
    description: 'Created a reusable matrix of agent card variants covering status, size, and interaction states...',
    time: '1 day ago',
    outputTag: 'Agent Design Component Library',
    type: 'Task',
  },
  {
    id: '5',
    title: 'Fix streaming indicator z-index in chat panel',
    description: 'Resolved layering issue where the typing indicator overlapped the action chip bar during long responses...',
    time: '2 days ago',
    type: 'Code',
  },
  {
    id: '6',
    title: 'Summarize competitive analysis of AI agent UIs',
    description: 'Reviewed interaction patterns across 6 AI agent products including reasoning visibility and tool use flows...',
    time: '3 days ago',
    outputTag: 'competitive analysis',
    type: 'Chat',
  },
  {
    id: '7',
    title: 'Implement dark mode token mapping for agent cards',
    description: 'Added CSS variable overrides and Tailwind config for all agent card components in dark theme...',
    time: '4 days ago',
    type: 'Code',
  },
];

const TYPE_ICON: Record<RecentType, typeof MessageCircle> = {
  Chat: MessageCircle,
  Task: CheckSquare,
  Code: Code2,
};

const FILTER_OPTIONS = ['All', 'Chat', 'Task', 'Code'] as const;

export default function ProjectPage({ project, sidebarOpen, onToggleSidebar }: ProjectPageProps) {
  const [recentsFilter, setRecentsFilter] = useState<string>('All');
  const [outputFilter, setOutputFilter] = useState<OutputType>('All');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('2');
  const [outputOpen, setOutputOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const isNarrow = useSyncExternalStore(subscribeResize, getIsNarrow);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);

  // Switch to overlay mode when going narrow, keep panel state when going wide
  useEffect(() => {
    if (isNarrow) setInfoPanelOpen(false);
  }, [isNarrow]);

  const filteredRecents = recentsFilter === 'All'
    ? DEMO_RECENTS
    : DEMO_RECENTS.filter(r => r.type === recentsFilter);

  const filteredOutputs = outputFilter === 'All'
    ? DEMO_OUTPUTS
    : DEMO_OUTPUTS.filter(o => o.type === outputFilter);

  const showPanel = infoPanelOpen;

  return (
    <div className="flex flex-col h-full flex-1 min-w-0 app-bg relative">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <div>
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
            >
              <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
                <rect width="22" height="2" rx="1" fill="currentColor" />
                <rect width="15" height="2" rx="1" y="7" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInfoPanelOpen(o => !o)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
          >
            <PanelRight size={20} />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex min-h-0">

        {/* ════ Left column ════ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-8 pb-4 scrollbar-autohide scrollbar-offset" style={{ minWidth: 0 }}>
            <div className="flex flex-col gap-6 max-w-[863px] mx-auto">

              {/* Project title row */}
              <div className="flex items-center justify-between">
                <h1 className="text-[40px] font-bold text-text-primary leading-[48px] tracking-[-0.5px]">
                  {project.name}
                </h1>
                <div className="flex items-center gap-6 shrink-0">
                  <button className="flex items-center justify-center text-text-primary transition-colors">
                    <Star size={16} />
                  </button>
                  <button className="flex items-center justify-center text-text-primary transition-colors">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Output section */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setOutputOpen(o => !o)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-[16px] font-semibold text-text-primary">Output</h3>
                  <ChevronDown
                    size={16}
                    className={`text-text-primary transition-transform ${outputOpen ? '' : '-rotate-90'}`}
                  />
                </button>

                {outputOpen && (
                  <>
                    {/* Output filter chips */}
                    <div className="flex gap-2">
                      {OUTPUT_FILTERS.map(filter => {
                        const isActive = outputFilter === filter;
                        return (
                          <button
                            key={filter}
                            onClick={() => setOutputFilter(filter)}
                            className={`px-3 py-1 rounded-full text-[14px] leading-[22px] transition-colors cursor-pointer ${
                              isActive
                                ? 'border border-transparent font-medium'
                                : 'chip-gradient-hover border border-stroke-outline text-text-primary'
                            }`}
                            style={isActive ? {
                              background: 'rgba(49,113,255,0.1)',
                              color: '#3171ff',
                            } : undefined}
                          >
                            {filter}
                          </button>
                        );
                      })}
                    </div>

                    {/* Output cards */}
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {filteredOutputs.map(o => {
                        const Icon = o.icon;
                        const isSelected = selectedOutputId === o.id;
                        return (
                          <button
                            key={o.id}
                            onClick={() => setSelectedOutputId(o.id)}
                            className={`flex flex-col items-center gap-2 min-w-[120px] w-[120px] p-2 rounded-lg border transition-colors ${
                              isSelected
                                ? 'border-[#3171ff] bg-[rgba(49,113,255,0.06)]'
                                : 'border-stroke-outline bg-white dark:bg-[#1a1f2e] hover:bg-bg-hover'
                            }`}
                          >
                            <Icon
                              size={32}
                              className={isSelected ? 'text-[#3171ff]' : 'text-text-secondary/40 dark:text-white'}
                              strokeWidth={1.2}
                            />
                            <span className="text-[14px] text-text-primary text-center leading-[1.2] line-clamp-2 w-full">
                              {o.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Recents section */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setRecentsOpen(o => !o)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-[16px] font-semibold text-text-primary">Recents</h3>
                  <ChevronDown
                    size={16}
                    className={`text-text-primary transition-transform ${recentsOpen ? '' : '-rotate-90'}`}
                  />
                </button>

                {recentsOpen && (
                  <>
                    {/* Recents filter chips */}
                    <div className="flex gap-2">
                      {FILTER_OPTIONS.map(filter => {
                        const isActive = recentsFilter === filter;
                        return (
                          <button
                            key={filter}
                            onClick={() => setRecentsFilter(filter)}
                            className={`px-3 py-1 rounded-full text-[14px] leading-[22px] transition-colors cursor-pointer ${
                              isActive
                                ? 'border border-transparent font-medium'
                                : 'chip-gradient-hover border border-stroke-outline text-text-primary'
                            }`}
                            style={isActive ? {
                              background: 'rgba(49,113,255,0.1)',
                              color: '#3171ff',
                            } : undefined}
                          >
                            {filter}
                          </button>
                        );
                      })}
                    </div>

                    {/* Recent items */}
                    <div className="flex flex-col gap-3">
                      {filteredRecents.map(r => {
                        const Icon = TYPE_ICON[r.type];
                        return (
                          <button
                            key={r.id}
                            className="flex items-start gap-3 w-full px-5 py-4 rounded-2xl border border-stroke-outline bg-white dark:bg-[#1a1f2e] hover:bg-bg-hover transition-colors text-left"
                          >
                            <div className="flex items-center justify-center shrink-0 mt-px text-text-primary">
                              <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[15px] font-semibold text-text-primary truncate">{r.title}</span>
                                <span className="text-[13px] text-text-primary whitespace-nowrap shrink-0">{r.time}</span>
                              </div>
                              <p className="text-[13px] text-text-primary leading-relaxed line-clamp-1">{r.description}</p>
                              {r.outputTag && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stroke-outline text-[12px] text-text-primary">
                                    <FileCode2 size={12} />
                                    {r.outputTag}
                                  </span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom input area — pinned to bottom */}
          <div className="px-8 pb-6 pt-2 max-w-[863px] mx-auto w-full">
            <ChatInput
              onSend={() => {}}
              placeholder="What would you like to work on in this project?"
            />
          </div>
        </div>

        {/* ════ Right column ════ */}
        {/* Narrow: slide-over overlay panel */}
        {isNarrow && infoPanelOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30"
            onClick={() => setInfoPanelOpen(false)}
          />
        )}
        {showPanel && (
          <div
            className={
              isNarrow
                ? 'fixed inset-0 z-30 overflow-y-auto pb-8 pt-4 px-5 scrollbar-autohide app-bg'
                : 'w-[280px] shrink-0 overflow-y-auto pb-8 pt-2 pr-6 scrollbar-autohide'
            }
          >
            {/* Close button in overlay mode */}
            {isNarrow && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setInfoPanelOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="flex flex-col gap-4">

              {/* Instructions */}
              <SideCard title="Instructions" icon={<Pen size={14} />} defaultOpen>
                <div className="flex flex-col gap-2">
                  <p className="text-[14px] text-text-primary leading-relaxed">
                    <strong>Project Name: </strong>{project.name}
                  </p>
                  <p className="text-[14px] text-text-primary leading-relaxed">
                    <strong>Project Objective: </strong>To study and track the evolution of interface design norms and interaction patterns of mainstream AI products.
                  </p>
                </div>
              </SideCard>

              {/* Scheduled */}
              <SideCard title="Scheduled" hasAdd defaultOpen={false}>
                <p className="text-text-secondary/60 italic text-[13px]">Set up recurring tasks for this project.</p>
              </SideCard>

              {/* Files */}
              <SideCard title="Files" defaultOpen>
                <div className="flex flex-col gap-1">
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors">
                    <File size={16} className="text-text-primary shrink-0" />
                    <span className="text-[14px] text-text-primary">Instructions.md</span>
                  </button>
                </div>
              </SideCard>

              {/* Context */}
              <SideCard title="Context" defaultOpen>
                <div className="flex flex-col gap-1">
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors group">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary shrink-0">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-[14px] text-text-primary flex-1 text-left">{project.name}</span>
                    <ChevronRight size={14} className="text-text-primary shrink-0" />
                  </button>
                </div>
              </SideCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
