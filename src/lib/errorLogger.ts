import { IS_DEMO } from './demoMode';
import { detectSource } from './usage';

/** §58 — window-level capture of uncaught errors and unhandled rejections,
 *  POSTed to /api/log-error. Mounted once from src/main.tsx before
 *  createRoot() so the listeners attach earlier than any React code.
 *
 *  Boundaries (PII): never reads cookies, localStorage, form values, or
 *  URL query params. Only msg + truncated stack + pathname#hash + UA +
 *  source go on the wire. Stack truncation guards against runaway closures
 *  capturing large user data structures in their frames.
 *
 *  Demo URL (my-workpal.vercel.app, IS_DEMO=true) short-circuits — production
 *  user error logging is for Beibei's prod surface only, not the demo
 *  audience. The fetch helper itself is fail-quiet: a logger that throws
 *  during error reporting would re-trigger unhandledrejection and loop. */

interface ErrorPayload {
  msg: string;
  stack?: string;
  url: string;
  ua: string;
  source: string;
}

const STACK_LIMIT = 8000;

function send(payload: ErrorPayload): void {
  try {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Network failure — swallow. Re-throwing or surfacing an error here
      // would re-enter the unhandledrejection listener and loop.
    });
  } catch {
    // JSON.stringify throw (cyclic, BigInt) — also swallow for the same reason.
  }
}

/** Strip query string from the URL before logging — query params can carry
 *  tokens, search terms, or other user-typed content we don't want stored
 *  alongside stacks. Pathname + hash are kept (they identify the route
 *  without leaking values). */
function safeUrl(): string {
  try {
    return location.pathname + location.hash;
  } catch {
    return '';
  }
}

export function setupErrorLogger(): void {
  if (IS_DEMO) return;
  if (typeof window === 'undefined') return;

  const source = detectSource();

  window.addEventListener('error', (e: ErrorEvent) => {
    // §63 — Same-Origin Policy masks cross-origin script errors as
    // `message === 'Script error.'` with `error === null`. Most often from
    // browser extension content scripts (Grammarly / 1Password / translation
    // tools) running in isolated worlds — unfixable from app code, no stack
    // means nothing actionable. Skip to keep NYE signal high. The double
    // condition avoids over-filtering: a real `new Error('Script error.')`
    // thrown by app code carries a non-null `error` and still logs.
    if (e.message === 'Script error.' && !e.error) return;

    send({
      msg: e.message ?? 'Unknown error',
      stack: e.error?.stack?.slice(0, STACK_LIMIT),
      url: safeUrl(),
      ua: navigator.userAgent,
      source,
    });
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason = e.reason as { message?: unknown; stack?: unknown } | undefined;
    const msg = typeof reason?.message === 'string'
      ? reason.message
      : String(reason ?? 'Unhandled rejection');
    const stack = typeof reason?.stack === 'string'
      ? reason.stack.slice(0, STACK_LIMIT)
      : undefined;
    send({
      msg,
      stack,
      url: safeUrl(),
      ua: navigator.userAgent,
      source,
    });
  });
}
