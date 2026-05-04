import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTimeAgo } from './timeAgo';

const NOW = new Date('2026-05-03T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatTimeAgo', () => {
  it('< 60 seconds → "just now"', () => {
    expect(formatTimeAgo(new Date(NOW - 30_000))).toBe('just now');
  });

  it('5 minutes → "5m ago"', () => {
    expect(formatTimeAgo(new Date(NOW - 5 * 60_000))).toBe('5m ago');
  });

  it('59 minutes → "59m ago"', () => {
    expect(formatTimeAgo(new Date(NOW - 59 * 60_000))).toBe('59m ago');
  });

  it('3 hours → "3h ago"', () => {
    expect(formatTimeAgo(new Date(NOW - 3 * 3_600_000))).toBe('3h ago');
  });

  it('1 day → "1 day ago" (singular)', () => {
    expect(formatTimeAgo(new Date(NOW - 86_400_000))).toBe('1 day ago');
  });

  it('2 days → "2 days ago"', () => {
    expect(formatTimeAgo(new Date(NOW - 2 * 86_400_000))).toBe('2 days ago');
  });

  it('1 week → "1 week ago" (singular)', () => {
    expect(formatTimeAgo(new Date(NOW - 7 * 86_400_000))).toBe('1 week ago');
  });

  it('3 weeks → "3 weeks ago"', () => {
    expect(formatTimeAgo(new Date(NOW - 21 * 86_400_000))).toBe('3 weeks ago');
  });

  it('future timestamp → "just now" (defensive: clock skew)', () => {
    expect(formatTimeAgo(new Date(NOW + 60_000))).toBe('just now');
  });

  it('accepts string ISO', () => {
    expect(formatTimeAgo(new Date(NOW - 5 * 60_000).toISOString())).toBe('5m ago');
  });

  it('accepts numeric epoch', () => {
    expect(formatTimeAgo(NOW - 5 * 60_000)).toBe('5m ago');
  });

  it('invalid input → "just now" (defensive)', () => {
    expect(formatTimeAgo('not-a-date')).toBe('just now');
  });
});
