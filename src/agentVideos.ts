import { useCallback, useEffect, useState } from 'react';
import { avatarAsianWoman, avatarBlackWoman, avatarWhiteMan } from './assets';
import { IS_DEMO } from './lib/demoMode';

export type AgentVideoMode = 'light' | 'dark';

/* Status model
 *   active   — in rotation, can play in WelcomeState
 *   inactive — soft pause: file still on disk, skipped from rotation
 *   deleted  — historical value: kept for back-compat with existing
 *              localStorage entries written by the now-removed
 *              DELETE /api/animations/:filename endpoint. No current
 *              UI surface writes this value; the filter logic stays
 *              defensive so a leftover 'deleted' entry doesn't resurrect
 *              into the rotation pool. */
export type VideoStatus = 'active' | 'inactive' | 'deleted';

export type AgentVideo = {
  src: string;
  mode: AgentVideoMode;
};

export type Agent = {
  id: string;
  name: string;
  avatar: string;
  videos: AgentVideo[];
};

export const AGENTS: Agent[] = [
  {
    id: 'white-man',
    name: 'Stephen',
    avatar: avatarWhiteMan,
    videos: [
      { src: '/animations/white-man-light.mp4',     mode: 'light' },
      { src: '/animations/white-man-thinking.mp4',  mode: 'light' },
      { src: '/animations/white-man-checkmark.mp4', mode: 'light' },
      { src: '/animations/white-man-light-3.mp4',   mode: 'light' },
      { src: '/animations/white-man-light-4.mp4',   mode: 'light' },
      { src: '/animations/white-man-dark.mp4',      mode: 'dark'  },
      { src: '/animations/white-man-coffee.mp4',    mode: 'dark'  },
    ],
  },
  {
    id: 'black-woman',
    name: 'Maya',
    avatar: avatarBlackWoman,
    videos: [
      { src: '/animations/black-woman-light.mp4', mode: 'light' },
      { src: '/animations/black-woman-dark.mp4',  mode: 'dark'  },
    ],
  },
  {
    id: 'asian-woman',
    name: 'Mei',
    avatar: avatarAsianWoman,
    videos: [
      { src: '/animations/asian-woman-light.mp4', mode: 'light' },
      { src: '/animations/asian-woman-dark.mp4',  mode: 'dark'  },
    ],
  },
];

const STORAGE_KEY    = 'workpal-agent-video-status';
const MIGRATED_KEY   = 'workpal-agent-video-status-migrated';
const CHANGE_EVENT   = 'workpal-agent-video-status-change';
const AUTH_KEY       = 'workpal-auth-v1';
/** Demo origin hits the self-use deployment cross-origin so demo visitors
 *  see Beibei's curated pool. Self-use uses relative /api which the same
 *  Vercel project serves. */
const CLOUD_BASE     = IS_DEMO ? 'https://workpal-beibei.vercel.app' : '';
type StatusMap       = Record<string, VideoStatus>;

/** Map legacy status values written by an earlier 3-state UI ('paused' was
 *  the old name for 'inactive'). Keeps users who already configured their
 *  pool from being reset back to all-active on first load after the rename. */
function normalizeStatus(raw: unknown): VideoStatus | null {
  if (raw === 'active' || raw === 'inactive' || raw === 'deleted') return raw;
  if (raw === 'paused') return 'inactive';
  return null;
}

function normalizeMap(input: Record<string, unknown>): StatusMap {
  const out: StatusMap = {};
  for (const [k, v] of Object.entries(input)) {
    const norm = normalizeStatus(v);
    if (norm) out[k] = norm;
  }
  return out;
}

/* Cloud-backed (Supabase `agent_video_status` table, migration 0006) so
 * the demo deployment can mirror Beibei's curated pool. localStorage is
 * the first-paint cache + offline fallback; the cloud is reconciled
 * lazily on mount. Cross-tab sync within a browser still uses the native
 * `storage` event.
 *
 * Auth model:
 *   - GET is unauthenticated — the demo origin reads it cross-origin.
 *   - PUT requires `x-memory-password` (same model as chats/memories).
 *   - In IS_DEMO `setStatus` is a no-op; the Switch UI in DesignSystemPage
 *     also renders disabled, so this is just defense-in-depth.
 *
 * One-time migration: a fresh self-use browser with localStorage entries
 * but an empty cloud table pushes its local map up via bulk-upsert. The
 * MIGRATED_KEY flag prevents re-uploading on every mount. */
function loadCachedMap(): StatusMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return normalizeMap(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return {};
  }
}

function cacheMap(map: StatusMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota or unavailable — ignore */
  }
}

/** Read the cached login password directly from localStorage (same trick
 *  App.tsx uses for the cross-device sync layer — keeps this module from
 *  needing the auth React context, so non-React callers stay simple). */
function getCachedPasswordSync(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.password === 'string' ? parsed.password : null;
  } catch {
    return null;
  }
}

async function cloudLoad(): Promise<StatusMap | null> {
  try {
    const res = await fetch(`${CLOUD_BASE}/api/agent-videos`);
    if (!res.ok) return null;
    const data = (await res.json()) as { map?: Record<string, unknown> };
    return data.map ? normalizeMap(data.map) : {};
  } catch {
    return null;
  }
}

async function cloudPut(src: string, status: VideoStatus): Promise<boolean> {
  if (IS_DEMO) return false;
  const password = getCachedPasswordSync();
  if (!password) return false;
  try {
    const res = await fetch('/api/agent-videos', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-memory-password': password },
      body: JSON.stringify({ src, status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function cloudBulkUpsert(map: StatusMap): Promise<boolean> {
  if (IS_DEMO) return false;
  if (Object.keys(map).length === 0) return true;
  const password = getCachedPasswordSync();
  if (!password) return false;
  try {
    const res = await fetch('/api/agent-videos/bulk-upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-memory-password': password },
      body: JSON.stringify({ map }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Hook returns current status map plus imperative setters. Every component
 *  that calls it re-renders on change, regardless of which component triggered
 *  it, so DesignSystemPage and ChatPanel stay in sync in the same tab.
 *
 *  Cross-tab sync uses the native `storage` event (fires on other tabs of the
 *  same origin). Cross-device / cross-deployment sync rides the Supabase
 *  cloud table — see top-of-file note. */
export function useAgentVideoStatus() {
  const [map, setMap] = useState<StatusMap>(() => loadCachedMap());

  useEffect(() => {
    const reload    = () => setMap(loadCachedMap());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) reload();
    };
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Lazy cloud hydrate. Local cache already drove first paint via the
  // useState initializer, so this just reconciles. Cloud unreachable
  // (dev / offline) → keep local. One-time migration uploads a fresh
  // self-use browser's local entries when the cloud table is empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cloud = await cloudLoad();
      if (cancelled || cloud === null) return;

      if (IS_DEMO) {
        // Demo only mirrors cloud — never writes. Local cache stays as-is
        // for the next first-paint, but state is the cloud snapshot.
        cacheMap(cloud);
        setMap(cloud);
        return;
      }

      const local            = loadCachedMap();
      const alreadyMigrated  = window.localStorage.getItem(MIGRATED_KEY) === '1';
      const cloudIsEmpty     = Object.keys(cloud).length === 0;
      const localHasEntries  = Object.keys(local).length > 0;

      if (!alreadyMigrated && cloudIsEmpty && localHasEntries) {
        const ok = await cloudBulkUpsert(local);
        if (!cancelled && ok) {
          window.localStorage.setItem(MIGRATED_KEY, '1');
          // Local already matches; leave state alone so the toggles don't
          // visually flip during the upload.
        }
        return;
      }

      cacheMap(cloud);
      setMap(cloud);
      window.localStorage.setItem(MIGRATED_KEY, '1');
    })();
    return () => { cancelled = true; };
  }, []);

  const getStatus = useCallback(
    (src: string): VideoStatus => map[src] ?? 'active',
    [map],
  );

  const setStatus = useCallback((src: string, status: VideoStatus) => {
    if (IS_DEMO) return;  // demo is read-only; Switch UI also renders disabled.
    const next: StatusMap = { ...loadCachedMap(), [src]: status };
    cacheMap(next);
    setMap(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    // Fire-and-forget cloud write. localStorage is immediate truth for this
    // tab; cloud reconciles on next mount/focus across other devices.
    void cloudPut(src, status);
  }, []);

  return { getStatus, setStatus };
}

/** Read-only variant that just exposes the filtered active pool, without
 *  the setters. Used by ChatPanel — it only needs to know which videos are
 *  currently usable. */
export function useActiveVideos(agentId: string, mode: AgentVideoMode): string[] {
  const { getStatus } = useAgentVideoStatus();
  const agent = AGENTS.find(a => a.id === agentId) ?? AGENTS[0];
  return agent.videos
    .filter(v => v.mode === mode && getStatus(v.src) === 'active')
    .map(v => v.src);
}
