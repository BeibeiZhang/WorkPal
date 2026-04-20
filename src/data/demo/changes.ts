/**
 * Static Changes-panel entries shown on the demo's `alcohol-delivery` chat.
 * Gives HRs a concrete look at the auto-commit / undo UX without needing a
 * live Claude Code backend (Vercel serverless can't host the SDK anyway —
 * see src/lib/demoMode.ts IS_CLAUDE_CODE_AVAILABLE).
 *
 * No commit hashes — these entries aren't backed by real git state, so the
 * panel falls back to its Phase 5 "every non-halt row shows Undo" behavior
 * (see TaskContextPanel.tsx Changes block). The Undo buttons flip the row
 * cosmetically; no real revert happens.
 */

import type { ChangeEntry } from '../../types';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

export const DEMO_CHANGES_ALCOHOL: ChangeEntry[] = [
  {
    id: 'demo-change-1',
    kind: 'create',
    label: 'Create summary.md',
    timestamp: minutesAgo(18),
  },
  {
    id: 'demo-change-2',
    kind: 'edit',
    label: 'Edit summary.md',
    timestamp: minutesAgo(14),
  },
  {
    id: 'demo-change-3',
    kind: 'create',
    label: 'Create recommendations.md',
    timestamp: minutesAgo(9),
  },
  {
    id: 'demo-change-4',
    kind: 'edit',
    label: 'Edit summary.md',
    timestamp: minutesAgo(4),
  },
];
