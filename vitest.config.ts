// §28 Phase 1 — vitest config. Frontend-only scope: server/ uses node:test
// (server/src/**/*.test.ts) and would otherwise be picked up by vitest's
// default `**/*.test.ts` glob and fail loudly. Constraining `include` to
// src/ keeps the two test infras cleanly separated.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
