/**
 * Demo-only extra chats layered on top of INITIAL_CHATS when IS_DEMO is true.
 * Kept in a separate file so the real app's seed data stays untouched.
 *
 * Each entry is a Phase 5 "scripted" chat — pre-filled messages + cards that
 * already exercise the meeting/research/ticket flows without calling the
 * OpenAI API. Matches the existing `ux-meeting` / `alcohol-delivery` pattern
 * in src/data.ts.
 */

import type { Chat } from '../../types';

const hour = (n: number) => new Date(Date.now() - n * 3_600_000);

/** Extra seed chats shown on the demo deployment. They look "already used",
 *  so HRs land on a populated sidebar instead of an empty-state prompt. */
export const DEMO_EXTRA_CHATS: Chat[] = [
  {
    id: 'demo-compare-ux-architecture',
    title: 'Generate Agent Design Component Library',
    lastMessage: 'Library generated — 10 patterns grouped by Surface / Governors / Tuners / Trust / Operations. Open it on the right.',
    timestamp: hour(5),
    projectId: 'proj-1',
    messages: [
      {
        id: 'demo-cua-u1',
        role: 'user',
        content:
          'Generate an Agent Design Component Library — distill the recurring UX patterns we\'ll need when we ship our own agent product. Group them by intent (surface / governance / tuning / trust / operations) and back each one with real product screenshots and design principles.',
        timestamp: hour(5),
      },
      {
        id: 'demo-cua-a1',
        role: 'assistant',
        content:
          "Library generated — 10 patterns, grouped by what they do for the user.\n\n**Surface (1)**\n• Workflow — compose multi-step actions into a reusable, predictable flow\n\n**Governors (5)**\n• Action Plan — show the agent's plan before it acts, confirm-then-execute\n• Stream of Thought — make reasoning, tool calls, and decisions visible and auditable\n• Verification — checkpoint risky steps so the user can intervene\n• Memory — persist context across sessions with clear scope\n• Shared Vision — agree on outcome and constraints up front\n\n**Tuners (1)**\n• Connectors — give the agent access to user data and tools\n\n**Trust (1)**\n• Trust Builders — surface why the agent is reliable in this run\n\n**Operations (2)**\n• Inspector Panel — debug a running agent (steps + tool calls + I/O)\n• Operations Dashboard — monitor production agents and intervene at scale\n\nEach card carries real product screenshots, design intent, and best practices. Open the doc on the right to drill in.",
        timestamp: hour(5),
        artifacts: [
          {
            name: 'Agent Design Component Library',
            fileType: 'Web',
            href: '/agent-design-guide.html',
            source: 'artifact',
          },
        ],
        chips: [
          { label: 'Show the Verification pattern', action: 'explore-solutions' },
          { label: 'Add a new component', action: 'explore-solutions' },
          { label: 'Draft handoff specs', action: 'create-tickets' },
        ],
      },
    ],
  },
  {
    id: 'demo-q1-ux-research',
    title: 'Q1 UX research highlights',
    lastMessage: 'Here are the top themes from Q1 usability sessions.',
    timestamp: hour(26),
    messages: [
      {
        id: 'demo-q1-u1',
        role: 'user',
        content:
          'Give me the highlights from our Q1 usability study — I want to share them with the team.',
        timestamp: hour(26),
      },
      {
        id: 'demo-q1-a1',
        role: 'assistant',
        content:
          "Here's a summary pulled from the Q1 research notes. Open the card to read the full write-up, or ask me to tune the tone — shorter, more formal, or translated.",
        timestamp: hour(26),
        card: {
          type: 'research',
          title: 'Q1 UX Research — top themes',
          summary:
            '**Scope**\n12 moderated sessions with new + returning drivers across SF and LA, March 4 – March 28.\n\n**Top themes**\n• Drivers skim onboarding screens — key compliance cues get missed entirely\n• The handoff between delivery app and ID scanner feels like a dead-end (no visible progress state)\n• Returning drivers find the pickup flow "quiet" — they want more confirmation that the order was accepted\n• Bilingual drivers mentally translate error strings before acting — every extra token of jargon costs seconds\n\n**Recommendations**\n1. Compress onboarding to three screens with one action per screen\n2. Persist a "Verifying ID…" state across the scanner handoff\n3. Add a subtle success chime + haptic on pickup accept\n4. Rewrite top five error strings in plain language, bilingual from day one',
        },
        chips: [
          { label: 'Explore Solutions', action: 'explore-solutions' },
          { label: 'Create Tickets', action: 'create-tickets' },
        ],
      },
    ],
  },
];

/** IDs callers (e.g. the DEMO_CHAT_IDS allowlist in App.tsx) should treat as
 *  scripted — they never hit the OpenAI API. */
export const DEMO_EXTRA_CHAT_IDS = DEMO_EXTRA_CHATS.map((c) => c.id);
