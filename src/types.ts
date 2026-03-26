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
}

export type CardData = MeetingCard | ResearchCard | TicketCard | ScheduleCard;

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  chips?: ActionChip[];
  card?: CardData;
  isLoading?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
  isActive?: boolean;
}

export interface App {
  id: string;
  name: string;
  icon: string;
  color: string;
}
