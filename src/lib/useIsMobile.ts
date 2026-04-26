// Candidate #15 — shared mobile-viewport detection.
//
// Lifted out of App.tsx so non-React modules (intentRouter, fetchAgent
// wrapper) can ask the same question without prop-drilling. matchMedia /
// useSyncExternalStore over userAgent sniffing keeps the source of truth
// at "what the layout actually looks like right now" — the same signal
// already used to flip MiniSidebar, swap nav-rail behavior, etc.

import { useSyncExternalStore } from 'react';

export const MOBILE_BREAKPOINT = 484;

const subscribe = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
};
const getIsMobile = () => window.innerWidth < MOBILE_BREAKPOINT;

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getIsMobile);
}

/** Sync getter for non-React call sites (intentRouter's plain function,
 *  fetchAgent wrapper). SSR-safe: returns false when there's no window. */
export function isMobileNow(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
}
