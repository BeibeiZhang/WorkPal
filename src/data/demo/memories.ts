/**
 * Read-only memory entries shown on the demo deployment. The demo does NOT
 * connect to Beibei's real Supabase — MEMORY_PASSWORD is specifically there
 * to keep strangers from deleting her entries, and the env vars are
 * intentionally absent on the `workpal` Vercel project.
 *
 * Keep these honest examples of what the memory system stores (core /
 * preference / project) but with made-up generic content so visitors don't
 * see anything personal.
 */

import type { MemoryEntry } from '../../types';

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 24 * 3_600_000).toISOString();

export const DEMO_MEMORIES: MemoryEntry[] = [
  {
    id: 'demo-mem-name',
    kind: 'core',
    title: 'Name',
    content:
      'User goes by Beibei. Address her directly, no "dear user" boilerplate.',
    createdAt: iso(14),
    updatedAt: iso(14),
  },
  {
    id: 'demo-mem-response-style',
    kind: 'preference',
    title: 'Response style',
    content:
      'Prefers short, direct answers with a clear recommendation. Avoid filler and hedging — give the verdict first, then the reasoning.',
    createdAt: iso(12),
    updatedAt: iso(6),
  },
  {
    id: 'demo-mem-language',
    kind: 'preference',
    title: 'Working language',
    content:
      'Mix Chinese and English freely — use whichever feels natural. Technical terms stay in English.',
    createdAt: iso(10),
    updatedAt: iso(10),
  },
  {
    id: 'demo-mem-role',
    kind: 'preference',
    title: 'Role context',
    content:
      'Product designer working on delivery-platform UX. Decisions usually balance driver + customer + compliance trade-offs.',
    createdAt: iso(8),
    updatedAt: iso(8),
  },
  {
    id: 'demo-mem-review-style',
    kind: 'preference',
    title: 'Review style',
    content:
      'When reviewing designs, lead with what is working before what to change. Cite specific screens or components, not abstract principles.',
    createdAt: iso(3),
    updatedAt: iso(3),
  },
];
