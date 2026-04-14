import { useState, useEffect } from 'react';
import { Project } from './Sidebar';
import ChatInput from './ChatInput';
import {
  ChevronDown, ChevronRight, Star, MoreVertical, PanelRight,
  FileCode2, MessageCircle, CheckSquare, Code2, Pen, File,
  MonitorPlay, Presentation,
} from 'lucide-react';
import { FilterChip, PageLayout, SearchBox, SideCard, SidePanelHeader, SplitView } from './shared';

interface ProjectPageProps {
  project: Project;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
}

/* ── Demo data ── */
type OutputType = 'All' | 'Web' | 'Slides' | 'Image' | 'Video';

interface OutputItem {
  id: string;
  name: string;
  icon: typeof FileCode2;
  type: OutputType;
}

const OUTPUT_FILTERS: OutputType[] = ['All', 'Web', 'Slides', 'Image', 'Video'];

type RecentType = 'Chat' | 'Task' | 'Code';

interface RecentItem {
  id: string;
  title: string;
  description: string;
  time: string;
  outputTag?: string;
  type: RecentType;
}

interface ProjectFile {
  name: string;
}

interface ProjectContent {
  objective: string;
  outputs: OutputItem[];
  recents: RecentItem[];
  files: ProjectFile[];
  contextLabel: string;
  defaultSelectedOutputId: string;
}

const PROJECT_CONTENT: Record<string, ProjectContent> = {
  'proj-1': {
    objective: 'To study and track the evolution of interface design norms and interaction patterns of mainstream AI products.',
    outputs: [
      { id: '1', name: 'Agent Design Component', icon: FileCode2, type: 'Web' },
      { id: '2', name: 'AI Product Info Architecture', icon: FileCode2, type: 'Web' },
      { id: '3', name: 'Agent UIUX Research', icon: MonitorPlay, type: 'Video' },
      { id: '4', name: 'Agent UIUX Research', icon: Presentation, type: 'Slides' },
      { id: '5', name: 'competitive analysis', icon: FileCode2, type: 'Web' },
    ],
    recents: [
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
    ],
    files: [
      { name: 'Instructions.md' },
    ],
    contextLabel: 'Agent Design',
    defaultSelectedOutputId: '2',
  },
  'proj-2': {
    objective: 'To redesign the Spark driver onboarding flow and reduce time-to-first-delivery, addressing the 38% drop-off observed in the current 7-step signup process.',
    outputs: [
      { id: '1', name: 'New Driver Landing Page', icon: FileCode2, type: 'Web' },
      { id: '2', name: 'Onboarding Flow Wireframes', icon: Presentation, type: 'Slides' },
      { id: '3', name: 'Driver Persona Deck', icon: Presentation, type: 'Slides' },
      { id: '4', name: 'Tutorial Walkthrough Demo', icon: MonitorPlay, type: 'Video' },
      { id: '5', name: 'Vehicle Verification Step', icon: FileCode2, type: 'Web' },
    ],
    recents: [
      {
        id: '1',
        title: 'Map current driver onboarding journey',
        description: 'Documented all 7 steps in the existing Spark driver signup, from app download to first scheduled shift...',
        time: '3 hour ago',
        outputTag: 'Onboarding Flow Wireframes',
        type: 'Chat',
      },
      {
        id: '2',
        title: 'Audit drop-off rates by step',
        description: 'Pulled funnel metrics from Amplitude for the past 90 days and flagged the vehicle verification step as the biggest leak...',
        time: '12 hour ago',
        outputTag: 'Driver Persona Deck',
        type: 'Task',
      },
      {
        id: '3',
        title: 'Implement progressive disclosure for tutorial screens',
        description: 'Refactored the tutorial carousel to lazy-load step content and remember progress across app sessions...',
        time: '1 day ago',
        type: 'Code',
      },
      {
        id: '4',
        title: 'Synthesize 12 driver interview transcripts',
        description: 'Coded interview notes from new and lapsed drivers to identify the top friction points in the current flow...',
        time: '2 days ago',
        outputTag: 'Driver Persona Deck',
        type: 'Chat',
      },
      {
        id: '5',
        title: 'Build form validation for vehicle info step',
        description: 'Added inline validation, license-plate format checks, and real-time error states for the vehicle entry screen...',
        time: '2 days ago',
        type: 'Code',
      },
      {
        id: '6',
        title: 'Draft welcome email sequence for new drivers',
        description: 'Wrote a 5-email drip covering first delivery tips, payout setup, and support channels for newly approved drivers...',
        time: '3 days ago',
        outputTag: 'New Driver Landing Page',
        type: 'Task',
      },
      {
        id: '7',
        title: 'Compare onboarding flows of Uber, DoorDash, Instacart',
        description: 'Captured screen recordings of competitor signup journeys and benchmarked step counts, time-to-complete, and verification UX...',
        time: '4 days ago',
        outputTag: 'Onboarding Flow Wireframes',
        type: 'Chat',
      },
    ],
    files: [
      { name: 'Driver_Onboarding_Brief.pdf' },
      { name: 'Current_Flow_Audit.md' },
      { name: 'Interview_Transcripts.zip' },
    ],
    contextLabel: 'Spark Driver Research',
    defaultSelectedOutputId: '2',
  },
};

const FALLBACK_CONTENT = PROJECT_CONTENT['proj-1'];

const TYPE_ICON: Record<RecentType, typeof MessageCircle> = {
  Chat: MessageCircle,
  Task: CheckSquare,
  Code: Code2,
};

const FILTER_OPTIONS = ['All', 'Chat', 'Task', 'Code'] as const;

export default function ProjectPage({ project, sidebarOpen, onToggleSidebar }: ProjectPageProps) {
  const content = PROJECT_CONTENT[project.id] ?? FALLBACK_CONTENT;
  const [recentsFilter, setRecentsFilter] = useState<string>('All');
  const [outputFilter, setOutputFilter] = useState<OutputType>('All');
  const [selectedOutputId, setSelectedOutputId] = useState<string>(content.defaultSelectedOutputId);
  const [outputOpen, setOutputOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);

  // Reset selected output when switching projects
  useEffect(() => {
    setSelectedOutputId(content.defaultSelectedOutputId);
    setRecentsFilter('All');
    setOutputFilter('All');
    setSearch('');
  }, [project.id, content.defaultSelectedOutputId]);

  const q = search.trim().toLowerCase();
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q);

  const filteredRecents = content.recents.filter(r => {
    if (recentsFilter !== 'All' && r.type !== recentsFilter) return false;
    return matchesSearch(r.title) || matchesSearch(r.description) || matchesSearch(r.outputTag ?? '');
  });

  const filteredOutputs = content.outputs.filter(o => {
    if (outputFilter !== 'All' && o.type !== outputFilter) return false;
    return matchesSearch(o.name);
  });

  return (
    <SplitView
      sideOpen={infoPanelOpen}
      onCloseSide={() => setInfoPanelOpen(false)}
      sideWidth={280}
      bgClass="app-bg"
      side={({ overlay }) => (
        <div
          className={`flex flex-col h-full ${overlay ? 'w-[280px] max-w-full' : ''}`}
          style={overlay ? { background: 'var(--color-bg-page)' } : undefined}
        >
          <SidePanelHeader
            onClose={() => setInfoPanelOpen(false)}
            closeIcon="panel-right"
            closeLabel="Collapse panel"
            className={overlay ? 'px-5' : 'pr-6 pl-0'}
          />
          <div
            className={
              overlay
                ? 'flex-1 min-h-0 overflow-y-auto px-5 pb-8 scrollbar-autohide'
                : 'flex-1 min-h-0 overflow-y-auto pr-6 pb-8 scrollbar-autohide'
            }
          >
            <div className="flex flex-col gap-4">
            {/* Instructions */}
            <SideCard title="Instructions" icon={<Pen size={14} />} defaultOpen>
              <div className="flex flex-col gap-2">
                <p className="text-[14px] text-text-primary leading-relaxed">
                  <strong>Project Name: </strong>{project.name}
                </p>
                <p className="text-[14px] text-text-primary leading-relaxed">
                  <strong>Project Objective: </strong>{content.objective}
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
                {content.files.map(file => (
                  <button
                    key={file.name}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    <File size={16} className="text-text-primary shrink-0" />
                    <span className="text-[14px] text-text-primary">{file.name}</span>
                  </button>
                ))}
              </div>
            </SideCard>

            {/* Context */}
            <SideCard title="Context" defaultOpen>
              <div className="flex flex-col gap-1">
                <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors group">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-[14px] text-text-primary flex-1 text-left">{content.contextLabel}</span>
                  <ChevronRight size={14} className="text-text-primary shrink-0" />
                </button>
              </div>
            </SideCard>
          </div>
          </div>
        </div>
      )}
    >
      <PageLayout
        title={project.name}
        bgClass="app-bg"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        headerRight={
          <>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary" aria-label="Star">
              <Star size={18} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary" aria-label="More">
              <MoreVertical size={20} />
            </button>
            {!infoPanelOpen && (
              <button
                onClick={() => setInfoPanelOpen(true)}
                aria-label="Open info panel"
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
              >
                <PanelRight size={20} />
              </button>
            )}
          </>
        }
        rightSlot={
          <SearchBox value={search} onChange={setSearch} placeholder="Search this project" width={200} />
        }
        footer={
          <ChatInput
            onSend={() => {}}
            placeholder="What would you like to work on in this project?"
          />
        }
      >
            <div className="flex flex-col gap-6">

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
                      {OUTPUT_FILTERS.map(f => (
                        <FilterChip
                          key={f}
                          label={f}
                          active={outputFilter === f}
                          onClick={() => setOutputFilter(f)}
                        />
                      ))}
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
                                ? 'border-[#3171ff]'
                                : 'border-transparent hover:bg-bg-hover'
                            }`}
                          >
                            <Icon
                              size={32}
                              className={isSelected ? 'text-[#3171ff]' : 'text-text-secondary/40 dark:text-white'}
                              strokeWidth={1.2}
                            />
                            <span className={`text-[14px] text-center leading-[1.2] line-clamp-2 w-full ${isSelected ? 'text-[#3171ff]' : 'text-text-primary'}`}>
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
                      {FILTER_OPTIONS.map(f => (
                        <FilterChip
                          key={f}
                          label={f}
                          active={recentsFilter === f}
                          onClick={() => setRecentsFilter(f)}
                        />
                      ))}
                    </div>

                    {/* Recent items */}
                    <div className="flex flex-col">
                      {filteredRecents.map(r => {
                        const Icon = TYPE_ICON[r.type];
                        return (
                          <button
                            key={r.id}
                            className="flex items-start gap-3 w-full px-5 py-4 hover:bg-bg-hover transition-colors text-left side-card-divider last:bg-none"
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
      </PageLayout>
    </SplitView>
  );
}
