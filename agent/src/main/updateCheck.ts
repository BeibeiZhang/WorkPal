import { app } from 'electron';
import { log } from './logger.js';
import { setUpdateAvailable, setUpdateUpToDate } from './serverState.js';

/* 7.5: GitHub Releases boot-time update check.
 *
 * Why boot-only (Beibei note): Beibei restarts daily, so a single check at
 * launch surfaces new versions within ~24h. Periodic in-process check (24h
 * setTimeout) is a separate follow-up; this file stays simple.
 *
 * Why GitHub Releases as the CDN: same URL as OnboardingSurface
 * (`/releases/latest`), no separate update-server infra to maintain. Public
 * GitHub API gives 60 req/hr unauthenticated — one boot per day per user is
 * orders of magnitude under that budget.
 *
 * Why we don't auto-download / self-replace: unsigned .app means
 * electron-updater's differential-update path doesn't apply (it requires
 * codesign for atomic replace). Settings card → "Download" → user installs
 * via the same right-click → Open flow as a fresh install. Adds ~zero
 * surface vs full self-replace and is honest about the unsigned reality.
 *
 * Why inline x.y.z compare instead of `semver` package (Beibei note): we
 * only ever publish `v0.1.0` / `v0.1.1` / `v0.2.0` style tags. Three-segment
 * numeric compare is ~10 lines. When we eventually publish `v1.0.0-beta.1`
 * style prerelease tags we'll bring in `semver`; for now this stays a tight
 * dependency-free helper. Prerelease tags fail to parse and are silently
 * skipped, which is the conservative behaviour (don't false-positive on a
 * weird tag we've never seen).
 *
 * Why never throw: update check is non-critical. Network down, API rate
 * limit, GitHub outage — none of these should affect boot or surface a
 * scary error to the user. We log and leave updateState at 'unknown'.
 */

/** Owner/repo segment of the GitHub URL. The hardcoded match in
 *  src/components/OnboardingSurface.tsx (Phase 7.4) uses the same path —
 *  changing one without the other will break the OnboardingSurface CTA. */
const GITHUB_OWNER_REPO = 'BeibeiZhang/WorkPal';

export const RELEASES_LATEST_URL = `https://github.com/${GITHUB_OWNER_REPO}/releases/latest`;
const API_LATEST_URL = `https://api.github.com/repos/${GITHUB_OWNER_REPO}/releases/latest`;

const FETCH_TIMEOUT_MS = 5000;

interface ReleaseInfo {
  /** GitHub-style tag, e.g. "v0.1.1". */
  tagName: string;
  /** URL the Settings card "Download" button opens. We use the rolling
   *  /releases/latest URL (not the specific-tag html_url) so a delay between
   *  the boot check and the user click still lands on whatever's newest. */
  downloadUrl: string;
}

/** Parses a semver-shaped string into a [major, minor, patch] tuple of finite
 *  non-negative integers. Strips a leading "v". Returns null on:
 *   - missing input
 *   - any non-numeric segment (e.g. "v1.0.0-beta.1" → segment "0-beta" fails)
 *   - fewer or more than 3 segments
 *  Prerelease / build-metadata tags fail this filter on purpose — see the
 *  module-level note about scope.
 */
export function parseSemver(input: string | null | undefined): [number, number, number] | null {
  if (!input) return null;
  const stripped = input.startsWith('v') ? input.slice(1) : input;
  const parts = stripped.split('.');
  if (parts.length !== 3) return null;
  const nums: number[] = [];
  for (const p of parts) {
    // /^\d+$/ rejects negative, decimal, prerelease-suffix, and empty —
    // Number.isInteger(parseInt(...)) would let "1-beta" through as 1.
    if (!/^\d+$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (!Number.isInteger(n) || n < 0) return null;
    nums.push(n);
  }
  return [nums[0], nums[1], nums[2]];
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b. Both inputs must be
 *  parseSemver-shaped. */
export function compareSemver(a: [number, number, number], b: [number, number, number]): -1 | 0 | 1 {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** Fetch the latest release JSON from GitHub. Returns null on any failure
 *  (network error, timeout, non-2xx, malformed JSON). All failures are
 *  logged but don't propagate. */
async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(API_LATEST_URL, {
      method: 'GET',
      headers: {
        // GitHub API requires a User-Agent; agent version helps trace
        // origin in their logs if we ever need to debug rate-limiting.
        'User-Agent': `WorkPal-Agent/${app.getVersion()}`,
        Accept: 'application/vnd.github+json',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      // 404 is the normal case before the first Release exists; downgrade
      // to info so an empty Releases page doesn't fill the log with errors.
      const level = res.status === 404 ? 'info' : 'warn';
      await log(level, `update: GitHub API returned ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { tag_name?: unknown };
    if (typeof json.tag_name !== 'string' || !json.tag_name) {
      await log('warn', 'update: GitHub API response missing tag_name');
      return null;
    }
    return {
      tagName: json.tag_name,
      downloadUrl: RELEASES_LATEST_URL,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('info', `update: check failed (network/timeout) — ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Boot-time entry. Always resolves (never throws). Updates serverState's
 *  updateState axis based on the comparison; on any failure leaves it at
 *  the default 'unknown' so Settings simply hides the card. */
export async function bootstrapUpdateCheck(): Promise<void> {
  const currentRaw = app.getVersion();
  const currentParsed = parseSemver(currentRaw);
  if (!currentParsed) {
    await log('warn', `update: skip — current version ${currentRaw} is not x.y.z`);
    return;
  }

  const release = await fetchLatestRelease();
  if (!release) return;

  const latestParsed = parseSemver(release.tagName);
  if (!latestParsed) {
    await log('info', `update: skip — latest tag ${release.tagName} is not x.y.z (prerelease or unexpected format)`);
    return;
  }

  const cmp = compareSemver(latestParsed, currentParsed);
  if (cmp <= 0) {
    setUpdateUpToDate();
    await log('info', `update: up-to-date (current=${currentRaw} latest=${release.tagName})`);
    return;
  }

  setUpdateAvailable(release.tagName, release.downloadUrl);
  await log('info', `update: newer version available (current=${currentRaw} latest=${release.tagName})`);
}
