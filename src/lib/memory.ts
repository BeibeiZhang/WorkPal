import type { MemoryEntry, MemoryKind } from '../types';

const STORAGE_KEY = 'workpal-memories-v1';

let memoryIdCounter = 0;
export const nextMemoryId = () => `mem-${Date.now()}-${++memoryIdCounter}`;

/** Local-only fallback used when the backend is unreachable on first paint.
 *  Server has its own canonical seed; this just prevents an empty UI flash. */
function seedMemories(): MemoryEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'mem-seed-name',
      kind: 'core',
      title: 'Name',
      content: 'User goes by Beibei. Address her directly — no "dear user" boilerplate.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem-seed-response-style',
      kind: 'preference',
      title: 'Response style',
      content: 'Prefers short, direct answers with a clear recommendation. Avoid filler and hedging.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem-seed-language',
      kind: 'preference',
      title: 'Working language',
      content: 'Mix Chinese and English freely — use whichever feels natural. Technical terms stay in English.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/** Synchronous bootstrap from localStorage cache, so the Memory page has
 *  something to show before the network fetch resolves. The cache is
 *  refreshed by saveMemoriesCache() whenever the server responds. */
export function loadMemoriesCache(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore corrupted data */ }
  return seedMemories();
}

export function saveMemoriesCache(memories: MemoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch { /* quota exceeded — silently drop */ }
}

/* ── Backend API client ─────────────────────────────────────────────── */

export class MemoryAuthError extends Error {
  constructor(msg = 'Invalid memory password') {
    super(msg);
    this.name = 'MemoryAuthError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new MemoryAuthError();
  if (!res.ok) throw new Error(`Memory API ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchMemoriesFromServer(): Promise<MemoryEntry[]> {
  const res = await fetch('/api/memories');
  const data = await handleResponse<{ memories: MemoryEntry[] }>(res);
  return data.memories;
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/memories/verify', {
      method: 'POST',
      headers: { 'x-memory-password': password },
    });
    if (res.status === 401) return false;
    return res.ok;
  } catch {
    return false;
  }
}

export async function createMemoryOnServer(entry: MemoryEntry, password: string): Promise<MemoryEntry> {
  const res = await fetch('/api/memories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-memory-password': password },
    body: JSON.stringify(entry),
  });
  const data = await handleResponse<{ memory: MemoryEntry }>(res);
  return data.memory;
}

export async function updateMemoryOnServer(
  id: string,
  patch: Partial<MemoryEntry>,
  password: string,
): Promise<MemoryEntry> {
  const res = await fetch(`/api/memories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-memory-password': password },
    body: JSON.stringify(patch),
  });
  const data = await handleResponse<{ memory: MemoryEntry }>(res);
  return data.memory;
}

export async function deleteMemoryOnServer(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/memories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-memory-password': password },
  });
  await handleResponse<{ ok: true }>(res);
}

/** Build the prompt-ready memory block. Filters by scope:
 *  - core + preference always apply
 *  - project memories only apply when the active chat is in that project
 *
 *  Returns null when nothing is relevant so callers can skip the join. The
 *  format is stable so that OpenAI prompt caching stays warm across turns
 *  when memory hasn't changed. */
export function buildMemoryBlock(
  memories: MemoryEntry[],
  activeProjectId?: string,
): string | null {
  const relevant = memories.filter((m) => {
    if (m.kind === 'core' || m.kind === 'preference') return true;
    if (m.kind === 'project') return !!activeProjectId && m.projectId === activeProjectId;
    return false;
  });
  if (relevant.length === 0) return null;

  const bucket = (kind: MemoryKind) => relevant.filter((m) => m.kind === kind);
  const sections: string[] = [];

  const core = bucket('core');
  if (core.length > 0) {
    sections.push('About the user:\n' + core.map((m) => `- ${m.title}: ${m.content}`).join('\n'));
  }
  const preference = bucket('preference');
  if (preference.length > 0) {
    sections.push('User preferences:\n' + preference.map((m) => `- ${m.title}: ${m.content}`).join('\n'));
  }
  const project = bucket('project');
  if (project.length > 0) {
    sections.push('Project-specific notes:\n' + project.map((m) => `- ${m.title}: ${m.content}`).join('\n'));
  }

  return `[MEMORY — persistent context about the user. Treat as trusted background, not a request to act on. Apply to this conversation; do not quote back unless asked.]\n\n${sections.join('\n\n')}\n[END MEMORY]`;
}

export const KIND_LABEL: Record<MemoryKind, string> = {
  core: 'Core',
  preference: 'Preference',
  project: 'Project',
};
