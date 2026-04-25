/// <reference types="vite/client" />
/**
 * Demo deployment flags. Two orthogonal axes:
 *
 *   IS_DEMO                  build-time, set on the `workpal` Vercel project
 *                            (my-workpal.vercel.app). Controls what a shared
 *                            HR/interviewer URL sees: seed chats, mock
 *                            connectors, read-only memory, visible "Demo"
 *                            badge. Off locally and on `workpal-beibei`.
 *
 *   IS_AGENT_REACHABLE runtime, computed from `location.hostname`.
 *                            Claude Agent SDK needs a persistent cwd + native
 *                            binary — neither Vercel deployment can host it,
 *                            only localhost dev. Hides the Claude Code code
 *                            path on both Vercel builds (demo + self-use)
 *                            without tying the decision to IS_DEMO.
 *
 * Kept as plain const exports (not a hook): they don't change across a
 * session — build flag is inlined at build time, hostname is stable — so
 * importers can branch at module load without triggering re-renders.
 */

export const IS_DEMO = import.meta.env.VITE_WORKPAL_DEMO === 'true';

export const IS_AGENT_REACHABLE =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');
