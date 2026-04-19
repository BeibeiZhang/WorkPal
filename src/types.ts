export type MessageRole = 'user' | 'assistant';

export interface ActionChip {
  label: string;
  action: string;
}

/** Origin of a tool-result card — drives the app-header icon + label at the top
 *  of the card (e.g. "Gmail", "Google Calendar"). Undefined means no header
 *  (legacy freeform rendering for demo flows). */
export type CardSource = 'gmail' | 'calendar' | 'doc';

export interface MeetingCard {
  title: string;
  content: string;
  type: 'meeting';
  source?: CardSource;
}

export interface ResearchCard {
  title: string;
  summary: string;
  type: 'research';
  status?: 'in-progress' | 'sent' | 'done';
  statusLabel?: string;
  source?: CardSource;
}

export interface TicketItem {
  text: string;
  assignee?: string;
  due?: string;
  checked?: boolean;
}

export interface TicketCard {
  title: string;
  description: string;
  assignee?: string;
  due?: string;
  items?: TicketItem[];
  type: 'ticket';
  status?: 'in-progress' | 'created' | 'sent';
  statusLabel?: string;
}

export interface TimeOption {
  date: string;
  time: string;
  selected?: boolean;
}

export interface ScheduleCard {
  title: string;
  date: string;
  time: string;
  attendees: string[];
  location?: string;
  timeOptions?: TimeOption[];
  type: 'schedule';
  status?: 'pending' | 'sent';
  statusLabel?: string;
  source?: CardSource;
}

export interface AgentCard {
  type: 'agent';
  title: string;
  status: 'creating' | 'ready' | 'saved';
  agentName?: string;
  agentIntro?: string;
  avatarUrl?: string;
}

export type CardData = MeetingCard | ResearchCard | TicketCard | ScheduleCard | AgentCard;

export type AttachmentKind = 'image' | 'file';

export interface Attachment {
  id: string;
  name: string;
  /** MIME type as reported by the browser (e.g. "image/png", "application/pdf"). */
  mimeType: string;
  /** Size in bytes. */
  size: number;
  kind: AttachmentKind;
  /** Base64 data URL — used as the thumbnail for images, and as a download href for files. */
  dataUrl: string;
}

/** An image returned by the `search_images` tool and rendered inline in the
 *  assistant's message. Separate from `attachments` (user-uploaded files). */
export interface ImageResult {
  url: string;
  thumbUrl: string;
  aspectRatio?: number;
  alt: string;
  sourceUrl?: string;
  attribution?: string;
}

/** A YouTube video returned by the `search_videos` tool and rendered as a
 *  clickable card in the assistant's message. */
export interface VideoResult {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
  description?: string;
}

/** A web search hit returned by the `web_search` tool. Rendered as a small
 *  source chip (favicon + domain) under the assistant's synthesized answer. */
export interface WebResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  chips?: ActionChip[];
  card?: CardData;
  isLoading?: boolean;
  attachments?: Attachment[];
  /** Images the assistant fetched via the search_images tool, rendered in a
   *  grid alongside the text. Populated as streaming chunks arrive. */
  imageResults?: ImageResult[];
  /** YouTube videos the assistant fetched via the search_videos tool, rendered
   *  as a list of cards beneath the text. */
  videoResults?: VideoResult[];
  /** Web-search source hits — shown as small favicon+domain chips so the user
   *  can click through to the citation. */
  webResults?: WebResult[];
}

export interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
  isActive?: boolean;
  draftPrompt?: string;
  /** True for a fresh "New Session" that has not yet received its first
   *  user message. Draft chats are not shown in the Recents list — they
   *  stay highlighted under the top "New Session" button until the user
   *  submits something. */
  isDraft?: boolean;
  /** Project this chat belongs to. Unset for chats created outside any
   *  project (they only appear in the root Recents list). */
  projectId?: string;
  /** Set to `true` once the AI has invoked a tool in this chat — that's
   *  the signal that the work is complex enough to warrant the inspector
   *  panel (live progress + tool list). Preserved across reopens so the
   *  panel re-appears when the user returns to the chat. */
  hasInspector?: boolean;
  /** Cosmetic filesystem path shown in the inspector Folder card and the
   *  chat header's folder chip. Auto-generated from the session title on the
   *  first send (e.g. `~/WorkPal/2026-04-18-alcohol-delivery-issues/`). Once
   *  a session is promoted to a project it becomes
   *  `~/WorkPal/{project-slug}/sessions/{session-slug}/`. The path is
   *  pre-computed so the promote flow and migration logic have something to
   *  re-nest, but no real mkdir happens until `folderMaterialized` flips. */
  sessionFolder?: string;
  /** Flips to `true` the first time the AI calls a Write/Edit tool in this
   *  chat — at that point the Claude Code backend actually creates the
   *  session folder on disk. Until then the chat is pure conversation and
   *  the folder chip / inspector Folder card stay hidden to avoid suggesting
   *  a workspace that doesn't exist. */
  folderMaterialized?: boolean;
}

export interface App {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/** An entry in the inspector's Changes panel — one per file modification the
 *  AI performed. Purely cosmetic in the prototype (no real git commit), but
 *  modeled after the "auto-commit + undo" flow in the Phase 4 spec. */
export type ChangeKind = 'create' | 'edit' | 'delete' | 'halt';

export interface ChangeEntry {
  id: string;
  kind: ChangeKind;
  /** Short label shown in the row — usually the file path, or a status note
   *  for `kind: 'halt'` entries ("Task stopped: permission denied"). */
  label: string;
  timestamp: Date;
  /** True once the user clicks Undo. The row stays in the list but greyed
   *  with an "Undone" tag. Entries backed by `commit` also get a real
   *  `git reset --hard HEAD~1` on disk; demo entries flip cosmetically. */
  undone?: boolean;
  /** 5.5: Claude Agent SDK tool_use.id that produced this entry. Used to
   *  correlate the later `commit` SSE chunk back to the right row. Absent on
   *  demo/simulated entries. */
  toolUseId?: string;
  /** 5.5: git commit hash set once the backend commits the disk state after
   *  a successful file-write tool_result. Its presence is also the signal
   *  that this entry is undoable (vs. a halt entry or a failed write). */
  commit?: string;
  /** 5.5: transient error message surfaced inline under the row when an Undo
   *  POST fails. Cleared after 5s by the component's auto-dismiss timer. */
  undoError?: string;
}

/** Surface the AI needs permission for. Drives the prompt's title and scope
 *  wording so the user always knows what they're approving. */
export type PermissionKind = 'file-read' | 'file-write' | 'command' | 'external-url';

export interface PermissionRequest {
  id: string;
  kind: PermissionKind;
  /** Exact target — file path, command string, or URL shown verbatim. */
  target: string;
  /** Scope the user's decision applies to. Example: for `file-write` the
   *  scope is the folder name shown in the title ("change files in
   *  "testing""). "Always allow" remembers this scope for the session. */
  scope: string;
  /** Optional one-sentence explanation of why the AI wants access. */
  reason?: string;
}

/** Memory entry — persistent context about the user that gets injected into
 *  every AI request (scoped by kind + optional project). Core/preference
 *  memories apply globally; project memories only apply when the chat is in
 *  that project. */
export type MemoryKind = 'core' | 'preference' | 'project';

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  /** Short headline shown in the list — also goes into the prompt as a label. */
  title: string;
  /** Body content — the substance that informs the AI. */
  content: string;
  /** Only meaningful for kind='project' — scopes this memory to one project. */
  projectId?: string;
  /** ISO strings (Date round-trips poorly through JSON). */
  createdAt: string;
  updatedAt: string;
}
