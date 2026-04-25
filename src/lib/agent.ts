// Phase 7.4 — local agent reachability probe + fetchAgent wrapper.
//
// The web app at workpal-beibei.vercel.app talks to the user's locally-installed
// WorkPal Agent (Phase 7.3) over HTTPS at https://127.0.0.1:3001. Cloud-only
// routes (memory / chats / projects / artifacts / connectors / usage / chat /
// edit-article) stay on Vercel; the four agent-only route prefixes (claude-chat
// SSE / project / session / reaper) cross-origin to the local agent here.
//
// Reachability has three settled-or-unsettled states (see AgentState). The
// boot probe debounces a single retry to absorb the ~200ms gap between the
// agent process spawning and the listener actually binding port 3001 — without
// it the onboarding surface would flash on cold launches when the agent is
// starting normally. Subsequent re-probes (window.focus, on-fetch-failure)
// are fail-fast: the user is already active, latency matters more than
// avoiding a brief misclassification.

import { useEffect, useState } from 'react';
import { IS_DEMO } from './demoMode';

export const AGENT_BASE_URL = 'https://127.0.0.1:3001';

const PROBE_TIMEOUT_MS = 1500;
const FIRST_BOOT_RETRY_DELAY_MS = 300;

/** Thrown by `fetchAgent` when the underlying `fetch` call rejects (TLS
 *  handshake failure, ECONNREFUSED, abort/timeout). Distinguishable from a
 *  4xx/5xx Response — those resolve normally so callers can `res.json()` the
 *  body the same as before. Callers that want to surface the onboarding
 *  surface check `err instanceof AgentUnreachableError`. */
export class AgentUnreachableError extends Error {
  cause?: unknown;
  constructor(cause?: unknown) {
    super('Agent unreachable');
    this.name = 'AgentUnreachableError';
    this.cause = cause;
  }
}

// `unknown` = probe hasn't run yet. Components hold off rendering the
// onboarding surface in this state to avoid a flash on first paint while the
// initial probe is in flight. `reachable` / `unreachable` are the settled
// states.
export type AgentState = 'unknown' | 'reachable' | 'unreachable';

let state: AgentState = 'unknown';
const listeners = new Set<(s: AgentState) => void>();

function setState(next: AgentState) {
  if (next === state) return;
  state = next;
  for (const fn of listeners) fn(state);
}

/** Sync getter — for non-React code (intentRouter's `shouldUseClaudeCode`
 *  is a plain function called from event handlers, not a hook context).
 *  Returns true only when state has settled to `reachable`; the unsettled
 *  `unknown` and the explicit `unreachable` both return false. */
export function isAgentCurrentlyReachable(): boolean {
  return state === 'reachable';
}

async function probeOnce(timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${AGENT_BASE_URL}/health`, {
      signal: ctrl.signal,
      // /health is unauthenticated. Skipping cookies also avoids surfacing
      // any cross-origin credential rules on a probe path that doesn't need
      // them.
      credentials: 'omit',
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Boot-time probe with the one-retry debounce (see file-level comment).
 *  Demo deployments short-circuit to `unreachable` so demo URLs never spin
 *  up a probe-loop attempting to reach an agent that doesn't apply.
 *  Resolved promise is unused — callers fire-and-forget; reactive state
 *  flows through the listener Set. */
export async function bootProbe(): Promise<void> {
  if (IS_DEMO) {
    setState('unreachable');
    return;
  }
  const first = await probeOnce(PROBE_TIMEOUT_MS);
  if (first) {
    setState('reachable');
    return;
  }
  await new Promise(r => setTimeout(r, FIRST_BOOT_RETRY_DELAY_MS));
  const second = await probeOnce(PROBE_TIMEOUT_MS);
  setState(second ? 'reachable' : 'unreachable');
}

/** Fast re-probe — no retry. Triggered by window.focus and on-fetch-failure
 *  paths where the user is already engaged. Concurrent calls coalesce on
 *  last-write-wins for the final setState; harmless because `probeOnce`
 *  itself doesn't mutate. */
export async function triggerReprobe(): Promise<void> {
  if (IS_DEMO) return;
  const ok = await probeOnce(PROBE_TIMEOUT_MS);
  setState(ok ? 'reachable' : 'unreachable');
}

/** Subscribe to agent state from React. Renders re-flow when state flips,
 *  letting App.tsx swap in the OnboardingSurface vs. normal chat chrome
 *  without prop-drilling. */
export function useAgentState(): AgentState {
  const [s, setS] = useState<AgentState>(state);
  useEffect(() => {
    listeners.add(setS);
    // Catch any state changes that landed between the initial useState read
    // and the listener registration — rare but possible if probe resolves
    // synchronously fast.
    if (state !== s) setS(state);
    return () => {
      listeners.delete(setS);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return s;
}

/** `fetch` against the local agent with the base URL prepended and a
 *  network-throw → onboarding-state side-effect. A successful 4xx / 5xx
 *  response resolves normally so callers can read `res.ok` / `res.json()`
 *  just like the pre-7.4 same-origin pattern.
 *
 *  On a network throw (TLS / ECONNREFUSED / abort): marks state
 *  `unreachable`, schedules a re-probe (so a transient blip self-heals on
 *  the next probe round-trip), and re-throws as `AgentUnreachableError` for
 *  the caller. */
export async function fetchAgent(path: string, init?: RequestInit): Promise<Response> {
  if (!path.startsWith('/')) {
    throw new Error(`fetchAgent: path must start with "/", got: ${path}`);
  }
  try {
    return await fetch(`${AGENT_BASE_URL}${path}`, init);
  } catch (err) {
    setState('unreachable');
    void triggerReprobe();
    throw new AgentUnreachableError(err);
  }
}

/** Wires up the boot probe + window.focus listener. Call once at app
 *  startup; returns a teardown for completeness (Strict Mode double-mount
 *  guard). */
export function initAgentProbe(): () => void {
  void bootProbe();
  const onFocus = () => {
    void triggerReprobe();
  };
  window.addEventListener('focus', onFocus);
  return () => {
    window.removeEventListener('focus', onFocus);
  };
}
