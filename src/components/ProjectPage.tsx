import { useState, useEffect, useSyncExternalStore } from 'react';
import { Project } from './Sidebar';
import ChatInput from './ChatInput';
import {
  ChevronDown, ChevronRight, Star, MoreVertical, Plus, PanelRight, X,
  FileCode2, MessageCircle, CheckSquare, Code2, Pen, FolderOpen,
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
        {hasAdd && (
          <span className="text-text-secondary hover:text-text-primary" onClick={e => { e.stopPropagation(); }}>
            <Plus size={18} />
          </span>
        )}
        <span className="text-text-secondary">{icon ?? null}</span>
        <ChevronDown
          size={16}
          className={`text-text-secondary transition-transform ${open ? '' : '-rotate-90'}`}
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
const DEMO_OUTPUTS = [
  { id: '1', name: 'AI UX comparison' },
  { id: '2', name: 'AI product info flow' },
  { id: '3', name: 'Agent design guide' },
];

type RecentType = 'Chat' | 'Task' | 'Code';

const DEMO_RECENTS: { id: string; title: string; description: string; time: string; outputTag?: string; type: RecentType }[] = [
  {
    id: '1',
    title: 'Compare UX architecture of four AI tools',
    description: 'Analyzed Grok, ChatGPT, Claude, and Gemini UX patterns for navigation, onboarding, and feature discovery...',
    time: '5 hours ago',
    outputTag: 'AI UX comparison',
    type: 'Chat',
  },
  {
    id: '2',
    title: 'Find AI product interface screenshots',
    description: 'Collected product screenshots for AI information architecture flow diagram and added references...',
    time: '18 hours ago',
    outputTag: 'AI product info flow',
    type: 'Task',
  },
  {
    id: '3',
    title: 'Create illustration for ID scanning flow',
    description: 'Assigned to Kai, due Thursday April 10. Includes step-by-step driver ID verification mockups...',
    time: '1 day ago',
    type: 'Task',
  },
  {
    id: '4',
    title: 'Refactor auth middleware for compliance',
    description: 'Updated session token storage to meet new legal requirements. Removed deprecated cookie-based approach...',
    time: '2 days ago',
    type: 'Code',
  },
  {
    id: '5',
    title: 'Fix age verification API timeout handling',
    description: 'Added retry logic and fallback flow for when the ID scanning service is unreachable during peak hours...',
    time: '2 days ago',
    type: 'Code',
  },
  {
    id: '6',
    title: 'Summarize alcohol delivery compliance research',
    description: 'Reviewed legal requirements across 12 states for last-mile alcohol delivery platforms and driver permits...',
    time: '3 days ago',
    outputTag: 'Agent design guide',
    type: 'Chat',
  },
  {
    id: '7',
    title: 'Draft onboarding flow copy for new drivers',
    description: 'Wrote UX copy for the 5-step driver onboarding wizard including ID upload, training, and certification...',
    time: '4 days ago',
    type: 'Chat',
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
  const isNarrow = useSyncExternalStore(subscribeResize, getIsNarrow);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  // Close panel overlay when switching to wide layout
  useEffect(() => {
    if (!isNarrow) setInfoPanelOpen(false);
  }, [isNarrow]);

  const filteredRecents = recentsFilter === 'All'
    ? DEMO_RECENTS
    : DEMO_RECENTS.filter(r => r.type === recentsFilter);

  const showPanel = isNarrow ? infoPanelOpen : true;

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
        {/* Toggle info panel button — only in narrow mode */}
        {isNarrow && (
          <button
            onClick={() => setInfoPanelOpen(o => !o)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-secondary"
          >
            <PanelRight size={20} />
          </button>
        )}
      </div>

      {/* Two-column layout — each column scrolls independently */}
      <div className="flex-1 flex gap-6 px-8 min-h-0 max-w-[1200px]">

        {/* ════ Left column (scrollable) ════ */}
        <div className="flex-1 overflow-y-auto pb-8 scrollbar-autohide scrollbar-offset" style={{ minWidth: 0 }}>
          <div className="flex flex-col gap-6">

            {/* Project title row */}
            <div className="flex items-center gap-3">
              <h1 className="text-[32px] font-semibold text-text-primary leading-tight tracking-[-0.5px] flex-1">
                {project.name}
              </h1>
              <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors text-text-secondary">
                <Star size={20} />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors text-text-secondary">
                <MoreVertical size={20} />
              </button>
            </div>

            {/* Input — reuses the shared ChatInput component */}
            <ChatInput
              onSend={() => {}}
              placeholder="What would you like to work on in this project?"
            />

            {/* Outputs section */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-semibold text-text-primary">Outputs</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {DEMO_OUTPUTS.map(o => (
                  <button
                    key={o.id}
                    className="flex flex-col items-center gap-3 min-w-[140px] w-[140px] p-4 rounded-2xl border border-stroke-outline bg-white dark:bg-[#1a1f2e] hover:bg-bg-hover transition-colors"
                  >
                    <FileCode2 size={32} className="text-text-secondary/40 dark:text-white" strokeWidth={1.2} />
                    <span className="text-[13px] text-text-primary text-center leading-tight line-clamp-2">
                      {o.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recents section */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-semibold text-text-primary">Recents</h3>
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
              <div className="flex flex-col gap-3">
                {filteredRecents.map(r => {
                  const Icon = TYPE_ICON[r.type];
                  return (
                    <button
                      key={r.id}
                      className="flex items-start gap-4 w-full p-5 rounded-2xl border border-stroke-outline bg-white dark:bg-[#1a1f2e] hover:bg-bg-hover transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={18} className="text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[15px] font-semibold text-text-primary truncate">{r.title}</span>
                          <span className="text-[13px] text-text-secondary whitespace-nowrap shrink-0">{r.time}</span>
                        </div>
                        <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-1">{r.description}</p>
                        {r.outputTag && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stroke-outline text-[12px] text-text-secondary">
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
            </div>
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
                : 'w-[340px] shrink-0 overflow-y-auto pb-8 pt-[52px] scrollbar-autohide'
            }
          >
            {/* Close button in overlay mode */}
            {isNarrow && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setInfoPanelOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-secondary"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="flex flex-col gap-4">

            {/* Instructions */}
            <SideCard title="Instructions" icon={<Pen size={16} />} defaultOpen>
              <div className="flex flex-col gap-2">
                <p className="text-[14px] text-text-primary leading-relaxed">
                  <strong>Project: </strong>{project.name}<br />
                  <strong>Goal: </strong>Research and track AI product interface design patterns and interaction paradigms.
                </p>
                <p className="text-[14px] text-text-primary leading-relaxed">
                  <strong>Requirements:</strong><br />
                  Include product screenshots with every analysis point. Screenshot sources include but are not limited to direct captures and reference materials.
                </p>
                <button className="text-[13px] text-text-secondary hover:text-text-primary mt-1 text-left w-fit">
                  Show more
                </button>
              </div>
            </SideCard>

            {/* Scheduled */}
            <SideCard title="Scheduled" hasAdd defaultOpen={false}>
              <p className="text-text-secondary/60 italic text-[13px]">Set up recurring tasks for this project.</p>
            </SideCard>

            {/* Context */}
            <SideCard title="Context" hasAdd defaultOpen>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-text-primary mb-2">On your computer</p>
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors">
                    <ChevronRight size={14} className="text-text-secondary" />
                    <FolderOpen size={16} className="text-text-secondary" />
                    <span className="text-[14px] text-text-primary">{project.name}</span>
                  </button>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-text-primary mb-2">Memory</p>
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors">
                    <ChevronRight size={14} className="text-text-secondary" />
                    <MessageCircle size={16} className="text-text-secondary" />
                    <span className="text-[14px] text-text-primary">Memory</span>
                  </button>
                </div>
              </div>
            </SideCard>
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
