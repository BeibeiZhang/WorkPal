import { describe, expect, it } from 'vitest';
import { getOverviewBannerCopy } from './overviewBanner';

describe('getOverviewBannerCopy — §54 8-case lookup', () => {
  it('all visible (0 hidden) → null', () => {
    expect(getOverviewBannerCopy({ nyeHidden: false, aawHidden: false, schedHidden: false })).toBeNull();
  });

  it('NYE only hidden', () => {
    expect(getOverviewBannerCopy({ nyeHidden: true, aawHidden: false, schedHidden: false }))
      .toBe('✓ Inbox zero — all reviews caught up');
  });

  it('AAW only hidden', () => {
    expect(getOverviewBannerCopy({ nyeHidden: false, aawHidden: true, schedHidden: false }))
      .toBe("✓ AI's resting — nothing running");
  });

  it('Scheduled only hidden', () => {
    expect(getOverviewBannerCopy({ nyeHidden: false, aawHidden: false, schedHidden: true }))
      .toBe('✓ Open runway — no automations queued');
  });

  it('NYE + AAW hidden', () => {
    expect(getOverviewBannerCopy({ nyeHidden: true, aawHidden: true, schedHidden: false }))
      .toBe("✓ All caught up — your AI's taking a break");
  });

  it('NYE + Scheduled hidden', () => {
    expect(getOverviewBannerCopy({ nyeHidden: true, aawHidden: false, schedHidden: true }))
      .toBe('✓ Inbox zero · nothing scheduled');
  });

  it('AAW + Scheduled hidden', () => {
    expect(getOverviewBannerCopy({ nyeHidden: false, aawHidden: true, schedHidden: true }))
      .toBe('✓ All quiet · agents idle, nothing scheduled');
  });

  it('all 3 hidden → full clear copy with celebration emoji', () => {
    expect(getOverviewBannerCopy({ nyeHidden: true, aawHidden: true, schedHidden: true }))
      .toBe('🎉 Nothing pending, nothing running, nothing scheduled. Nice work — take a break.');
  });
});
