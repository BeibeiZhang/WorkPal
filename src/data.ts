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
    draftPrompt: 'Find any reports about Spark drivers experiencing issues with alcohol deliveries and summarize the key pain points.',
    messages: [],
    hasInspector: true,
    sessionFolder: '~/WorkPal/2026-04-18-alcohol-delivery-issues/',
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
];
