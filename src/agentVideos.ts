import { useCallback, useEffect, useState } from 'react';
import { avatarAsianWoman, avatarBlackWoman, avatarWhiteMan } from './assets';

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
const CHANGE_EVENT   = 'workpal-agent-video-status-change';
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

/* localStorage is the source of truth — per-browser, with a `storage` event
 * to keep tabs in the same browser in sync. The previous server-backed route
 * was removed in post-Phase-7 cleanup (candidate #12); the toggle UI is admin-
 * only (DesignSystemPage), so per-browser is fine in practice.
 *
 * If cross-device sync is ever needed, promote to Supabase following the
 * `chatStore` / `projectStore` pattern (see api/_lib/chat-store.ts). */
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

/** Hook returns current status map plus imperative setters. Every component
 *  that calls it re-renders on change, regardless of which component triggered
 *  it, so DesignSystemPage and ChatPanel stay in sync in the same tab.
 *
 *  Cross-tab sync uses the native `storage` event (fires on other tabs of the
 *  same origin). Cross-browser / cross-device sync is intentionally not
 *  supported — see top-of-file note. */
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

  const getStatus = useCallback(
    (src: string): VideoStatus => map[src] ?? 'active',
    [map],
  );

  const setStatus = useCallback((src: string, status: VideoStatus) => {
    const next: StatusMap = { ...loadCachedMap(), [src]: status };
    cacheMap(next);
    setMap(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
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
