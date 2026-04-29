import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listAddedTopLevelFiles,
  mergeDiffOutputs,
  NOT_FF_RE,
  parseDiffNameStatus,
  parseDiffNumstat,
  parseNewFilesPorcelain,
  SESSION_BRANCH_RE,
  type SessionDiffEntry,
} from './git.js';

const execFileP = promisify(execFile);

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

/* ── 6.3 diff parsers ─────────────────────────────────────────────────────
 * Run with: `cd server && npx tsx --test src/lib/git.test.ts`.
 * These cover the parsers `diffSessionVsBase` depends on — the git subprocess
 * side is exercised by the 9-case acceptance flow in
 * docs/phase-6-requirements.md (principle #12 risk-routed). */

describe('parseDiffNumstat', () => {
  it('normal record', () => {
    assert.deepEqual(parseDiffNumstat('5\t2\tsrc/foo.ts\0'), [
      { path: 'src/foo.ts', insertions: 5, deletions: 2 },
    ]);
  });

  it('multiple records', () => {
    const out = parseDiffNumstat(
      '5\t2\tsrc/foo.ts\0' +
        '1\t0\tsrc/bar.ts\0' +
        '0\t3\tsrc/baz.ts\0',
    );
    assert.equal(out.length, 3);
    assert.deepEqual(out[2], { path: 'src/baz.ts', insertions: 0, deletions: 3 });
  });

  it('binary files get -1 sentinels', () => {
    assert.deepEqual(parseDiffNumstat('-\t-\timages/logo.png\0'), [
      { path: 'images/logo.png', insertions: -1, deletions: -1 },
    ]);
  });

  it('empty input → empty array', () => {
    assert.deepEqual(parseDiffNumstat(''), []);
  });

  it('CJK path passes through untouched', () => {
    assert.deepEqual(parseDiffNumstat('3\t1\t你好/文件.md\0'), [
      { path: '你好/文件.md', insertions: 3, deletions: 1 },
    ]);
  });

  it('spaces in path', () => {
    assert.deepEqual(parseDiffNumstat('1\t0\tmy notes/a b.txt\0'), [
      { path: 'my notes/a b.txt', insertions: 1, deletions: 0 },
    ]);
  });

  it('malformed record dropped without throwing', () => {
    const out = parseDiffNumstat('5\t2\ta.txt\0garbage\0');
    assert.equal(out.length, 1);
    assert.equal(out[0].path, 'a.txt');
  });

  it('non-numeric counts dropped', () => {
    assert.deepEqual(parseDiffNumstat('x\ty\tbad.txt\0'), []);
  });
});

describe('parseDiffNameStatus', () => {
  it('A / M / D basic', () => {
    assert.deepEqual(
      parseDiffNameStatus('M\0a.txt\0A\0b.txt\0D\0c.txt\0'),
      [
        { path: 'a.txt', status: 'M' },
        { path: 'b.txt', status: 'A' },
        { path: 'c.txt', status: 'D' },
      ],
    );
  });

  it('empty input → empty array', () => {
    assert.deepEqual(parseDiffNameStatus(''), []);
  });

  it('CJK path passes through untouched', () => {
    assert.deepEqual(parseDiffNameStatus('A\0你好/文件.md\0'), [
      { path: '你好/文件.md', status: 'A' },
    ]);
  });

  it('T (type change) surfaces as M', () => {
    // --no-renames blocks R/C, but T can still appear for file↔symlink.
    // Fallback bucket is 'M' — closest user-intuitive meaning.
    assert.deepEqual(parseDiffNameStatus('T\0link.sh\0'), [
      { path: 'link.sh', status: 'M' },
    ]);
  });

  it('trailing NUL(s) ignored', () => {
    assert.deepEqual(parseDiffNameStatus('A\0a.txt\0\0'), [
      { path: 'a.txt', status: 'A' },
    ]);
  });

  it('truncated stream (status with no path) dropped', () => {
    assert.deepEqual(parseDiffNameStatus('A\0a.txt\0M\0'), [
      { path: 'a.txt', status: 'A' },
    ]);
  });
});

describe('mergeDiffOutputs', () => {
  it('correlates by path', () => {
    const merged = mergeDiffOutputs(
      [
        { path: 'a.txt', status: 'A' },
        { path: 'b.txt', status: 'D' },
      ],
      [
        { path: 'a.txt', insertions: 3, deletions: 0 },
        { path: 'b.txt', insertions: 0, deletions: 5 },
      ],
    );
    assert.deepEqual<SessionDiffEntry[]>(merged, [
      { path: 'a.txt', status: 'A', insertions: 3, deletions: 0 },
      { path: 'b.txt', status: 'D', insertions: 0, deletions: 5 },
    ]);
  });

  it('status missing falls back to M', () => {
    assert.deepEqual(
      mergeDiffOutputs([], [{ path: 'a.txt', insertions: 1, deletions: 0 }]),
      [{ path: 'a.txt', status: 'M', insertions: 1, deletions: 0 }],
    );
  });

  it('stat-less status still surfaces with 0/0', () => {
    assert.deepEqual(
      mergeDiffOutputs([{ path: 'untouched.txt', status: 'D' }], []),
      [{ path: 'untouched.txt', status: 'D', insertions: 0, deletions: 0 }],
    );
  });

  it('both empty → empty', () => {
    assert.deepEqual(mergeDiffOutputs([], []), []);
  });
});

describe('NOT_FF_RE', () => {
  it('matches "Not possible to fast-forward, aborting."', () => {
    assert.ok(
      NOT_FF_RE.test('fatal: Not possible to fast-forward, aborting.\n'),
    );
  });

  it('matches "Not a fast-forward"', () => {
    assert.ok(NOT_FF_RE.test('fatal: Not a fast-forward\n'));
  });

  it('matches "non-fast-forward"', () => {
    assert.ok(
      NOT_FF_RE.test(
        '! [rejected]        main -> main (non-fast-forward)',
      ),
    );
  });

  it('matches "refusing to merge unrelated histories"', () => {
    assert.ok(
      NOT_FF_RE.test('fatal: refusing to merge unrelated histories\n'),
    );
  });

  it('case-insensitive', () => {
    assert.ok(NOT_FF_RE.test('FATAL: NON-FAST-FORWARD'));
  });

  it('rejects unrelated errors', () => {
    assert.equal(NOT_FF_RE.test('fatal: not a git repository\n'), false);
    assert.equal(NOT_FF_RE.test("error: pathspec 'foo' did not match\n"), false);
    assert.equal(NOT_FF_RE.test('fatal: index file corrupt\n'), false);
  });
});

/** §30: parseNewFilesPorcelain feeds the ref-folder merge fallback. The
 *  parser drives every safety decision downstream — wrong status filtering
 *  would let `M`-only or deleted files through (overwriting user content
 *  in the ref folder), and missing rename-skip would mis-pair status codes
 *  with paths. Cover both axes plus the empty + malformed edge cases. */
describe('parseNewFilesPorcelain', () => {
  it('returns [] for empty input', () => {
    assert.deepEqual(parseNewFilesPorcelain(''), []);
  });

  it('extracts untracked files (??)', () => {
    const input = '?? foo.md\0?? bar.txt\0';
    assert.deepEqual(parseNewFilesPorcelain(input), ['foo.md', 'bar.txt']);
  });

  it('extracts staged-add files (A )', () => {
    const input = 'A  resume.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), ['resume.md']);
  });

  it('treats AM (added then modified) as new', () => {
    const input = 'AM draft.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), ['draft.md']);
  });

  it('skips modified-only files (kept by user, not new)', () => {
    const input = ' M existing.md\0M  changed.md\0MM mixed.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), []);
  });

  it('skips deleted files', () => {
    const input = ' D gone.md\0D  also-gone.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), []);
  });

  it('skips renames (R) and consumes the old-path entry', () => {
    // Rename emits two entries: status+new path, then old path alone.
    // Without the skip we'd mis-parse the old-path entry as another file.
    const input = 'R  new.md\0old.md\0?? foo.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), ['foo.md']);
  });

  it('skips copies (C) similarly', () => {
    const input = 'C  copy.md\0source.md\0?? real-new.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), ['real-new.md']);
  });

  it('preserves paths with spaces and unicode (no quoting in -z)', () => {
    const input = '?? my resume.md\0?? 简历.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), ['my resume.md', '简历.md']);
  });

  it('returns subdirectory paths verbatim (caller filters top-level)', () => {
    // The parser itself is path-shape agnostic; subdir filtering happens in
    // listNewFilesAtTop. This test pins the contract so a future refactor
    // doesn't accidentally couple the two.
    const input = '?? outputs/foo.md\0?? src/bar.ts\0?? top.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), [
      'outputs/foo.md',
      'src/bar.ts',
      'top.md',
    ]);
  });

  it('tolerates malformed entries (too short)', () => {
    const input = '??\0?? ok.md\0';
    assert.deepEqual(parseNewFilesPorcelain(input), ['ok.md']);
  });
});

/** §41 — listAddedTopLevelFiles is the diff-based companion to
 *  listNewFilesAtTop. Phase 5.5 auto-commits writes to the session branch
 *  before /merge runs, so `git status` returns empty by then; this function
 *  diffs base...session to surface those committed additions. Test mirrors
 *  the real production state: a session branch with one top-level commit
 *  and one subdir commit; only top-level should come through. */
describe('listAddedTopLevelFiles', () => {
  let repo: string;
  let baseBranch: string;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'workpal-listadded-'));
    await execFileP('git', ['init', '-q'], { cwd: repo });
    await execFileP('git', ['config', 'user.email', 'test@workpal'], { cwd: repo });
    await execFileP('git', ['config', 'user.name', 'Test'], { cwd: repo });
    await execFileP('git', ['commit', '--allow-empty', '-q', '-m', 'baseline'], {
      cwd: repo,
    });
    // Read whatever the default branch is (main on git ≥ 2.28, master on
    // older). Same lookup the production code uses, so the test stays
    // valid across user `init.defaultBranch` configs.
    const { stdout } = await execFileP(
      'git',
      ['-C', repo, 'symbolic-ref', '--short', 'HEAD'],
    );
    baseBranch = stdout.trim();
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('returns top-level added files committed on session branch', async () => {
    // Switch to session branch, write + commit a top-level deliverable AND a
    // subdir entry, then return to base. Mirrors §41 production state where
    // Phase 5.5 has already committed everything by /merge time.
    await execFileP('git', ['-C', repo, 'checkout', '-q', '-b', 'session/foo']);
    await writeFile(join(repo, 'hello.md'), '# top-level deliverable');
    await mkdir(join(repo, 'subdir'));
    await writeFile(join(repo, 'subdir', 'nested.md'), '# nested — must not surface');
    await execFileP('git', ['-C', repo, 'add', '.']);
    await execFileP('git', ['-C', repo, 'commit', '-q', '-m', 'session work']);
    await execFileP('git', ['-C', repo, 'checkout', '-q', baseBranch]);

    const result = await listAddedTopLevelFiles(repo, 'session/foo');

    assert.deepEqual(result, ['hello.md']);
  });

  it('returns empty array when session branch added no top-level files', async () => {
    // Subdir-only commit (e.g. agent wrote into outputs/) should yield [].
    // Pins the contract so the route handler can safely pass [] into the
    // ref-folder copy and trust the tri-state semantics in sessionCopy.ts.
    await execFileP('git', ['-C', repo, 'checkout', '-q', '-b', 'session/subdir-only']);
    await mkdir(join(repo, 'outputs'));
    await writeFile(join(repo, 'outputs', 'a.md'), '# in outputs');
    await execFileP('git', ['-C', repo, 'add', '.']);
    await execFileP('git', ['-C', repo, 'commit', '-q', '-m', 'subdir only']);
    await execFileP('git', ['-C', repo, 'checkout', '-q', baseBranch]);

    const result = await listAddedTopLevelFiles(repo, 'session/subdir-only');

    assert.deepEqual(result, []);
  });
});
