/**
 * Chat persistence — localStorage first-paint cache + Supabase-backed cloud
 * sync. Same pattern as src/lib/memory.ts: load synchronously from cache so
 * the UI has something to render immediately, then reconcile with the server
 * once the password is unlocked.
 *
 * Demo mode: never touches localStorage or the cloud — INITIAL_CHATS +
 * DEMO_EXTRA_CHATS are returned fresh on every load so HRs see the same
 * pristine snapshot on every visit.
 *
 * Cross-device merge model (lives in App.tsx, the store just provides the
 * primitives):
 *   - On unlock: fetch metadata from /api/chats. For each cloud row whose
 *     updatedAt is newer than the local cached updatedAt, fetch the full
 *     chat. For local chats not present in the cloud, delete them locally
 *     (someone removed them on another device) — except isDraft chats,
 *     which stay local-only until the user sends their first message.
 *   - On flush: PUT /api/chats/[id] with the full chat record + a fresh
 *     updatedAt. Streaming-time changes are excluded by App.tsx's
 *     streamingChatIds set; the trailing debounce flushes once the stream
 *     stabilizes.
 *   - On migration (one-shot per device): bulk-upsert with
 *     ignoreDuplicates=true. Existing server rows win — local cached
 *     versions of seed chats don't accidentally trample updates that
 *     other devices have already pushed.
 */

import type { Chat, Message } from '../types';
import { IS_DEMO } from './demoMode';
import { INITIAL_CHATS } from '../data';
import { DEMO_EXTRA_CHATS } from '../data/demo/chats';

const CHATS_CACHE_KEY = 'workpal-chats-v2';
const CHATS_UPDATED_AT_KEY = 'workpal-chats-updated-at-v1';
const CHATS_MIGRATED_KEY = 'workpal-chats-cloud-migrated-v1';
const LEGACY_CHATS_KEYS = ['workpal-chats'];

/* ── Wire shape (mirrors api/_lib/chat-store.ts) ──────────────────── */

export interface ChatMetadataWire {
  id: string;
  title: string;
  lastMessage: string;
  projectId?: string;
  isDraft?: boolean;
  hasInspector?: boolean;
  sessionFolder?: string;
  folderMaterialized?: boolean;
  sessionCompleted?: boolean;
  draftPrompt?: string;
  timestamp: string;
  updatedAt: string;
}

interface ChatRecord extends ChatMetadataWire {
  messages: Message[];
}

function chatToRecord(chat: Chat, updatedAt: string): ChatRecord {
  return {
    id: chat.id,
    title: chat.title,
    lastMessage: chat.lastMessage,
    projectId: chat.projectId,
    isDraft: chat.isDraft,
    hasInspector: chat.hasInspector,
    sessionFolder: chat.sessionFolder,
    folderMaterialized: chat.folderMaterialized,
    sessionCompleted: chat.sessionCompleted,
    draftPrompt: chat.draftPrompt,
    messages: chat.messages,
    timestamp:
      chat.timestamp instanceof Date
        ? chat.timestamp.toISOString()
        : new Date(chat.timestamp).toISOString(),
    updatedAt,
  };
}

function recordToChat(record: ChatRecord): Chat {
  return {
    id: record.id,
    title: record.title,
    lastMessage: record.lastMessage,
    timestamp: new Date(record.timestamp),
    messages: (record.messages ?? []).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp as unknown as string),
    })),
    projectId: record.projectId,
    isDraft: (record.isDraft && !(record.messages?.length)) || undefined,
    hasInspector: record.hasInspector,
    sessionFolder: record.sessionFolder,
    folderMaterialized: record.folderMaterialized,
    sessionCompleted: record.sessionCompleted,
    draftPrompt: record.draftPrompt,
  };
}

/* ── localStorage cache ───────────────────────────────────────────── */

/** Synchronous bootstrap from cache so the sidebar / chat panel have
 *  something to render before the network fetch resolves. Mirrors the
 *  legacy `loadChats()` behavior — including the dedupe + seed-field
 *  backfill — so existing localStorage carries over without a wipe. */
export function loadChatsCache(): Chat[] {
  if (IS_DEMO) return [...INITIAL_CHATS, ...DEMO_EXTRA_CHATS];
  try {
    LEGACY_CHATS_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(CHATS_CACHE_KEY);
    if (!raw) return INITIAL_CHATS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_CHATS;
    const seen = new Set<string>();
    const deduped = parsed.filter((c: { id: string }) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    const seedById: Record<string, Partial<Chat>> = Object.fromEntries(
      INITIAL_CHATS.map((c) => [c.id, c]),
    );
    return deduped.map((c: Chat & { timestamp: string | Date }): Chat => ({
      ...c,
      timestamp: new Date(c.timestamp),
      messages: (c.messages ?? []).map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp as unknown as string),
      })),
      isDraft: (c.isDraft && !(c.messages?.length)) || undefined,
      hasInspector: c.hasInspector ?? seedById[c.id]?.hasInspector,
      sessionFolder: c.sessionFolder ?? seedById[c.id]?.sessionFolder,
      folderMaterialized: c.folderMaterialized ?? seedById[c.id]?.folderMaterialized,
    }));
  } catch {
    return INITIAL_CHATS;
  }
}

export function saveChatsCache(chats: Chat[]): void {
  if (IS_DEMO) return;
  try {
    localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(chats));
  } catch {
    /* quota exceeded — silently drop */
  }
}

/** Per-id updatedAt map persisted alongside the cache so cross-device
 *  reconciliation has a comparable timestamp on first paint. Server-returned
 *  updatedAt is authoritative; this map gets bumped both when a flush
 *  succeeds (to the server's value) and when a chat goes dirty (to now). */
export function loadChatsUpdatedAtMap(): Record<string, string> {
  if (IS_DEMO) return {};
  try {
    const raw = localStorage.getItem(CHATS_UPDATED_AT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveChatsUpdatedAtMap(map: Record<string, string>): void {
  if (IS_DEMO) return;
  try {
    localStorage.setItem(CHATS_UPDATED_AT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function isChatsMigrationDone(): boolean {
  if (IS_DEMO) return true;
  try {
    return localStorage.getItem(CHATS_MIGRATED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markChatsMigrationDone(): void {
  if (IS_DEMO) return;
  try {
    localStorage.setItem(CHATS_MIGRATED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/* ── Backend API client ───────────────────────────────────────────── */

export class ChatAuthError extends Error {
  constructor(msg = 'Invalid chat password') {
    super(msg);
    this.name = 'ChatAuthError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new ChatAuthError();
  if (!res.ok) throw new Error(`Chat API ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchChatsMetadata(password: string): Promise<ChatMetadataWire[]> {
  if (IS_DEMO) return [];
  const res = await fetch('/api/chats', {
    headers: { 'x-memory-password': password },
  });
  const data = await handleResponse<{ chats: ChatMetadataWire[] }>(res);
  return data.chats;
}

export async function fetchChat(id: string, password: string): Promise<Chat | null> {
  if (IS_DEMO) return null;
  const res = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
    headers: { 'x-memory-password': password },
  });
  if (res.status === 404) return null;
  const data = await handleResponse<{ chat: ChatRecord }>(res);
  return recordToChat(data.chat);
}

/** Returns the server-assigned updatedAt so the client can cache it for
 *  next-startup reconciliation. */
export async function upsertChatOnServer(
  chat: Chat,
  updatedAt: string,
  password: string,
): Promise<string> {
  if (IS_DEMO) throw new Error('Chats are read-only in demo mode');
  const record = chatToRecord(chat, updatedAt);
  const res = await fetch(`/api/chats/${encodeURIComponent(chat.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-memory-password': password },
    body: JSON.stringify(record),
  });
  const data = await handleResponse<{ chat: ChatRecord }>(res);
  return data.chat.updatedAt;
}

export async function deleteChatOnServer(id: string, password: string): Promise<void> {
  if (IS_DEMO) throw new Error('Chats are read-only in demo mode');
  const res = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-memory-password': password },
  });
  if (res.status === 404) return; // already gone — idempotent
  await handleResponse<{ ok: true }>(res);
}

/** Migration upload — sends every non-draft local chat. Server uses
 *  ignoreDuplicates so existing rows aren't overwritten. */
export async function bulkUploadChats(
  chats: Chat[],
  updatedAtMap: Record<string, string>,
  password: string,
): Promise<number> {
  if (IS_DEMO) return 0;
  const records = chats
    .filter((c) => !c.isDraft || c.messages.length > 0)
    .map((c) => chatToRecord(c, updatedAtMap[c.id] ?? new Date().toISOString()));
  if (records.length === 0) return 0;
  const res = await fetch('/api/chats/bulk-upsert', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-memory-password': password },
    body: JSON.stringify({ chats: records }),
  });
  const data = await handleResponse<{ inserted: number }>(res);
  return data.inserted;
}
