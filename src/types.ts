export type MessageRole = 'user' | 'assistant';

export interface ActionChip {
  label: string;
  action: string;
}

export interface MeetingCard {
  title: string;
  content: string;
  type: 'meeting';
}

export interface ResearchCard {
  title: string;
  summary: string;
  type: 'research';
  status?: 'in-progress' | 'sent' | 'done';
  statusLabel?: string;
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

export type ChatMode = 'Chat' | 'Tasks' | 'Code';

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
  /** Which conversation mode the chat was started in. Drives the right
   *  panel (Task mode opens the context/workspace panel; Chat mode keeps
   *  it closed). Preserved across reopens. */
  mode?: ChatMode;
}

export interface App {
  id: string;
  name: string;
  icon: string;
  color: string;
}
