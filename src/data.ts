import { Chat, App } from './types';

export const APPS: App[] = [
  { id: 'asana', name: 'Asana', icon: 'asana', color: '#F06A6A' },
  { id: 'docs', name: 'Docs', icon: 'docs', color: '#4285F4' },
  { id: 'sheets', name: 'Sheets', icon: 'sheets', color: '#34A853' },
  { id: 'gmail', name: 'Gmail', icon: 'gmail', color: '#EA4335' },
  { id: 'zoom', name: 'Zoom', icon: 'zoom', color: '#2D8CFF' },
];

export const INITIAL_CHATS: Chat[] = [
  {
    id: 'my-workpal',
    title: 'My WorkPal',
    lastMessage: 'How can I help you today?',
    timestamp: new Date(),
    messages: [],
  },
  {
    id: 'workpal-design-research',
    title: 'WorkPal Design Research',
    lastMessage: 'Three discovery tickets are now in the UX backlog.',
    timestamp: new Date(Date.now() - 1800000),
    messages: [
      {
        id: '1',
        role: 'user',
        content:
          'I\'m kicking off design research for WorkPal v2. Help me draft a discovery research plan — we want to understand how knowledge workers use AI assistants in their daily workflow, where the friction lives, and whether the project + library model resonates.',
        timestamp: new Date(Date.now() - 1800000),
      },
      {
        id: '2',
        role: 'assistant',
        content:
          'Here\'s the discovery plan ready to go. Want me to **set up a kickoff with the team**, **draft the interview script**, or **start recruiting participants**?',
        timestamp: new Date(Date.now() - 1790000),
        card: {
          type: 'research',
          title: 'WorkPal v2 — Discovery Research Plan',
          summary:
            'A **4-week mixed-methods study** covering **12 contextual interviews**, a **2-week diary study (n=8)**, and a **benchmark survey (n=120)**. Goals: map daily AI workflows, surface frustrations with current tools, and validate the **project + library** model with power users.',
          status: 'done',
          statusLabel: 'Plan ready',
        },
        chips: [
          { label: 'Set up kickoff', action: 'set-up-kickoff' },
          { label: 'Draft interview script', action: 'draft-interview-script' },
          { label: 'Recruit participants', action: 'recruit-participants' },
        ],
      },
      {
        id: '3',
        role: 'user',
        content: 'Looks great. Can you set up a kickoff with the design and research team?',
        timestamp: new Date(Date.now() - 1700000),
      },
      {
        id: '4',
        role: 'assistant',
        content:
          'Done — the kickoff is on the team\'s calendar. Want me to **send the invite**, **draft the agenda**, or **prep a discussion guide** before the meeting?',
        timestamp: new Date(Date.now() - 1690000),
        card: {
          type: 'schedule',
          title: 'WorkPal v2 Research Kickoff',
          date: 'Monday, April 14',
          time: '10:00 AM-11:00 AM',
          attendees: ['Beibei Zhang', 'Kai Garcia', 'Stephen Garcia', 'Maya Patel'],
          location: 'Google Meet',
          timeOptions: [
            { date: 'Monday, April 14', time: '10:00 AM-11:00 AM', selected: true },
            { date: 'Monday, April 14', time: '2:00 PM-3:00 PM' },
          ],
        },
        chips: [
          { label: 'Send invite', action: 'send-invite' },
          { label: 'Draft agenda', action: 'draft-agenda' },
          { label: 'Prep discussion guide', action: 'prep-discussion-guide' },
        ],
      },
      {
        id: '5',
        role: 'user',
        content:
          'Perfect. Once interviews wrap, summarize the top themes and create tickets for the design team to act on.',
        timestamp: new Date(Date.now() - 1500000),
      },
      {
        id: '6',
        role: 'assistant',
        content:
          'All set — three discovery tickets are now in the UX backlog. Want me to **draft the interview script**, **create a screener**, or **prep the diary study brief** next? 😊',
        timestamp: new Date(Date.now() - 1490000),
        card: {
          type: 'ticket',
          title: 'WorkPal v2 — Research Synthesis',
          description:
            'Auto-generated from the **n=12 interview themes**. Routed to the UX backlog under the WorkPal v2 epic.',
          items: [
            { text: 'Reduce friction when switching between projects', assignee: 'Beibei', due: 'Apr 22' },
            { text: 'Make Library more discoverable on first run', assignee: 'Kai', due: 'Apr 24' },
            { text: 'Surface saved artifacts in chat context', assignee: 'Stephen', due: 'Apr 26' },
          ],
          status: 'created',
          statusLabel: 'Created',
        },
        chips: [
          { label: 'Draft interview script', action: 'draft-interview-script' },
          { label: 'Create screener', action: 'create-screener' },
          { label: 'Prep diary brief', action: 'prep-diary-brief' },
        ],
      },
    ],
  },
  {
    id: 'alcohol-delivery',
    title: 'Alcohol Delivery Issues',
    lastMessage: 'Find any reports about Spark drivers...',
    timestamp: new Date(Date.now() - 3600000),
    isActive: true,
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Find any reports about Spark drivers experiencing issues with alcohol deliveries and summarize the key pain points.',
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        id: '1b',
        role: 'assistant',
        content: '',
        timestamp: new Date(Date.now() - 3550000),
        card: {
          type: 'research',
          title: 'Confirming citation',
          summary: '',
          status: 'in-progress',
          statusLabel: 'Sent',
        },
      },
      {
        id: '2',
        role: 'assistant',
        content: 'All done! Let me know if you\'d like some **recommendations** based on the report findings — or, if it makes sense, we can also **explore solutions** or even **set up a meeting** to discuss things further. 😊',
        timestamp: new Date(Date.now() - 3500000),
        card: {
          type: 'research',
          title: 'Pickup & Drop-off V4 Metrics Report',
          summary: 'The Pickup & Drop-off V4 Report shows a **12% improvement** in delivery efficiency, reducing average wait time from **8.5 minutes to 7.4 minutes**.',
        },
        chips: [
          { label: 'Set Up Meeting', action: 'set-up-meeting' },
          { label: 'Explore Solutions', action: 'explore-solutions' },
          { label: 'View Recommendations', action: 'view-recommendations' },
        ],
      },
    ],
  },
  {
    id: 'ux-meeting',
    title: 'UX Meeting Minutes',
    lastMessage: 'Can you write a summary of yesterday\'s meeting?',
    timestamp: new Date(Date.now() - 7200000),
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Can you write a summary of yesterday\'s meeting about alcohol delivery?',
        timestamp: new Date(Date.now() - 7200000),
      },
    ],
  },
  {
    id: 'ux-review',
    title: 'Set up a UX review',
    lastMessage: 'Meeting scheduled for Friday.',
    timestamp: new Date(Date.now() - 86400000),
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Set up a UX review meeting for the team.',
        timestamp: new Date(Date.now() - 86400000),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'I\'ve set up the UX review meeting. Here are the details:',
        timestamp: new Date(Date.now() - 85000000),
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
    ],
  },
  {
    id: 'metrics',
    title: 'Pickup & Drop-off V4 Metrics...',
    lastMessage: 'Here\'s the analysis of your metrics.',
    timestamp: new Date(Date.now() - 172800000),
    messages: [],
  },
];
