import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

/* ─── 6.5: Orphan worktree reaper ──────────────────────────────────────────
 *
 * DESTRUCTIVE CODE. This module runs `git worktree remove --force` and
 * `git branch -D` against the user's on-disk project repos. Before editing,
 * re-read docs/phase-6-requirements.md §6.5 — in particular the three orphan
 * shapes (A/B/C) and the `session/` branch namespace contract. Phase 5
 * legacy sessions (per-session `.git/` directory) MUST NEVER be touched;
 * this module relies on `git worktree list --porcelain` structurally
 * excluding them (they aren't registered as worktrees), not on any
 * fs.stat-based detection.
 * ────────────────────────────────────────────────────────────────────────── */

/** One row in `git worktree list --porcelain` output. See `parseWorktreePorcelain`
 *  for the source format. */
export interface WorktreeEntry {
  /** Absolute path as git reports it. Git strips trailing slashes — consumers
   *  that compare against frontend-sourced paths must normalize both sides. */
  path: string;
  /** Short branch name with the `refs/heads/` prefix removed. `null` for
   *  detached / bare worktrees (we refuse to touch those). */
  branch: string | null;
  /** True when git tagged this entry `prunable` — shape-B dangling metadata:
   *  the on-disk folder is gone but the worktree record is still in the
   *  project's `.git/worktrees/` registry. */
  prunable: boolean;
}

export interface ReapError {
  path: string;
  branch: string | null;
  /** Which git step failed. `remove-worktree` also used as the catch-all
   *  bucket for `worktree list` / `worktree prune` failures at the project
   *  level, distinguished by `path` matching the projectPath itself. */
  stage: 'remove-worktree' | 'delete-branch';
  message: string;
}

export interface ReapResult {
  /** Worktrees we successfully removed (branch delete may still have failed,
   *  which shows up as a `delete-branch` entry in `errors`). */
  reapedCount: number;
  /** Shape-B entries cleaned by `git worktree prune`. Counted from the
   *  pre-prune porcelain output so the number reflects what was on disk
   *  at the start of the sweep, not whatever prune returned. */
  prunedCount: number;
  errors: ReapError[];
}

/** Parse `git worktree list --porcelain` output. Each record is a group of
 *  key/value lines separated from the next by one or more blank lines.
 *  Fields of interest:
 *    worktree <abs-path>      — always first, always present
 *    HEAD <sha>               — present unless `bare`
 *    branch refs/heads/<name> — only when on a branch
 *    detached                 — instead of `branch` when detached
 *    bare                     — on bare repos (no HEAD / branch)
 *    prunable [<reason>]      — present when the worktree's folder is gone
 *    locked [<reason>]        — optional; ignored
 *
 *  Exported for test coverage. Tolerates CRLF and blank leading/trailing
 *  lines. Ignores unknown keys so a future git version adding fields doesn't
 *  break the parser — if the parser starts dropping records it's because we
 *  changed the schema, not because git did. */
export function parseWorktreePorcelain(stdout: string): WorktreeEntry[] {
  const normalized = stdout.replace(/\r\n/g, '\n');
  const records = normalized.split(/\n\n+/);
  const out: WorktreeEntry[] = [];
  for (const rec of records) {
    const trimmed = rec.trim();
    if (!trimmed) continue;
    let path: string | null = null;
    let branch: string | null = null;
    let prunable = false;
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length);
      } else if (line.startsWith('branch refs/heads/')) {
        branch = line.slice('branch refs/heads/'.length);
      } else if (line === 'prunable' || line.startsWith('prunable ')) {
        prunable = true;
      }
      // `detached` / `bare` / `HEAD ...` / `locked ...` → ignored. Missing
      // `branch` means downstream code won't touch the entry (defensive).
    }
    if (!path) continue;
    out.push({ path, branch, prunable });
  }
  return out;
}

/** Strip trailing slashes so Set membership compares cleanly. Frontend paths
 *  may carry a trailing `/` (cosmetic, matches the UI chip); porcelain output
 *  never does. Both sides normalize through this helper so a live session
 *  can't be misclassified as orphan due to a stray separator. */
function normalizePath(p: string): string {
  return p.replace(/\/+$/, '');
}

/** Reap orphaned session worktrees under `projectPath`. Execution order:
 *    1. List worktrees via porcelain.
 *    2. Count `prunable` entries for the summary.
 *    3. For each non-prunable `session/<slug>` worktree whose normalized
 *       path isn't in `activeSessionFolders`:
 *         a. `git worktree remove --force <path>` — on failure, record and
 *            SKIP step (b). The worktree is still checked out against the
 *            branch; deleting the branch now would orphan the checkout.
 *         b. `git branch -D <branch>` — on failure, record and continue.
 *            `reapedCount` still increments — the worktree is gone, the
 *            stray branch is a pointer the user can clean manually.
 *    4. `git worktree prune` to clean shape-B metadata.
 *
 *  Filters that structurally skip non-session worktrees:
 *    • `entry.branch === null` → detached or bare; never touch.
 *    • `!entry.branch.startsWith('session/')` → main repo, or a user-created
 *      worktree in a different namespace; never touch.
 *    • `entry.prunable` → shape-B; handled by step 4's prune, not step 3's
 *      remove (which would fail with "not a working tree" and noise errors).
 *
 *  Phase 5 legacy sessions are structurally excluded: they are separate
 *  repos with their own `.git/` directory, never registered in this
 *  project's worktree metadata, so they don't appear in porcelain output.
 *  That exclusion is load-bearing — do not add any fs.stat-based fallback
 *  (per the 6.5 doc) or legacy sessions could be hit.
 *
 *  Does not throw: even a catastrophic failure of step 1 lands in `errors`
 *  so the route can always respond 200 with a summary. */
export async function reapProjectOrphans(
  projectPath: string,
  activeSessionFolders: ReadonlySet<string>,
): Promise<ReapResult> {
  const errors: ReapError[] = [];
  let reapedCount = 0;
  let prunedCount = 0;

  let entries: WorktreeEntry[];
  try {
    const { stdout } = await execFileP('git', [
      '-C',
      projectPath,
      'worktree',
      'list',
      '--porcelain',
    ]);
    entries = parseWorktreePorcelain(stdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[reaper] worktree list failed for ${projectPath}: ${message}`);
    return {
      reapedCount: 0,
      prunedCount: 0,
      errors: [
        { path: projectPath, branch: null, stage: 'remove-worktree', message },
      ],
    };
  }

  // Count prunable BEFORE pruning so the summary reflects the pre-sweep
  // state, not whatever git emits in the prune stdout (which varies by
  // version and is noisy to parse).
  prunedCount = entries.filter((e) => e.prunable).length;

  for (const entry of entries) {
    // Prunable → step 4 handles it. Trying `worktree remove` on a gone
    // folder would fail with "not a working tree" and pollute the errors
    // array with noise that's not actionable.
    if (entry.prunable) continue;
    // Namespace guard — only `session/<slug>` worktrees are reapable. This
    // structurally protects the main project worktree (branch `main` or
    // `master`) and any user-created worktree in another namespace, even
    // if its path isn't in `activeSessionFolders`.
    if (!entry.branch || !entry.branch.startsWith('session/')) continue;
    if (activeSessionFolders.has(normalizePath(entry.path))) continue;

    console.log(`[reaper] remove ${entry.path} (branch ${entry.branch})`);
    try {
      await execFileP('git', [
        '-C',
        projectPath,
        'worktree',
        'remove',
        '--force',
        entry.path,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[reaper] worktree remove ${entry.path} failed: ${message}`);
      errors.push({
        path: entry.path,
        branch: entry.branch,
        stage: 'remove-worktree',
        message,
      });
      // Skip branch delete — worktree is still checked out against it.
      continue;
    }

    console.log(`[reaper] branch -D ${entry.branch}`);
    try {
      await execFileP('git', [
        '-C',
        projectPath,
        'branch',
        '-D',
        entry.branch,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[reaper] branch -D ${entry.branch} failed: ${message}`);
      errors.push({
        path: entry.path,
        branch: entry.branch,
        stage: 'delete-branch',
        message,
      });
      // Still count the reap — the worktree is gone. A stray branch is
      // recoverable / ignorable; the expensive destructive step already
      // succeeded.
    }
    reapedCount += 1;
  }

  try {
    await execFileP('git', ['-C', projectPath, 'worktree', 'prune']);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[reaper] worktree prune failed for ${projectPath}: ${message}`);
    errors.push({
      path: projectPath,
      branch: null,
      stage: 'remove-worktree',
      message: `prune: ${message}`,
    });
    // Prune failed → metadata entries are still there. Zero out the claimed
    // prunedCount so the summary doesn't lie about state that didn't change.
    prunedCount = 0;
  }

  return { reapedCount, prunedCount, errors };
}
