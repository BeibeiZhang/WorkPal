import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import Sidebar from './components/Sidebar';
import type { Project } from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import DetailPanel from './components/DetailPanel';
import Onboarding from './components/Onboarding';
import TaskScreen from './components/TaskScreen';
import TaskContextPanel from './components/TaskContextPanel';
import ProjectPage from './components/ProjectPage';
import ConnectorsPage from './components/ConnectorsPage';
import DesignSystemPage from './components/DesignSystemPage';
import NewProjectDialog from './components/NewProjectDialog';
import { Chat, Message, ActionChip, TicketCard, AgentCard } from './types';
import { avatarBlackWoman, avatarAsianWoman, avatarWhiteMan } from './assets';
import { INITIAL_CHATS } from './data';

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

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

let msgIdCounter = 100;
const nextId = () => String(++msgIdCounter);

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = 336;
const CONTEXT_PANEL_MIN = 260;
const MAIN_CONTENT_MIN = 360;
const subscribe = (cb: () => void) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); };
const getIsMobile = () => window.innerWidth < MOBILE_BREAKPOINT;
/** Can the context panel fit beside the main content? */
const getCanFitPanel = () => {
  const available = window.innerWidth - 16; // m-2 = 8px each side
  const sidebarW = window.innerWidth >= MOBILE_BREAKPOINT ? SIDEBAR_WIDTH : 0;
  return available - sidebarW - MAIN_CONTENT_MIN >= CONTEXT_PANEL_MIN;
};


export default function App() {
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [activeChatId, setActiveChatId] = useState<string>('my-workpal');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState('black-woman');
  const [detailOpen, setDetailOpen] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem('workpal-onboarding-done') === 'true');
  const [activeView, setActiveView] = useState<'chat' | 'tasks' | 'connectors' | 'design-system' | 'overview' | 'library'>('chat');
  const [inputMode, setInputMode] = useState<'Chat' | 'Tasks' | 'Code'>('Chat');
  const [taskModeMsgSent, setTaskModeMsgSent] = useState(false);
  const [_taskModeUserMsg, setTaskModeUserMsg] = useState('');
  const [projects, setProjects] = useState<Project[]>([
    { id: 'proj-1', name: 'Agent Design' },
    { id: 'proj-2', name: 'Project name 2' },
  ]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const isMobile = useSyncExternalStore(subscribe, getIsMobile);
  const canFitPanel = useSyncExternalStore(subscribe, getCanFitPanel);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);

  // Toggle dark class on root element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

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

  const handleSend = useCallback((text: string) => {
    if (inputMode === 'Tasks') { setTaskModeMsgSent(true); setTaskModeUserMsg(text); }
    // Find or create active chat
    let chatId = activeChatId;

    // If on welcome screen or empty session, update the existing chat's title
    if (!activeChat || activeChat.messages.length === 0) {
      if (activeChat && activeChat.messages.length === 0) {
        // Reuse existing empty chat (e.g. "New Session") and update its title
        chatId = activeChat.id;
        const newTitle = text.slice(0, 40) + (text.length > 40 ? '...' : '');
        setChats(prev => prev.map(c =>
          c.id === chatId ? { ...c, title: newTitle, lastMessage: text, timestamp: new Date() } : c
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
    // set-agent: transition agent card from 'ready' to 'saved'
    if (action === 'set-agent') {
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

  const handleOnboardingComplete = useCallback((description: string, traits: string[]) => {
    setOnboardingDone(true);
    localStorage.setItem('workpal-onboarding-done', 'true');

    // Build user message content: description + trait bullets
    const traitBullets = traits.map(t => `  • ${t}`).join('\n');
    const userContent = description
      ? `${description}\n${traitBullets}`
      : traitBullets || 'Set up my WorkPal agent';

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
    const newId = `chat-${Date.now()}`;
    setChats(prev => [{
      id: newId,
      title: 'New Session',
      lastMessage: '',
      timestamp: new Date(),
      messages: [],
    }, ...prev]);
    setActiveChatId(newId);
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
      <div className="flex-1 flex overflow-hidden m-2 rounded-[40px] shadow-2xl relative" style={{ border: `1px solid var(--color-outer-border)` }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <>
            {/* Backdrop overlay on mobile */}
            {isMobile && (
              <div
                className="absolute inset-0 z-20 bg-black/30"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <div className={isMobile ? 'absolute inset-y-0 left-0 z-30' : 'contents'}>
              <Sidebar
                chats={chats}
                activeChatId={activeChatId}
                activeView={activeView}
                activeProjectId={activeProjectId}
                projects={projects}
                onChatSelect={(id) => { handleChatSelect(id); if (isMobile) setSidebarOpen(false); }}
                onNewChat={() => { handleNewChat(); if (isMobile) setSidebarOpen(false); }}
                onNewProject={() => setNewProjectOpen(true)}
                onProjectSelect={(id) => { handleProjectSelect(id); if (isMobile) setSidebarOpen(false); }}
                onViewChange={(view) => { setActiveView(view); setActiveProjectId(null); if (isMobile) setSidebarOpen(false); }}
                isDark={isDark}
                onToggleDark={() => setIsDark(d => !d)}
                onToggleSidebar={() => setSidebarOpen(o => !o)}
              />
            </div>
          </>
        )}

        {/* Detail Panel */}
        {detailOpen && (
          <DetailPanel
            title="Summary Report: Spark Driver Alcohol"
            content={REPORT_CONTENT}
            onClose={() => setDetailOpen(false)}
          />
        )}

        {/* Main Content */}
        {activeProjectId && projects.find(p => p.id === activeProjectId) ? (
          <ProjectPage
            project={projects.find(p => p.id === activeProjectId)!}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : activeView === 'design-system' ? (
          <DesignSystemPage
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : activeView === 'connectors' ? (
          <ConnectorsPage
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : activeView === 'tasks' ? (
          <TaskScreen
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : !onboardingDone && activeChatId === 'my-workpal' ? (
          <Onboarding
            onComplete={handleOnboardingComplete}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        ) : (
          <>
            <ChatPanel
              chat={activeChat?.id === 'my-workpal' && (!onboardingDone || (activeChat?.messages.length ?? 0) === 0) ? null : activeChat ?? null}
              onSend={handleSend}
              onChipClick={handleChipClick}
              onCardAction={(action) => {
                handleCardAction(action);
                if (action === 'view-report') setDetailOpen(true);
              }}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen(o => !o)}
              isDark={isDark}
              selectedAvatarId={selectedAvatarId}
              onAvatarChange={setSelectedAvatarId}
              onModeChange={(m) => { setInputMode(m); if (m !== 'Tasks') { setTaskModeMsgSent(false); setTaskModeUserMsg(''); } }}
              showContextToggle={inputMode === 'Tasks' && taskModeMsgSent}
              contextPanelOpen={contextPanelOpen}
              onToggleContextPanel={() => setContextPanelOpen(o => !o)}
            />
            {/* Inline context panel (desktop with enough space) */}
            {inputMode === 'Tasks' && taskModeMsgSent && canFitPanel && contextPanelOpen && (
              <TaskContextPanel onClose={() => setContextPanelOpen(false)} />
            )}
            {/* Fullscreen overlay context panel (mobile or narrow viewport) */}
            {inputMode === 'Tasks' && taskModeMsgSent && !canFitPanel && contextPanelOpen && (
              <>
                <div className="absolute inset-0 z-20 bg-black/30" onClick={() => setContextPanelOpen(false)} />
                <div className="absolute inset-0 z-30 flex">
                  <TaskContextPanel onClose={() => setContextPanelOpen(false)} />
                </div>
              </>
            )}
          </>
        )}
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
