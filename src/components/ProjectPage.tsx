import { useState, useEffect, useRef } from 'react';
import { Project } from './Sidebar';
import ChatInput from './ChatInput';
import VoiceMode from './VoiceMode';
import {
  ChevronDown, ChevronRight, Star, MoreVertical, PanelRight,
  FileCode2, MessageCircle, Pen, File, Plus, X,
  FolderOpen, FolderClosed, Inbox,
} from 'lucide-react';
import { AddRowButton, AgentRequiredHint, EmptyState, FilterChip, PageLayout, SearchBox, SideCard, SidePanelBody, SidePanelHeader, SplitView, outputIconFor } from './shared';
import type { Chat, Attachment, OutputItem, OutputType, ImageResult, VideoResult, WebResult } from '../types';
import { filesToAttachments, formatFileSize } from '../lib/attachments';
import { IS_DEMO } from '../lib/demoMode';
import { useIsMobile } from '../lib/useIsMobile';
import { listArtifacts, outputTypeFromPath, type Artifact, type ArtifactKind } from '../lib/artifacts';
import { fetchProjectDeliverables, type DeliverableItem } from '../lib/api';
import { fetchAgent, AgentUnreachableError } from '../lib/agent';

interface ProjectPageProps {
  project: Project;
  /** §43: pre-computed slugify(project.name) from App.tsx so ProjectPage
   *  can call fetchProjectDeliverables without duplicating slugify. */
  projectSlug: string;
  chats: Chat[];
  onCreateChat: (projectId: string, text: string, attachments?: Attachment[]) => void;
  onOpenChat: (chatId: string) => void;
  /** Add reference files to the project — their content gets prepended to
   *  every AI request in any chat scoped here. */
  onAddFiles?: (projectId: string, files: Attachment[]) => void;
  onRemoveFile?: (projectId: string, fileId: string) => void;
  /** §17: attach an external folder. Server validates the path; UI surfaces
   *  the bilingual error inline on rejection. Returns ok / error from the
   *  PUT round-trip so the caller can clear the input on success only. */
  onAddReferenceDirectory?: (projectId: string, path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** §17: detach a reference folder. Local-only mutation; the auto-flush
   *  will PUT the shorter array within 1.5s. */
  onRemoveReferenceDirectory?: (projectId: string, path: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
  /** §23: click on a Claude-code Output card with a known `path` → request
   *  the App to fetch the file and dock the DetailPanel preview at the
   *  ProjectPage's right edge. Mobile + path-less (legacy / hosted) cards
   *  skip this and fall back to the toggle-highlight. */
  onOutputPreview?: (output: OutputItem) => void;
  /** §36: voice mode props mirror ChatPanel's. State lives in App.tsx so
   *  toggling voice on the ProjectPage footer surfaces the same bar as
   *  the chat surface. Selected avatar drives the agent-gender voice
   *  filter inside <VoiceMode>. */
  selectedAvatarId?: string;
  onVoiceMode?: () => void;
  voiceModeActive?: boolean;
  onVoiceModeClose?: () => void;
  onVoiceMessage?: (role: 'user' | 'assistant', text: string) => void;
  onVoiceImages?: (query: string, images: ImageResult[]) => void;
  onVoiceVideos?: (query: string, videos: VideoResult[]) => void;
  onVoiceWebSearch?: (query: string, results: WebResult[], images: ImageResult[]) => void;
  voicePendingText?: string;
  voicePendingImages?: string[];
  onVoicePendingTextConsumed?: () => void;
}

/** §17: Reference folders SideCard contents. Lifted out of ProjectPage's
 *  render so the picker / text-input fallback / mobile graceful-degrade /
 *  bilingual error state stay encapsulated. Mounts inside the existing
 *  side panel between Files and Context. */
function ReferenceFoldersSection({
  project,
  onAddReferenceDirectory,
  onRemoveReferenceDirectory,
}: {
  project: Project;
  onAddReferenceDirectory?: (projectId: string, path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemoveReferenceDirectory?: (projectId: string, path: string) => void;
}) {
  const isMobile = useIsMobile();
  const dirs = project.referenceDirectories ?? [];
  const [showHint, setShowHint] = useState(false);
  // Manual text input fallback used in dev mode (no Electron native picker).
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-clear inline error after a few seconds so it doesn't linger across
  // unrelated interactions (matches the file upload pattern above).
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
  }, [error]);

  const triggerHint = () => {
    setShowHint(true);
    window.setTimeout(() => setShowHint(false), 5000);
  };

  const submitPath = async (path: string) => {
    if (!onAddReferenceDirectory) return;
    const trimmed = path.trim();
    if (!trimmed) return;
    setBusy(true);
    const result = await onAddReferenceDirectory(project.id, trimmed);
    setBusy(false);
    if (result.ok) {
      setInputValue('');
      setShowInput(false);
      setError(null);
    } else {
      setError(result.error);
    }
  };

  const handleAddClick = async () => {
    if (isMobile) {
      triggerHint();
      return;
    }
    if (IS_DEMO) {
      setError('Reference folders are read-only in demo mode');
      return;
    }
    // Try the Electron native picker first. The picker route lives on the
    // local agent (https://127.0.0.1:3001), not the Vercel cloud — fetchAgent
    // routes there. In dev mode without an agent this returns 404; on any
    // network failure (no agent installed, agent not running) the caller
    // catches AgentUnreachableError. Both paths fall back to the manual text
    // input row.
    try {
      const res = await fetchAgent('/api/pick-folder', { method: 'POST' });
      if (res.status === 404) {
        setShowInput(v => !v);
        return;
      }
      if (!res.ok) {
        setError(`Picker error (${res.status})`);
        return;
      }
      const body = (await res.json()) as { ok: boolean; path?: string; reason?: string };
      if (!body.ok) {
        if (body.reason === 'cancelled') return; // user cancelled, no error
        setError('Picker failed');
        return;
      }
      if (body.path) await submitPath(body.path);
    } catch (err) {
      if (err instanceof AgentUnreachableError) {
        console.warn('[picker] agent unreachable, falling back to text input');
        setShowInput(v => !v);
        return;
      }
      console.warn('[picker] unexpected picker error, falling back to text input', err);
      setShowInput(v => !v);
    }
  };

  const handleRemove = (path: string) => {
    if (isMobile) {
      triggerHint();
      return;
    }
    if (IS_DEMO) return;
    onRemoveReferenceDirectory?.(project.id, path);
  };

  return (
    <div className="flex flex-col gap-1">
      {dirs.length === 0 && !showInput && (
        <p className="px-3 py-1 type-detail text-text-tertiary italic">
          No reference folders attached. AI sees only this project's worktree.
        </p>
      )}
      {dirs.map(path => (
        <div
          key={path}
          className="group flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
        >
          <FolderClosed size={16} className="text-text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="type-detail text-text-primary truncate" title={path}>{path}</div>
          </div>
          {onRemoveReferenceDirectory && (
            <button
              onClick={() => handleRemove(path)}
              aria-label={`Remove ${path}`}
              className={`w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-bg-page transition-opacity ${isMobile ? 'cursor-not-allowed' : ''}`}
            >
              <X size={12} className="text-text-secondary" />
            </button>
          )}
        </div>
      ))}
      {showInput && !isMobile && (
        <div className="flex flex-col gap-1.5 px-3 py-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitPath(inputValue);
              } else if (e.key === 'Escape') {
                setShowInput(false);
                setInputValue('');
                setError(null);
              }
            }}
            disabled={busy}
            autoFocus
            placeholder="/Users/you/Documents/reference"
            className="type-detail px-2.5 py-1.5 rounded-md bg-bg-hover text-text-primary border border-stroke-outline focus:outline-none focus:ring-1 focus:ring-stroke-outline"
          />
          <p className="type-detail text-text-tertiary">
            Paste an absolute path.
          </p>
        </div>
      )}
      <div className={isMobile ? 'opacity-50 cursor-not-allowed' : ''}>
        <AddRowButton
          onClick={handleAddClick}
          icon={<Plus size={16} />}
        >
          {showInput && !isMobile ? 'Cancel' : 'Add folder'}
        </AddRowButton>
      </div>
      {showHint && (
        <div className="px-3 pb-1">
          <AgentRequiredHint variant="tip" />
        </div>
      )}
      {error && (
        <div className="px-3 py-1 type-detail text-error" role="alert">{error}</div>
      )}
    </div>
  );
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

export default function ProjectPage({
  project, projectSlug, chats, onCreateChat, onOpenChat,
  onAddFiles, onRemoveFile,
  onAddReferenceDirectory, onRemoveReferenceDirectory,
  sidebarOpen, onToggleSidebar, onOutputPreview,
  selectedAvatarId,
  onVoiceMode, voiceModeActive, onVoiceModeClose,
  onVoiceMessage, onVoiceImages, onVoiceVideos, onVoiceWebSearch,
  voicePendingText, voicePendingImages, onVoicePendingTextConsumed,
}: ProjectPageProps) {
  const content = PROJECT_CONTENT[project.id] ?? EMPTY_CONTENT;
  const isMobile = useIsMobile();
  // Four output sources feed the grid:
  //   1. deliverables — §43 authoritative list from GET /api/project/:slug/deliverables.
  //      Merges main-branch saved files + in-session uncommitted, deduped by basename.
  //   2. claudeCodeOutputs — instant feedback for in-flight chat file writes.
  //   3. hostedArtifacts — candidate #3 /api/artifacts rows scoped to this project.
  //   4. seedOutputs — PROJECT_CONTENT mock (proj-1 showcase). Demo only.
  // Deliverables carry authoritative status tags; remaining sources fill gaps
  // for items the endpoint hasn't seen yet (in-flight writes, hosted artifacts).
  const seedOutputs = content.outputs;
  const claudeCodeOutputs = project.outputs ?? [];
  const [hostedArtifacts, setHostedArtifacts] = useState<OutputItem[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    listArtifacts({ status: 'ready', projectId: project.id }).then((rows) => {
      if (cancelled) return;
      setHostedArtifacts(rows.map(artifactToOutputItem));
    });
    return () => { cancelled = true; };
  }, [project.id]);
  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    fetchProjectDeliverables(projectSlug).then((items) => {
      if (!cancelled) setDeliverables(items);
    });
    return () => { cancelled = true; };
  }, [projectSlug]);

  const seenNames = new Set<string>();
  const mergedOutputs: OutputItem[] = [];
  // Deliverables first — they carry the authoritative status tag.
  for (const d of deliverables) {
    if (seenNames.has(d.name)) continue;
    seenNames.add(d.name);
    mergedOutputs.push({
      id: `deliverable-${d.name}`,
      name: d.name,
      type: outputTypeFromPath(d.name),
      path: d.path,
      status: d.status,
    });
  }
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
          />
          <SidePanelBody>
            {/* Instructions */}
            <SideCard title="Instructions" icon={<Pen size={14} />} defaultOpen>
              <div className="flex flex-col gap-2">
                <p className="type-detail text-text-primary">
                  Project Name: {project.name}
                </p>
                <p className="type-detail text-text-primary">
                  Project Objective:{' '}
                  {content.objective || (
                    <span className="text-text-tertiary italic">No objective yet</span>
                  )}
                </p>
              </div>
            </SideCard>

            {/* Scheduled */}
            <SideCard title="Scheduled" hasAdd defaultOpen={false}>
              <p className="type-detail text-text-tertiary italic">Set up recurring tasks for this project.</p>
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
                      <div className="type-detail text-text-primary truncate">{file.name}</div>
                      <div className="type-detail text-text-secondary">{formatFileSize(file.size)}</div>
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
                <AddRowButton
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Plus size={16} />}
                >
                  Add file
                </AddRowButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
                {fileError && (
                  <div className="px-3 py-1 type-detail text-error">{fileError}</div>
                )}
              </div>
            </SideCard>

            {/* §17 Reference folders — external knowledge sources passed to
                 the SDK as `additionalDirectories` during chats in this
                 project. Read/Glob/Grep can reach them; mobile shows the
                 list read-only with the AgentRequiredHint pattern. */}
            <SideCard title="Reference folders" defaultOpen={false}>
              <ReferenceFoldersSection
                project={project}
                onAddReferenceDirectory={onAddReferenceDirectory}
                onRemoveReferenceDirectory={onRemoveReferenceDirectory}
              />
            </SideCard>

            {/* Context */}
            <SideCard title="Context" defaultOpen>
              <div className="flex flex-col gap-1">
                <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors group">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="type-detail text-text-primary flex-1 text-left">{content.contextLabel}</span>
                  <ChevronRight size={14} className="text-text-primary shrink-0" />
                </button>
              </div>
            </SideCard>
          </SidePanelBody>
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
          <>
            {/* §36: voice bar above the footer input — parallel mount to
                ChatPanel's. State + callbacks live in App.tsx; only one
                <VoiceMode> renders at a time because ProjectPage and
                ChatPanel are conditional siblings in App's router. */}
            {voiceModeActive && onVoiceModeClose && (
              <VoiceMode
                onClose={onVoiceModeClose}
                onMessage={onVoiceMessage}
                onImages={onVoiceImages}
                onVideos={onVoiceVideos}
                onWebSearch={onVoiceWebSearch}
                pendingText={voicePendingText}
                pendingImages={voicePendingImages}
                onPendingTextConsumed={onVoicePendingTextConsumed}
                agentGender={selectedAvatarId === 'white-man' ? 'male' : 'female'}
              />
            )}
            <ChatInput
              onSend={handleSend}
              chatKey={`project-${project.id}`}
              placeholder="What would you like to work on in this project?"
              onVoiceMode={onVoiceMode}
              voiceModeActive={voiceModeActive}
            />
          </>
        }
      >
            <div className="flex flex-col gap-6">

              {/* Output section */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setOutputOpen(o => !o)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="type-h2-emphasized text-text-primary">Output</h3>
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
                          // §23: claude-code outputs with a known path →
                          // dispatch to App so DetailPanel previews the file.
                          // Mobile + path-less / legacy entries fall through
                          // to the toggle-highlight (graceful degrade — no
                          // panel surface on phone, no path nothing to read).
                          const handleClick = () => {
                            if (o.href) {
                              window.open(o.href, '_blank', 'noopener,noreferrer');
                            } else if (o.path && !isMobile && onOutputPreview) {
                              onOutputPreview(o);
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
                                  ? 'border-accent-blue'
                                  : 'border-transparent hover:bg-bg-hover'
                              }`}
                            >
                              <Icon
                                size={32}
                                className={isSelected ? 'text-accent-blue' : 'text-text-primary dark:text-white'}
                                strokeWidth={1.2}
                              />
                              <span className={`type-detail text-center leading-[1.2] line-clamp-2 w-full ${isSelected ? 'text-accent-blue' : 'text-text-primary'}`}>
                                {o.name}
                              </span>
                              {o.status && (
                                <span className={`type-detail ${
                                  o.status === 'saved' ? 'text-accent-green' : 'text-text-tertiary'
                                }`}>
                                  {o.status === 'saved' ? 'Saved' : 'In session'}
                                </span>
                              )}
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
                  <h3 className="type-h2-emphasized text-text-primary">Recents</h3>
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
                            className={`flex items-start gap-3 w-full px-5 py-4 transition-colors text-left dashed-border-b last:bg-none ${
                              isReal ? 'hover:bg-bg-hover cursor-pointer' : 'hover:bg-bg-hover'
                            }`}
                          >
                            <div className="flex items-center justify-center shrink-0 mt-px text-text-primary">
                              <MessageCircle size={18} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-0">
                              <div className="flex items-center justify-between gap-3">
                                <span className="type-detail-emphasized text-text-primary truncate">{r.title}</span>
                                <span className="type-detail text-text-primary whitespace-nowrap shrink-0">{r.time}</span>
                              </div>
                              <p className="type-detail text-text-primary line-clamp-1">{r.description}</p>
                              {r.outputTag && (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stroke-outline type-detail text-text-primary">
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
