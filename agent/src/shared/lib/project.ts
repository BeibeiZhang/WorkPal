import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join, resolve as pathResolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { WORKPAL_ROOT } from './paths.js';

const execFileP = promisify(execFile);

/** True if `cwd/.git` exists. Mirror of the same check in `git.ts` — lets
 *  `initProjectIfNeeded` stay idempotent across repeated POSTs without a
 *  second `git rev-parse` subprocess per call. */
async function hasGitDir(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, '.git'));
    return true;
  } catch {
    return false;
  }
}

/** Expand a user-supplied project slug to an absolute path inside
 *  WORKPAL_ROOT. Stricter than `resolveSessionFolder`: a project slug is a
 *  single filesystem segment, so separators, `..`, NUL, and leading `.` are
 *  all rejected outright instead of relying purely on the post-resolve
 *  containment check. Error messages are bilingual per principle #8 since
 *  they flow back to the user through a 400 response. */
export function resolveProjectFolder(
  projectSlug: unknown,
): { ok: true; resolved: string } | { ok: false; reason: string } {
  if (typeof projectSlug !== 'string' || projectSlug.length === 0) {
    return { ok: false, reason: 'projectSlug is required / projectSlug 必填' };
  }
  // Strip an optional trailing slash so `'foo/'` and `'foo'` land on the same
  // resolved path. Everything else still has to be a clean segment.
  const trimmed = projectSlug.replace(/\/+$/, '');
  if (trimmed.length === 0) {
    return { ok: false, reason: 'projectSlug is required / projectSlug 必填' };
  }
  // Project slug is a single path segment — no nested paths, no absolute paths,
  // no traversal, no NUL injection, no leading `.` (which would produce a
  // hidden folder or point at `..`). These checks are stricter than what
  // `pathResolve` containment alone catches (e.g. `foo/../bar` resolves inside
  // the root but bypasses the "single segment" contract future 6.X endpoints
  // will rely on).
  if (
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0') ||
    trimmed.startsWith('.')
  ) {
    return {
      ok: false,
      reason:
        'projectSlug must be a single path segment / projectSlug 必须是单一路径段',
    };
  }
  const resolved = pathResolve(WORKPAL_ROOT, trimmed);
  if (resolved !== WORKPAL_ROOT && !resolved.startsWith(WORKPAL_ROOT + sep)) {
    return {
      ok: false,
      reason:
        'projectSlug must not escape ~/WorkPal/ / projectSlug 不能越出 ~/WorkPal/',
    };
  }
  if (resolved === WORKPAL_ROOT) {
    return {
      ok: false,
      reason:
        'projectSlug must not resolve to ~/WorkPal/ itself / projectSlug 不能就是 ~/WorkPal/',
    };
  }
  return { ok: true, resolved };
}

/** Initialize a git repo at `projectPath` if one doesn't already exist, set
 *  a repo-local identity, and drop an empty baseline commit. Mirrors
 *  `initIfNeeded` in `git.ts` but targets the **project** layer (not the
 *  session layer) and uses its own baseline subject so `git log --oneline`
 *  distinguishes the two origins visually. Idempotent — the `.git` probe up
 *  front lets 6.X endpoints call this defensively on every request without
 *  paying subprocess overhead past the first init. Caller must ensure
 *  `projectPath` already exists on disk (the route `mkdir`s it). */
export async function initProjectIfNeeded(projectPath: string): Promise<void> {
  if (await hasGitDir(projectPath)) return;
  await execFileP('git', ['init', '-q'], { cwd: projectPath });
  // --local is explicit per Phase 6 spec: `git config` inside a repo already
  // defaults to writing the local file, but spelling it out documents intent
  // and keeps a future global-config-poisoned environment from silently
  // leaking user identity into WorkPal baseline commits (principle #7).
  await execFileP(
    'git',
    ['config', '--local', 'user.email', 'workpal@local'],
    { cwd: projectPath },
  );
  await execFileP(
    'git',
    ['config', '--local', 'user.name', 'WorkPal'],
    { cwd: projectPath },
  );
  // --allow-empty matters: the baseline commit has no files, but 6.2's
  // `git worktree add` needs a valid HEAD to branch off, and later `git log`
  // / undo logic needs a parent to reset to. Without this, the first real
  // commit would be a root commit with no parent.
  await execFileP(
    'git',
    ['commit', '--allow-empty', '-q', '-m', 'WorkPal project baseline'],
    { cwd: projectPath },
  );
}
