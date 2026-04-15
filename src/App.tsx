import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
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
import NewProjectDialog from './components/NewProjectDialog';
import { SplitView } from './components/shared';
import { Chat, Message, ActionChip, TicketCard, AgentCard, ScheduleCard } from './types';
import { avatarBlackWoman, avatarAsianWoman, avatarWhiteMan } from './assets';
import { INITIAL_CHATS } from './data';

// Bump this whenever INITIAL_CHATS gains new seed fields (e.g. draftPrompt) so
// returning visitors with stale localStorage drop their cached chats and pick
// up the new demo data on next load.
const STORAGE_KEY = 'workpal-chats-v2';
const LEGACY_STORAGE_KEYS = ['workpal-chats'];

function loadChats(): Chat[] {
  try {
    // Drop any pre-versioned cache so old demo data can't shadow new seed fields.
    LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Rehydrate Date objects
      return parsed.map((c: any) => ({
        ...c,
        timestamp: new Date(c.timestamp),
        messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
      }));
    }
  } catch { /* ignore corrupted data */ }
  return INITIAL_CHATS;
}

function saveChats(chats: Chat[]) {
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


export default function App() {
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeChatId, setActiveChatId] = useState<string>('my-workpal');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState('black-woman');
  const [detailOpen, setDetailOpen] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem('workpal-onboarding-done') === 'true');
  const [activeView, setActiveView] = useState<'chat' | 'connectors' | 'design-system' | 'overview' | 'library'>('chat');
  const [inputMode, setInputMode] = useState<'Chat' | 'Tasks' | 'Code'>('Chat');
  const [taskModeMsgSent, setTaskModeMsgSent] = useState(false);
  const [taskPanelPreviewing, setTaskPanelPreviewing] = useState(false);
  const [_taskModeUserMsg, setTaskModeUserMsg] = useState('');
  const [projects, setProjects] = useState<Project[]>([
    { id: 'proj-1', name: 'Agent Design' },
  ]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const isMobile = useSyncExternalStore(subscribe, getIsMobile);
  const isCompactNav = useSyncExternalStore(subscribe, getIsCompactNav);
  const canFitAllThree = useSyncExternalStore(subscribe, getCanFitAllThree);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  // 0–3 = current active step index in alcohol-delivery flow, 4 = all completed
  const [alcoholProgress, setAlcoholProgress] = useState(4);

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

  // Custom multi-step flow for the Alcohol Delivery Issues demo chat
  const runAlcoholDeliveryFlow = useCallback((chatId: string) => {
    const cardMsgId = nextId();

    // 1. Show in-progress research card after a short delay
    setTimeout(() => {
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
    }, 300);

    // 2. Animate progress steps in the right panel
    setAlcoholProgress(0);
    setTimeout(() => setAlcoholProgress(1), 1300);
    setTimeout(() => setAlcoholProgress(2), 2300);
    setTimeout(() => setAlcoholProgress(3), 3300);

    // 3. Swap in-progress card → final report preview + chips
    setTimeout(() => {
      setAlcoholProgress(4);
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
    }, 4300);
  }, []);

  const handleSend = useCallback((text: string) => {
    // Special-case the alcohol-delivery demo chat: keep title, run scripted flow
    if (activeChatId === 'alcohol-delivery') {
      const userMessage: Message = {
        id: nextId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setChats(prev => prev.map(c =>
        c.id === 'alcohol-delivery'
          ? { ...c, messages: [...c.messages, userMessage], lastMessage: text, timestamp: new Date() }
          : c
      ));
      setInputMode('Tasks');
      setTaskModeMsgSent(true);
      setTaskModeUserMsg(text);
      if (getCanFitPanel()) {
        // Desktop with room: open the inline panel directly (original behavior)
        setContextPanelOpen(true);
      } else {
        // Narrow viewport: keep chat in focus, run a preview animation hint
        setContextPanelOpen(false);
        setTaskPanelPreviewing(true);
        window.setTimeout(() => setTaskPanelPreviewing(false), 3000);
      }
      runAlcoholDeliveryFlow('alcohol-delivery');
      return;
    }

    if (inputMode === 'Tasks') { setTaskModeMsgSent(true); setTaskModeUserMsg(text); }
    // Find or create active chat
    let chatId = activeChatId;

    // If on welcome screen or empty session, update the existing chat's title
    if (!activeChat || activeChat.messages.length === 0) {
      if (activeChat && activeChat.messages.length === 0) {
        // Reuse existing empty chat (e.g. "New Session") and update its title.
        // Promote it from draft → recent so it shows up in the Recents list.
        chatId = activeChat.id;
        const newTitle = text.slice(0, 40) + (text.length > 40 ? '...' : '');
        setChats(prev => prev.map(c =>
          c.id === chatId ? { ...c, title: newTitle, lastMessage: text, timestamp: new Date(), isDraft: false } : c
        ));
      } else {
        // No active chat at all — create a new one
        chatId = `chat-${Date.now()}`;
        const newChat: Chat = {
          id: chatId,
          title: text.slice(0, 40) + (text.length > 40 ? '...' : ''),
          lastMessage: text,
          timestamp: new Date(),
          messages: [],
        };
        setChats(prev => [newChat, ...prev.filter(c => c.id !== 'my-workpal'), prev.find(c => c.id === 'my-workpal')!]);
        setActiveChatId(chatId);
      }
    }

    // Add user message
    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    // Need to use the possibly-new chatId
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return {
        ...c,
        messages: [...c.messages, userMessage],
        lastMessage: text,
        timestamp: new Date(),
      };
    }));

    // Generate response
    const responses = generateResponse(text);
    showTypingThenRespond(chatId, responses, 1200);
  }, [activeChatId, activeChat, showTypingThenRespond, inputMode]);

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
            { label: '🚀 Start a task', action: 'start-task' },
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

  const handleOnboardingComplete = useCallback((mostImportant: string[], avoid: string[], description?: string) => {
    setOnboardingDone(true);
    localStorage.setItem('workpal-onboarding-done', 'true');

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
    setActiveChatId(chatId);

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
              agentName: 'Maya',
              agentIntro: "Hi, I'm Maya. I've got your back! Let's make your workday a little brighter \u2600\uFE0F\uFE0F",
              avatarUrl: AVATAR_MAP[selectedAvatarId] || avatarBlackWoman,
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
        setActiveChatId(existingDraft.id);
        return prev;
      }
      const newId = `chat-${Date.now()}`;
      setActiveChatId(newId);
      return [{
        id: newId,
        title: 'New Session',
        lastMessage: '',
        timestamp: new Date(),
        messages: [],
        isDraft: true,
      }, ...prev];
    });
    setActiveView('chat');
  }, []);

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
      setTaskPanelPreviewing(false);
    }
    // Clear task-mode panel state when switching chats
    setTaskModeMsgSent(false);
    setActiveChatId(id);
    setActiveProjectId(null);
    setActiveView('chat');
  }, []);

  const handleProjectSelect = useCallback((id: string) => {
    setActiveProjectId(id);
    setActiveView('chat'); // reset view
  }, []);

  const handleCreateProject = useCallback((name: string, description: string) => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name,
      description: description || undefined,
    };
    setProjects(prev => [...prev, newProject]);
    setNewProjectOpen(false);
  }, []);

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
                  onViewChange={(view) => { setActiveView(view); setActiveProjectId(null); }}
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
                  onViewChange={(view) => { setActiveView(view); setActiveProjectId(null); }}
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
                      onViewChange={(view) => { setActiveView(view); setActiveProjectId(null); if (closeOnNav) setSidebarOpen(false); }}
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
          />
        ) : activeView === 'library' ? (
          <LibraryPage
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
          // Exactly one side panel is active at a time. DetailPanel wins over
          // the task context panel (since the "view report" action closes the
          // context panel when it opens Detail).
          const sideKind: 'detail' | 'context' | null =
            detailOpen ? 'detail'
            : (inputMode === 'Tasks' && taskModeMsgSent && contextPanelOpen) ? 'context'
            : null;
          return (
            <SplitView
              sideOpen={sideKind !== null}
              sideWidth={sideKind === 'detail' ? 504 : 280}
              onCloseSide={sideKind === 'detail'
                ? () => { setDetailOpen(false); setContextPanelOpen(true); }
                : () => setContextPanelOpen(false)}
              bgClass="app-bg"
              side={({ overlay }) => {
                if (sideKind === 'detail') {
                  return (
                    <DetailPanel
                      title="Summary Report: Spark Driver Alcohol"
                      content={REPORT_CONTENT}
                      onClose={() => { setDetailOpen(false); setContextPanelOpen(true); }}
                      fullScreen={overlay}
                    />
                  );
                }
                if (sideKind === 'context') {
                  return (
                    <TaskContextPanel
                      onClose={() => setContextPanelOpen(false)}
                      progress={activeChatId === 'alcohol-delivery' ? buildAlcoholProgress(alcoholProgress) : undefined}
                      fullScreen={overlay}
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
                onCardAction={(action) => {
                  if (action === 'view-report') { setDetailOpen(true); setContextPanelOpen(false); return; }
                  handleCardAction(action);
                }}
                sidebarOpen={sidebarOpen || !isMobile}
                onToggleSidebar={() => setSidebarOpen(o => !o)}
                isDark={isDark}
                selectedAvatarId={selectedAvatarId}
                onAvatarChange={setSelectedAvatarId}
                onModeChange={(m) => { setInputMode(m); if (m !== 'Tasks') { setTaskModeMsgSent(false); setTaskModeUserMsg(''); } }}
                showContextToggle={inputMode === 'Tasks' && taskModeMsgSent && !detailOpen}
                contextPanelOpen={contextPanelOpen}
                onToggleContextPanel={() => setContextPanelOpen(o => !o)}
                isAiResponding={isAiResponding}
                draftValue={activeChat?.draftPrompt}
                forceMode={activeChat?.id === 'alcohol-delivery' ? 'Tasks' : undefined}
                onNewChat={isMobile ? handleNewChat : undefined}
              />
              {/* Task panel preview — slides in from right then back out (3s) */}
              {taskPanelPreviewing && !contextPanelOpen && !detailOpen && (
                <div
                  className="absolute top-0 right-0 bottom-0 z-20 task-panel-preview pointer-events-none overflow-hidden"
                  style={{ width: 'min(60vw, 504px)' }}
                >
                  <TaskContextPanel
                    onClose={() => {}}
                    progress={activeChatId === 'alcohol-delivery' ? buildAlcoholProgress(alcoholProgress) : undefined}
                    fullScreen
                  />
                </div>
              )}
            </SplitView>
          );
        })()}
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
