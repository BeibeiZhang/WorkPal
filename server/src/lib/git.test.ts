import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_BRANCH_RE } from './git.js';

/** Run with: `cd server && npx tsx --test src/lib/git.test.ts`. No new deps —
 *  tsx is already in devDependencies, node:test is built in on Node 18+.
 *  Covers the branch-name contract spelled out in Phase 6 doc "Context from
 *  6.1" — anything that slips past this regex would flow unsanitized into
 *  `git worktree add -b <...>`. */
describe('SESSION_BRANCH_RE', () => {
  describe('accepts', () => {
    const cases: readonly string[] = [
      // Realistic 5.5-era slugs produced by buildSessionFolder.
      'session/2026-04-19-foo',
      'session/2026-04-19-set-up-a-ux-review',
      // CJK: slugify preserves \p{L}\p{N}, so the branch name carries them
      // through verbatim. This is the case that forced D2's supersede.
      'session/2026-04-19-生成一个关于云的俳句',
      'session/2026-04-19-你好-world',
      // Minimal / single char.
      'session/a',
      'session/foo_bar',
      'session/foo-bar',
      // Dots are allowed inside the body (not trailing, not consecutive) —
      // slugify doesn't produce them, but we don't proactively reject them.
      'session/a.b.c',
    ];
    for (const name of cases) {
      it(name, () => assert.ok(SESSION_BRANCH_RE.test(name), `expected accept: ${name}`));
    }
  });

  describe('rejects', () => {
    const cases: readonly [string, string][] = [
      // Namespace contract.
      ['main', 'missing session/ prefix'],
      ['feature/foo', 'wrong namespace'],
      ['session/', 'empty slug'],
      ['session/foo/bar', 'nested slash breaks single-segment contract'],
      ['session/foo\\bar', 'backslash'],
      // check-ref-format guards.
      ['session/..', '.. alone'],
      ['session/foo..bar', '.. substring'],
      ['session/foo.lock', '.lock suffix (ref-lock protocol)'],
      ['session/foo.', 'trailing dot'],
      ['session/.hidden', 'leading dot'],
      ['session/-flag', 'leading dash (CLI flag confusion)'],
      // Whitespace / control / NUL.
      ['session/with space', 'space'],
      ['session/with\ttab', 'tab'],
      ['session/with\nnewline', 'newline'],
      ['session/with\0null', 'NUL byte'],
      ['session/with\x01ctrl', 'ASCII control char'],
      ['session/with\x7fdel', 'DEL'],
      // Git's reserved ref chars.
      ['session/foo:bar', 'colon'],
      ['session/foo~bar', 'tilde'],
      ['session/foo^bar', 'caret'],
      ['session/foo?bar', 'question mark'],
      ['session/foo*bar', 'asterisk'],
      ['session/foo[bar', 'open bracket'],
      ['session/foo]bar', 'close bracket'],
      // Traversal-shaped inputs should never reach the regex (route blocks
      // them upstream via resolveSessionFolder), but belt-and-braces.
      ['../session/x', 'leading traversal'],
      ['', 'empty string'],
    ];
    for (const [name, why] of cases) {
      const printable = name.replace(/[\x00-\x1f\x7f]/g, c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
      it(`${printable} (${why})`, () =>
        assert.equal(SESSION_BRANCH_RE.test(name), false, `expected reject: ${printable}`));
    }
  });
});
