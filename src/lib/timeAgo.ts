/** Human-friendly "N ago" label for an ISO 8601 timestamp.
 *
 *  Returns short forms ("5m ago", "2h ago", "3d ago") instead of the verbose
 *  "5 minutes ago" — kept compact because the surfaces using this (chat
 *  meta, NYE error entries) are dense. Empty / invalid input returns ''
 *  rather than throwing so callers can pass optional fields without guards.
 *
 *  Originally inline in ChatMessage.tsx; extracted for §58 NYE error
 *  timestamps so both surfaces share one impl.
 */
export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'y'],
    [60 * 60 * 24 * 30, 'mo'],
    [60 * 60 * 24 * 7, 'w'],
    [60 * 60 * 24, 'd'],
    [60 * 60, 'h'],
    [60, 'm'],
  ];
  for (const [size, label] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n}${label} ago`;
  }
  return 'just now';
}
