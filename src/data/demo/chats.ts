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
    id: 'demo-weekly-sync',
    title: 'Weekly product sync recap',
    lastMessage: "I'll summarize this week's sync notes for you.",
    timestamp: hour(4),
    messages: [
      {
        id: 'demo-sync-u1',
        role: 'user',
        content: "Summarize this week's product sync and pull out action items.",
        timestamp: hour(4),
      },
      {
        id: 'demo-sync-a1',
        role: 'assistant',
        content:
          "Here's the recap from Monday's product sync. The team agreed on two big moves for next week — would you like me to turn them into Jira tickets?",
        timestamp: hour(4),
        card: {
          type: 'meeting',
          title: 'Weekly product sync — April 15',
          content:
            '**Attendees**\nBeibei, Kai, Stephen, Priya\n\n**Decisions**\n• Ship the pickup-flow redesign behind a 20% experiment starting Monday\n• Pause the loyalty integration until legal clears the T&Cs update\n\n**Action items**\n• Kai — finalize pickup illustrations by Thursday\n• Stephen — draft experiment targeting rules\n• Priya — schedule legal sync about loyalty T&Cs',
        },
        chips: [
          { label: 'Create Tickets', action: 'create-tickets' },
          { label: 'Set Up Meeting', action: 'set-up-meeting' },
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
