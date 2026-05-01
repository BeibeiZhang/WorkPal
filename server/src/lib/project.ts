import { execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import { basename, join, resolve as pathResolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { WORKPAL_ROOT } from './paths.js';
import { isDeliverable } from './sessionCopy.js';

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

/** §31: walk `<projectPath>/sessions/` recursively, returning a map from
 *  filename basename → list of absolute paths that match. Used by the
 *  legacy-output backfill to recover `path` for OutputItem entries created
 *  before §23 (which started persisting `path` on commit). Skips `.git/`,
 *  `node_modules/`, and any other dotfile-prefixed directory — they're not
 *  user-facing artifacts and would balloon the walk on real projects.
 *
 *  Bounded by `maxEntries` (default 5000) so a runaway sessions/ subtree
 *  can't pin the event loop. Caller treats a partial result as best-effort:
 *  the backfill is non-essential, and any unmatched legacy entries just
 *  stay in their pre-§23 toggle-only fallback. */
export async function indexProjectOutputs(
  projectPath: string,
  maxEntries = 5000,
): Promise<Map<string, string[]>> {
  const sessionsDir = join(projectPath, 'sessions');
  const index = new Map<string, string[]>();
  let entries: Dirent[];
  try {
    entries = await readdir(sessionsDir, { recursive: true, withFileTypes: true });
  } catch {
    // sessions/ doesn't exist yet — fresh project, no work to do.
    return index;
  }
  let count = 0;
  for (const entry of entries) {
    if (count >= maxEntries) break;
    if (!entry.isFile()) continue;
    // node:fs Dirent.parentPath is the directory the entry lives in (Node 20+);
    // older @types/node lacks the field, so we read it through `unknown` and
    // fall back to sessionsDir on any older / non-string shape.
    const rawParent = (entry as unknown as { parentPath?: unknown }).parentPath;
    const parent = typeof rawParent === 'string' ? rawParent : sessionsDir;
    if (parent.includes(`${sep}.git${sep}`) || parent.endsWith(`${sep}.git`)) continue;
    if (parent.includes(`${sep}node_modules${sep}`) || parent.endsWith(`${sep}node_modules`)) continue;
    const name = typeof entry.name === 'string' ? entry.name : String(entry.name);
    const full = join(parent, name);
    const key = basename(full);
    const existing = index.get(key);
    if (existing) existing.push(full);
    else index.set(key, [full]);
    count++;
  }
  return index;
}

/** §44: list user-facing deliverable filenames on the project's main branch.
 *  Runs `git ls-tree` against project HEAD (the base branch). Filters to
 *  top-level deliverables only via the shared `isDeliverable` filter.
 *  Throws on git failure — caller catches and silently skips injection. */
export async function listProjectMainDeliverables(
  projectPath: string,
): Promise<string[]> {
  const { stdout } = await execFileP(
    'git',
    ['-C', projectPath, 'ls-tree', '-r', '--name-only', 'HEAD'],
  );
  return stdout
    .split('\n')
    .filter((line) => line.length > 0)
    .filter((path) => !path.includes('/'))
    .filter((name) => isDeliverable(name));
}
