// §59 vitest unit. Covers markErrorReviewed across the four return paths
// the OverviewPage handler depends on:
//   IS_DEMO short-circuit, missing password, fetch ok (incl. marked=0
//   "race already won" path), fetch !ok / network throw → false so the
//   optimistic filter reverts.
//
// Mock pattern mirrors src/lib/errorLogger.test.ts — vi.hoisted + getter
// on the demoMode mock so each test can flip IS_DEMO before importing
// the module-under-test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  IS_DEMO: false,
}));

vi.mock('./demoMode', () => ({
  get IS_DEMO() {
    return mocks.IS_DEMO;
  },
}));

import { markErrorReviewed } from './errors';

let fetchMock: ReturnType<typeof vi.fn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.IS_DEMO = false;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('markErrorReviewed — short-circuits', () => {
  it('IS_DEMO=true → returns false without fetching', async () => {
    mocks.IS_DEMO = true;
    expect(await markErrorReviewed('id1', 'pw')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('password=null → returns false without fetching', async () => {
    expect(await markErrorReviewed('id1', null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('markErrorReviewed — wire shape', () => {
  it('PATCHes /api/errors with sample_id body + password header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, marked: 3 }),
    });
    const result = await markErrorReviewed('sample-uuid', 'secret');
    expect(result).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/errors');
    expect(init.method).toBe('PATCH');
    expect(init.headers['x-memory-password']).toBe('secret');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ sample_id: 'sample-uuid' });
  });

  it('200 with marked=0 → still returns true (entry gone in DB) + warns', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, marked: 0 }),
    });
    expect(await markErrorReviewed('id1', 'pw')).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('0 rows marked'),
      'id1',
    );
  });
});

describe('markErrorReviewed — failure paths', () => {
  it('401 (password fail) → returns false', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    expect(await markErrorReviewed('id1', 'wrong-pw')).toBe(false);
  });

  it('500 → returns false', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    expect(await markErrorReviewed('id1', 'pw')).toBe(false);
  });

  it('network throw → returns false (no propagation)', async () => {
    fetchMock.mockRejectedValue(new Error('network-down'));
    expect(await markErrorReviewed('id1', 'pw')).toBe(false);
  });
});
