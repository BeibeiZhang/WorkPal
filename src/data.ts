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
