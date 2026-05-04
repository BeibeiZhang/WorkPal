import { describe, it, expect } from 'vitest';
import { scaleToMonth } from './health';

describe('scaleToMonth', () => {
  // §55 lock: Health Check section uses a fixed 30d window so this identity
  // must hold — passing 30 through scaleToMonth returns the input unchanged.
  // Guards against silent regression if someone changes the function
  // signature or math (e.g., flipping "/days * 30" to "/days * 28").
  it('returns value unchanged when rangeDays === 30', () => {
    expect(scaleToMonth(0, 30)).toBe(0);
    expect(scaleToMonth(326, 30)).toBe(326);
    expect(scaleToMonth(1398, 30)).toBe(1398);
  });

  it('projects to monthly for sub-30d windows', () => {
    expect(scaleToMonth(70, 7)).toBe(300);
    expect(scaleToMonth(10, 1)).toBe(300);
  });

  it('returns 0 for invalid rangeDays', () => {
    expect(scaleToMonth(100, 0)).toBe(0);
    expect(scaleToMonth(100, -1)).toBe(0);
  });
});
