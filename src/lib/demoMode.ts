/// <reference types="vite/client" />
/**
 * Demo deployment flag, set at build time on the `workpal` Vercel project
 * (my-workpal.vercel.app). Controls what a shared HR/interviewer URL sees:
 * seed chats, mock connectors, read-only memory, visible "Demo" badge.
 * Off locally and on `workpal-beibei`.
 *
 * Plain const export (not a hook): build flag is inlined by Vite at build
 * time, doesn't change across a session.
 *
 * Phase 7.4 note — agent reachability used to live here as
 * IS_CLAUDE_CODE_AVAILABLE / IS_AGENT_REACHABLE. It moved to
 * `src/lib/agent.ts` (`useAgentState`, `isAgentCurrentlyReachable`,
 * `fetchAgent`) when the live HTTPS probe replaced hostname sniffing.
 */

export const IS_DEMO = import.meta.env.VITE_WORKPAL_DEMO === 'true';
