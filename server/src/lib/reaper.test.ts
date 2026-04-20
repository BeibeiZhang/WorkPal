import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorktreePorcelain } from './reaper.js';

/** Run with: `cd server && npx tsx --test src/lib/reaper.test.ts`. No new
 *  deps — tsx is already in devDependencies, node:test is built in.
 *
 *  Covers the porcelain parser. The reaper's destructive git calls are
 *  covered by the 7 manual acceptance tests in docs/phase-6-requirements.md
 *  §6.5 (principle #12 — high-risk file operations route through live
 *  testing, not unit tests).  */
describe('parseWorktreePorcelain', () => {
  it('parses main + two session worktrees', () => {
    const input = [
      'worktree /Users/b/WorkPal/proj',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'worktree /Users/b/WorkPal/proj/sessions/s1',
      'HEAD def456',
      'branch refs/heads/session/s1',
      '',
      'worktree /Users/b/WorkPal/proj/sessions/s2',
      'HEAD ghi789',
      'branch refs/heads/session/s2',
      '',
    ].join('\n');
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 3);
    assert.deepEqual(entries[0], {
      path: '/Users/b/WorkPal/proj',
      branch: 'main',
      prunable: false,
    });
    assert.deepEqual(entries[1], {
      path: '/Users/b/WorkPal/proj/sessions/s1',
      branch: 'session/s1',
      prunable: false,
    });
    assert.equal(entries[2].branch, 'session/s2');
  });

  it('flags prunable on shape-B records', () => {
    const input = [
      'worktree /repo',
      'HEAD abc',
      'branch refs/heads/main',
      '',
      'worktree /repo/sessions/gone',
      'HEAD def',
      'branch refs/heads/session/gone',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n');
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].prunable, false);
    assert.equal(entries[1].prunable, true);
    // Branch is still reported even on prunable entries — the reap loop
    // ignores the branch, but the parser stays faithful to git's output.
    assert.equal(entries[1].branch, 'session/gone');
  });

  it('tolerates a bare `prunable` line with no reason', () => {
    // Defensive — git always emits a reason today, but don't assume.
    const input = 'worktree /repo/sessions/gone\nprunable\n';
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].prunable, true);
  });

  it('reports detached worktrees with branch=null', () => {
    const input = [
      'worktree /repo',
      'HEAD abc',
      'branch refs/heads/main',
      '',
      'worktree /repo/det',
      'HEAD def',
      'detached',
      '',
    ].join('\n');
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].branch, 'main');
    assert.equal(entries[1].branch, null);
  });

  it('reports bare worktrees with branch=null', () => {
    const input = [
      'worktree /repo',
      'bare',
      '',
      'worktree /repo/sessions/s1',
      'HEAD abc',
      'branch refs/heads/session/s1',
      '',
    ].join('\n');
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].branch, null);
    assert.equal(entries[1].branch, 'session/s1');
  });

  it('tolerates CRLF line endings', () => {
    const input =
      'worktree /repo\r\nHEAD abc\r\nbranch refs/heads/main\r\n\r\n' +
      'worktree /repo/s1\r\nHEAD def\r\nbranch refs/heads/session/s1\r\n';
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].path, '/repo');
    assert.equal(entries[1].branch, 'session/s1');
  });

  it('returns empty array for empty / whitespace-only input', () => {
    assert.deepEqual(parseWorktreePorcelain(''), []);
    assert.deepEqual(parseWorktreePorcelain('\n\n\n'), []);
    assert.deepEqual(parseWorktreePorcelain('   \n  \n'), []);
  });

  it('skips records missing a worktree line', () => {
    // Shouldn't happen in practice (every porcelain record opens with
    // `worktree <path>`) but the parser must not emit ghost entries if it
    // ever does — path stays null → record is dropped.
    const input =
      'HEAD abc\nbranch refs/heads/main\n\n' +
      'worktree /repo\nHEAD def\nbranch refs/heads/main\n';
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].path, '/repo');
  });

  it('ignores unknown keys (future git fields)', () => {
    // Future-proofing: if git adds a new key we haven't seen, parser keeps
    // the record with known fields populated and shrugs off the rest.
    const input = [
      'worktree /repo/sessions/s1',
      'HEAD abc',
      'branch refs/heads/session/s1',
      'locked for reason',
      'future-field some value',
      '',
    ].join('\n');
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].path, '/repo/sessions/s1');
    assert.equal(entries[0].branch, 'session/s1');
    assert.equal(entries[0].prunable, false);
  });

  it('preserves branch names that contain slashes after the namespace', () => {
    // SESSION_BRANCH_RE rejects `session/foo/bar` (two-slash) at the worktree
    // add boundary, so this wouldn't normally show up — but if a user
    // hand-crafted a worktree with a multi-level branch, the parser must
    // still report it faithfully so the namespace guard can reject it.
    const input =
      'worktree /repo/odd\nHEAD abc\nbranch refs/heads/feature/foo/bar\n';
    const entries = parseWorktreePorcelain(input);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].branch, 'feature/foo/bar');
  });
});
