// §28 Phase 1 vitest unit. Pins `getAgentRouteIntent` against the 12 cases
// originally verified ad-hoc in `/tmp/verify-pr150.ts` during the §21 planning
// review, plus by-construction coverage of every branch in
// `src/lib/intentRouter.ts`:
//   - IS_DEMO short-circuit                    (e1, e2)
//   - §21 refDirs + reachable → use-claude     (a1, a2, a3, f3)
//   - keyword miss → fallback-cloud            (b, c, f2)
//   - keyword match + reachable → use-claude   (r1)
//   - keyword match + unreachable + mobile     (f1)
//   - keyword match + unreachable + Mac        (r2)
//
// Mocking strategy: `IS_DEMO` is a module-level const (live binding) so a
// getter pattern lets each test flip its value before calling the function.
// `isAgentCurrentlyReachable` is a function so we route it through the same
// mutable `mocks` object — vi.hoisted ensures the closure runs before the
// module-under-test imports either module.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  IS_DEMO: false,
  agentReachable: true,
}));

vi.mock('./demoMode', () => ({
  get IS_DEMO() {
    return mocks.IS_DEMO;
  },
}));

vi.mock('./agent', () => ({
  isAgentCurrentlyReachable: () => mocks.agentReachable,
}));

import { getAgentRouteIntent } from './intentRouter';

beforeEach(() => {
  mocks.IS_DEMO = false;
  mocks.agentReachable = true;
});

describe('getAgentRouteIntent — §21 ref folder defaults to Claude', () => {
  it('a1: refDirs + reachable + 自然语言 "加点东西到简历" → use-claude', () => {
    expect(
      getAgentRouteIntent('加点东西到简历', false, ['/Users/me/resume']),
    ).toBe('use-claude');
  });

  it('a2: refDirs + reachable + 自然语言 "记录这个" → use-claude', () => {
    expect(
      getAgentRouteIntent('记录这个', false, ['/Users/me/notes']),
    ).toBe('use-claude');
  });

  it('a3: refDirs + reachable + 自然语言 "补一下文档" → use-claude', () => {
    expect(
      getAgentRouteIntent('补一下文档', false, ['/Users/me/docs']),
    ).toBe('use-claude');
  });
});

describe('getAgentRouteIntent — empty refDirs falls through to keyword match', () => {
  it('b: no refDirs + 自然语言 → §21 not fired → keyword miss → fallback-cloud', () => {
    expect(
      getAgentRouteIntent('加点东西到简历', false, []),
    ).toBe('fallback-cloud');
  });

  it('c: standalone chat (refDirs=[] because no project) → fallback-cloud', () => {
    expect(
      getAgentRouteIntent('加点东西到简历', false, []),
    ).toBe('fallback-cloud');
  });
});

describe('getAgentRouteIntent — IS_DEMO short-circuits everything', () => {
  it('e1: demo URL + refDirs + 自然语言 → IS_DEMO first-line short-circuit → fallback-cloud', () => {
    mocks.IS_DEMO = true;
    expect(
      getAgentRouteIntent('加点东西到简历', false, ['/Users/me/resume']),
    ).toBe('fallback-cloud');
  });

  it('e2: demo URL + keyword prompt → IS_DEMO still short-circuits (regression check)', () => {
    mocks.IS_DEMO = true;
    expect(
      getAgentRouteIntent('改简历', false, []),
    ).toBe('fallback-cloud');
  });
});

describe('getAgentRouteIntent — mobile-aware fallback (§15)', () => {
  it('f1: mobile + refDirs + unreachable + keyword → §21 false (unreachable) → keyword path → mac-only-on-mobile', () => {
    mocks.agentReachable = false;
    expect(
      getAgentRouteIntent('改简历', true, ['/Users/me/resume']),
    ).toBe('mac-only-on-mobile');
  });

  it('f2: mobile + refDirs + unreachable + 自然语言 → §21 false → keyword miss → fallback-cloud', () => {
    mocks.agentReachable = false;
    expect(
      getAgentRouteIntent('加点东西到简历', true, ['/Users/me/resume']),
    ).toBe('fallback-cloud');
  });

  it('f3: Mac + refDirs + reachable + keyword → §21 fires (refDirs>0 && reachable) → use-claude', () => {
    expect(
      getAgentRouteIntent('改简历', false, ['/Users/me/resume']),
    ).toBe('use-claude');
  });
});

describe('getAgentRouteIntent — pre-§21 keyword-only behavior (regression)', () => {
  it('r1: no refDirs + keyword + reachable → keyword path → use-claude (§15 unbroken)', () => {
    expect(
      getAgentRouteIntent('改一下 src/App.tsx', false, []),
    ).toBe('use-claude');
  });

  it('r2: no refDirs + keyword + unreachable + Mac → fallback-cloud (silent degrade)', () => {
    mocks.agentReachable = false;
    expect(
      getAgentRouteIntent('改一下 src/App.tsx', false, []),
    ).toBe('fallback-cloud');
  });
});
