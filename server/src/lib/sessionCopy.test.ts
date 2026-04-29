import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { copySessionOutputsToRefFolder } from './sessionCopy.js';

const execFileP = promisify(execFile);

/** §30 — integration tests for the ref-folder copy fallback. Each test
 *  spins up a real git worktree in a tmp dir, simulates an AI session's
 *  file output (outputs/ subdir or cwd top-level), runs the copy, and
 *  asserts the CopyResult discriminator + the actual contents of the
 *  ref folder. Covers the 5 verification cases from PR §30:
 *    1. AI writes outputs/foo.md     → strict-copy path
 *    2. AI writes foo.md at cwd top  → fallback path (the §30 fix)
 *    3. AI writes nothing new        → 'no_new_deliverables' warning
 *    4. Path traversal               → jail rejects (defensive)
 *    5. package.json at cwd top      → scaffolding blocklist rejects */
describe('copySessionOutputsToRefFolder — §30 fallback', () => {
  let session: string;
  let ref: string;

  beforeEach(async () => {
    session = await mkdtemp(join(tmpdir(), 'workpal-session-'));
    ref = await mkdtemp(join(tmpdir(), 'workpal-ref-'));
    await execFileP('git', ['init', '-q'], { cwd: session });
    await execFileP('git', ['config', 'user.email', 'test@workpal'], { cwd: session });
    await execFileP('git', ['config', 'user.name', 'Test'], { cwd: session });
    await execFileP('git', ['commit', '--allow-empty', '-q', '-m', 'baseline'], {
      cwd: session,
    });
  });

  afterEach(async () => {
    await rm(session, { recursive: true, force: true });
    await rm(ref, { recursive: true, force: true });
  });

  it('case 1: AI writes outputs/foo.md → strict copy', async () => {
    await mkdir(join(session, 'outputs'));
    await writeFile(join(session, 'outputs', 'foo.md'), '# foo');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    assert.equal('usedFallback' in result && result.usedFallback, false);
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles.sort(), ['foo.md']);
  });

  it('case 2: AI writes foo.md at cwd top → fallback copies it', async () => {
    await writeFile(join(session, 'foo.md'), '# from top');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    assert.equal('usedFallback' in result && result.usedFallback, true);
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles.sort(), ['foo.md']);
  });

  it('case 2b: fallback handles staged-add files (after git add)', async () => {
    await writeFile(join(session, 'staged.md'), '# staged');
    await execFileP('git', ['add', 'staged.md'], { cwd: session });

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    assert.equal('usedFallback' in result && result.usedFallback, true);
  });

  it('case 2c: fallback handles unicode + spaces in filenames', async () => {
    await writeFile(join(session, '我的简历.md'), '# 简历');
    await writeFile(join(session, 'my resume.md'), '# resume');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 2);
    const refFiles = (await readdir(ref)).sort();
    assert.deepEqual(refFiles, ['my resume.md', '我的简历.md']);
  });

  it('case 2d: empty outputs/ also triggers fallback', async () => {
    // outputs/ exists but contains no files — fallback should still run.
    await mkdir(join(session, 'outputs'));
    await writeFile(join(session, 'top.md'), '# top');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    assert.equal('usedFallback' in result && result.usedFallback, true);
  });

  it('case 3: nothing new → no_new_deliverables', async () => {
    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 0);
    assert.equal('warning' in result && result.warning, 'no_new_deliverables');
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles, []);
  });

  it('case 4: path-jail rejects subdirectory entries (top-level filter)', async () => {
    // Subdir files are filtered by listNewFilesAtTop already (only top-level).
    // This test pins that contract: even if the agent wrote into a sibling
    // subdir, fallback won't sweep it. Combined with case 1 strict-copy of
    // outputs/, this is the only legitimate way to land files in ref folder.
    await mkdir(join(session, 'sneaky'));
    await writeFile(join(session, 'sneaky', 'evil.md'), '# nope');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 0);
    assert.equal('warning' in result && result.warning, 'no_new_deliverables');
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles, []);
  });

  it('case 5: scaffolding (package.json, tsconfig.*.json) is blocked', async () => {
    await writeFile(join(session, 'package.json'), '{}');
    await writeFile(join(session, 'package-lock.json'), '{}');
    await writeFile(join(session, 'tsconfig.json'), '{}');
    await writeFile(join(session, 'tsconfig.app.json'), '{}');
    await writeFile(join(session, 'real-deliverable.md'), '# yes');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    assert.equal('usedFallback' in result && result.usedFallback, true);
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles, ['real-deliverable.md']);
  });

  it('case 6: extension filter excludes non-deliverables (.ts, .js, etc.)', async () => {
    await writeFile(join(session, 'foo.ts'), 'export {};');
    await writeFile(join(session, 'bar.js'), '');
    await writeFile(join(session, '.gitignore'), 'node_modules');
    await writeFile(join(session, 'README.md'), '# README is fine');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles, ['README.md']);
  });

  it('case 7: collisions in ref folder are skipped silently (no overwrite)', async () => {
    await writeFile(join(ref, 'existing.md'), '# original');
    await writeFile(join(session, 'existing.md'), '# new (would overwrite)');
    await writeFile(join(session, 'fresh.md'), '# fresh');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    // existing.md skipped (EEXIST), fresh.md copied.
    assert.equal(result.copiedCount, 1);
    const refFiles = (await readdir(ref)).sort();
    assert.deepEqual(refFiles, ['existing.md', 'fresh.md']);
  });

  it('case 8: outputs/ with files takes precedence over fallback', async () => {
    // Both outputs/ and cwd top-level have new files. Per spec, fallback
    // only runs when outputs/ is empty/missing. Strict copy wins.
    await mkdir(join(session, 'outputs'));
    await writeFile(join(session, 'outputs', 'official.md'), '# in outputs');
    await writeFile(join(session, 'stray.md'), '# at top');

    const result = await copySessionOutputsToRefFolder(session, ref);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    assert.equal('usedFallback' in result && result.usedFallback, false);
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles, ['official.md']);
  });

  /** §41 — `addedFiles` 3rd arg lets the route handler pre-capture
   *  base...session diff before FF merge collapses it. Two cases pin the
   *  tri-state semantics: provided (used as-is) vs `[]` (treated as truly
   *  empty — does NOT fall through to git status). */

  it('case 9: addedFiles param bypasses git status, copies committed files', async () => {
    // Mirror real production state: file is COMMITTED on the session
    // branch (Phase 5.5 auto-commit), so `git status --porcelain` returns
    // empty. Without the §41 fix the fallback would silently miss it.
    await writeFile(join(session, 'hello.md'), '# committed deliverable');
    await execFileP('git', ['add', 'hello.md'], { cwd: session });
    await execFileP('git', ['commit', '-q', '-m', 'session work'], { cwd: session });

    // Sanity: confirm git status really is empty now (the bug condition).
    const { stdout: statusOut } = await execFileP(
      'git',
      ['status', '--porcelain=v1', '-z'],
      { cwd: session },
    );
    assert.equal(statusOut, '', 'precondition: git status should be empty post-commit');

    const result = await copySessionOutputsToRefFolder(session, ref, ['hello.md']);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 1);
    assert.equal('usedFallback' in result && result.usedFallback, true);
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles, ['hello.md']);
  });

  it('case 10: addedFiles=[] yields no_new_deliverables even when cwd has untracked .md', async () => {
    // Setup an untracked file that would have been picked up by the legacy
    // `listNewFilesAtTop` path. Pass [] explicitly: route captured nothing.
    // The fallback MUST treat [] as truly empty — falling through to git
    // status here would defeat the §41 capture and let stale untracked
    // files leak into the ref folder when the route already decided
    // there's nothing to copy.
    await writeFile(join(session, 'stray.md'), '# untracked, would tempt fallback');

    const result = await copySessionOutputsToRefFolder(session, ref, []);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.copiedCount, 0);
    assert.equal('warning' in result && result.warning, 'no_new_deliverables');
    const refFiles = await readdir(ref);
    assert.deepEqual(refFiles, []);
  });
});
