import { useCallback, useEffect, useState } from 'react';
import { avatarAsianWoman, avatarBlackWoman, avatarWhiteMan } from './assets';

export type AgentVideoMode = 'light' | 'dark';

/* Status model
 *   active   — in rotation, can play in WelcomeState
 *   inactive — soft pause: file still on disk, skipped from rotation
 *   deleted  — the .mp4 was physically removed from public/animations/
 *              via DELETE /api/animations/:filename. Hidden from the DS
 *              list AND filtered out of the rotation pool. We persist the
 *              status (rather than just "the file is gone") so that the
 *              AGENTS array — which is hardcoded data — knows to skip the
 *              entry on subsequent loads without 404'ing on the missing
 *              <video src>. */
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
const CHANGE_EVENT   = 'workpal-agent-video-status-change';
const API_PATH       = '/api/agent-video-status';
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

/* The server is the source of truth, but we keep a localStorage mirror so the
 * UI can render instantly on mount (before the fetch resolves) and so toggles
 * still work offline. The server file lives at server/data/agent-video-status.json
 * and is shared across every browser/device that hits the same backend. */
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

async function fetchServerMap(): Promise<StatusMap | null> {
  try {
    const res = await fetch(API_PATH);
    if (!res.ok) return null;
    const body = await res.json() as { map?: Record<string, unknown> };
    if (!body?.map || typeof body.map !== 'object') return null;
    return normalizeMap(body.map);
  } catch {
    return null;
  }
}

async function patchServerStatus(src: string, status: VideoStatus): Promise<StatusMap | null> {
  try {
    const res = await fetch(API_PATH, {
      method:  'PATCH',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ src, status }),
    });
    if (!res.ok) return null;
    const body = await res.json() as { map?: Record<string, unknown> };
    if (!body?.map) return null;
    return normalizeMap(body.map);
  } catch {
    return null;
  }
}

/** Hook returns current status map plus imperative setters. Every component
 *  that calls it re-renders on change, regardless of which component triggered
 *  it, so DesignSystemPage and ChatPanel stay in sync in the same tab.
 *
 *  Cross-browser sync happens via the server: every read pulls the latest
 *  from /api/agent-video-status, and we re-fetch on window focus so flipping
 *  a toggle in Chrome shows up in Safari the next time you alt-tab back. */
export function useAgentVideoStatus() {
  const [map, setMap] = useState<StatusMap>(() => loadCachedMap());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const fresh = await fetchServerMap();
      if (!cancelled && fresh) {
        cacheMap(fresh);
        setMap(fresh);
      }
    };
    void refresh();

    const reload    = () => setMap(loadCachedMap());
    const onFocus   = () => { void refresh(); };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) reload();
    };
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const getStatus = useCallback(
    (src: string): VideoStatus => map[src] ?? 'active',
    [map],
  );

  const setStatus = useCallback((src: string, status: VideoStatus) => {
    // Optimistic local update so the UI reacts immediately even when the
    // server is slow or unreachable. Cache + state both flip first.
    const optimistic: StatusMap = { ...loadCachedMap(), [src]: status };
    cacheMap(optimistic);
    setMap(optimistic);
    window.dispatchEvent(new Event(CHANGE_EVENT));

    // Then push to the server. On success we adopt the authoritative map —
    // it may include entries from other browsers we hadn't seen locally.
    void (async () => {
      const fresh = await patchServerStatus(src, status);
      if (fresh) {
        cacheMap(fresh);
        setMap(fresh);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      }
    })();
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
