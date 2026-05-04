export function formatTimeAgo(d: Date | string | number): string {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (Number.isNaN(t)) return 'just now';
  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return 'just now';
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}
