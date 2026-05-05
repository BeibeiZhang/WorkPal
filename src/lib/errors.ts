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
