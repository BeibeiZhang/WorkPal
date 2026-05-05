// §60 vitest unit. Covers the server-side detectSourceFromRequest helper
// across the four Source enum values + the origin/referer fallback ladder.
//
// Tests the api/ copy directly. The server/src/lib/usageLog.ts mirror is
// kept byte-equivalent by sync-agent-shared.sh + check-agent-shared-sync.sh,
// so testing one is sufficient — drift would surface in the check script,
// not in this test.

import { describe, expect, it } from 'vitest';

import { detectSourceFromRequest } from '../../api/_lib/usage-store';

describe('detectSourceFromRequest', () => {
  it('returns workpal-beibei when origin is the prod URL', () => {
    expect(
      detectSourceFromRequest({ headers: { origin: 'https://workpal-beibei.vercel.app' } }),
    ).toBe('workpal-beibei');
  });

  it('returns workpal-beibei for vercel preview URLs that prefix workpal-beibei', () => {
    expect(
      detectSourceFromRequest({
        headers: { origin: 'https://workpal-beibei-git-feat-x-beibei.vercel.app' },
      }),
    ).toBe('workpal-beibei');
  });

  it('returns my-workpal when origin is the demo URL', () => {
    expect(
      detectSourceFromRequest({ headers: { origin: 'https://my-workpal.vercel.app' } }),
    ).toBe('my-workpal');
  });

  it('returns localhost for localhost origin', () => {
    expect(
      detectSourceFromRequest({ headers: { origin: 'http://localhost:2006' } }),
    ).toBe('localhost');
  });

  it('returns localhost for 127.0.0.1 origin', () => {
    expect(
      detectSourceFromRequest({ headers: { origin: 'http://127.0.0.1:2006' } }),
    ).toBe('localhost');
  });

  it('falls back to referer when origin is missing', () => {
    expect(
      detectSourceFromRequest({
        headers: { origin: undefined, referer: 'https://workpal-beibei.vercel.app/chat' },
      }),
    ).toBe('workpal-beibei');
  });

  it('returns unknown when both origin and referer are missing', () => {
    expect(detectSourceFromRequest({ headers: {} })).toBe('unknown');
  });

  it('returns unknown for an origin that matches no known host', () => {
    expect(
      detectSourceFromRequest({ headers: { origin: 'https://random-attacker.example.com' } }),
    ).toBe('unknown');
  });

  it('prefers origin over referer when both are present', () => {
    // Defense-in-depth: a malicious referer header shouldn't override a real
    // origin. Origin is set by the browser; referer is more easily spoofed
    // by curl / fetch. Origin first.
    expect(
      detectSourceFromRequest({
        headers: {
          origin: 'http://localhost:2006',
          referer: 'https://workpal-beibei.vercel.app',
        },
      }),
    ).toBe('localhost');
  });
});
