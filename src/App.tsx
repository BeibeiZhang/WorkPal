import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, useMatch } from 'react-router-dom';
import Sidebar, { MiniSidebar } from './components/Sidebar';
import type { Project } from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import DetailPanel from './components/DetailPanel';
import Onboarding from './components/Onboarding';
import TaskContextPanel from './components/TaskContextPanel';
import ProjectPage from './components/ProjectPage';
import ConnectorsPage from './components/ConnectorsPage';
import DesignSystemPage from './components/DesignSystemPage';
import OverviewPage from './components/OverviewPage';
import LibraryPage from './components/LibraryPage';
import MemoryPage from './components/MemoryPage';
import NewProjectDialog from './components/NewProjectDialog';
import { SplitView } from './components/shared';
import { Chat, Message, ActionChip, Attachment, TicketCard, AgentCard, ScheduleCard, ImageResult, VideoResult, WebResult, MemoryEntry, MemoryKind, CardData, ChangeEntry, ChangeKind, PermissionRequest, OutputItem } from './types';
import PermissionPrompt from './components/PermissionPrompt';
import CompleteSessionModal, { type CompleteSessionPhase } from './components/CompleteSessionModal';
import { avatarBlackWoman, avatarAsianWoman, avatarWhiteMan } from './assets';
import { INITIAL_CHATS } from './data';
import { DEMO_EXTRA_CHATS, DEMO_EXTRA_CHAT_IDS } from './data/demo/chats';
import { DEMO_CHANGES_ALCOHOL } from './data/demo/changes';
import { IS_DEMO, IS_CLAUDE_CODE_AVAILABLE } from './lib/demoMode';
import { postClaudePermissionDecision, postInitProject, postOpenFile, postOpenFolder, postReadFile, postReaperRun, postSessionComplete, postSessionMerge, postUndoChange, streamChat, streamClaudeChat } from './lib/api';
import { shouldUseClaudeCode, shouldGenerateArtifact } from './lib/intentRouter';
import { buildAttachmentContextBlock, buildImageDescriptionBlock } from './lib/attachments';
import { artifactFromClaudePath, outputTypeFromPath, generateArtifactRequest, artifactItemCount } from './lib/artifacts';
import {
  loadMemoriesCache,
  saveMemoriesCache,
  buildMemoryBlock,
  nextMemoryId,
  fetchMemoriesFromServer,
  createMemoryOnServer,
  updateMemoryOnServer,
  deleteMemoryOnServer,
} from './lib/memory';
import { useMemoryAuth } from './lib/useMemoryAuth';

// Projects are persisted separately from chats so uploads survive a refresh.
// Bump the version if the shape changes in an incompatible way.
const PROJECTS_STORAGE_KEY = 'workpal-projects-v1';

// Seeded Instructions.md for the demo project. Stored as a real data URL so
// it round-trips through the same extract → prompt-block path as user uploads.
const DEMO_INSTRUCTIONS_MD = `# Agent Design — Project Instructions

This project tracks the evolution of interface design norms and interaction
patterns of mainstream AI products (Grok, ChatGPT, Claude, Gemini).

## Focus areas
- Navigation patterns and information architecture
- Onboarding and first-run experience
- Message/response rendering patterns
- Tool-use and reasoning visibility
- Agent personality and voice

## Notes
When asked about any AI product design, anchor in this project's scope —
prefer comparative analysis across the four focal products.`;

function seedInstructionsFile(): Attachment {
  const b64 = btoa(unescape(encodeURIComponent(DEMO_INSTRUCTIONS_MD)));
  return {
    id: 'seed-instructions-md',
    name: 'Instructions.md',
    mimeType: 'text/markdown',
    size: DEMO_INSTRUCTIONS_MD.length,
    kind: 'file',
    dataUrl: `data:text/markdown;base64,${b64}`,
  };
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore corrupted data */ }
  return [{
    id: 'proj-1',
    name: 'Agent Design',
    files: [seedInstructionsFile()],
  }];
}

function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch { /* quota exceeded — silently drop, matches saveChats behavior */ }
}

// Demo chat IDs — these always use hardcoded flows, never call the API.
// On IS_DEMO we also add the richer DEMO_EXTRA_CHATS so their canned replies
// stay scripted instead of hitting OpenAI on the Vercel demo project.
const DEMO_CHAT_IDS = [
  'alcohol-delivery',
  'ux-meeting',
  'my-workpal',
  ...(IS_DEMO ? DEMO_EXTRA_CHAT_IDS : []),
];

// Bump this whenever INITIAL_CHATS gains new seed fields (e.g. draftPrompt) so
// returning visitors with stale localStorage drop their cached chats and pick
// up the new demo data on next load.
const STORAGE_KEY = 'workpal-chats-v2';
const LEGACY_STORAGE_KEYS = ['workpal-chats'];

function loadChats(): Chat[] {
  // Demo mode: ignore any localStorage cache and always return a fresh seed
  // — HRs get the same pristine state on every visit. Principle #6 also:
  // don't write to or read from localStorage in demo.
  if (IS_DEMO) return [...INITIAL_CHATS, ...DEMO_EXTRA_CHATS];
  try {
    // Drop any pre-versioned cache so old demo data can't shadow new seed fields.
    LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Dedupe by id (earlier bug seeded multiple chats with id 'draft-session').
      // Keep the first occurrence of each id.
      const seen = new Set<string>();
      const deduped = parsed.filter((c: any) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      // Backfill new seed fields so cached visitors get Phase 2 behavior
      // without wiping their real chats. Keep this list narrow — every
      // entry here is a documented field added post-v2 storage key.
      const seedById: Record<string, Partial<Chat>> = Object.fromEntries(
        INITIAL_CHATS.map(c => [c.id, c]),
      );
      return deduped.map((c: any): Chat => ({
        ...c,
        timestamp: new Date(c.timestamp),
        messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
        hasInspector: c.hasInspector ?? seedById[c.id]?.hasInspector,
        sessionFolder: c.sessionFolder ?? seedById[c.id]?.sessionFolder,
        folderMaterialized: c.folderMaterialized ?? seedById[c.id]?.folderMaterialized,
      }));
    }
  } catch { /* ignore corrupted data */ }
  return INITIAL_CHATS;
}

function getInitialChatState(): { chats: Chat[]; activeChatId: string } {
  const loaded = loadChats();
  const existingDraft = loaded.find(c => c.isDraft);
  if (existingDraft) return { chats: loaded, activeChatId: existingDraft.id };
  const newDraftId = `chat-${Date.now()}`;
  const draft: Chat = {
    id: newDraftId,
    title: 'New Session',
    lastMessage: '',
    timestamp: new Date(),
    messages: [],
    isDraft: true,
  };
  return { chats: [draft, ...loaded], activeChatId: newDraftId };
}

function saveChats(chats: Chat[]) {
  // Demo mode: principle #6 lazy-clean — don't leave any trace in
  // localStorage. Refreshing the demo URL should always snap back to the
  // canonical seed.
  if (IS_DEMO) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch { /* quota exceeded — ignore */ }
}

const REPORT_CONTENT = `**Introduction**
As alcohol delivery becomes a growing segment within last-mile logistics, platforms are facing increased scrutiny over age verification, driver compliance, and customer safety. While the convenience of contactless drop-offs has improved efficiency, it has also exposed new legal and operational vulnerabilities. This brief outlines key pain points in alcohol delivery workflows and highlights best practices for mitigating compliance risks.

• **Age Verification Compliance**\nMany drivers fail to properly verify age, especially with contactless delivery.\nSome systems lack real-time ID scanning features.
• **Legal Liability**\nIn several U.S. states, alcohol delivery requires the driver to hold a special permit.\nMisdelivery can result in fines or license suspension for the platform.
• **Driver Safety**\nAlcohol deliveries at night increase risk of harassment or theft in certain regions.
• **Operational Delays**\nVerification steps slow down delivery speed, impacting ETA accuracy.\nCustomer Complaints\nCases of incorrect age-based refusal or confusion on signature policies
• **Customer Complaints**\nCases of incorrect age-based refusal or confusion on signature policies

**Conclusion**
Alcohol delivery introduces a higher regulatory and reputational risk for delivery platforms. Clearer ID protocols, training for drivers, and stronger app-level compliance safeguards are critical. Some platforms (e.g., Drizly, Uber Eats) mitigate this with age-check flows, facial ID, and license scanning.`;

// Demo AI response flows
const AI_FLOWS: Record<string, { delay: number; response: Omit<Message, 'id' | 'timestamp' | 'role'> }[]> = {
  'summarize-design-sync': [
    {
      delay: 1500,
      response: {
        content: 'Would you like me to create **Jira tickets** for the team?',
        card: {
          type: 'meeting',
          title: 'Meeting Minutes',
          content: '**Objective**\nIdentify and resolve friction points in the alcohol delivery experience to ensure compliance, driver safety, and customer satisfaction.\n\n**Design Optimization Points**\n• Clarify ID verification steps for both customers and drivers\n• Standardize error messaging for failed ID scans or customer no-shows\n\n**New request**\nAdd step-by-step illustrations to guide drivers through ID scanning.',
        },
        chips: [{ label: 'Create Tickets', action: 'create-tickets' }],
      },
    },
  ],
  'create-tickets': [
    {
      delay: 1200,
      response: {
        content: '',
        card: {
          type: 'ticket',
          title: 'Creating a Ticket...',
          description: '',
          status: 'in-progress',
        },
      },
    },
  ],
  'confirm-ticket': [],
  'set-up-meeting': [
    {
      delay: 1200,
      response: {
        content: 'I\'ll set up a meeting for your team. Here are the details:',
        card: {
          type: 'schedule',
          title: 'Pickup & Drop-off UX review',
          date: 'Friday, April 4',
          time: '10:00 AM-10:30 AM',
          attendees: ['Beibei Zhang', 'Kai Garcia', 'Stephen Garcia'],
          location: 'Google Meet',
          timeOptions: [
            { date: 'Friday, April 4,(Tomorrow)', time: '10:00 AM-10:30 AM', selected: true },
            { date: 'Friday, April 4,(Tomorrow)', time: '10:30 AM-11:00 AM' },
          ],
        },
      },
    },
  ],
  'explore-solutions': [
    {
      delay: 1500,
      response: {
        content: 'Based on the report, here are the top solutions to address alcohol delivery compliance issues:\n\n**1. Enhanced ID Verification Flow**\nImplement a step-by-step guide with illustrations for drivers during the ID scanning process.\n\n**2. Automated Compliance Alerts**\nSet up real-time alerts when a delivery involves alcohol, reminding drivers of protocols.\n\n**3. Customer Communication Templates**\nStandardize messaging for failed ID scans, no-shows, and refusal scenarios.',
        chips: [
          { label: 'Create Tasks', action: 'create-tasks' },
          { label: 'Set Up Meeting', action: 'set-up-meeting' },
        ],
      },
    },
  ],
  'default': [
    {
      delay: 1200,
      response: {
        content: 'Got it! I\'ll help you with that. What would you like to do next?',
        chips: [
          { label: 'Learn More', action: 'learn-more' },
          { label: 'Start Over', action: 'new-chat' },
        ],
      },
    },
  ],
};

// Smart response generation based on user message
function generateResponse(message: string): Omit<Message, 'id' | 'timestamp' | 'role'>[] {
  const lower = message.toLowerCase();

  if (lower.includes('meeting') && (lower.includes('summar') || lower.includes('minute') || lower.includes('yesterday'))) {
    return [
      {
        content: 'Looks like there were two meetings yesterday about Pickup and Drop-off: **Design Sync** and **Pain Point Review**. Which one should I summarize for you?',
        chips: [
          { label: 'Design Sync', action: 'summarize-design-sync' },
          { label: 'Pain Point Review', action: 'summarize-pain-point' },
        ],
      },
    ];
  }

  if (lower.includes('report') || lower.includes('research') || lower.includes('find')) {
    return [
      {
        content: 'All done! Let me know if you\'d like some **recommendations** based on the report findings — or, if it makes sense, we can also **explore solutions** or even **set up a meeting** to discuss things further. 😊',
        card: {
          type: 'research',
          title: 'Summary Report: Spark Driver Alcohol Delivery C',
          summary: 'Alcohol delivery introduces a higher regulatory and reputational risk for delivery platforms.',
        },
        chips: [
          { label: 'Set Up Meeting', action: 'set-up-meeting' },
          { label: 'Explore Solutions', action: 'explore-solutions' },
          { label: 'View Recommendations', action: 'view-recommendations' },
        ],
      },
    ];
  }

  if (lower.includes('ticket') || lower.includes('jira') || lower.includes('task')) {
    return [
      {
        content: '',
        card: {
          type: 'ticket',
          title: 'Tickets',
          description: '',
          items: [
            { text: 'provided the engineers\' ETA', assignee: 'Stephen', due: 'Tomorrow' },
            { text: 'design five illustrations according to the \'Deliver\' category', assignee: 'Kai', due: 'Thursday, April 10' },
          ],
        },
      },
    ];
  }

  if (lower.includes('schedule') || lower.includes('meeting') || lower.includes('set up')) {
    return [
      {
        content: 'I\'ll schedule that for you. Here are the details:',
        card: {
          type: 'schedule',
          title: 'Pickup & Drop-off UX review',
          date: 'Friday, April 4',
          time: '10:00 AM-10:30 AM',
          attendees: ['Beibei Zhang', 'Kai Garcia', 'Stephen Garcia'],
          location: 'Google Meet',
          timeOptions: [
            { date: 'Friday, April 4,(Tomorrow)', time: '10:00 AM-10:30 AM', selected: true },
            { date: 'Friday, April 4,(Tomorrow)', time: '10:30 AM-11:00 AM' },
          ],
        },
      },
    ];
  }

  if (lower.includes('goal') || lower.includes('performance')) {
    return [
      {
        content: 'I can help you create performance goals. Here\'s a suggested framework:\n\n**Q2 Design Goals**\n• Improve design system adoption by 40%\n• Reduce time-to-handoff by 20%\n• Conduct 5 user testing sessions\n\nWould you like me to add these to a project tracker?',
        chips: [
          { label: 'Add to Asana', action: 'add-to-asana' },
          { label: 'Customize Goals', action: 'customize-goals' },
        ],
      },
    ];
  }

  if (lower.includes('analyze') || lower.includes('doc')) {
    return [
      {
        content: 'I can analyze documents for you. Please share the document you\'d like me to review, or I can search for relevant documents in your connected apps.',
        chips: [
          { label: 'Search Docs', action: 'search-docs' },
          { label: 'Upload File', action: 'upload-file' },
        ],
      },
    ];
  }

  // Generic response
  return [
    {
      content: 'I\'m on it! Give me a moment to process that for you.',
      chips: [
        { label: 'Ask Follow-up', action: 'follow-up' },
        { label: 'Start Over', action: 'new-chat' },
      ],
    },
  ];
}

const ALCOHOL_PROGRESS_LABELS = [
  'Find driver incident reports',
  'Identify top pain points',
  'Draft summary report',
  'Suggest recommendations',
];

type ProgressStep = { label: string; status: 'completed' | 'active' | 'pending' };

function buildAlcoholProgress(activeIdx: number): ProgressStep[] {
  return ALCOHOL_PROGRESS_LABELS.map((label, i) => ({
    label,
    status: i < activeIdx ? 'completed' : i === activeIdx ? 'active' : 'pending',
  }));
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

let msgIdCounter = 100;
const nextId = () => String(++msgIdCounter);

/** Cosmetic root for every session folder — matches what the future Claude
 *  Code CLI backend will actually mkdir. Shown in the inspector's Folder card
 *  and the chat header's folder chip. */
const SESSION_FOLDER_ROOT = '~/WorkPal';

/** `YYYY-MM-DD` for the `{date}-{slug}` prefix. Uses local time so the folder
 *  name matches what the user sees on their clock. */
function todayDateStamp(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Title → filesystem-safe slug. Lowercase, spaces → dashes, strips
 *  punctuation, keeps CJK characters verbatim (they're valid in POSIX paths
 *  and easier to scan than pinyin). Capped so long prompts don't produce
 *  absurd paths. */
function slugify(title: string): string {
  const lower = title.trim().toLowerCase();
  const cleaned = lower
    // Replace any run of whitespace or unsafe-for-path chars with a dash.
    // Keep letters/digits (incl. non-Latin), dashes, and underscores.
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return cleaned.slice(0, 40).replace(/-+$/g, '') || 'session';
}

// 6.4: no-project chats land in a shared Downloads bucket so the top level of
// ~/WorkPal/ stays clean (one entry per real project + the Downloads folder
// for loose outputs, instead of one folder per one-off chat). Mental model
// matches Mac's ~/Downloads — stuff you haven't filed yet. Promoting a chat
// to a project still pulls it out via nestFolderUnderProject, which only
// reuses the session slug and discards the Downloads prefix.
const DOWNLOADS_BUCKET = 'Downloads';

function buildSessionFolder(title: string, date: Date = new Date()): string {
  return `${SESSION_FOLDER_ROOT}/${DOWNLOADS_BUCKET}/${todayDateStamp(date)}-${slugify(title)}/`;
}

/** When a session is promoted to a project (or moved into one), its folder
 *  nests as `~/WorkPal/{project-slug}/sessions/{session-slug}/`. Extracts the
 *  session's existing `{date}-{slug}` piece so we don't rename the folder on
 *  promote — only reparent it. */
function nestFolderUnderProject(sessionFolder: string | undefined, projectName: string, sessionTitle: string, date: Date = new Date()): string {
  const projectSlug = slugify(projectName);
  let sessionSlug = `${todayDateStamp(date)}-${slugify(sessionTitle)}`;
  if (sessionFolder) {
    // Pull the last non-empty path segment out of the existing folder so we
    // keep whatever the user already saw on screen.
    const parts = sessionFolder.replace(/\/+$/, '').split('/');
    const last = parts[parts.length - 1];
    if (last) sessionSlug = last;
  }
  return `${SESSION_FOLDER_ROOT}/${projectSlug}/sessions/${sessionSlug}/`;
}

// Responsive panel hierarchy (priority-based collapse).
//
// Module minimum widths (per design):
//   • Sidebar (full nav):  280
//   • Center content:      420
//   • Right panel:         260
//   • Mini sidebar rail:    64
//
// Breakpoints derived from those mins:
//   • THREE_MODULE_FIT = 280 + 420 + 260 = 960
//       At or above 960: all three modules can sit inline at their minimums.
//       Below 960: right panel auto-closes (reopening it renders as overlay).
//       The sidebar itself stays at its current mode — with right closed,
//       sidebar + center only need 280 + 420 = 700 to fit.
//   • COMPACT_NAV_BREAKPOINT = 280 + 420 = 700
//       Below 700: even sidebar + center can't fit, so sidebar collapses
//       to the 64px mini rail.
//   • MOBILE_BREAKPOINT = 64 + 420 = 484
//       Below 484: even the mini rail can't sit beside the center column.
//       → Mini rail hides; toggling the sidebar opens it as an overlay.
//       → Right panel can only ever appear as an overlay.
const MOBILE_BREAKPOINT = 484;          // below: no inline nav rail; sidebar overlays when toggled
const COMPACT_NAV_BREAKPOINT = 700;     // below: force MiniSidebar rail (full sidebar overlays)
const THREE_MODULE_FIT = 960;           // below: right panel auto-closes on resize (overlays if reopened)
const SIDEBAR_WIDTH = 280;              // full sidebar minimum width (used for fit calc)
const MINI_SIDEBAR_WIDTH = 64;
const CONTEXT_PANEL_MIN = 260;
const MAIN_CONTENT_MIN = 420;
const subscribe = (cb: () => void) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); };
const getIsMobile = () => window.innerWidth < MOBILE_BREAKPOINT;
const getIsCompactNav = () => window.innerWidth < COMPACT_NAV_BREAKPOINT;
const getCanFitAllThree = () => window.innerWidth >= THREE_MODULE_FIT;
/** Point-in-time check used on send to decide between opening the panel
 *  inline vs. showing a preview animation. Inline render fit is now handled
 *  reactively by SplitView via ResizeObserver. */
const getCanFitPanel = () => {
  const available = window.innerWidth - 16; // m-2 = 8px each side
  const sidebarW = window.innerWidth >= COMPACT_NAV_BREAKPOINT
    ? SIDEBAR_WIDTH
    : window.innerWidth >= MOBILE_BREAKPOINT
      ? MINI_SIDEBAR_WIDTH
      : 0;
  return available - sidebarW - MAIN_CONTENT_MIN >= CONTEXT_PANEL_MIN;
};

/* ── Claude Agent SDK tool-call mapping (5.4c) ──────────────────────────── */
// Tool boundaries, kept as Sets so adding a future file-mutating tool is a
// one-line change — no scattered `if name === ...`.
const CREATE_TOOLS = new Set(['Write']);
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'NotebookEdit']);

const TOOL_LABEL_MAX = 50;

function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

function truncate(s: string, max: number = TOOL_LABEL_MAX): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/** Human-readable label for a tool_use in the inspector's Progress list.
 *  Capped at ~50 chars to fit the one-line row. */
function deriveToolStepLabel(name: string, input: unknown): string {
  const inp = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const filePath = typeof inp.file_path === 'string' ? inp.file_path : '';
  if (CREATE_TOOLS.has(name) && filePath) return truncate(`Create ${basename(filePath)}`);
  if (EDIT_TOOLS.has(name) && filePath) return truncate(`Edit ${basename(filePath)}`);
  if (name === 'Read' && filePath) return truncate(`Read ${basename(filePath)}`);
  if (name === 'Bash') {
    const cmd = typeof inp.command === 'string' ? inp.command : '';
    return truncate(`Bash: ${cmd.slice(0, 40)}`);
  }
  if (name === 'Glob' || name === 'Grep') {
    const pattern = typeof inp.pattern === 'string' ? inp.pattern : '';
    return truncate(`Search: ${pattern}`);
  }
  return truncate(name);
}

/** Map a tool_use to a Changes entry. Only file-mutating tools — Read / Bash /
 *  Glob / Grep etc. show up in Progress but not in Changes. Label is the full
 *  file_path so the user sees it's under /tmp/workpal-sandbox today and
 *  automatically under ~/WorkPal/... once 5.4e switches cwd. Known gap:
 *  Bash-invoked writes (`echo ... > file`) don't surface here — parsing
 *  arbitrary shell is out of scope for 5.4c. */
function deriveChangeFromToolUse(
  name: string,
  input: unknown,
): { kind: ChangeKind; label: string } | null {
  const inp = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const filePath = typeof inp.file_path === 'string' ? inp.file_path : '';
  if (!filePath) return null;
  if (CREATE_TOOLS.has(name)) return { kind: 'create', label: filePath };
  if (EDIT_TOOLS.has(name)) return { kind: 'edit', label: filePath };
  return null;
}


export default function App() {
  const [initialChatState] = useState(getInitialChatState);
  const [chats, setChats] = useState<Chat[]>(initialChatState.chats);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState('white-man');
  const [detailOpen, setDetailOpen] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem('workpal-onboarding-done') === 'true');
  const [projects, setProjects] = useState<Project[]>(loadProjects);

  // Routing: URL is the source of truth for active view / chat / project.
  // `rootChatId` is the one piece of state not derivable from URL — it's
  // which chat the `/` route shows (my-workpal welcome, or a draft after
  // "New Session"). Drafts deliberately don't get their own URL.
  const location = useLocation();
  const navigate = useNavigate();
  const chatMatch = useMatch('/chat/:chatId');
  const projectMatch = useMatch('/project/:projectId');
  const [rootChatId, setRootChatId] = useState<string>(initialChatState.activeChatId);

  type ViewName = 'chat' | 'connectors' | 'design-system' | 'overview' | 'library' | 'memory';
  const activeView: ViewName =
    location.pathname === '/overview' ? 'overview'
    : location.pathname === '/connectors' ? 'connectors'
    : location.pathname === '/design-system' ? 'design-system'
    : location.pathname === '/library' ? 'library'
    : location.pathname === '/memory' ? 'memory'
    : 'chat';
  const activeChatId = chatMatch?.params.chatId ?? rootChatId;
  const activeProjectId = projectMatch?.params.projectId ?? null;
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  /** Chat ids currently being promoted to a project. null = dialog closed,
   *  non-empty array = open the dialog pre-filled from those chats. Single
   *  element for the one-row "Promote to Project" menu, multiple for the
   *  multi-select "New project…" action bar. */
  const [promotingChatIds, setPromotingChatIds] = useState<string[] | null>(null);
  // Memory: persistent context about the user. Core + preference memories apply
  // to every chat; project-scoped memories apply only when a chat sits under
  // the matching project. Injected via buildMemoryBlock in streamFromAPI.
  // Source of truth lives on the backend (so phone + laptop stay in sync);
  // localStorage acts as an offline-friendly first-paint cache.
  const [memories, setMemories] = useState<MemoryEntry[]>(loadMemoriesCache);
  const { ensurePassword, passwordModal } = useMemoryAuth();
  const isMobile = useSyncExternalStore(subscribe, getIsMobile);
  const isCompactNav = useSyncExternalStore(subscribe, getIsCompactNav);
  const canFitAllThree = useSyncExternalStore(subscribe, getCanFitAllThree);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  // 0–3 = current active step index in alcohol-delivery flow, 4 = all completed
  const [alcoholProgress, setAlcoholProgress] = useState(4);
  // Live task-mode progress & tool list — populated from streaming chunks
  // emitted by Gmail/Calendar tool calls. Reset on every new Tasks-mode send.
  const [taskSteps, setTaskSteps] = useState<{ id: string; label: string; status: 'active' | 'completed' }[]>([]);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  // The specific card whose "view-report" was clicked — drives what the side
  // DetailPanel renders. Null = fall back to the alcohol-delivery demo report.
  const [detailCard, setDetailCard] = useState<CardData | null>(null);
  // Phase 7 #2: id of the message that owned `detailCard`. Lets the DetailPanel
  // "Save to card" button write the edited text back to the right message's
  // card without scanning the whole chat by reference. Cleared in lockstep
  // with `detailCard` (both cleared on DetailPanel close and on view-report
  // of a different message).
  const [detailMessageId, setDetailMessageId] = useState<string | null>(null);
  // 6.4: inline preview of an AI-produced artifact (.md / .html / .txt).
  // Populated when the user clicks an ArtifactCard in chat; the server
  // reads the file, the DetailPanel opens with content. null = no preview.
  const [previewArtifact, setPreviewArtifact] = useState<{
    name: string;
    content: string;
    renderAs: 'markdown' | 'html' | 'plaintext';
    path: string;
  } | null>(null);
  // User-resizable DetailPanel width. Resets to default on close so each open
  // starts at 504px — no cross-session persistence by design (see chat note).
  const DETAIL_DEFAULT_WIDTH = 504;
  const [detailPanelWidth, setDetailPanelWidth] = useState(DETAIL_DEFAULT_WIDTH);
  useEffect(() => {
    if (!previewArtifact && !detailOpen) setDetailPanelWidth(DETAIL_DEFAULT_WIDTH);
  }, [previewArtifact, detailOpen]);
  // Voice mode overlay
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [voicePendingText, setVoicePendingText] = useState<string | undefined>();
  const [voicePendingImages, setVoicePendingImages] = useState<string[] | undefined>();
  // Phase 4: auto-commit log + permission gating. Both are session-only —
  // no localStorage, no cross-reload persistence. changes is keyed by chat
  // id so each session has its own log.
  //
  // Demo mode (candidate #2): pre-seed the alcohol-delivery chat with
  // static ChangeEntry rows so HRs see the Changes panel populated even
  // though the Claude Agent SDK cannot run on Vercel serverless.
  const [changes, setChanges] = useState<Record<string, ChangeEntry[]>>(
    IS_DEMO ? { 'alcohol-delivery': DEMO_CHANGES_ALCOHOL } : {},
  );
  /** FIFO queue of permission requests awaiting the user's decision. The
   *  modal renders the head; on resolution the head is shifted off and the
   *  next entry (if any) flows in. A queue is needed — not a single slot —
   *  because two concurrent Claude SDK sessions can each hit canUseTool
   *  before the user resolves the first, and overwriting the slot would
   *  silently drop the earlier prompt and leak its SDK promise.
   *
   *  Two flavors live in the queue:
   *  1. Local-flow permissions (e.g. alcohol-delivery demo) carry a
   *     `resolve(allow)` callback that finishes the awaited Promise.
   *  2. Bridge permissions (5.4d Claude SDK) carry `bridge: {chatId, requestId}`
   *     instead — the modal handlers POST the decision back to the server. */
  type PendingPerm = PermissionRequest & {
    resolve: (allow: boolean) => void;
    bridge?: { chatId: string; requestId: string };
  };
  const [pendingPermissions, setPendingPermissions] = useState<PendingPerm[]>([]);
  const pendingPermission = pendingPermissions[0] ?? null;

  /** 6.3 Complete Session — the modal is driven by two pieces of state:
   *    `completeSessionChatId` — which chat's diff we're looking at (null
   *       when the modal is closed)
   *    `completeSessionPhase`  — the visual state the modal renders
   *  Splitting phase out of chatId lets us open the modal in 'loading'
   *  immediately on click, then transition to 'ready' / 'empty' once the
   *  diff POST resolves, without closing/reopening. */
  const [completeSessionChatId, setCompleteSessionChatId] = useState<string | null>(null);
  const [completeSessionPhase, setCompleteSessionPhase] = useState<CompleteSessionPhase>({ kind: 'loading' });
  /** "Always allow" memory — session-only Set of "{kind}:{scope}" strings.
   *  Subsequent requests matching a stored entry skip the modal.
   *
   *  Ref, not state: the Claude SDK stream's `for await` loop captures this
   *  by closure and runs across multiple permission requests in a single
   *  turn. If we stored it in useState, clicking "Always allow" would schedule
   *  a re-render, but the already-running loop would keep seeing the old
   *  Set and re-prompt on the very next same-scope request. A ref side-steps
   *  the staleness — the loop reads .current each time, so the decision
   *  lands on the same stream that the user just approved. No re-render is
   *  needed because nothing in the UI tree reads this value directly. */
  const approvedScopesRef = useRef<Set<string>>(new Set());

  // Toggle dark class on root element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Responsive auto-collapse: when the viewport drops below the all-three
  // threshold (sidebar + center + right), retract the right panel so the
  // sidebar + center can still fit at their minimums. The user can re-open
  // it; below this threshold SplitView will render it as an overlay.
  useEffect(() => {
    if (!canFitAllThree) {
      setDetailOpen(false);
      setContextPanelOpen(false);
    }
  }, [canFitAllThree]);

  // Persist chats to localStorage on every change
  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  // Persist projects (including uploaded files) so uploads survive a refresh.
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  // Refresh local cache (used as the first-paint snapshot before the next
  // network fetch) whenever memories change.
  useEffect(() => {
    saveMemoriesCache(memories);
  }, [memories]);

  // Pull canonical memory list from the backend on mount so the UI matches
  // whatever was last saved from any device. Falls back silently to the
  // localStorage-cached state if the backend is unreachable.
  useEffect(() => {
    let cancelled = false;
    fetchMemoriesFromServer()
      .then((list) => { if (!cancelled) setMemories(list); })
      .catch((err) => { console.warn('Memory sync failed:', err); });
    return () => { cancelled = true; };
  }, []);

  // Deep-link fallback: if the URL points to a chat/project that no longer
  // exists (stale bookmark, deleted chat), redirect to `/` rather than
  // rendering a broken empty state.
  useEffect(() => {
    if (chatMatch && !chats.some(c => c.id === chatMatch.params.chatId)) {
      console.warn('Unknown chat id in URL, redirecting to /:', chatMatch.params.chatId);
      navigate('/', { replace: true });
    }
  }, [chatMatch, chats, navigate]);
  useEffect(() => {
    if (projectMatch && !projects.some(p => p.id === projectMatch.params.projectId)) {
      console.warn('Unknown project id in URL, redirecting to /:', projectMatch.params.projectId);
      navigate('/', { replace: true });
    }
  }, [projectMatch, projects, navigate]);

  // 6.1: first-time-entering-a-project hook. Fires `postInitProject` every
  // time `activeProjectId` transitions to a valid project, which subsumes
  // direct navigation, deep links, page reloads, and `handlePromoteToProject`
  // (which also calls init explicitly as belt-and-braces). Backend is
  // idempotent, so duplicate POSTs are cheap. Covers the "existing project
  // without .git" case where the folder predates Phase 6 — first entry after
  // upgrade lazily initializes it. Principle #6: lazy, on-demand creation.
  useEffect(() => {
    if (!activeProjectId) return;
    // Claude Agent SDK only runs on localhost dev. Skip the project-init
    // POST on both Vercel deployments (demo + self-use) — the endpoint
    // would return an error and clutter the console without any upside.
    if (!IS_CLAUDE_CODE_AVAILABLE) return;
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;
    void postInitProject(slugify(project.name)).then(result => {
      if (!result.ok) {
        console.warn(`[project-init] open failed: ${result.error}`);
      }
    });
  }, [activeProjectId, projects]);

  // 6.5: mount-time orphan worktree reaper. Fire-and-forget sweep — for
  // each project, the backend removes `session/<slug>` worktrees whose
  // paths aren't in `activeSessionFolders`, and prunes shape-B dangling
  // metadata. `sessionCompleted: true` chats are included as live per the
  // 6.5 decision lock (retention policy deferred to Phase 7+). Any `skipped`
  // entry in the summary gets a console.warn so payload bugs (slug typos,
  // cross-project leaks) surface even though the endpoint returns 200. Empty
  // deps are intentional: one sweep per app mount; re-firing on chats /
  // projects change would be constant noise on every message.
  useEffect(() => {
    if (projects.length === 0) return;
    // Same reasoning as the project-init hook above: the reaper lives on the
    // Claude Code backend and can't run on Vercel serverless. Skip outside
    // localhost dev.
    if (!IS_CLAUDE_CODE_AVAILABLE) return;
    const payload = projects.map(p => {
      const activeSessionFolders = chats
        .filter(c => c.projectId === p.id && c.sessionFolder)
        .map(c => c.sessionFolder!);
      return { projectSlug: slugify(p.name), activeSessionFolders };
    });
    void postReaperRun(payload).then(result => {
      if (!result.ok) {
        console.warn(`[reaper] ${result.error}`);
        return;
      }
      for (const entry of result.summary) {
        if (entry.skipped) {
          console.warn(
            `[reaper] ${entry.projectSlug} skipped (${entry.skipped}): ${entry.skippedReason ?? ''}`,
          );
        } else if (
          entry.reapedCount > 0 ||
          entry.prunedCount > 0 ||
          entry.errors.length > 0
        ) {
          console.log(
            `[reaper] ${entry.projectSlug}: reaped=${entry.reapedCount} pruned=${entry.prunedCount} errors=${entry.errors.length}`,
          );
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  // Detect if AI is currently responding (last message is a loading indicator)
  const isAiResponding = !!activeChat?.messages.some(m => m.isLoading);

  const updateChat = useCallback((chatId: string, updater: (chat: Chat) => Chat) => {
    setChats(prev => prev.map(c => c.id === chatId ? updater(c) : c));
  }, []);

  const addMessage = useCallback((chatId: string, message: Message) => {
    updateChat(chatId, chat => ({
      ...chat,
      messages: [...chat.messages, message],
      lastMessage: message.content || 'New message',
      timestamp: message.timestamp,
    }));
  }, [updateChat]);

  /** Append a change entry to the chat's log. Shown in the inspector's
   *  Changes card. Claude-backed entries get a `toolUseId` so the later
   *  `commit` SSE chunk can find this row and stamp the hash; demo entries
   *  carry neither `toolUseId` nor `commit` and render as pure cosmetic
   *  flips when the user clicks Undo. */
  const addChange = useCallback((chatId: string, entry: Omit<ChangeEntry, 'id' | 'timestamp'>) => {
    const full: ChangeEntry = {
      ...entry,
      id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
    };
    setChanges(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), full] }));
  }, []);

  /** 5.5: stamp a Change entry with its git commit hash once the backend
   *  emits the matching `commit` SSE chunk. Matching is by `toolUseId` (set
   *  on the entry when the tool_use chunk first arrived). If no matching
   *  entry exists the chunk is silently dropped — can happen if the user
   *  navigated away from a chat mid-stream. */
  const stampCommit = useCallback((chatId: string, toolUseId: string, commit: string) => {
    setChanges(prev => {
      const list = prev[chatId];
      if (!list) return prev;
      let changed = false;
      const next = list.map(c => {
        if (c.toolUseId === toolUseId && !c.commit) {
          changed = true;
          return { ...c, commit };
        }
        return c;
      });
      return changed ? { ...prev, [chatId]: next } : prev;
    });
  }, []);

  /** Undo a Change entry. Claude-backed entries (with a `commit` hash and a
   *  `sessionFolder` on the chat) POST to the server for a real
   *  `git reset --hard HEAD~1`; only the latest committed entry is offered an
   *  Undo button (LIFO, enforced by TaskContextPanel) so the server can stay
   *  stateless. On POST failure we stamp `undoError` on the entry — the panel
   *  renders it inline in red and auto-clears it after 5s. Demo/simulated
   *  entries (no commit) keep the original cosmetic flip. */
  const handleUndoChange = useCallback(async (chatId: string, changeId: string) => {
    const chat = chats.find(c => c.id === chatId);
    const entry = (changes[chatId] || []).find(c => c.id === changeId);
    if (!entry) return;

    if (!entry.commit || !chat?.sessionFolder) {
      setChanges(prev => {
        const list = prev[chatId] || [];
        return { ...prev, [chatId]: list.map(c => c.id === changeId ? { ...c, undone: true } : c) };
      });
      return;
    }

    const result = await postUndoChange(chat.sessionFolder, changeId);
    if (result.ok) {
      setChanges(prev => {
        const list = prev[chatId] || [];
        return { ...prev, [chatId]: list.map(c => c.id === changeId ? { ...c, undone: true, undoError: undefined } : c) };
      });
      return;
    }

    setChanges(prev => {
      const list = prev[chatId] || [];
      return { ...prev, [chatId]: list.map(c => c.id === changeId ? { ...c, undoError: result.error } : c) };
    });
    // 5s auto-dismiss so the error doesn't stick around once the user has
    // had a chance to read it. If they retry and fail again, the new error
    // replaces this one (same entry id, last-write-wins) and the timer resets.
    window.setTimeout(() => {
      setChanges(prev => {
        const list = prev[chatId];
        if (!list) return prev;
        const hit = list.find(c => c.id === changeId);
        if (!hit?.undoError) return prev;
        return { ...prev, [chatId]: list.map(c => c.id === changeId ? { ...c, undoError: undefined } : c) };
      });
    }, 5000);
  }, [chats, changes]);

  /** 6.3: open the Complete Session modal and fetch the diff preview.
   *  Entry point from TaskContextPanel's footer button. Computes
   *  projectSlug + sessionFolder the same way `streamClaudeChat` does
   *  (principle #9 — one slug flows from UI to git), POSTs to
   *  /api/session/complete, and parks the response in `completeSessionPhase`
   *  so the modal transitions from 'loading' to 'ready' / 'empty' / 'error-other'.
   *  Modal stays open on error so the user sees the message; they close with
   *  Cancel. */
  const handleCompleteSession = useCallback(async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat?.projectId || !chat.sessionFolder) return;
    const project = projects.find(p => p.id === chat.projectId);
    if (!project) return;
    const projectSlug = slugify(project.name);

    setCompleteSessionChatId(chatId);
    setCompleteSessionPhase({ kind: 'loading' });

    const result = await postSessionComplete(projectSlug, chat.sessionFolder);
    // Defensive: the user may have closed the modal (or switched chats)
    // while the POST was in flight. Drop the response if so — don't clobber
    // whatever phase they're looking at now.
    setCompleteSessionChatId(currentId => {
      if (currentId !== chatId) return currentId;
      if (result.ok) {
        setCompleteSessionPhase(
          result.files.length === 0
            ? { kind: 'empty' }
            : { kind: 'ready', files: result.files },
        );
      } else {
        setCompleteSessionPhase({ kind: 'error-other', message: result.error });
      }
      return currentId;
    });
  }, [chats, projects]);

  /** 6.3: user approved the diff — POST /api/session/merge and map the
   *  response to the modal's success / not-ff / other-error phases. On
   *  success we flip `chat.sessionCompleted` so the footer button permanently
   *  disables (rolling back after a successful merge is out of Phase 6
   *  scope) and auto-close the modal after a brief confirmation delay. */
  const handleMergeSession = useCallback(async () => {
    const chatId = completeSessionChatId;
    if (!chatId) return;
    const chat = chats.find(c => c.id === chatId);
    if (!chat?.projectId || !chat.sessionFolder) return;
    const project = projects.find(p => p.id === chat.projectId);
    if (!project) return;
    const projectSlug = slugify(project.name);

    setCompleteSessionPhase({ kind: 'merging' });
    const result = await postSessionMerge(projectSlug, chat.sessionFolder);

    // Same in-flight guard as handleCompleteSession — modal may have been
    // closed while the POST was landing.
    setCompleteSessionChatId(currentId => {
      if (currentId !== chatId) return currentId;
      if (result.ok) {
        setChats(prev => prev.map(c =>
          c.id === chatId ? { ...c, sessionCompleted: true } : c,
        ));
        setCompleteSessionPhase({ kind: 'success', alreadyUpToDate: result.alreadyUpToDate });
        // Auto-close after a beat so the user sees the ✅ land but the modal
        // doesn't linger. Cleared below if the user closes it first.
        window.setTimeout(() => {
          setCompleteSessionChatId(inner => (inner === chatId ? null : inner));
        }, 1800);
      } else if (result.reason === 'not-ff') {
        setCompleteSessionPhase({
          kind: 'error-not-ff',
          message: result.error,
          cliCommand: result.cliCommand,
        });
      } else {
        setCompleteSessionPhase({ kind: 'error-other', message: result.error });
      }
      return currentId;
    });
  }, [completeSessionChatId, chats, projects]);

  /** Open the PermissionPrompt modal and await the user's decision. Returns
   *  true on Allow / Always allow, false on Cancel. "Always allow" also
   *  caches the scope so subsequent same-scope requests skip the modal for
   *  this session. */
  const requestPermission = useCallback((req: Omit<PermissionRequest, 'id'>): Promise<boolean> => {
    const scopeKey = `${req.kind}:${req.scope}`;
    if (approvedScopesRef.current.has(scopeKey)) return Promise.resolve(true);
    return new Promise<boolean>(resolve => {
      setPendingPermissions(prev => [
        ...prev,
        { ...req, id: `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, resolve },
      ]);
    });
  }, []);

  /** Flip a chat into "inspector" state: persist `hasInspector: true` on the
   *  chat (so reopens restore the panel) and open the right side panel. Called
   *  the first time the AI decides to use a tool in a given chat — that's the
   *  signal that this is real work, not just a chat. */
  const openInspector = useCallback((chatId: string) => {
    setChats(prev => prev.map(c =>
      c.id === chatId && !c.hasInspector ? { ...c, hasInspector: true } : c
    ));
    setContextPanelOpen(true);
  }, []);

  const showTypingThenRespond = useCallback((
    chatId: string,
    responses: Omit<Message, 'id' | 'timestamp' | 'role'>[],
    delay = 1200,
  ) => {
    // Show typing indicator
    const loadingId = nextId();
    addMessage(chatId, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    });

    setTimeout(() => {
      // Remove loading, add real response(s)
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const withoutLoader = c.messages.filter(m => m.id !== loadingId);
        const newMessages: Message[] = responses.map(r => ({
          ...r,
          id: nextId(),
          role: 'assistant' as const,
          timestamp: new Date(),
        }));
        return {
          ...c,
          messages: [...withoutLoader, ...newMessages],
          lastMessage: responses[0]?.content || 'New message',
          timestamp: new Date(),
        };
      }));
    }, delay);
  }, [addMessage]);

  // Stream a real LLM response for non-demo chats
  const streamFromAPI = useCallback(async (
    chatId: string,
    userText: string,
    userAttachments?: Attachment[],
    /** Override for fresh chats created by handleCreateChatInProject — the
     *  chats closure hasn't committed yet, so we can't look up projectId via
     *  the chat row the way the post-submit path does. */
    projectIdOverride?: string,
  ) => {
    // Collect conversation history for context
    // We pass userText/attachments explicitly because setChats hasn't committed yet.
    // Historical messages forward their own image attachments too so the model keeps
    // visual context across turns (e.g. user: "look again at the image I sent").
    const chat = chats.find(c => c.id === chatId);
    const previousMessages = (chat?.messages || [])
      .filter(m => !m.isLoading)
      .map(m => {
        const imgs = (m.attachments || []).filter(a => a.kind === 'image').map(a => a.dataUrl);
        return imgs.length > 0
          ? { role: m.role, content: m.content, images: imgs }
          : { role: m.role, content: m.content };
      });
    // Project-level reference files: treat them as persistent context that
    // applies to every message in any chat scoped to this project. Prepended
    // ahead of per-message attachments so the model sees the project brief
    // first, then the user's specific upload, then the question.
    const projectId = projectIdOverride ?? chat?.projectId;
    const project = projectId ? projects.find(p => p.id === projectId) : null;
    const projectFiles = project?.files || [];
    const projectDocBlock = projectFiles.length > 0
      ? await buildAttachmentContextBlock(projectFiles, 'project')
      : null;
    const projectImages = projectFiles.filter(a => a.kind === 'image').map(a => a.dataUrl);
    // Memory: core + preference memories always apply; project memories apply
    // only when the active chat is in the matching project. Kept stable across
    // turns so prompt caching on the backend can reuse it once implemented.
    const memoryBlock = buildMemoryBlock(memories, projectId ?? undefined);
    // Extract text from non-image attachments (PDFs, .txt, .md, etc.) and
    // inline it ahead of the user's message so the model can answer about it.
    const docText = userAttachments ? await buildAttachmentContextBlock(userAttachments) : null;
    // Order: memory → project docs → per-message attachments → user question.
    // Memory goes first so the model frames everything that follows through
    // the user's preferences.
    const combinedText = [memoryBlock, projectDocBlock, docText, userText]
      .filter((s): s is string => !!s && s.length > 0)
      .join('\n\n');
    const currentImages = [
      ...projectImages,
      ...(userAttachments || []).filter(a => a.kind === 'image').map(a => a.dataUrl),
    ];
    const currentMessage = currentImages.length > 0
      ? { role: 'user' as const, content: combinedText, images: currentImages }
      : { role: 'user' as const, content: combinedText };
    const history = [...previousMessages, currentMessage];

    // Add a loading placeholder
    const assistantId = nextId();
    addMessage(chatId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    });

    try {
      let fullContent = '';
      for await (const chunk of streamChat(history)) {
        if (chunk.type === 'text') {
          fullContent += chunk.content;
          // Update the message in-place with streamed content
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantId
                  ? { ...m, content: fullContent, isLoading: true }
                  : m
              ),
            };
          }));
        } else if (chunk.type === 'images') {
          // Append image search results to the in-flight assistant message so
          // they render in the grid below the streaming text.
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantId
                  ? { ...m, imageResults: [...(m.imageResults || []), ...chunk.images] }
                  : m
              ),
            };
          }));
        } else if (chunk.type === 'videos') {
          // Append YouTube video cards to the in-flight assistant message.
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantId
                  ? { ...m, videoResults: [...(m.videoResults || []), ...chunk.videos] }
                  : m
              ),
            };
          }));
        } else if (chunk.type === 'web_results') {
          // Stream web-search hits into the in-flight message so the source
          // chips appear immediately while the model synthesizes its reply.
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantId
                  ? { ...m, webResults: [...(m.webResults || []), ...chunk.results] }
                  : m
              ),
            };
          }));
        } else if (chunk.type === 'card') {
          // Gmail/Calendar tool produced a structured card — attach it to the
          // in-flight assistant message so MessageCard renders it. Only the
          // first card wins per message (matches how scripted flows work).
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantId && !m.card
                  ? { ...m, card: chunk.card }
                  : m
              ),
            };
          }));
        } else if (chunk.type === 'task_step') {
          // Live task-panel progress — update by id (server reuses tool_call_id
          // so the same step flips from active → completed in place).
          setTaskSteps(prev => {
            const idx = prev.findIndex(s => s.id === chunk.step.id);
            if (idx === -1) return [...prev, chunk.step];
            const next = prev.slice();
            next[idx] = chunk.step;
            return next;
          });
          // First tool signal in this chat → mark hasInspector + open the
          // side panel. The model deciding to call a tool IS the "this is
          // complex" signal, so we don't need a client-side heuristic.
          openInspector(chatId);
        } else if (chunk.type === 'tool_active') {
          setActiveTools(prev => prev.includes(chunk.name) ? prev : [...prev, chunk.name]);
          openInspector(chatId);
        } else if (chunk.type === 'error') {
          fullContent = `Sorry, something went wrong: ${chunk.content}`;
        }
      }
      // Finalize: remove loading state. A read-only tool can produce a card
      // with no accompanying text — don't show the "No response received."
      // fallback in that case, since the card IS the answer.
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map(m => {
            if (m.id !== assistantId) return m;
            const hasStructured = !!(m.card || m.imageResults?.length || m.videoResults?.length || m.webResults?.length);
            const finalText = fullContent || (hasStructured ? '' : 'No response received.');
            return { ...m, content: finalText, isLoading: false };
          }),
          lastMessage: fullContent || 'No response received.',
          timestamp: new Date(),
        };
      }));
    } catch {
      // Network error fallback
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Failed to connect to AI. Is the server running?', isLoading: false }
              : m
          ),
        };
      }));
    }
  }, [chats, projects, memories, addMessage, openInspector]);

  // Phase 5.4b/5.4c — Claude Agent SDK path. Picked by src/lib/intentRouter
  // when the user's message contains a code/file keyword. 5.4b: text streaming.
  // 5.4c: tool_use flips `hasInspector`, appends Changes entries for file
  // mutations, and drives the Progress list via tool_use/tool_result pairing.
  // Attachments / project docs / memory block intentionally not wired here yet.
  const streamFromClaudeAPI = useCallback(async (
    chatId: string,
    userText: string,
    // Fresh chats mint their sessionFolder in handleSend the same tick they
    // call this function, which is before React has flushed the setChats that
    // stores it. Reading `chat?.sessionFolder` from this closure would see
    // the pre-flush value (undefined) and the server would reject the request
    // with a 400. Accepting an override lets handleSend hand the freshly-
    // computed path straight through; established chats rely on the closure
    // lookup like before.
    overrideSessionFolder?: string,
    // 6.4: true if the user attached any local file with this message. Today
    // handleSend routes attachment-bearing messages to the OpenAI path, so
    // this defaults to false and the SDK runs in web-first mode (Bash/Read/
    // Glob/Grep stripped). Kept as a param so when attachments get wired into
    // the Claude path later, the only change is flipping this flag at the
    // callsite — rule stays "user shared something → SDK can touch local".
    hasAttachedFiles = false,
  ) => {
    const chat = chats.find(c => c.id === chatId);
    const previousMessages = (chat?.messages || [])
      .filter(m => !m.isLoading)
      .map(m => ({ role: m.role, content: m.content }));
    const history = [...previousMessages, { role: 'user' as const, content: userText }];

    const assistantId = nextId();
    addMessage(chatId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    });

    // 6.2: project-owned chats pass their project's slug alongside sessionFolder
    // so the backend can `git worktree add -b session/<slug>` at request start.
    // `slugify(project.name)` matches what built the sessionFolder (via
    // nestFolderUnderProject / buildSessionFolder) and what went to
    // /project/init in 6.1 — principle #9, the same slug flows from UI to git.
    // Chats outside any project (chat.projectId === undefined) leave this
    // undefined and the backend falls back to Phase 5's per-session git init.
    const project = chat?.projectId
      ? projects.find(p => p.id === chat.projectId)
      : null;
    const projectSlug = project ? slugify(project.name) : undefined;

    try {
      let fullContent = '';
      // Per-request lookup: tool_use id → absolute file path. Populated when a
      // file-write tool_use arrives (so we have the path in hand), read back
      // on tool_result.isError (to unpin the optimistic chat-bubble
      // ArtifactCard) and on `commit` (to append the file to the project's
      // Output grid). Closure-local — no cross-request bleed.
      const toolUsePaths = new Map<string, string>();
      for await (const chunk of streamClaudeChat({
        prompt: userText,
        sessionId: chatId,
        sessionFolder: overrideSessionFolder ?? chat?.sessionFolder,
        projectSlug,
        hasAttachedFiles,
        messages: history,
      })) {
        if (chunk.type === 'text') {
          fullContent += chunk.content;
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantId ? { ...m, content: fullContent, isLoading: true } : m
              ),
            };
          }));
        } else if (chunk.type === 'tool_use') {
          // First tool call in this chat → mark hasInspector + open the panel.
          // The model deciding to reach for a tool IS the "this is work" signal.
          openInspector(chatId);
          setActiveTools(prev => prev.includes(chunk.name) ? prev : [...prev, chunk.name]);
          // 5.4e: a file-mutating tool means the backend just ran `mkdir -p`
          // on the session folder, so flip `folderMaterialized` to reveal the
          // folder chip. Pure Q&A sessions never hit this branch and stay
          // chip-less. Idempotent across later tool_use events in the same
          // session — React bails on the no-op setState.
          if (CREATE_TOOLS.has(chunk.name) || EDIT_TOOLS.has(chunk.name)) {
            setChats(prev => prev.map(c =>
              c.id === chatId && !c.folderMaterialized ? { ...c, folderMaterialized: true } : c
            ));
            // Push an ArtifactCard onto the streaming assistant message so
            // the file is visible inline as soon as the write is requested.
            // De-dup by path — a later Edit on the same file shouldn't add a
            // second card. If the tool_result comes back with isError, the
            // matching branch below removes this card again.
            const inp = chunk.input && typeof chunk.input === 'object'
              ? (chunk.input as Record<string, unknown>)
              : {};
            const filePath = typeof inp.file_path === 'string' ? inp.file_path : '';
            if (filePath) {
              toolUsePaths.set(chunk.id, filePath);
              const artifact = artifactFromClaudePath(filePath);
              setChats(prev => prev.map(c => {
                if (c.id !== chatId) return c;
                return {
                  ...c,
                  messages: c.messages.map(m => {
                    if (m.id !== assistantId) return m;
                    const existing = m.artifacts || [];
                    if (existing.some(a => a.path === filePath)) return m;
                    return { ...m, artifacts: [...existing, artifact] };
                  }),
                };
              }));
            }
          }
          // Defensive: if the SDK ever emits a tool_use without an id, fall back
          // to a unique synthetic id so this step doesn't mass-match any later
          // empty-id tool_result (which would wrongly complete other steps).
          const stepId = chunk.id || `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setTaskSteps(prev => [
            ...prev,
            { id: stepId, label: deriveToolStepLabel(chunk.name, chunk.input), status: 'active' },
          ]);
          const change = deriveChangeFromToolUse(chunk.name, chunk.input);
          if (change) addChange(chatId, { ...change, toolUseId: chunk.id });
        } else if (chunk.type === 'tool_result') {
          // Flip the matching Progress step to completed.
          setTaskSteps(prev => prev.map(s =>
            s.id === chunk.toolUseId ? { ...s, status: 'completed' } : s
          ));
          // 5.6: Claude often retries file writes at wrong paths (/root/,
          // /repo/) before landing on the real session folder. Each failed
          // attempt produces a tool_use that lands a Change entry which
          // never gets a commit (backend drops it from pendingWrites on
          // isError=true). Mirror that cleanup in the UI so the inspector
          // only shows real, recoverable file changes.
          if (chunk.isError) {
            setChanges(prev => {
              const list = prev[chatId];
              if (!list) return prev;
              const filtered = list.filter(c => c.toolUseId !== chunk.toolUseId);
              if (filtered.length === list.length) return prev;
              return { ...prev, [chatId]: filtered };
            });
            // Matching ArtifactCard cleanup — if this tool_use had pushed a
            // card onto the assistant message, pull it back out so the user
            // doesn't see a pill for a write that didn't land.
            const failedPath = toolUsePaths.get(chunk.toolUseId);
            if (failedPath) {
              toolUsePaths.delete(chunk.toolUseId);
              setChats(prev => prev.map(c => {
                if (c.id !== chatId) return c;
                return {
                  ...c,
                  messages: c.messages.map(m => {
                    if (m.id !== assistantId || !m.artifacts) return m;
                    const next = m.artifacts.filter(a => a.path !== failedPath);
                    if (next.length === m.artifacts.length) return m;
                    return { ...m, artifacts: next };
                  }),
                };
              }));
            }
          }
        } else if (chunk.type === 'commit') {
          // 5.5: server auto-committed this file-write's disk state. Stamp the
          // matching Change entry with the commit hash so LIFO Undo lights up.
          // Ordering: this chunk always arrives AFTER the tool_result for the
          // same toolUseId, so the Change entry reliably exists by now.
          stampCommit(chatId, chunk.toolUseId, chunk.commit);
          // If this chat lives under a project, promote the committed file
          // into the project's Output grid. De-dup by filename — re-editing
          // the same file shouldn't produce a duplicate output card. Persists
          // through saveProjects on the effect below.
          const committedPath = toolUsePaths.get(chunk.toolUseId);
          if (committedPath && chat?.projectId) {
            const name = basename(committedPath);
            const type = outputTypeFromPath(committedPath);
            setProjects(prev => prev.map(p => {
              if (p.id !== chat.projectId) return p;
              const existing = p.outputs || [];
              if (existing.some(o => o.name === name)) return p;
              const entry: OutputItem = {
                id: `output-${chunk.toolUseId}`,
                name,
                type,
              };
              return { ...p, outputs: [...existing, entry] };
            }));
          }
        } else if (chunk.type === 'permission_request') {
          // 5.4d bridge: server parked a SDK canUseTool resolver under
          // chunk.requestId. If the user has already granted "Always allow"
          // for this scope this session, auto-POST allow without surfacing
          // the modal (acceptance test #6). Otherwise enqueue a
          // bridge-flavored prompt — the modal handlers POST the user's
          // decision back to the same requestId.
          //
          // Ref lookup (not closure): the user may click "Always allow"
          // mid-stream, and we want the very next permission_request in
          // this same loop to pick it up. A state closure would still be
          // reading the pre-click Set here.
          const scopeKey = `${chunk.kind}:${chunk.scope}`;
          if (approvedScopesRef.current.has(scopeKey)) {
            void postClaudePermissionDecision(chunk.requestId, chatId, 'allow');
          } else {
            setPendingPermissions(prev => [
              ...prev,
              {
                id: chunk.requestId,
                kind: chunk.kind,
                target: chunk.target,
                scope: chunk.scope,
                resolve: () => {/* no-op for bridge — decision goes via POST */},
                bridge: { chatId, requestId: chunk.requestId },
              },
            ]);
          }
        } else if (chunk.type === 'error') {
          fullContent = `Sorry, something went wrong: ${chunk.content}`;
        }
        // claude_done: usage/cost — ignored for now.
      }
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId
              ? { ...m, content: fullContent || 'No response received.', isLoading: false }
              : m
          ),
          lastMessage: fullContent || 'No response received.',
          timestamp: new Date(),
        };
      }));
    } catch {
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Failed to connect to AI. Is the server running?', isLoading: false }
              : m
          ),
        };
      }));
    }
  }, [chats, projects, addMessage, openInspector, addChange, stampCommit]);

  // Candidate #3 — artifact generation path. Picked by shouldGenerateArtifact
  // when the user's message combines an artifact noun ("周刊", "digest") with
  // an action verb ("写", "make"). Pipeline runs synchronously server-side
  // (Tavily + OpenAI ×2, ~10-30s); we render a generating-status card
  // immediately and swap it to ready/failed when the POST resolves.
  const streamArtifactFromAPI = useCallback(async (chatId: string, userText: string) => {
    const chat = chats.find(c => c.id === chatId);
    const project = chat?.projectId ? projects.find(p => p.id === chat.projectId) : null;

    const assistantId = nextId();
    const initialTitle = userText.trim().slice(0, 60);
    addMessage(chatId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      card: {
        type: 'artifact',
        title: initialTitle,
        status: 'generating',
        templateId: 'bay-area-weekend',
      },
    });

    try {
      const { artifact, url } = await generateArtifactRequest({
        templateId: 'bay-area-weekend',
        topic: userText.trim() || undefined,
        chatId,
        projectId: project?.id,
      });
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  isLoading: false,
                  content: '',
                  card: {
                    type: 'artifact',
                    title: artifact.contentEn?.title || initialTitle,
                    status: 'ready',
                    templateId: artifact.templateId,
                    slug: artifact.slug,
                    url,
                    coverImageUrl: artifact.coverImageUrl,
                    itemCount: artifactItemCount(artifact, 'en'),
                  },
                }
              : m
          ),
        };
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  isLoading: false,
                  content: '',
                  card: {
                    type: 'artifact',
                    title: initialTitle,
                    status: 'failed',
                    templateId: 'bay-area-weekend',
                    error: msg,
                  },
                }
              : m
          ),
        };
      }));
    }
  }, [chats, projects, addMessage]);

  // Auto-respond when opening ux-meeting chat with only the user message
  useEffect(() => {
    if (!activeChat) return;
    const msgs = activeChat.messages;
    // Only auto-respond if last message is from user and no assistant reply yet
    if (msgs.length >= 1 && msgs[msgs.length - 1].role === 'user' && activeChat.id === 'ux-meeting') {
      const responses = generateResponse(msgs[msgs.length - 1].content);
      showTypingThenRespond(activeChat.id, responses, 1200);
    }
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Custom multi-step flow for the Alcohol Delivery Issues demo chat.
  // Phase 4: between step 1 and step 2 we pop a PermissionPrompt asking to
  // read an external file. Allow → flow resumes; Cancel → flow halts with a
  // Change entry "Task stopped: permission denied".
  const runAlcoholDeliveryFlow = useCallback(async (chatId: string) => {
    const cardMsgId = nextId();

    // Clear any prior changes so repeated runs of the demo start fresh.
    setChanges(prev => ({ ...prev, [chatId]: [] }));

    const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

    // 1. Show in-progress research card after a short delay
    await sleep(300);
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      const inProgress: Message = {
        id: cardMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        card: {
          type: 'research',
          title: 'Confirming citation',
          summary: '',
          status: 'in-progress',
        },
      };
      return { ...c, messages: [...c.messages, inProgress], timestamp: new Date() };
    }));

    // 2. First progress step runs, then we gate step 2 behind permission.
    setAlcoholProgress(0);
    await sleep(1300);

    const allowed = await requestPermission({
      kind: 'file-read',
      target: '~/Downloads/driver_reports.zip',
      scope: '~/Downloads/driver_reports.zip',
      reason: 'Needed to identify top pain points from the Spark driver incident archive.',
    });
    if (!allowed) {
      addChange(chatId, {
        kind: 'halt',
        label: 'Task stopped: permission denied for ~/Downloads/driver_reports.zip',
      });
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const messages = c.messages.map(m =>
          m.id === cardMsgId
            ? {
                ...m,
                content: 'I stopped here — I don\'t have permission to read `~/Downloads/driver_reports.zip`. Let me know if you\'d like to grant access or pick a different source.',
                card: undefined,
              }
            : m
        );
        return { ...c, messages };
      }));
      return;
    }

    // 3. Resume: steps 2 → 4 progress, file changes appear at step 3 and 4.
    setAlcoholProgress(1);
    await sleep(1000);
    setAlcoholProgress(2);
    await sleep(1000);
    setAlcoholProgress(3);
    addChange(chatId, { kind: 'create', label: 'summary-report.md' });
    await sleep(1000);

    // 4. Swap in-progress card → final report preview + chips, edit the file
    setAlcoholProgress(4);
    addChange(chatId, { kind: 'edit', label: 'summary-report.md (added recommendations)' });
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      const messages = c.messages.map(m =>
        m.id === cardMsgId
          ? {
              ...m,
              content: 'All done! Let me know if you\'d like some **recommendations** based on the report findings — or, if it makes sense, we can also **explore solutions** or even **set up a meeting** to discuss things further. 😊',
              card: {
                type: 'research' as const,
                title: 'Summary Report: Spark Driver Alcohol',
                summary: 'Alcohol delivery introduces a higher regulatory and reputational risk for delivery platforms.',
              },
              chips: [
                { label: 'Set Up Meeting', action: 'set-up-meeting' },
                { label: 'Explore Solutions', action: 'explore-solutions' },
                { label: 'View Recommendations', action: 'view-recommendations' },
              ],
            }
          : m
      );
      return { ...c, messages };
    }));
  }, [requestPermission, addChange]);

  const handleSend = useCallback((text: string, attachments?: Attachment[]) => {
    // Special-case the alcohol-delivery demo chat: keep title, run scripted
    // flow, and auto-open the inspector (the demo is a scripted "complex task"
    // — we don't wait for a real tool call to flip it on).
    if (activeChatId === 'alcohol-delivery') {
      const userMessage: Message = {
        id: nextId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
        ...(attachments && attachments.length ? { attachments } : {}),
      };
      setChats(prev => prev.map(c =>
        c.id === 'alcohol-delivery'
          ? { ...c, messages: [...c.messages, userMessage], lastMessage: text, timestamp: new Date(), hasInspector: true }
          : c
      ));
      setContextPanelOpen(true);
      runAlcoholDeliveryFlow('alcohol-delivery');
      return;
    }

    // Fresh send — clear any prior live progress/tools so the inspector panel
    // shows this run's work, not the previous one's.
    setTaskSteps([]);
    setActiveTools([]);

    // Find or create active chat
    let chatId = activeChatId;
    // Track the sessionFolder this send WILL use. Computed synchronously here
    // so we can hand it directly to streamFromClaudeAPI instead of relying on
    // React flushing the setChats below before the async function's closure
    // snapshot captures `chats`. Defaults to the existing chat's value and
    // only gets overwritten in the fresh-chat branch.
    let sessionFolderForSend = activeChat?.sessionFolder;

    // If on welcome screen or empty session, update the existing chat's title
    if (!activeChat || activeChat.messages.length === 0) {
      const titleSource = text || (attachments && attachments.length ? attachments[0].name : '');
      const derivedTitle = titleSource
        ? titleSource.slice(0, 40) + (titleSource.length > 40 ? '...' : '')
        : 'New Session';
      // Auto-generate the session folder on first send. The slug comes from
      // the derived title, not the chat id, so it's meaningful to humans.
      const sessionFolder = buildSessionFolder(titleSource || 'session');
      // Mirror the `?? sessionFolder` fallback used in setChats below so the
      // value we forward matches what the chat will end up with.
      sessionFolderForSend = activeChat?.sessionFolder ?? sessionFolder;
      if (activeChat && activeChat.messages.length === 0) {
        // Reuse existing empty chat (e.g. "New Session") and update its title.
        // Promote it from draft → recent so it shows up in the Recents list.
        chatId = activeChat.id;
        setChats(prev => prev.map(c =>
          c.id === chatId ? { ...c, title: derivedTitle, lastMessage: text, timestamp: new Date(), isDraft: false, sessionFolder: c.sessionFolder ?? sessionFolder } : c
        ));
        // Draft graduation: swap `/` for `/chat/:id` with replace so the back
        // button doesn't bounce between draft-empty and draft-sent. my-workpal
        // is the exception — the welcome chat always lives at `/`.
        if (chatId !== 'my-workpal' && !chatMatch) {
          navigate(`/chat/${chatId}`, { replace: true });
        }
      } else {
        // No active chat at all — create a new one
        chatId = `chat-${Date.now()}`;
        const newChat: Chat = {
          id: chatId,
          title: derivedTitle,
          lastMessage: text,
          timestamp: new Date(),
          messages: [],
          sessionFolder,
        };
        setChats(prev => [newChat, ...prev.filter(c => c.id !== 'my-workpal'), prev.find(c => c.id === 'my-workpal')!]);
        navigate(`/chat/${chatId}`);
      }
    }

    // Add user message
    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      ...(attachments && attachments.length ? { attachments } : {}),
    };

    // Need to use the possibly-new chatId
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return {
        ...c,
        messages: [...c.messages, userMessage],
        lastMessage: text || (attachments && attachments.length ? `📎 ${attachments[0].name}` : ''),
        timestamp: new Date(),
      };
    }));

    // Generate response — route depends on current mode
    if (DEMO_CHAT_IDS.includes(chatId)) {
      // Demo chats always use hardcoded flows
      const responses = generateResponse(text);
      showTypingThenRespond(chatId, responses, 1200);
    } else if (voiceModeActive) {
      // Voice mode active — don't call text API, the Realtime session handles it.
      // The OpenAI Realtime API (gpt-4o-realtime-preview) only accepts input_text
      // and input_audio — sending input_image breaks the session. So every kind of
      // attachment goes in as text: non-image files via client-side extraction,
      // images via a one-shot vision-model description round-trip. Both flow into
      // pendingText; pendingImages stays undefined so no input_image gets sent.
      setVoicePendingImages(undefined);
      const hasImages = !!attachments?.some(a => a.kind === 'image');
      const hasFiles = !!attachments?.some(a => a.kind !== 'image');
      if (hasImages || hasFiles) {
        Promise.all([
          hasFiles ? buildAttachmentContextBlock(attachments!) : Promise.resolve(null),
          hasImages ? buildImageDescriptionBlock(attachments!) : Promise.resolve(null),
        ]).then(([docBlock, imgBlock]) => {
          const parts = [docBlock, imgBlock, text].filter((p): p is string => !!p && p.length > 0);
          setVoicePendingText(parts.join('\n\n'));
        });
      } else {
        setVoicePendingText(text);
      }
    } else if (!attachments?.length && shouldGenerateArtifact(text)) {
      // Candidate #3 — artifact intent (noun + verb bilingual match) wins
      // before the Claude Code path because "写...周刊" contains "写" which
      // would otherwise route to the SDK.
      streamArtifactFromAPI(chatId, text);
    } else if (!attachments?.length && shouldUseClaudeCode(text)) {
      // 5.4b keyword router — code/file intents go to Claude Agent SDK. Skip
      // when attachments are present since the Claude path doesn't wire them
      // yet; OpenAI still handles those.
      streamFromClaudeAPI(chatId, text, sessionFolderForSend);
    } else {
      streamFromAPI(chatId, text, attachments);
    }
  }, [activeChatId, activeChat, showTypingThenRespond, streamFromAPI, streamFromClaudeAPI, streamArtifactFromAPI, runAlcoholDeliveryFlow, voiceModeActive, navigate, chatMatch]);

  const handleChipClick = useCallback((chip: ActionChip) => {
    // Treat chip click as a user message
    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: chip.label,
      timestamp: new Date(),
    };

    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      return { ...c, messages: [...c.messages, userMessage] };
    }));

    // Look up flow
    const flow = AI_FLOWS[chip.action] || AI_FLOWS['default'];
    const responses = flow.map(f => f.response);
    showTypingThenRespond(activeChatId, responses, flow[0]?.delay || 1200);

    // Multi-step: after "Creating a Ticket..." in-progress, swap to real ticket card
    if (chip.action === 'create-tickets') {
      setTimeout(() => {
        setChats(prev => prev.map(c => {
          if (c.id !== activeChatId) return c;
          // Find the last message with in-progress ticket card and replace it
          const messages = [...c.messages];
          const idx = findLastIndex(messages, (m: Message) =>
            m.card?.type === 'ticket' && (m.card as TicketCard).status === 'in-progress'
          );
          if (idx !== -1) {
            messages[idx] = {
              ...messages[idx],
              card: {
                type: 'ticket',
                title: 'Illustration Request Ticket',
                description: 'Create illustration to explain how to scan an ID.',
                items: [
                  { text: 'Create illustration to explain how to scan an ID.', assignee: 'Kai', due: 'Thursday, April 10' },
                ],
                status: 'created',
              },
            };
          }
          return { ...c, messages };
        }));
      }, 3500); // 1200 typing + 2300 progress bar display
    }
  }, [activeChatId, showTypingThenRespond]);

  /** Phase 7 #2: write the edited article text back to the card of a specific
   *  message. Called from DetailPanel's "Save to card" button — updates
   *  `research.summary` or `meeting.content` in the active chat's message
   *  list. The card preview in the chat bubble re-renders immediately from
   *  the same state, which is intentional per design review.
   *
   *  Also updates the local `detailCard` snapshot so the `content` prop
   *  DetailPanel receives reflects the saved text. Without this, any
   *  subsequent DetailPanel remount (e.g. when SplitView flips between
   *  inline and overlay modes on viewport resize) would re-initialize
   *  `useState(content)` from a stale snapshot and show the pre-edit text. */
  const handleSaveCardEdit = useCallback((messageId: string, newText: string) => {
    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      return {
        ...c,
        messages: c.messages.map(m => {
          if (m.id !== messageId || !m.card) return m;
          if (m.card.type === 'research') {
            return { ...m, card: { ...m.card, summary: newText } };
          }
          if (m.card.type === 'meeting') {
            return { ...m, card: { ...m.card, content: newText } };
          }
          return m;
        }),
      };
    }));
    setDetailCard(prev => {
      if (!prev) return prev;
      if (prev.type === 'research') return { ...prev, summary: newText };
      if (prev.type === 'meeting') return { ...prev, content: newText };
      return prev;
    });
  }, [activeChatId]);

  const handleCardAction = useCallback((action: string) => {
    // set-agent: transition agent card from 'ready' to 'saved', then add follow-up message
    if (action === 'set-agent') {
      // Find the user's selected qualities from the user message in this chat
      const activeChat = chats.find(c => c.id === activeChatId);
      const userMsg = activeChat?.messages.find(m => m.role === 'user');
      const qualityLines = userMsg?.content?.split('\n').filter(l => l.trim().startsWith('•')) || [];
      const qualities = qualityLines.map(l => l.replace(/^\s*•\s*/, '').replace(/^[\p{Emoji}\s]+/u, '').trim());
      const qualityText = qualities.length
        ? qualities.slice(0, 3).join(', ').toLowerCase()
        : 'the qualities you care about';

      setChats(prev => prev.map(c => {
        if (c.id !== activeChatId) return c;
        const messages = [...c.messages];
        const idx = findLastIndex(messages, (m: Message) =>
          m.card?.type === 'agent' && (m.card as AgentCard).status === 'ready'
        );
        if (idx !== -1) {
          const existingCard = messages[idx].card as AgentCard;
          messages[idx] = {
            ...messages[idx],
            card: { ...existingCard, status: 'saved' },
          };
        }
        // Add follow-up AI message with suggestions
        messages.push({
          id: nextId(),
          role: 'assistant',
          content: `Great, I'm all set up! I'll bring the qualities you care about — ${qualityText} — into everything I do. What would you like to start with?`,
          timestamp: new Date(),
          chips: [
            { label: '🔗 Connect my tools', action: 'connect-tools' },
            { label: '💬 Just chat', action: 'just-chat' },
          ],
        });
        return { ...c, messages };
      }));
      return;
    }

    // confirm-schedule: transition schedule card in-place to "sent" + add closing message
    if (action === 'confirm-schedule') {
      setChats(prev => prev.map(c => {
        if (c.id !== activeChatId) return c;
        const messages = [...c.messages];
        const idx = findLastIndex(messages, (m: Message) =>
          m.card?.type === 'schedule' && (m.card as ScheduleCard).status !== 'sent'
        );
        if (idx !== -1) {
          const existingCard = messages[idx].card as ScheduleCard;
          messages[idx] = {
            ...messages[idx],
            chips: undefined,
            card: { ...existingCard, status: 'sent', statusLabel: 'Sent' },
          };
        }
        return { ...c, messages };
      }));
      return;
    }

    // confirm-ticket: transition ticket card in-place to "sent"
    if (action === 'confirm-ticket') {
      setChats(prev => prev.map(c => {
        if (c.id !== activeChatId) return c;
        const messages = [...c.messages];
        const idx = findLastIndex(messages, (m: Message) =>
          m.card?.type === 'ticket' && (m.card as TicketCard).status === 'created'
        );
        if (idx !== -1) {
          const existingCard = messages[idx].card as TicketCard;
          messages[idx] = {
            ...messages[idx],
            card: {
              ...existingCard,
              status: 'sent',
              statusLabel: 'Sent',
            },
          };
        }
        return { ...c, messages };
      }));
      return;
    }

    const flow = AI_FLOWS[action] || AI_FLOWS['default'];
    const responses = flow.map(f => f.response);
    showTypingThenRespond(activeChatId, responses, flow[0]?.delay || 800);
  }, [activeChatId, showTypingThenRespond]);

  const AVATAR_MAP: Record<string, string> = {
    'black-woman': avatarBlackWoman,
    'asian-woman': avatarAsianWoman,
    'white-man': avatarWhiteMan,
  };

  const AGENT_NAME_MAP: Record<string, string> = {
    'black-woman': 'Maya',
    'asian-woman': 'Mei',
    'white-man': 'Stephen',
  };

  const handleOnboardingComplete = useCallback((mostImportant: string[], avoid: string[], description?: string) => {
    setOnboardingDone(true);
    localStorage.setItem('workpal-onboarding-done', 'true');

    // Persist the user's selections as Memory so every future chat inherits
    // them — not just the first message. Fixed IDs so re-running onboarding
    // overwrites instead of duplicating. Empty sections get removed.
    const now = new Date().toISOString();
    const upsertEntries: MemoryEntry[] = [];
    if (mostImportant.length) {
      upsertEntries.push({
        id: 'onboarding-top-qualities',
        kind: 'preference',
        title: 'Top qualities I value',
        content: `When shaping tone and behavior, lean into these qualities the user chose as most important: ${mostImportant.join(', ')}.`,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (avoid.length) {
      upsertEntries.push({
        id: 'onboarding-avoid',
        kind: 'preference',
        title: 'Qualities to avoid',
        content: `Avoid these traits the user marked as unwanted: ${avoid.join(', ')}.`,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (description) {
      upsertEntries.push({
        id: 'onboarding-description',
        kind: 'core',
        title: 'In the user\u2019s own words',
        content: description,
        createdAt: now,
        updatedAt: now,
      });
    }
    const upsertIds = new Set(upsertEntries.map(e => e.id));
    // Also clear any onboarding-* entries that no longer apply (e.g. user
    // cleared their description on a re-run).
    const staleOnboardingIds = new Set(['onboarding-top-qualities', 'onboarding-avoid', 'onboarding-description']);
    setMemories(prev => {
      const kept = prev.filter(m => !staleOnboardingIds.has(m.id) || upsertIds.has(m.id));
      const withoutUpserted = kept.filter(m => !upsertIds.has(m.id));
      return [...upsertEntries, ...withoutUpserted];
    });

    // Build user message content: optional description + most-important + avoid sections
    const lines: string[] = [];
    if (description) {
      lines.push(description);
    }
    if (mostImportant.length) {
      if (lines.length) lines.push('');
      lines.push('Most important to me:');
      lines.push(...mostImportant.map(t => `  • ${t}`));
    }
    if (avoid.length) {
      if (lines.length) lines.push('');
      lines.push('Avoid:');
      lines.push(...avoid.map(t => `  • ${t}`));
    }
    const userContent = lines.length ? lines.join('\n') : 'Set up my WorkPal agent';

    // Create "My WorkPal" chat with the user message
    const chatId = 'my-workpal';
    const userMsg: Message = {
      id: nextId(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return {
        ...c,
        messages: [userMsg],
        lastMessage: userContent.slice(0, 40),
        timestamp: new Date(),
      };
    }));
    // Onboarding lives at `/` (the welcome chat), so we just make sure
    // rootChatId points at my-workpal — no navigate needed since the
    // Onboarding component is already rendered at `/`.
    setRootChatId(chatId);

    // Step 3: Show "Creating your agent..." card
    const loadingId = nextId();
    setTimeout(() => {
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: [...c.messages, {
            id: loadingId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            card: {
              type: 'agent',
              title: 'Creating your agent\u2026',
              status: 'creating',
            },
          }],
        };
      }));
    }, 500);

    // Step 4: After 3s, swap to "My WorkPal Agent" card with "Set as my agent"
    setTimeout(() => {
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const messages = [...c.messages];
        const idx = findLastIndex(messages, (m: Message) =>
          m.card?.type === 'agent' && (m.card as AgentCard).status === 'creating'
        );
        if (idx !== -1) {
          messages[idx] = {
            ...messages[idx],
            card: {
              type: 'agent',
              title: 'My WorkPal Agent',
              status: 'ready',
              agentName: AGENT_NAME_MAP[selectedAvatarId] || 'Stephen',
              agentIntro: `Hi, I'm ${AGENT_NAME_MAP[selectedAvatarId] || 'Stephen'}. I've got your back! Let's make your workday a little brighter \u2600\uFE0F\uFE0F`,
              avatarUrl: AVATAR_MAP[selectedAvatarId] || avatarWhiteMan,
            },
          };
        }
        return { ...c, messages };
      }));
    }, 3500);
  }, [selectedAvatarId]);

  const handleNewChat = useCallback(() => {
    setChats(prev => {
      // Reuse an existing draft chat if one is already pending — clicking
      // "New Session" repeatedly should not pile up empty drafts.
      const existingDraft = prev.find(c => c.isDraft);
      if (existingDraft) {
        setRootChatId(existingDraft.id);
        return prev;
      }
      const newId = `chat-${Date.now()}`;
      setRootChatId(newId);
      return [{
        id: newId,
        title: 'New Session',
        lastMessage: '',
        timestamp: new Date(),
        messages: [],
        isDraft: true,
      }, ...prev];
    });
    // Drafts deliberately live at `/` (not their own URL) — see routing plan.
    // Once the user sends their first message, handleSend navigates to
    // `/chat/:id` with replace so history stays clean.
    navigate('/');
  }, [navigate]);

  const handleChatSelect = useCallback((id: string) => {
    // Reset onboarding every time "My WorkPal" is clicked (demo mode)
    if (id === 'my-workpal') {
      setOnboardingDone(false);
      localStorage.removeItem('workpal-onboarding-done');
      // Clear any previous messages in the my-workpal chat
      setChats(prev => prev.map(c =>
        c.id === 'my-workpal' ? { ...c, messages: [] } : c
      ));
    }
    // Reset Alcohol Delivery Issues every visit (demo mode)
    if (id === 'alcohol-delivery') {
      setChats(prev => prev.map(c =>
        c.id === 'alcohol-delivery' ? { ...c, messages: [] } : c
      ));
      setAlcoholProgress(4);
      setDetailOpen(false);
      setContextPanelOpen(false);
    }
    // Re-open the inspector panel only for chats that already triggered it.
    // An unsent chat (messages empty) stays quiet even if a previous session
    // under the same id had the panel — the panel re-opens on the next tool
    // call (or, for the alcohol-delivery demo, on the next send).
    const target = chats.find(c => c.id === id);
    const showInspector = !!target?.hasInspector && target.messages.length > 0;
    setContextPanelOpen(showInspector && getCanFitPanel());
    // Streaming task progress is per-conversation-turn — clearing on switch
    // prevents old chatroom's progress from bleeding into the next one.
    setTaskSteps([]);
    setActiveTools([]);
    // Detail panels are scoped to the previous chat's messages; close them on
    // switch so the new chat doesn't inherit a stale artifact preview or card.
    setPreviewArtifact(null);
    setDetailCard(null);
    setDetailMessageId(null);
    // my-workpal is the welcome chat at `/`, not a normal /chat/:id.
    if (id === 'my-workpal') {
      setRootChatId('my-workpal');
      navigate('/');
    } else {
      navigate(`/chat/${id}`);
    }
  }, [chats, navigate]);

  const handleProjectSelect = useCallback((id: string) => {
    navigate(`/project/${id}`);
  }, [navigate]);

  // Create a new chat inside a project, then send the first message. Invoked
  // when the user types into the project page's input.
  const handleCreateChatInProject = useCallback((
    projectId: string,
    text: string,
    attachments?: Attachment[],
  ) => {
    const chatId = `chat-${Date.now()}`;
    const titleSource = text || (attachments && attachments.length ? attachments[0].name : '');
    const derivedTitle = titleSource
      ? titleSource.slice(0, 40) + (titleSource.length > 40 ? '...' : '')
      : 'New Session';
    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      ...(attachments && attachments.length ? { attachments } : {}),
    };
    const project = projects.find(p => p.id === projectId);
    const sessionFolder = project
      ? nestFolderUnderProject(undefined, project.name, titleSource || 'session')
      : buildSessionFolder(titleSource || 'session');
    const newChat: Chat = {
      id: chatId,
      title: derivedTitle,
      lastMessage: text || (attachments && attachments.length ? `📎 ${attachments[0].name}` : ''),
      timestamp: new Date(),
      messages: [userMessage],
      projectId,
      sessionFolder,
    };
    // Insert at the top so it appears first in both root Recents and the
    // project's Recents list.
    setChats(prev => [newChat, ...prev]);
    navigate(`/chat/${chatId}`);
    setContextPanelOpen(false);
    setTaskSteps([]);
    setActiveTools([]);
    // Stream the AI response — pass projectId explicitly because the chats
    // closure inside streamFromAPI hasn't committed the new chat yet. The
    // inspector panel auto-opens when the model calls its first tool.
    streamFromAPI(chatId, text, attachments, projectId);
  }, [streamFromAPI, projects, navigate]);

  const handleCreateProject = useCallback((name: string, description: string) => {
    const projectId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: projectId,
      name,
      description: description || undefined,
    };
    setProjects(prev => [...prev, newProject]);
    setNewProjectOpen(false);
    // 6.1: belt-and-braces project init. The navigate() below triggers the
    // activeProjectId useEffect, which also fires init — firing here too means
    // the backend primes the folder while React is mid-render, so the repo is
    // ready by the user's first write. Idempotent on the backend.
    void postInitProject(slugify(name)).then(result => {
      if (!result.ok) {
        console.warn(`[project-init] create failed: ${result.error}`);
      }
    });
    navigate(`/project/${projectId}`);
  }, [navigate]);

  /** Promote one or more sessions into a brand-new project. Creates the
   *  project, links each chat to it, nests every sessionFolder under the
   *  project, and drops the user onto the new project's page. One-way — no
   *  downgrade. For batch promote, the optional `folderOverride` is used as
   *  the *project* folder (only the first chat honors it; the rest auto-nest
   *  under the same project root via nestFolderUnderProject). */
  const handlePromoteToProject = useCallback((chatIds: string[], name: string, description: string, folderOverride?: string) => {
    if (chatIds.length === 0) return;
    const idSet = new Set(chatIds);
    const targets = chats.filter(c => idSet.has(c.id));
    if (targets.length === 0) return;
    const projectId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: projectId,
      name,
      description: description || undefined,
    };
    const useOverride = folderOverride && folderOverride.length > 0 && targets.length === 1;
    setProjects(prev => [...prev, newProject]);
    setChats(prev => prev.map(c => {
      if (!idSet.has(c.id)) return c;
      const nested = useOverride
        ? folderOverride!
        : nestFolderUnderProject(c.sessionFolder, name, c.title);
      return { ...c, projectId, sessionFolder: nested };
    }));
    setPromotingChatIds(null);
    // 6.1: belt-and-braces project init. The navigate() below will trigger
    // the activeProjectId useEffect, which also fires init — but firing here
    // too means the backend is priming the folder while React is still mid-
    // render, so by the time the user's first session write happens the repo
    // is guaranteed ready. Idempotent on the backend so the double fire is
    // a no-op past the first call.
    void postInitProject(slugify(name)).then(result => {
      if (!result.ok) {
        console.warn(`[project-init] promote failed: ${result.error}`);
      }
    });
    navigate(`/project/${projectId}`);
  }, [chats, navigate]);

  const handleDeleteChat = useCallback((id: string) => {
    setChats(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (id !== activeChatId) return remaining;
      // Deleted the active chat — land on a fresh draft so the sidebar always
      // has something selected and the main pane shows the welcome state.
      const newDraftId = `chat-${Date.now()}`;
      const draft: Chat = {
        id: newDraftId,
        title: 'New Session',
        lastMessage: '',
        timestamp: new Date(),
        messages: [],
        isDraft: true,
      };
      setRootChatId(newDraftId);
      navigate('/');
      return [draft, ...remaining];
    });
  }, [activeChatId, navigate]);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      navigate('/');
    }
  }, [activeProjectId, navigate]);

  // Add one or more files to a project's shared reference files. The caller
  // (ProjectPage) has already converted the FileList → Attachment[] via
  // filesToAttachments so the data URL + metadata are ready to persist.
  const handleAddProjectFiles = useCallback((projectId: string, newFiles: Attachment[]) => {
    if (newFiles.length === 0) return;
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, files: [...(p.files || []), ...newFiles] }
        : p
    ));
  }, []);

  const handleRemoveProjectFile = useCallback((projectId: string, fileId: string) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, files: (p.files || []).filter(f => f.id !== fileId) }
        : p
    ));
  }, []);

  // Memory CRUD. Every mutation goes through the backend (so phone + laptop
  // stay in sync) and is gated by the password the user set in MEMORY_PASSWORD.
  // The handlers resolve to a boolean so the calling form can stay open on
  // failure and close on success.
  const handleAddMemory = useCallback(async (draft: { kind: MemoryKind; title: string; content: string; projectId?: string }): Promise<boolean> => {
    let password: string;
    try {
      password = await ensurePassword();
    } catch {
      return false;
    }
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: nextMemoryId(),
      kind: draft.kind,
      title: draft.title,
      content: draft.content,
      projectId: draft.projectId,
      createdAt: now,
      updatedAt: now,
    };
    try {
      const saved = await createMemoryOnServer(entry, password);
      setMemories(prev => [saved, ...prev]);
      return true;
    } catch (err) {
      console.error('Failed to add memory:', err);
      return false;
    }
  }, [ensurePassword]);

  const handleUpdateMemory = useCallback(async (id: string, patch: { kind: MemoryKind; title: string; content: string; projectId?: string }): Promise<boolean> => {
    let password: string;
    try {
      password = await ensurePassword();
    } catch {
      return false;
    }
    try {
      const saved = await updateMemoryOnServer(id, patch, password);
      setMemories(prev => prev.map(m => m.id === id ? saved : m));
      return true;
    } catch (err) {
      console.error('Failed to update memory:', err);
      return false;
    }
  }, [ensurePassword]);

  const handleDeleteMemory = useCallback(async (id: string): Promise<boolean> => {
    // Delete is destructive — always re-prompt for the password, even if a
    // valid one is cached for the current session.
    let password: string;
    try {
      password = await ensurePassword({
        force: true,
        message: 'Deleting a memory requires the password — there is no undo.',
      });
    } catch {
      return false;
    }
    try {
      await deleteMemoryOnServer(id, password);
      setMemories(prev => prev.filter(m => m.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete memory:', err);
      return false;
    }
  }, [ensurePassword]);

  // Move a chat into a project (or out of any project when projectId is null).
  // Triggered from the Recents row's 3-dot menu. Also re-nests the cosmetic
  // sessionFolder path so it matches the chat's new home.
  const handleMoveChat = useCallback((chatId: string, projectId: string | null) => {
    setChats(prev => {
      const chat = prev.find(c => c.id === chatId);
      if (!chat) return prev;
      const nextFolder = projectId
        ? nestFolderUnderProject(
            chat.sessionFolder,
            projects.find(p => p.id === projectId)?.name ?? 'project',
            chat.title,
          )
        : buildSessionFolder(chat.title);
      return prev.map(c =>
        c.id === chatId
          ? { ...c, projectId: projectId ?? undefined, sessionFolder: nextFolder }
          : c
      );
    });
  }, [projects]);

  // Voice mode: close session
  const handleVoiceModeClose = useCallback(() => {
    setVoiceModeActive(false);
  }, []);

  // Voice mode: add each spoken message to the chat in real-time
  const handleVoiceMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    let chatId = activeChatId;

    // If first message in an empty chat, promote it
    if (activeChat && activeChat.messages.length === 0 && role === 'user') {
      const newTitle = text.slice(0, 40) + (text.length > 40 ? '...' : '');
      setChats(prev => prev.map(c =>
        c.id === chatId ? { ...c, title: newTitle, isDraft: false } : c
      ));
    }

    const msg: Message = {
      id: nextId(),
      role,
      content: text,
      timestamp: new Date(),
    };
    addMessage(chatId, msg);
  }, [activeChatId, activeChat, addMessage]);

  // Voice mode: the AI invoked search_images — append the photos as an
  // assistant message in the active chat. Text content stays empty so the
  // message card only shows the image grid (matching text-mode rendering).
  const handleVoiceImages = useCallback((_query: string, images: ImageResult[]) => {
    const msg: Message = {
      id: nextId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      imageResults: images,
    };
    addMessage(activeChatId, msg);
  }, [activeChatId, addMessage]);

  // Voice mode counterpart for search_videos — drop the cards into the chat
  // as a standalone assistant message, same shape as the image flow.
  const handleVoiceVideos = useCallback((_query: string, videos: VideoResult[]) => {
    const msg: Message = {
      id: nextId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      videoResults: videos,
    };
    addMessage(activeChatId, msg);
  }, [activeChatId, addMessage]);

  // Voice mode counterpart for web_search — drop source chips and an optional
  // product photo into the chat while the AI speaks the synthesized answer.
  // The spoken reply arrives separately via handleVoiceMessage, so this
  // message stays text-empty and just carries the chip/image payload.
  const handleVoiceWebSearch = useCallback((_query: string, results: WebResult[], images: ImageResult[]) => {
    const msg: Message = {
      id: nextId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      webResults: results,
      imageResults: images.length > 0 ? images : undefined,
    };
    addMessage(activeChatId, msg);
  }, [activeChatId, addMessage]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--color-outer-bg)' }}>
      {/* Outer rounded container */}
      <div className="flex-1 flex overflow-hidden m-2 rounded-[40px] shadow-2xl relative app-shell-bg" style={{ border: `1px solid var(--color-outer-border)` }}>
        {/* ─── NavPanel (priority 3: collapses first) ───
            • wide  (≥ 1200px): inline expanded Sidebar when open, MiniSidebar rail when closed
            • compact (768–1199px): MiniSidebar rail inline; expanded Sidebar overlays with dark backdrop
            • mobile (< 768px): no inline rail; expanded Sidebar overlays with dark backdrop
            The expanded-overlay and dismiss-on-nav behaviors apply whenever the nav is compact. */}
        {(() => {
          const navOverlay = sidebarOpen && isCompactNav;                    // compact OR mobile
          const inlineSidebar = sidebarOpen && !isCompactNav;                // wide + open
          const showMiniInline = !isMobile && !inlineSidebar;                // compact with closed sidebar, or wide with closed sidebar
          const closeOnNav = isCompactNav;                                    // dismiss overlay after navigating
          return (
            <>
              {showMiniInline && (
                <MiniSidebar
                  activeView={activeView}
                  activeChatId={activeChatId}
                  onViewChange={(view) => navigate(view === 'chat' ? '/' : `/${view}`)}
                  onChatSelect={handleChatSelect}
                  onNewChat={handleNewChat}
                  onToggleSidebar={() => setSidebarOpen(o => !o)}
                />
              )}
              {inlineSidebar && (
                <Sidebar
                  chats={chats}
                  activeChatId={activeChatId}
                  activeView={activeView}
                  activeProjectId={activeProjectId}
                  projects={projects}
                  onChatSelect={handleChatSelect}
                  onNewChat={handleNewChat}
                  onNewProject={() => setNewProjectOpen(true)}
                  onProjectSelect={handleProjectSelect}
                  onViewChange={(view) => navigate(view === 'chat' ? '/' : `/${view}`)}
                  onDeleteChat={handleDeleteChat}
                  onDeleteProject={handleDeleteProject}
                  onMoveChat={handleMoveChat}
                  onPromoteChat={(id) => setPromotingChatIds([id])}
                  isDark={isDark}
                  onToggleDark={() => setIsDark(d => !d)}
                  onToggleSidebar={() => setSidebarOpen(o => !o)}
                />
              )}
              {navOverlay && (
                <>
                  <div
                    className="absolute inset-0 z-20 panel-overlay-backdrop"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden
                  />
                  {/* Solid sidebar background — overrides the in-flow `dark:bg-transparent`
                      that relies on the shell gradient, so no ConversationPanel bleed-through. */}
                  <div className="absolute inset-y-0 left-0 z-30" style={{ background: 'var(--color-sidebar-bg)' }}>
                    <Sidebar
                      chats={chats}
                      activeChatId={activeChatId}
                      activeView={activeView}
                      activeProjectId={activeProjectId}
                      projects={projects}
                      onChatSelect={(id) => { handleChatSelect(id); if (closeOnNav) setSidebarOpen(false); }}
                      onNewChat={() => { handleNewChat(); if (closeOnNav) setSidebarOpen(false); }}
                      onNewProject={() => setNewProjectOpen(true)}
                      onProjectSelect={(id) => { handleProjectSelect(id); if (closeOnNav) setSidebarOpen(false); }}
                      onViewChange={(view) => { navigate(view === 'chat' ? '/' : `/${view}`); if (closeOnNav) setSidebarOpen(false); }}
                      onDeleteChat={handleDeleteChat}
                      onDeleteProject={handleDeleteProject}
                      onMoveChat={handleMoveChat}
                      onPromoteChat={(id) => setPromotingChatIds([id])}
                      isDark={isDark}
                      onToggleDark={() => setIsDark(d => !d)}
                      onToggleSidebar={() => setSidebarOpen(o => !o)}
                    />
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* Main Content */}
        {activeProjectId && projects.find(p => p.id === activeProjectId) ? (
          <ProjectPage
            project={projects.find(p => p.id === activeProjectId)!}
            chats={chats}
            onCreateChat={handleCreateChatInProject}
            onOpenChat={handleChatSelect}
            onAddFiles={handleAddProjectFiles}
            onRemoveFile={handleRemoveProjectFile}
            sidebarOpen={sidebarOpen || !isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : activeView === 'design-system' ? (
          <DesignSystemPage
            sidebarOpen={sidebarOpen || !isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : activeView === 'connectors' ? (
          <ConnectorsPage
            sidebarOpen={sidebarOpen || !isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
            onNewChat={isMobile ? handleNewChat : undefined}
          />
        ) : activeView === 'overview' ? (
          <OverviewPage
            sidebarOpen={sidebarOpen || !isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
            onNewChat={isMobile ? handleNewChat : undefined}
            onOpenChat={handleChatSelect}
            onOpenProject={handleProjectSelect}
          />
        ) : activeView === 'library' ? (
          <LibraryPage
            sidebarOpen={sidebarOpen || !isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
            onNewChat={isMobile ? handleNewChat : undefined}
          />
        ) : activeView === 'memory' ? (
          <MemoryPage
            memories={memories}
            projects={projects}
            onAdd={handleAddMemory}
            onUpdate={handleUpdateMemory}
            onDelete={handleDeleteMemory}
            sidebarOpen={sidebarOpen || !isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
            onNewChat={isMobile ? handleNewChat : undefined}
          />
        ) : !onboardingDone && activeChatId === 'my-workpal' ? (
          <Onboarding
            onComplete={handleOnboardingComplete}
            sidebarOpen={sidebarOpen || !isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : (() => {
          // Exactly one side panel is active at a time. Artifact preview and
          // DetailPanel (card report) both render the 504px DetailPanel shell
          // — they just pass different props. Preview wins if both flags are
          // set, but onArtifactClick clears detailCard first so this is only
          // a defense-in-depth ordering.
          const sideKind: 'preview' | 'detail' | 'context' | null =
            previewArtifact ? 'preview'
            : detailOpen ? 'detail'
            : (activeChat?.hasInspector && contextPanelOpen) ? 'context'
            : null;
          return (
            <SplitView
              sideOpen={sideKind !== null}
              sideWidth={sideKind === 'detail' || sideKind === 'preview' ? detailPanelWidth : 280}
              onCloseSide={sideKind === 'preview'
                ? () => { setPreviewArtifact(null); setContextPanelOpen(true); }
                : sideKind === 'detail'
                ? () => { setDetailOpen(false); setDetailCard(null); setDetailMessageId(null); setContextPanelOpen(true); }
                : () => setContextPanelOpen(false)}
              bgClass="app-bg"
              side={({ overlay }) => {
                if (sideKind === 'preview' && previewArtifact) {
                  // 6.4: inline preview of an AI-produced file. Reuses
                  // DetailPanel's shell (header + scroll area + close button)
                  // so the motion / sizing matches the research / meeting
                  // detail view. Not editable — artifacts are immutable from
                  // the user's side; rewrites happen by asking the AI.
                  return (
                    <DetailPanel
                      key={previewArtifact.path}
                      title={previewArtifact.name}
                      content={previewArtifact.content}
                      renderAs={previewArtifact.renderAs}
                      onClose={() => {
                        setPreviewArtifact(null);
                        setContextPanelOpen(true);
                      }}
                      fullScreen={overlay}
                      onResize={setDetailPanelWidth}
                    />
                  );
                }
                if (sideKind === 'detail') {
                  // Real tool-result cards (Research / Meeting) carry their own
                  // title + body. Fall back to the alcohol-delivery demo report
                  // when no specific card was opened (demo view-report click).
                  // Phase 7 #2: `editable` flag gates the popover — only prose
                  // cards (research/meeting) expose the AI edit actions; the
                  // demo fallback + ticket/schedule do not.
                  let detailTitle = 'Summary Report: Spark Driver Alcohol';
                  let detailContent: string | null = null;
                  let editable = false;
                  if (detailCard?.type === 'research') {
                    detailTitle = detailCard.title;
                    detailContent = detailCard.summary;
                    editable = true;
                  } else if (detailCard?.type === 'meeting') {
                    detailTitle = detailCard.title;
                    detailContent = detailCard.content;
                    editable = true;
                  }
                  return (
                    <DetailPanel
                      // Remount when the user view-reports a different card
                      // while the panel is already open, so local edit state
                      // (display content, undo buffer, streaming controller)
                      // doesn't bleed across cards.
                      key={detailMessageId ?? 'demo'}
                      title={detailTitle}
                      content={detailContent ?? REPORT_CONTENT}
                      editable={editable}
                      onSave={
                        editable && detailMessageId
                          ? (newText) => handleSaveCardEdit(detailMessageId, newText)
                          : undefined
                      }
                      onClose={() => {
                        setDetailOpen(false);
                        setDetailCard(null);
                        setDetailMessageId(null);
                        setContextPanelOpen(true);
                      }}
                      fullScreen={overlay}
                      onResize={setDetailPanelWidth}
                    />
                  );
                }
                if (sideKind === 'context') {
                  const isDemo = activeChatId === 'alcohol-delivery';
                  // Live tool-call progress maps onto the Progress step list.
                  // The demo chat keeps its scripted 4-step sequence; real chats
                  // render whatever the streaming backend emitted.
                  const liveProgress = isDemo
                    ? buildAlcoholProgress(alcoholProgress)
                    : taskSteps.map(s => ({
                        label: s.label,
                        status: s.status === 'completed' ? 'completed' as const : 'active' as const,
                      }));
                  const liveTools = isDemo
                    ? undefined
                    : activeTools.map(name => ({ name }));
                  return (
                    <TaskContextPanel
                      onClose={() => setContextPanelOpen(false)}
                      progress={liveProgress}
                      toolsActive={liveTools}
                      useDemoDefaults={isDemo}
                      fullScreen={overlay}
                      folderPath={activeChat?.sessionFolder}
                      folderMaterialized={activeChat?.folderMaterialized ?? false}
                      changes={activeChat ? changes[activeChat.id] : undefined}
                      onUndoChange={activeChat ? (id) => handleUndoChange(activeChat.id, id) : undefined}
                      canCompleteSession={
                        // 6.3 gate: project-owned + materialized. Legacy Phase 5
                        // chats (no projectId) and pure-Q&A chats (no folder
                        // ever materialized) never show the footer button.
                        //
                        // Demo mode loosens the gate to "materialized is
                        // enough" so the seeded `alcohol-delivery` chat shows
                        // the button (disabled, per TaskContextPanel's demo
                        // branch). HRs see the capability surface without a
                        // project plumbing detour.
                        IS_DEMO
                          ? !!activeChat?.folderMaterialized
                          : !!(activeChat?.projectId && activeChat?.folderMaterialized)
                      }
                      sessionCompleted={!!activeChat?.sessionCompleted}
                      onCompleteSession={
                        activeChat
                          ? () => handleCompleteSession(activeChat.id)
                          : undefined
                      }
                    />
                  );
                }
                return null;
              }}
            >
              <ChatPanel
                chat={activeChat?.id === 'my-workpal' && (!onboardingDone || (activeChat?.messages.length ?? 0) === 0) ? null : activeChat ?? null}
                onSend={handleSend}
                onChipClick={handleChipClick}
                // 5.4e: folder chip click → reveal session folder in Finder.
                // ChatPanel passes this through to its FolderChip; the chip
                // also keeps a shift+click shortcut for copy-to-clipboard.
                onOpenFolder={postOpenFolder}
                // 6.4: click on an inline artifact pill → fetch file content
                // and open the DetailPanel as an inline preview. Falls back to
                // `open` spawn if the read fails (e.g. binary/large file the
                // 10MB cap rejects). Hosted artifacts (#3) carry their own
                // `href` and skip this handler — the card renders as a link.
                onArtifactClick={async (artifact) => {
                  if (!artifact.path) return;
                  const content = await postReadFile(artifact.path);
                  if (content === null) {
                    // Read failed — degrade to the old open-in-default-app
                    // flow so the user still sees their file somehow.
                    void postOpenFile(artifact.path);
                    return;
                  }
                  const lower = artifact.name.toLowerCase();
                  const renderAs: 'markdown' | 'html' | 'plaintext' =
                    lower.endsWith('.html') || lower.endsWith('.htm') ? 'html'
                    : lower.endsWith('.md') || lower.endsWith('.markdown') ? 'markdown'
                    : 'plaintext';
                  // Opening the artifact preview takes over the side panel —
                  // close any existing card-detail / context view first so
                  // only one side panel is ever visible.
                  setDetailCard(null);
                  setDetailMessageId(null);
                  setDetailOpen(false);
                  setContextPanelOpen(false);
                  setPreviewArtifact({
                    name: artifact.name,
                    content,
                    renderAs,
                    path: artifact.path,
                  });
                }}
                onCardAction={(action, card, messageId) => {
                  if (action === 'view-report') {
                    setDetailCard(card ?? null);
                    setDetailMessageId(messageId ?? null);
                    setDetailOpen(true);
                    setContextPanelOpen(false);
                    return;
                  }
                  handleCardAction(action);
                }}
                sidebarOpen={sidebarOpen || !isMobile}
                onToggleSidebar={() => setSidebarOpen(o => !o)}
                isDark={isDark}
                selectedAvatarId={selectedAvatarId}
                onAvatarChange={setSelectedAvatarId}
                showContextToggle={!!activeChat?.hasInspector && !detailOpen && !previewArtifact}
                contextPanelOpen={contextPanelOpen}
                onToggleContextPanel={() => setContextPanelOpen(o => !o)}
                isAiResponding={isAiResponding}
                draftValue={activeChat?.draftPrompt}
                onNewChat={isMobile ? handleNewChat : undefined}
                onVoiceMode={() => setVoiceModeActive(true)}
                voiceModeActive={voiceModeActive}
                onVoiceModeClose={handleVoiceModeClose}
                onVoiceMessage={handleVoiceMessage}
                onVoiceImages={handleVoiceImages}
                onVoiceVideos={handleVoiceVideos}
                onVoiceWebSearch={handleVoiceWebSearch}
                voicePendingText={voicePendingText}
                voicePendingImages={voicePendingImages}
                onVoicePendingTextConsumed={() => { setVoicePendingText(undefined); setVoicePendingImages(undefined); }}
              />
            </SplitView>
          );
        })()}
      </div>

      {/* New Project Dialog — doubles as the "Promote to Project" dialog when
          `promotingChatIds` is set. Single-session promote only (from the
          Recents row menu). */}
      {(() => {
        const promotingChat = promotingChatIds && promotingChatIds.length > 0
          ? chats.find(c => c.id === promotingChatIds[0])
          : undefined;
        const isPromote = !!promotingChat;
        const dialogOpen = newProjectOpen || isPromote;
        const suggestedName = promotingChat?.title;
        const suggestedFolder = promotingChat
          ? nestFolderUnderProject(promotingChat.sessionFolder, promotingChat.title, promotingChat.title)
          : undefined;
        return (
          <NewProjectDialog
            open={dialogOpen}
            mode={isPromote ? 'promote' : 'create'}
            suggestedName={suggestedName}
            suggestedFolder={suggestedFolder}
            onClose={() => {
              if (isPromote) setPromotingChatIds(null);
              else setNewProjectOpen(false);
            }}
            onCreate={(name, description, folder) => {
              if (isPromote && promotingChat) {
                handlePromoteToProject([promotingChat.id], name, description, folder);
              } else {
                handleCreateProject(name, description);
              }
            }}
          />
        );
      })()}

      {/* Memory password prompt (rendered by useMemoryAuth) */}
      {passwordModal}

      {/* Phase 4 permission gate — any call to requestPermission() (or 5.4d
          SDK bridge `permission_request` chunk) surfaces here as a modal.
          For local-flow prompts the Promise resolver finishes the awaited
          call; for bridge prompts we POST the decision back to the server
          so the parked SDK canUseTool resolver unblocks. */}
      <PermissionPrompt
        request={pendingPermission}
        onAllow={() => {
          if (!pendingPermission) return;
          if (pendingPermission.bridge) {
            void postClaudePermissionDecision(
              pendingPermission.bridge.requestId,
              pendingPermission.bridge.chatId,
              'allow',
            );
          } else {
            pendingPermission.resolve(true);
          }
          setPendingPermissions(prev => prev.slice(1));
        }}
        onAlwaysAllow={(req) => {
          if (!pendingPermission) return;
          // Ref mutation, not setState — the in-flight stream's for-await
          // loop needs to see this before its next permission_request lands.
          const scopeKey = `${req.kind}:${req.scope}`;
          approvedScopesRef.current.add(scopeKey);
          // 5.6: drain every already-queued entry whose scope now matches —
          // including the head the user just clicked on. Without this, a
          // second same-scope permission_request that arrived between the
          // first modal showing and this click stays in the queue and pops
          // a redundant modal even though the user meant "blanket approve."
          // Any NEW chunks arriving mid-click already bypass the queue via
          // the ref check at streamFromClaudeAPI's permission_request branch,
          // so we only need to drain what was queued at click time.
          const toApprove = pendingPermissions.filter(
            p => `${p.kind}:${p.scope}` === scopeKey,
          );
          for (const p of toApprove) {
            if (p.bridge) {
              void postClaudePermissionDecision(
                p.bridge.requestId,
                p.bridge.chatId,
                'allow',
              );
            } else {
              p.resolve(true);
            }
          }
          setPendingPermissions(prev =>
            prev.filter(p => `${p.kind}:${p.scope}` !== scopeKey),
          );
        }}
        onCancel={() => {
          if (!pendingPermission) return;
          if (pendingPermission.bridge) {
            void postClaudePermissionDecision(
              pendingPermission.bridge.requestId,
              pendingPermission.bridge.chatId,
              'deny',
            );
            // Per 5.4d acceptance: leave a halt entry in Changes so the user
            // sees the cancelled tool didn't vanish silently.
            addChange(pendingPermission.bridge.chatId, {
              kind: 'halt',
              label: `Task stopped: permission denied for ${pendingPermission.target}`,
            });
          } else {
            pendingPermission.resolve(false);
          }
          setPendingPermissions(prev => prev.slice(1));
        }}
      />

      {/* 6.3: Complete Session modal. Controlled by completeSessionChatId —
          null = modal closed. Phase drives the inner visual state (loading
          → ready → merging → success/error). Close is a no-op during
          loading/merging so a stray click can't leave the UI in a half-
          applied state (the modal's own onCancel has the same guard). */}
      {completeSessionChatId && (
        <CompleteSessionModal
          phase={completeSessionPhase}
          onCancel={() => setCompleteSessionChatId(null)}
          onMerge={handleMergeSession}
        />
      )}

    </div>
  );
}
