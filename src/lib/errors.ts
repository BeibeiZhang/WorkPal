import { IS_DEMO } from './demoMode';

/** §58 — frontend helper for the error_log read endpoint. Used by
 *  OverviewPage NYE to pull the top-20 unreviewed errors of the past 7 days,
 *  deduped server-side by msg.
 *
 *  IS_DEMO short-circuits before fetch (defense in depth — errorLogger.ts
 *  also short-circuits writes, but a fresh demo deploy with old data
 *  shouldn't surface anything either).
 *
 *  Password is taken as an explicit param rather than read from React
 *  context here, so OverviewPage owns the auth decision and this module
 *  stays a plain helper. The component reads useAuth().getCachedPassword()
 *  synchronously (AuthGate guarantees the cache is populated by the time
 *  OverviewPage mounts). */

export interface ErrorSummaryItem {
  msg: string;
  count: number;
  first_seen: string;
  last_seen: string;
  stack?: string;
  url?: string;
  source?: string;
  sample_id: string;
}

export async function fetchErrorSummary(password: string | null): Promise<ErrorSummaryItem[]> {
  if (IS_DEMO) return [];
  if (!password) return [];
  try {
    const res = await fetch('/api/error-summary', {
      headers: { 'x-memory-password': password },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: ErrorSummaryItem[] };
    return json.items ?? [];
  } catch {
    return [];
  }
}

/** §59 — mark a NYE error entry reviewed (whole msg-group). Returns true on
 *  HTTP 200 regardless of `marked` count: marked=0 collapses stale sample_id
 *  and multi-tab race ("already marked elsewhere") into the same UX (entry
 *  is gone in DB either way, so optimistic-filter-on-click is correct).
 *  Returns false only on network failure or non-2xx (incl. 401 password
 *  fail) so the caller can revert the optimistic filter. */
export async function markErrorReviewed(sampleId: string, password: string | null): Promise<boolean> {
  if (IS_DEMO) return false;
  if (!password) return false;
  try {
    const res = await fetch('/api/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-memory-password': password },
      body: JSON.stringify({ sample_id: sampleId }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { marked?: number };
    if (json.marked === 0) {
      console.warn('[§59] markErrorReviewed: 0 rows marked (stale sample_id or multi-tab race)', sampleId);
    }
    return true;
  } catch {
    return false;
  }
}
