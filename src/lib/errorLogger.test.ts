// §58 Phase 1 vitest unit. Pins setupErrorLogger() against the two paths
// that matter most for production behavior: IS_DEMO short-circuit (must not
// attach listeners or POST) and event-driven payload shape.
//
// Mocking strategy mirrors src/lib/intentRouter.test.ts — IS_DEMO is a
// module-level const, so vi.hoisted + a getter on the mock lets each test
// flip its value before importing the module-under-test.
//
// We don't pull in jsdom (would expand devDeps for one test file). Instead
// the tests stub window.addEventListener so we can capture the handlers
// setupErrorLogger registers, then invoke them directly with synthetic
// event payloads. This isolates the behavior we care about (stack
// truncation, source tagging, fail-quiet on fetch error) from DOM details.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  IS_DEMO: false,
  source: 'workpal-beibei' as 'workpal-beibei' | 'localhost' | 'my-workpal' | 'unknown',
}));

vi.mock('./demoMode', () => ({
  get IS_DEMO() {
    return mocks.IS_DEMO;
  },
}));

vi.mock('./usage', () => ({
  detectSource: () => mocks.source,
}));

import { setupErrorLogger } from './errorLogger';

type Handler = (e: unknown) => void;

let fetchMock: ReturnType<typeof vi.fn>;
let handlers: Map<string, Handler>;

beforeEach(() => {
  mocks.IS_DEMO = false;
  mocks.source = 'workpal-beibei';
  handlers = new Map();
  fetchMock = vi.fn().mockResolvedValue({ ok: true });

  // Minimal window stub — capture every addEventListener call so the test
  // can fire the registered handler directly. Other window APIs we touch
  // (navigator.userAgent, location.pathname/hash) need stubs too.
  vi.stubGlobal('window', {
    addEventListener: (type: string, handler: Handler) => {
      handlers.set(type, handler);
    },
  });
  vi.stubGlobal('navigator', { userAgent: 'test-agent/1.0' });
  vi.stubGlobal('location', { pathname: '/overview', hash: '#focus' });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('setupErrorLogger — IS_DEMO short-circuits', () => {
  it('IS_DEMO=true → no listeners registered, no fetch on synthetic event', () => {
    mocks.IS_DEMO = true;
    setupErrorLogger();
    expect(handlers.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('setupErrorLogger — window.error path', () => {
  it('error event → POST with msg + truncated stack + source + safe url', () => {
    setupErrorLogger();
    const stack = 'a'.repeat(10000);
    const err = new Error('boom');
    err.stack = stack;
    handlers.get('error')!({ message: 'boom', error: err });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/log-error');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.msg).toBe('boom');
    expect(body.stack.length).toBe(8000);
    expect(body.source).toBe('workpal-beibei');
    expect(body.url).toBe('/overview#focus');
    expect(body.ua).toBe('test-agent/1.0');
  });

  it('error event with no underlying Error → POST without stack field', () => {
    setupErrorLogger();
    handlers.get('error')!({ message: 'no-error-obj', error: undefined });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.msg).toBe('no-error-obj');
    expect(body.stack).toBeUndefined();
  });
});

describe('setupErrorLogger — window.unhandledrejection path', () => {
  it('rejected Error → POST with message + stack', () => {
    setupErrorLogger();
    const reason = new Error('promise-fail');
    reason.stack = 'StackLine\nStackLine2';
    handlers.get('unhandledrejection')!({ reason });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.msg).toBe('promise-fail');
    expect(body.stack).toContain('StackLine');
  });

  it('rejected non-Error string → POST with String(reason) fallback', () => {
    setupErrorLogger();
    handlers.get('unhandledrejection')!({ reason: 'plain-string-reject' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.msg).toBe('plain-string-reject');
    expect(body.stack).toBeUndefined();
  });

  it('rejected undefined → POST with "Unhandled rejection" fallback (not "undefined")', () => {
    setupErrorLogger();
    handlers.get('unhandledrejection')!({ reason: undefined });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.msg).toBe('Unhandled rejection');
  });
});

describe('setupErrorLogger — fail-quiet', () => {
  it('fetch rejection does not propagate out of the handler', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network-down'));
    setupErrorLogger();
    expect(() => {
      handlers.get('error')!({ message: 'boom', error: new Error('boom') });
    }).not.toThrow();
    await Promise.resolve();
  });
});
