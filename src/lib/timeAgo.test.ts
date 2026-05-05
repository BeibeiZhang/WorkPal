// §58 Phase 1 vitest unit. Pins timeAgo()'s contract — the formatter is
// shared between ChatMessage video meta and OverviewPage NYE error
// timestamps, so a regression here would bleed into both surfaces.
//
// Strategy: freeze Date.now() with vi.useFakeTimers + vi.setSystemTime so
// the unit boundaries are deterministic regardless of when the test runs.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeAgo } from './timeAgo';

const NOW = new Date('2026-05-04T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function isoSecondsAgo(secs: number): string {
  return new Date(NOW - secs * 1000).toISOString();
}

describe('timeAgo — falsy / invalid input', () => {
  it('empty string → ""', () => {
    expect(timeAgo('')).toBe('');
  });
  it('undefined → ""', () => {
    expect(timeAgo(undefined)).toBe('');
  });
  it('garbage ISO → ""', () => {
    expect(timeAgo('not-a-date')).toBe('');
  });
});

describe('timeAgo — sub-minute falls through to "just now"', () => {
  it('5s ago → "just now"', () => {
    expect(timeAgo(isoSecondsAgo(5))).toBe('just now');
  });
  it('59s ago → "just now"', () => {
    expect(timeAgo(isoSecondsAgo(59))).toBe('just now');
  });
});

describe('timeAgo — unit boundaries', () => {
  it('60s → "1m ago"', () => {
    expect(timeAgo(isoSecondsAgo(60))).toBe('1m ago');
  });
  it('5min → "5m ago"', () => {
    expect(timeAgo(isoSecondsAgo(5 * 60))).toBe('5m ago');
  });
  it('1h → "1h ago"', () => {
    expect(timeAgo(isoSecondsAgo(60 * 60))).toBe('1h ago');
  });
  it('2h → "2h ago"', () => {
    expect(timeAgo(isoSecondsAgo(2 * 60 * 60))).toBe('2h ago');
  });
  it('3d → "3d ago"', () => {
    expect(timeAgo(isoSecondsAgo(3 * 24 * 60 * 60))).toBe('3d ago');
  });
  it('2w → "2w ago"', () => {
    expect(timeAgo(isoSecondsAgo(2 * 7 * 24 * 60 * 60))).toBe('2w ago');
  });
  it('6mo → "6mo ago"', () => {
    expect(timeAgo(isoSecondsAgo(6 * 30 * 24 * 60 * 60))).toBe('6mo ago');
  });
  it('2y → "2y ago"', () => {
    expect(timeAgo(isoSecondsAgo(2 * 365 * 24 * 60 * 60))).toBe('2y ago');
  });
});
