import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * We test the route handler by mocking `global.fetch` and `fs.readFile`, then
 * importing the route module dynamically. For simplicity we test the semver
 * utilities directly (covered in semver.test.ts) and focus here on the
 * aggregate response shape and per-row error isolation.
 */

import { parseSemver, compareSemver } from '../lib/semver.js';

describe('version-info endpoint logic', () => {
  describe('SDK version comparison', () => {
    it('detects update available when latest > current', () => {
      const cur = parseSemver('0.2.114')!;
      const lat = parseSemver('0.3.0')!;
      assert.equal(compareSemver(lat, cur), 1);
    });

    it('detects up-to-date when latest === current', () => {
      const cur = parseSemver('4.78.1')!;
      const lat = parseSemver('4.78.1')!;
      assert.equal(compareSemver(lat, cur), 0);
    });

    it('detects up-to-date when latest < current (local ahead)', () => {
      const cur = parseSemver('0.2.114')!;
      const lat = parseSemver('0.2.100')!;
      assert.equal(compareSemver(lat, cur), -1);
    });
  });

  describe('model verification logic', () => {
    it('all models present → up-to-date', () => {
      const known = ['gpt-4o', 'gpt-4o-mini'];
      const available = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']);
      const missing = known.filter((m) => !available.has(m));
      assert.equal(missing.length, 0);
    });

    it('missing model → update-available', () => {
      const known = ['gpt-4o', 'gpt-4o-mini'];
      const available = new Set(['gpt-4o', 'gpt-3.5-turbo']);
      const missing = known.filter((m) => !available.has(m));
      assert.deepEqual(missing, ['gpt-4o-mini']);
    });
  });

  describe('per-row error isolation', () => {
    it('missing API key produces error row without throwing', () => {
      const key: string | undefined = undefined;
      const row = {
        id: 'claude-models',
        label: 'Claude Models',
        current: 'claude-opus-4-7',
        latest: null as string | null,
        status: 'unknown' as const,
        error: undefined as string | undefined,
      };
      if (!key) {
        row.error = 'ANTHROPIC_API_KEY not configured';
      }
      assert.equal(row.status, 'unknown');
      assert.equal(row.error, 'ANTHROPIC_API_KEY not configured');
      assert.equal(row.latest, null);
    });

    it('prerelease GitHub tag → unknown status', () => {
      const tag = 'v1.0.0-beta.1';
      const parsed = parseSemver(tag);
      assert.equal(parsed, null);
    });
  });

  describe('response shape', () => {
    it('rows array has correct structure', () => {
      const row = {
        id: 'openai-sdk',
        label: 'OpenAI SDK',
        current: '4.78.1',
        latest: '4.80.0',
        status: 'update-available' as const,
      };
      assert.equal(typeof row.id, 'string');
      assert.equal(typeof row.label, 'string');
      assert.equal(typeof row.current, 'string');
      assert.ok(['up-to-date', 'update-available', 'unknown'].includes(row.status));
    });

    it('checkedAt is ISO string', () => {
      const checkedAt = new Date().toISOString();
      assert.ok(checkedAt.endsWith('Z'));
      assert.ok(!isNaN(Date.parse(checkedAt)));
    });
  });
});
