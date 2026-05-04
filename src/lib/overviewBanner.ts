export type OverviewBannerInput = {
  nyeHidden: boolean;
  aawHidden: boolean;
  schedHidden: boolean;
};

export function getOverviewBannerCopy(i: OverviewBannerInput): string | null {
  const { nyeHidden, aawHidden, schedHidden } = i;
  const key = `${nyeHidden ? 1 : 0}${aawHidden ? 1 : 0}${schedHidden ? 1 : 0}`;
  switch (key) {
    case '000': return null;
    case '100': return '✓ Inbox zero — all reviews caught up';
    case '010': return "✓ AI's resting — nothing running";
    case '001': return '✓ Open runway — no automations queued';
    case '110': return "✓ All caught up — your AI's taking a break";
    case '101': return '✓ Inbox zero · nothing scheduled';
    case '011': return '✓ All quiet · agents idle, nothing scheduled';
    case '111': return '🎉 Nothing pending, nothing running, nothing scheduled. Nice work — take a break.';
    default: return null;
  }
}
