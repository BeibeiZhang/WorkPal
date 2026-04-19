import { useCallback, useEffect, useState } from 'react';
import { avatarAsianWoman, avatarBlackWoman, avatarWhiteMan } from './assets';

export type AgentVideoMode = 'light' | 'dark';
export type VideoStatus = 'active' | 'paused' | 'deleted';

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
      { src: '/animations/white-man-light-2.mp4',   mode: 'light' },
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

function loadMap(): StatusMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMap(map: StatusMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota or unavailable — ignore */
  }
}

/** Hook returns current status map plus imperative setters. Every component
 *  that calls it re-renders on change, regardless of which component triggered
 *  it, so DesignSystemPage and ChatPanel stay in sync in the same tab. */
export function useAgentVideoStatus() {
  const [map, setMap] = useState<StatusMap>(() => loadMap());

  useEffect(() => {
    const reload = () => setMap(loadMap());
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
    const current = loadMap();
    const next: StatusMap = { ...current, [src]: status };
    saveMap(next);
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
