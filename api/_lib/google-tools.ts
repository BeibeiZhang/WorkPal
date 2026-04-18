import { gmail } from '@googleapis/gmail';
import { calendar } from '@googleapis/calendar';
import { getOAuthClient, type GoogleConnectorId } from './google-auth.js';

/** Card shapes mirror src/types.ts — these JSON blobs leave the server and
 *  are rendered directly by MessageCard, so field names must match exactly. */
export type CardSourceJson = 'gmail' | 'calendar' | 'doc';
export interface MeetingCardJson { type: 'meeting'; title: string; content: string; source?: CardSourceJson; }
export interface ResearchCardJson { type: 'research'; title: string; summary: string; status?: 'in-progress' | 'sent' | 'done'; statusLabel?: string; source?: CardSourceJson; }
export interface TicketItemJson { text: string; assignee?: string; due?: string; checked?: boolean; }
export interface TicketCardJson { type: 'ticket'; title: string; description: string; assignee?: string; due?: string; items?: TicketItemJson[]; status?: 'in-progress' | 'created' | 'sent'; statusLabel?: string; }
export interface TimeOptionJson { date: string; time: string; selected?: boolean; }
export interface ScheduleCardJson { type: 'schedule'; title: string; date: string; time: string; attendees: string[]; location?: string; timeOptions?: TimeOptionJson[]; status?: 'pending' | 'sent'; statusLabel?: string; source?: CardSourceJson; }

export type CardJson = MeetingCardJson | ResearchCardJson | TicketCardJson | ScheduleCardJson;

export interface ToolResult {
  card: CardJson;
  data: unknown;
}

export class ConnectorNotConnectedError extends Error {
  constructor(connector: GoogleConnectorId) {
    super(`Connector ${connector} is not connected`);
    this.name = 'ConnectorNotConnectedError';
  }
}

async function requireClient(id: GoogleConnectorId) {
  const oauth2 = await getOAuthClient(id);
  if (!oauth2) throw new ConnectorNotConnectedError(id);
  return oauth2;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(s)}-${fmt(e)}`;
}

function encodeMessage(raw: string): string {
  return Buffer.from(raw, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Normalise a datetime string into RFC 3339 with a timezone. LLMs often emit
 *  bare "2026-04-20T15:00:00"; date-only becomes midnight UTC. */
function normalizeIso(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (!s) return undefined;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) return `${s}Z`;
  return s;
}

/* ─── search_gmail ──────────────────────────────────────────────────── */

export interface GmailSearchArgs { query?: string; max_results?: number; }

export async function searchGmail(args: GmailSearchArgs): Promise<ToolResult> {
  const auth = await requireClient('gmail');
  const api = gmail({ version: 'v1', auth });
  const q = (args.query || '').toString();
  const max = Math.max(1, Math.min(args.max_results ?? 10, 20));

  const listResp = await api.users.messages.list({
    userId: 'me',
    q: q || undefined,
    maxResults: max,
  });
  const ids = (listResp.data.messages || []).map((m) => m.id).filter((v): v is string => !!v);

  const hits = await Promise.all(ids.map(async (id) => {
    const m = await api.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });
    const headers = m.data.payload?.headers || [];
    const pick = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
    return {
      id,
      threadId: m.data.threadId || '',
      from: pick('From'),
      subject: pick('Subject') || '(no subject)',
      date: pick('Date'),
      snippet: m.data.snippet || '',
    };
  }));

  const bullets = hits.slice(0, 8).map((h) => {
    const who = h.from.replace(/<[^>]+>/g, '').trim() || h.from;
    return `- **${h.subject}** — ${who}${h.date ? ` (${shortDate(h.date)})` : ''}`;
  }).join('\n');
  const summary = hits.length === 0
    ? `No messages found for "${q}".`
    : `Found ${hits.length} message${hits.length === 1 ? '' : 's'}${q ? ` for "${q}"` : ''}.\n\n${bullets}`;

  const card: ResearchCardJson = {
    type: 'research',
    title: 'Inbox results',
    summary,
    status: 'done',
    statusLabel: 'Searched',
    source: 'gmail',
  };
  return { card, data: { query: q, hits } };
}

/* ─── send_email ────────────────────────────────────────────────────── */

export interface SendEmailArgs { to?: string; subject?: string; body?: string; cc?: string; }

export async function sendEmail(args: SendEmailArgs): Promise<ToolResult> {
  const auth = await requireClient('gmail');
  const api = gmail({ version: 'v1', auth });
  const to = (args.to || '').toString().trim();
  const subject = (args.subject || '').toString();
  const body = (args.body || '').toString();
  const cc = (args.cc || '').toString().trim();
  if (!to) throw new Error('send_email requires a "to" address');

  const headers: string[] = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ];
  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;

  const resp = await api.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMessage(raw) },
  });

  const preview = body.length > 400 ? `${body.slice(0, 400)}…` : body;
  const footer = `\n\nTo: ${to}${cc ? ` · Cc: ${cc}` : ''}`;
  const card: MeetingCardJson = {
    type: 'meeting',
    title: subject || '(no subject)',
    content: `${preview}${footer}`,
    source: 'gmail',
  };
  return { card, data: { messageId: resp.data.id, to, subject, cc } };
}

/* ─── list_calendar_events ─────────────────────────────────────────── */

export interface ListEventsArgs { time_min?: string; time_max?: string; max_results?: number; }

export async function listCalendarEvents(args: ListEventsArgs): Promise<ToolResult> {
  const auth = await requireClient('google-cal');
  const api = calendar({ version: 'v3', auth });

  const now = new Date();
  const defaultMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const timeMin = normalizeIso(args.time_min) || now.toISOString();
  const timeMax = normalizeIso(args.time_max) || defaultMax.toISOString();
  const max = Math.max(1, Math.min(args.max_results ?? 10, 20));

  const resp = await api.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: max,
  });

  const events = (resp.data.items || []).map((e) => {
    const startIso = e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00Z` : '');
    const endIso = e.end?.dateTime || (e.end?.date ? `${e.end.date}T00:00:00Z` : '');
    return {
      id: e.id || '',
      summary: e.summary || '(no title)',
      startIso,
      endIso,
      location: e.location || '',
      attendees: (e.attendees || []).map((a) => a.email || '').filter(Boolean),
      htmlLink: e.htmlLink || '',
    };
  });

  const first = events[0];
  const title = events.length === 0 ? 'No upcoming events' : 'Upcoming events';
  const card: ScheduleCardJson = {
    type: 'schedule',
    title,
    date: first?.startIso ? formatDateLabel(first.startIso) : '',
    time: first?.startIso && first?.endIso ? formatTimeRange(first.startIso, first.endIso) : '',
    attendees: first?.attendees || [],
    location: first?.location || undefined,
    source: 'gmail',
  };
  return { card, data: { events } };
}

/* ─── create_calendar_event ────────────────────────────────────────── */

export interface CreateEventArgs {
  title?: string;
  start_iso?: string;
  end_iso?: string;
  attendees?: string[];
  location?: string;
  description?: string;
}

export async function createCalendarEvent(args: CreateEventArgs): Promise<ToolResult> {
  const auth = await requireClient('google-cal');
  const api = calendar({ version: 'v3', auth });

  const title = (args.title || 'Untitled event').toString();
  const startIso = normalizeIso(args.start_iso);
  const endIso = normalizeIso(args.end_iso);
  if (!startIso || !endIso) throw new Error('create_calendar_event requires start_iso and end_iso');
  const attendees = (args.attendees || []).map((e) => ({ email: e }));

  const resp = await api.events.insert({
    calendarId: 'primary',
    sendUpdates: 'all',
    requestBody: {
      summary: title,
      description: args.description,
      location: args.location,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
      attendees,
    },
  });

  const ev = resp.data;
  const card: ScheduleCardJson = {
    type: 'schedule',
    title,
    date: formatDateLabel(startIso),
    time: formatTimeRange(startIso, endIso),
    attendees: (args.attendees || []),
    location: args.location,
    source: 'calendar',
  };
  return { card, data: { eventId: ev.id, htmlLink: ev.htmlLink, title, startIso, endIso } };
}

export function humanLabel(toolName: string, argsJson: string): string {
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(argsJson); } catch { /* empty */ }
  switch (toolName) {
    case 'search_gmail': {
      const q = typeof args.query === 'string' ? args.query : '';
      return q ? `Searching Gmail for "${q}"` : 'Searching Gmail';
    }
    case 'send_email': {
      const to = typeof args.to === 'string' ? args.to : '';
      return to ? `Sending email to ${to}` : 'Sending email';
    }
    case 'list_calendar_events':
      return 'Listing calendar events';
    case 'create_calendar_event': {
      const t = typeof args.title === 'string' ? args.title : '';
      return t ? `Creating event: ${t}` : 'Creating calendar event';
    }
    default:
      return toolName;
  }
}
