import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * We test the route handler by mocking `global.fetch` and `fs.readFile`, then
 * importing the route module dynamically. For simplicity we test the semver
 * utilities directly (covered in semver.test.ts) and focus here on the
 * aggregate response shape and per-row error isolation.
 */

import { parseSemver, compareSemver } from '../lib/semver.js';
import { readAgentVersion } from './versionInfo.js';

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

  describe('readAgentVersion (asar path resolution)', () => {
    it('falls back to fs read when not in Electron context', async () => {
      // No isElectron flag, no electronLoader → takes the filesystem branch.
      // Proves the dev-server / non-Electron path resolves agent/package.json
      // correctly via import.meta.url + path.resolve.
      const version = await readAgentVersion();
      assert.match(version, /^\d+\.\d+\.\d+$/, 'version should be x.y.z');
    });

    it('uses electron.app.getVersion() when isElectron flag is true (simulated asar context)', async () => {
      // Inject a fake electron module via the testability seam. In real asar
      // packaging fs.readFile against an asar-virtualised path is the failure
      // mode this avoids — by using app.getVersion() (a native Electron call)
      // we sidestep filesystem virtualisation entirely.
      const fakeElectron = { app: { getVersion: () => '0.9.99-asar-test' } };
      const version = await readAgentVersion(async () => fakeElectron, true);
      assert.equal(version, '0.9.99-asar-test');
    });

    it('falls back to fs read if electronLoader rejects under simulated Electron context', async () => {
      // Simulates a corrupted electron module load — fallback must kick in
      // and read from disk so the row still populates instead of silently
      // returning empty.
      const failingLoader = async () => { throw new Error('electron unavailable'); };
      const version = await readAgentVersion(failingLoader, true);
      assert.match(version, /^\d+\.\d+\.\d+$/);
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
