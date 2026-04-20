import { useState, useEffect, useRef } from 'react';
import { Project } from './Sidebar';
import ChatInput from './ChatInput';
import {
  ChevronDown, ChevronRight, Star, MoreVertical, PanelRight,
  FileCode2, MessageCircle, Pen, File, Plus, X,
  FolderOpen, Inbox,
} from 'lucide-react';
import { EmptyState, FilterChip, PageLayout, SearchBox, SideCard, SidePanelHeader, SplitView, outputIconFor } from './shared';
import type { Chat, Attachment, OutputItem, OutputType } from '../types';
import { filesToAttachments, formatFileSize } from '../lib/attachments';
import { IS_DEMO } from '../lib/demoMode';
import { listArtifacts, type Artifact, type ArtifactKind } from '../lib/artifacts';

interface ProjectPageProps {
  project: Project;
  chats: Chat[];
  onCreateChat: (projectId: string, text: string, attachments?: Attachment[]) => void;
  onOpenChat: (chatId: string) => void;
  /** Add reference files to the project — their content gets prepended to
   *  every AI request in any chat scoped here. */
  onAddFiles?: (projectId: string, files: Attachment[]) => void;
  onRemoveFile?: (projectId: string, fileId: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
}

/** Format a timestamp as a coarse "x hour ago" label (matches the demo copy). */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/* ── Demo data ── */
type OutputFilter = 'All' | OutputType;

/** Map from the 8 server-side ArtifactKinds to the 4 ProjectPage Output
 *  filter tabs. Groups webpage/document/report/note/spreadsheet under Web
 *  because those all render flat in this rail; Slides / Image / Video get
 *  their own tabs. Icon derivation happens downstream in `outputIconFor`
 *  (shared.tsx) so OutputItem stays JSON-serializable for localStorage. */
function kindToOutputType(kind: ArtifactKind): OutputType {
  switch (kind) {
    case 'presentation': return 'Slides';
    case 'image':        return 'Image';
    case 'video':        return 'Video';
    default:             return 'Web';
  }
}

function artifactToOutputItem(a: Artifact): OutputItem {
  return {
    id: a.slug,
    name: a.contentEn?.title || a.topic || a.templateId,
    type: kindToOutputType(a.kind),
    // Hosted artifacts get a public URL — clicking the Output card opens it.
    href: `/artifact/${a.slug}`,
  };
}

const OUTPUT_FILTERS: OutputFilter[] = ['All', 'Web', 'Slides', 'Image', 'Video'];

interface RecentItem {
  id: string;
  title: string;
  description: string;
  time: string;
  outputTag?: string;
}

/** Seeded content for a demo project — kept so the original `proj-1`
 *  (Agent Design) stays a polished showcase. Real projects created by the
 *  user have no entry here and get an empty-state shell instead, filled by
 *  actual Claude-Code file writes + chat activity. */
interface ProjectContent {
  objective: string;
  outputs: OutputItem[];
  recents: RecentItem[];
  contextLabel: string;
  defaultSelectedOutputId: string;
}

const PROJECT_CONTENT: Record<string, ProjectContent> = {
  'proj-1': {
    objective: 'To study and track the evolution of interface design norms and interaction patterns of mainstream AI products.',
    outputs: [
      { id: '1', name: 'Agent Design Component', type: 'Web' },
      { id: '2', name: 'AI Product Info Architecture', type: 'Web' },
      { id: '3', name: 'Agent UIUX Research', type: 'Video' },
      { id: '4', name: 'Agent UIUX Research', type: 'Slides' },
      { id: '5', name: 'competitive analysis', type: 'Web' },
    ],
    recents: [
      {
        id: '1',
        title: 'Compare UX architecture of four AI tools',
        description: 'Analyzed Grok, ChatGPT, Claude and Gemini UX patterns for navigation, onbo',
        time: '5 hour ago',
        outputTag: 'Agent Design Component Library',
      },
      {
        id: '2',
        title: 'Find AI product interface screenshots',
        description: 'Collected product screenshots for AI information architecture flow diagram ar',
        time: '18hour ago',
        outputTag: 'AI product info flow',
      },
      {
        id: '3',
        title: 'Refactor agent response parser module',
        description: 'Restructured the streaming response handler to support multi-turn agent conversations and tool calls...',
        time: '1 day ago',
      },
      {
        id: '4',
        title: 'Build component variant matrix for agent cards',
        description: 'Created a reusable matrix of agent card variants covering status, size, and interaction states...',
        time: '1 day ago',
        outputTag: 'Agent Design Component Library',
      },
      {
        id: '5',
        title: 'Fix streaming indicator z-index in chat panel',
        description: 'Resolved layering issue where the typing indicator overlapped the action chip bar during long responses...',
        time: '2 days ago',
      },
      {
        id: '6',
        title: 'Summarize competitive analysis of AI agent UIs',
        description: 'Reviewed interaction patterns across 6 AI agent products including reasoning visibility and tool use flows...',
        time: '3 days ago',
        outputTag: 'competitive analysis',
      },
      {
        id: '7',
        title: 'Implement dark mode token mapping for agent cards',
        description: 'Added CSS variable overrides and Tailwind config for all agent card components in dark theme...',
        time: '4 days ago',
      },
    ],
    contextLabel: 'Agent Design',
    defaultSelectedOutputId: '2',
  },
};

/** Fallback for user-created projects with no seed entry — nothing is
 *  pre-populated; the Output grid + Recents list start empty and grow as
 *  the user actually produces artifacts and starts sessions. Instructions
 *  card renders a "No objective yet" placeholder. */
const EMPTY_CONTENT: ProjectContent = {
  objective: '',
  outputs: [],
  recents: [],
  contextLabel: '',
  defaultSelectedOutputId: '',
};

export default function ProjectPage({ project, chats, onCreateChat, onOpenChat, onAddFiles, onRemoveFile, sidebarOpen, onToggleSidebar }: ProjectPageProps) {
  const content = PROJECT_CONTENT[project.id] ?? EMPTY_CONTENT;
  // Three output sources feed the grid:
  //   1. seedOutputs  — PROJECT_CONTENT mock (proj-1 showcase). Demo only.
  //   2. claudeCodeOutputs — Claude Code file writes in this project, persisted
  //      on `project.outputs` via the App-level streaming loop (PR #93).
  //   3. hostedArtifacts — candidate #3 /api/artifacts rows scoped to this
  //      project. Fetched fresh on mount; demo-mode short-circuits to [].
  // Merged in that priority (real work first, seed as fallback), deduped by
  // name so re-generating a seed-named item doesn't double up.
  const seedOutputs = content.outputs;
  const claudeCodeOutputs = project.outputs ?? [];
  const [hostedArtifacts, setHostedArtifacts] = useState<OutputItem[]>([]);
  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    listArtifacts({ status: 'ready', projectId: project.id }).then((rows) => {
      if (cancelled) return;
      setHostedArtifacts(rows.map(artifactToOutputItem));
    });
    return () => { cancelled = true; };
  }, [project.id]);
  const seenNames = new Set<string>();
  const mergedOutputs: OutputItem[] = [];
  for (const o of [...claudeCodeOutputs, ...hostedArtifacts, ...seedOutputs]) {
    if (seenNames.has(o.name)) continue;
    seenNames.add(o.name);
    mergedOutputs.push(o);
  }

  const [outputFilter, setOutputFilter] = useState<OutputFilter>('All');
  const [selectedOutputId, setSelectedOutputId] = useState<string>(content.defaultSelectedOutputId);
  const [outputOpen, setOutputOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { added, oversized } = await filesToAttachments(e.target.files);
    e.target.value = '';
    if (added.length && onAddFiles) onAddFiles(project.id, added);
    setFileError(oversized.length ? `${oversized.length} file${oversized.length > 1 ? 's' : ''} too large (max 25MB)` : null);
  };

  // Auto-clear the error after a few seconds so it doesn't linger.
  useEffect(() => {
    if (!fileError) return;
    const t = window.setTimeout(() => setFileError(null), 4000);
    return () => window.clearTimeout(t);
  }, [fileError]);

  // Reset selected output when switching projects
  useEffect(() => {
    setSelectedOutputId(content.defaultSelectedOutputId);
    setOutputFilter('All');
    setSearch('');
  }, [project.id, content.defaultSelectedOutputId]);

  const q = search.trim().toLowerCase();
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q);

  // Real chats belonging to this project, mapped into the RecentItem shape so
  // they render with the same layout as the seeded demo rows. Newest first.
  // Drafts (empty "New Session" placeholders) are excluded.
  const realRecents: (RecentItem & { isReal: true })[] = chats
    .filter(c => c.projectId === project.id && !c.isDraft && c.messages.length > 0)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .map(c => ({
      id: c.id,
      title: c.title,
      description: c.lastMessage || c.messages[0]?.content || '',
      time: formatRelative(c.timestamp),
      isReal: true as const,
    }));

  // Combine real chats on top, then the project's seeded demo rows.
  const combinedRecents: (RecentItem & { isReal?: boolean })[] = [
    ...realRecents,
    ...content.recents.map(r => ({ ...r, isReal: false })),
  ];

  const filteredRecents = combinedRecents.filter(r =>
    matchesSearch(r.title) || matchesSearch(r.description) || matchesSearch(r.outputTag ?? ''),
  );

  const filteredOutputs = mergedOutputs.filter(o => {
    if (outputFilter !== 'All' && o.type !== outputFilter) return false;
    return matchesSearch(o.name);
  });

  const handleSend = (text: string, attachments?: Attachment[]) => {
    const trimmed = text.trim();
    if (!trimmed && !(attachments && attachments.length)) return;
    onCreateChat(project.id, trimmed, attachments);
  };

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
                  <strong>Project Objective: </strong>
                  {content.objective || (
                    <span className="text-text-secondary/60 italic">No objective yet</span>
                  )}
                </p>
              </div>
            </SideCard>

            {/* Scheduled */}
            <SideCard title="Scheduled" hasAdd defaultOpen={false}>
              <p className="text-text-secondary/60 italic text-[13px]">Set up recurring tasks for this project.</p>
            </SideCard>

            {/* Files — real project-scoped uploads. Each file's text is
                 injected into every AI request in chats under this project. */}
            <SideCard title="Files" defaultOpen>
              <div className="flex flex-col gap-1">
                {(project.files || []).map(file => (
                  <div
                    key={file.id}
                    className="group flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    {file.kind === 'image' ? (
                      <img
                        src={file.dataUrl}
                        alt={file.name}
                        className="w-5 h-5 object-cover rounded shrink-0"
                      />
                    ) : (
                      <File size={16} className="text-text-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-text-primary truncate">{file.name}</div>
                      <div className="text-[11px] text-text-secondary">{formatFileSize(file.size)}</div>
                    </div>
                    {onRemoveFile && (
                      <button
                        onClick={() => onRemoveFile(project.id, file.id)}
                        aria-label={`Remove ${file.name}`}
                        className="w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-bg-page transition-opacity"
                      >
                        <X size={12} className="text-text-secondary" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
                >
                  <Plus size={16} />
                  <span className="text-[13px]">Add file</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
                {fileError && (
                  <div className="px-3 py-1 text-[12px] text-[#B42318]">{fileError}</div>
                )}
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
          <SearchBox value={search} onChange={setSearch} placeholder="Search this project" />
        }
        footer={
          <ChatInput
            onSend={handleSend}
            chatKey={`project-${project.id}`}
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
                    {/* Output filter chips — only shown when there are outputs
                        to filter. On an empty project the chips would be
                        visual noise above a "nothing here yet" message. */}
                    {mergedOutputs.length > 0 && (
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
                    )}

                    {/* Output cards — or empty state when the project hasn't
                        produced anything yet. */}
                    {mergedOutputs.length === 0 ? (
                      <EmptyState
                        icon={FolderOpen}
                        title="No outputs yet"
                        description="Files WorkPal creates in this project — or hosted artifacts you ask it to generate — will show up here."
                      />
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {filteredOutputs.map(o => {
                          const Icon = outputIconFor(o.type);
                          const isSelected = selectedOutputId === o.id;
                          // Hosted artifacts (candidate #3) carry an href; the
                          // card opens the /artifact/<slug> page in a new tab.
                          // Claude-code and seed entries only toggle the
                          // selected-highlight state.
                          const handleClick = () => {
                            if (o.href) {
                              window.open(o.href, '_blank', 'noopener,noreferrer');
                            } else {
                              setSelectedOutputId(o.id);
                            }
                          };
                          return (
                            <button
                              key={o.id}
                              onClick={handleClick}
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
                    )}
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
                    {/* Recent items — or empty state when nothing has been
                        started in this project yet. */}
                    {combinedRecents.length === 0 ? (
                      <EmptyState
                        icon={Inbox}
                        title="No sessions yet"
                        description="Conversations you start in this project will show up here."
                      />
                    ) : (
                    <div className="flex flex-col">
                      {filteredRecents.map(r => {
                        // Only real chats are wired up for now. Demo rows stay
                        // visual-only so the page keeps its showcase content.
                        const isReal = r.isReal === true;
                        return (
                          <button
                            key={r.id}
                            onClick={isReal ? () => onOpenChat(r.id) : undefined}
                            className={`flex items-start gap-3 w-full px-5 py-4 transition-colors text-left side-card-divider last:bg-none ${
                              isReal ? 'hover:bg-bg-hover cursor-pointer' : 'hover:bg-bg-hover'
                            }`}
                          >
                            <div className="flex items-center justify-center shrink-0 mt-px text-text-primary">
                              <MessageCircle size={18} />
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
                    )}
                  </>
                )}
              </div>
            </div>
      </PageLayout>
    </SplitView>
  );
}
