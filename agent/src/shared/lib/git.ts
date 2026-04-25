import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

/** 6.2: Branch-name contract for worktree-backed sessions. Supersedes D2's
 *  original `/^session\/[a-zA-Z0-9._-]+$/` — that rejected Phase 5's real-
 *  world CJK slugs. Since branch names flow through `execFile('git', [...])`
 *  there is no shell interpretation, so the threat model is git-layer:
 *    • `/` would break our single-level `session/<slug>` namespace
 *    • whitespace / NUL / control chars break `git check-ref-format`
 *    • `:` `~` `^` `?` `*` `[` `]` are git's reserved ref chars
 *    • `..` substring is rejected by git (and is a path-traversal smell)
 *    • `.lock` suffix collides with git's ref-lock protocol
 *    • leading `-` would be mistaken for a CLI flag by git commands
 *    • leading/trailing `.` is rejected by check-ref-format
 *  Pattern breakdown:
 *    ^session\/                  — namespace prefix
 *    (?![.\-])                   — first slug char isn't `.` or `-`
 *    (?!.*\.\.)                  — no `..` substring anywhere
 *    (?!.*\.lock$)               — no `.lock` suffix
 *    (?!.*\.$)                   — no trailing `.`
 *    [^...]+                     — body chars in the complement set
 *  `/u` turns on Unicode so CJK (which slugify preserves via \p{L}\p{N}) is
 *  accepted verbatim. */
export const SESSION_BRANCH_RE =
  /^session\/(?![.\-])(?!.*\.\.)(?!.*\.lock$)(?!.*\.$)[^\s/\\\0:~^?*\[\]\x00-\x1f\x7f]+$/u;

/** Keep commit-message summary short so `git log --oneline` stays readable. */
const SUMMARY_MAX = 80;
/** First 8 chars of the WorkPal chat id — enough to tell sessions apart in
 *  `git log` without turning every subject line into a UUID wall. */
const SID_PREFIX = 8;

/** True if `cwd/.git` exists. Used to gate init so we don't reinit an
 *  already-initialized repo on every file-write tool_use. */
async function hasGitDir(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, '.git'));
    return true;
  } catch {
    return false;
  }
}

/** Initialize a git repo in `cwd` if one doesn't already exist, set a
 *  repo-local identity, and create an empty baseline commit. The baseline
 *  matters: without it, undoing the session's first real write would target
 *  a root commit and `git reset HEAD~1` would fail — the user would see
 *  their "first Undo" silently break. With the baseline, every write has a
 *  parent to roll back to. Caller must ensure `cwd` already exists on disk. */
export async function initIfNeeded(cwd: string): Promise<void> {
  if (await hasGitDir(cwd)) return;
  await execFileP('git', ['init', '-q'], { cwd });
  // Repo-local identity keeps WorkPal self-contained — a user with no global
  // git config can still commit, and a user with a global identity doesn't
  // leak their email into the prototype's scratch commits.
  await execFileP('git', ['config', 'user.email', 'workpal@local'], { cwd });
  await execFileP('git', ['config', 'user.name', 'WorkPal'], { cwd });
  await execFileP(
    'git',
    ['commit', '--allow-empty', '-q', '-m', 'WorkPal session baseline'],
    { cwd },
  );
}

/** 6.2: Idempotent `git worktree add`. Creates `<sessionPath>` as a worktree
 *  of `<projectPath>` checked out on a fresh `<branchName>`. Caller must have
 *  already validated `branchName` against SESSION_BRANCH_RE; we don't
 *  re-validate since the same check runs at the request boundary.
 *
 *  Idempotency via a `.git` probe at `<sessionPath>`: worktrees write `.git`
 *  as a FILE (not a directory) that points back at the main repo's metadata.
 *  Presence of any `.git` entry at `<sessionPath>` means either (a) this
 *  worktree already exists from an earlier request in the same session — no-
 *  op is correct — or (b) the caller pointed us at a Phase 5 legacy folder
 *  with its own per-session `.git/` dir, in which case we also want to skip
 *  (the caller shouldn't mix modes, but better silent than double-init). The
 *  intermediate `<projectPath>/sessions/` parent must already exist — `git
 *  worktree add` doesn't create intermediate dirs — that's the caller's job.
 *  Throws on any other git failure (bad branch name slipping past validation,
 *  concurrent lock, disk full, etc.); caller's catch block drops to degraded
 *  mode (no git backup this request) matching Phase 5's `initIfNeeded`
 *  precedent. */
export async function worktreeAddIfNeeded(
  projectPath: string,
  sessionPath: string,
  branchName: string,
): Promise<void> {
  try {
    await access(join(sessionPath, '.git'));
    return;
  } catch {
    // `.git` absent → fall through and add the worktree.
  }
  // `-C <projectPath>` anchors the command at the main repo regardless of
  // process cwd (request handlers don't reliably have cwd === project).
  await execFileP('git', [
    '-C',
    projectPath,
    'worktree',
    'add',
    sessionPath,
    '-b',
    branchName,
  ]);
}

/** 6.2: Best-effort teardown for a pure-Q&A session in a project. Called from
 *  the request's `finally` block when `folderMaterialized === false` (no file
 *  write ever landed). Two git commands, both catch-and-log: worktree remove
 *  wipes the session folder + its worktree metadata; branch -D drops the
 *  empty branch we created for it. Either can fail (concurrent remove,
 *  branch already gone, lock file) without wedging the response — this is
 *  cleanup, not a correctness gate. Matches Phase 5 `finally rmdir`'s
 *  swallow-on-benign-error shape. */
export async function worktreeRemoveIfEmpty(
  projectPath: string,
  sessionPath: string,
  branchName: string,
): Promise<void> {
  try {
    await execFileP('git', [
      '-C',
      projectPath,
      'worktree',
      'remove',
      '--force',
      sessionPath,
    ]);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.warn(`[git] worktree remove ${sessionPath} failed: ${m}`);
  }
  try {
    // -D (force) not -d: an empty session branch still has a commit-less
    // history distinct from project main, and -d would complain about
    // "not fully merged". We explicitly want to discard the branch since
    // no file write ever targeted it.
    await execFileP('git', ['-C', projectPath, 'branch', '-D', branchName]);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.warn(`[git] branch -D ${branchName} failed: ${m}`);
  }
}

export interface CommitResult {
  /** Full HEAD hash after the commit. */
  commit: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/** Stage the specific `filePath` this tool touched and commit it. Returns the
 *  new HEAD hash, or `null` when staging produced no diff (e.g. an Edit that
 *  rewrote identical bytes — committing that with `--allow-empty` would leave
 *  a phantom entry in the undo stack that silently no-ops on click).
 *
 *  Per-file staging (not `-A`) is load-bearing: the SDK can batch multiple
 *  Write tool_uses in one assistant turn and only yields their tool_results
 *  after all of them have hit disk. A blanket `git add -A` during the first
 *  tool_result's commit would bundle sibling-write files into that commit,
 *  making Undo on the first row revert the wrong set of files.
 *
 *  `git add -- <abs>` is fine as long as the path resolves inside the repo
 *  (cwd === repo root, which is how claudeChat.ts sets it up). If the path
 *  ever escapes (defense-in-depth against a malformed tool input), git fatals
 *  here and the route's catch block logs + skips the commit, matching the
 *  existing degrade-silently policy. */
export async function commitAfterTool(
  cwd: string,
  args: { sessionId: string; toolName: string; filePath: string },
): Promise<CommitResult | null> {
  const sidShort = args.sessionId.slice(0, SID_PREFIX) || 'anon';
  const subject = `Session ${sidShort} – ${args.toolName} – ${truncate(args.filePath, SUMMARY_MAX)}`;

  await execFileP('git', ['add', '--', args.filePath], { cwd });
  // `git diff --cached --quiet` exits 0 when there's nothing staged — which
  // after a targeted `git add` means the tool reported success but the file
  // bytes didn't change. Skip the commit in that case: no commit hash goes
  // back to the frontend → the Change entry stays in the list without an
  // Undo button, honestly reflecting that there's nothing to undo.
  try {
    await execFileP('git', ['diff', '--cached', '--quiet'], { cwd });
    return null;
  } catch {
    // non-zero exit = staged diff exists → fall through to commit.
  }
  await execFileP('git', ['commit', '-q', '-m', subject], { cwd });
  const { stdout } = await execFileP('git', ['rev-parse', 'HEAD'], { cwd });
  return { commit: stdout.trim() };
}

/** Roll the repo back one commit and discard working-tree changes to match.
 *  Returns the new HEAD hash. Throws if there's no parent to reset to (e.g.
 *  trying to undo the very first commit). */
export async function undoLastCommit(cwd: string): Promise<CommitResult> {
  await execFileP('git', ['reset', '--hard', '-q', 'HEAD~1'], { cwd });
  const { stdout } = await execFileP('git', ['rev-parse', 'HEAD'], { cwd });
  return { commit: stdout.trim() };
}

/* ── 6.3: Complete Session — diff preview + FF merge ─────────────────────── */

/** One row in the diff preview the user sees before hitting Merge.
 *  `status` is simplified to A/M/D — renames are disabled at the git layer
 *  (`--no-renames`) so they surface as a D+A pair, which matches how 6.3's
 *  UI renders them anyway. `insertions`/`deletions` are `-1` for binary files
 *  (git's `--numstat` outputs `-` in those columns); the frontend renders a
 *  dash in place of a number when it sees `-1`. */
export interface SessionDiffEntry {
  path: string;
  status: 'A' | 'M' | 'D';
  insertions: number;
  deletions: number;
}

/** Parse `git diff --name-status --no-renames -z` output. Exported for
 *  test coverage — tolerates trailing NUL(s) and the empty-output case. */
export function parseDiffNameStatus(
  output: string,
): Array<{ path: string; status: 'A' | 'M' | 'D' }> {
  const out: Array<{ path: string; status: 'A' | 'M' | 'D' }> = [];
  if (!output) return out;
  // -z splits ALL tokens by NUL (status AND paths). Trailing NUL leaves an
  // empty final element after split; filter it out.
  const tokens = output.split('\0').filter((t) => t.length > 0);
  let i = 0;
  while (i < tokens.length) {
    const statusToken = tokens[i++];
    if (i >= tokens.length) break; // malformed — missing path after status
    const path = tokens[i++];
    const c = statusToken.charAt(0);
    // With --no-renames git never emits R/C, so the only expected single-
    // letter statuses are A / M / D / T (type change) / U (unmerged).
    // T and U don't naturally appear in a diff between two branches without
    // conflict markers, but if they did we'd surface them as 'M' — closest
    // user-intuitive bucket.
    let status: 'A' | 'M' | 'D';
    if (c === 'A') status = 'A';
    else if (c === 'D') status = 'D';
    else status = 'M';
    out.push({ path, status });
  }
  return out;
}

/** Parse `git diff --numstat --no-renames -z` output. Exported for test
 *  coverage. Binary files show `-` for both counts; we map that to `-1` so
 *  the frontend can key off a sentinel without re-parsing the string. */
export function parseDiffNumstat(
  output: string,
): Array<{ path: string; insertions: number; deletions: number }> {
  const out: Array<{ path: string; insertions: number; deletions: number }> = [];
  if (!output) return out;
  // Each `-z` record has shape `<ins>\t<del>\t<path>` followed by `\0`.
  const records = output.split('\0').filter((r) => r.length > 0);
  for (const rec of records) {
    const firstTab = rec.indexOf('\t');
    if (firstTab < 0) continue;
    const secondTab = rec.indexOf('\t', firstTab + 1);
    if (secondTab < 0) continue;
    const insStr = rec.slice(0, firstTab);
    const delStr = rec.slice(firstTab + 1, secondTab);
    const path = rec.slice(secondTab + 1);
    if (!path) continue;
    const insertions = insStr === '-' ? -1 : Number.parseInt(insStr, 10);
    const deletions = delStr === '-' ? -1 : Number.parseInt(delStr, 10);
    if (Number.isNaN(insertions) || Number.isNaN(deletions)) continue;
    out.push({ path, insertions, deletions });
  }
  return out;
}

/** Merge the two `git diff` outputs by path. Keyed so order follows `numstat`
 *  (which matches git's on-disk enumeration order); paths that appear in
 *  `statuses` but not `stats` (shouldn't happen in practice but possible on
 *  weird filesystems) are appended with `0/0` counts so the user still sees
 *  them rather than silently dropping the row. */
export function mergeDiffOutputs(
  statuses: Array<{ path: string; status: 'A' | 'M' | 'D' }>,
  stats: Array<{ path: string; insertions: number; deletions: number }>,
): SessionDiffEntry[] {
  const statusByPath = new Map<string, 'A' | 'M' | 'D'>();
  for (const s of statuses) statusByPath.set(s.path, s.status);
  const seen = new Set<string>();
  const out: SessionDiffEntry[] = [];
  for (const n of stats) {
    seen.add(n.path);
    out.push({
      path: n.path,
      status: statusByPath.get(n.path) ?? 'M',
      insertions: n.insertions,
      deletions: n.deletions,
    });
  }
  for (const s of statuses) {
    if (seen.has(s.path)) continue;
    out.push({ path: s.path, status: s.status, insertions: 0, deletions: 0 });
  }
  return out;
}

/** 6.3: diff the session branch against the project's base branch. Two git
 *  subprocesses (numstat + name-status) because `git diff` silently takes the
 *  last-specified flag when both are passed — the doc's one-command sketch
 *  was a shorthand that git doesn't actually honor. Subprocess overhead is
 *  single-digit ms per call; simpler than trying to merge a `--raw` + stats
 *  stream. `--no-renames` simplifies the output: a rename surfaces as a D+A
 *  pair, matching how the UI renders it anyway.
 *
 *  Base branch is whatever `symbolic-ref HEAD` returns on the project repo,
 *  not hardcoded `main`: `git init` picks a default branch name from the
 *  user's `init.defaultBranch` config (`main` on recent installs, `master`
 *  on older ones). 6.1 didn't pin `-b main`, so we read it here. Caller must
 *  have already validated `branchName` against `SESSION_BRANCH_RE`. */
export async function diffSessionVsBase(
  projectPath: string,
  branchName: string,
): Promise<SessionDiffEntry[]> {
  const { stdout: headOut } = await execFileP(
    'git',
    ['-C', projectPath, 'symbolic-ref', '--short', 'HEAD'],
  );
  const baseBranch = headOut.trim();
  if (!baseBranch) {
    throw new Error(
      `project repo at ${projectPath} has detached HEAD or no base branch`,
    );
  }
  const range = `${baseBranch}...${branchName}`;
  const [statusRes, statsRes] = await Promise.all([
    execFileP('git', [
      '-C',
      projectPath,
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      range,
    ]),
    execFileP('git', [
      '-C',
      projectPath,
      'diff',
      '--numstat',
      '--no-renames',
      '-z',
      range,
    ]),
  ]);
  const statuses = parseDiffNameStatus(statusRes.stdout);
  const stats = parseDiffNumstat(statsRes.stdout);
  return mergeDiffOutputs(statuses, stats);
}

/** Git's stderr when `--ff-only` rejects a merge. Covers the three phrasings
 *  observed across git 2.30+ (macOS system git and brew's latest), plus the
 *  "unrelated histories" failure which is effectively non-FF for our
 *  purposes (two branches sharing no merge base — can't fast-forward to a
 *  disjoint ref). Case-insensitive since git 2.45+ sometimes capitalizes
 *  `Fast-Forward` differently. */
export const NOT_FF_RE =
  /not possible to fast[- ]forward|non[- ]fast[- ]forward|not a fast[- ]forward|refusing to merge unrelated histories/i;

/** Stdout marker git prints when the named branch is already reachable from
 *  HEAD — nothing to merge. Exit code is 0 in this case, distinct from the
 *  non-FF path. */
const ALREADY_UP_TO_DATE_RE = /already up to date/i;

export type MergeFFResult =
  | { ok: true; commit: string; alreadyUpToDate: boolean }
  | { ok: false; reason: 'not-ff' | 'other'; message: string };

/** 6.3: `git merge --ff-only <branchName>` run in the project base repo.
 *  The merge target is whatever branch HEAD currently points at (see
 *  `diffSessionVsBase` for why this is read from `symbolic-ref` rather than
 *  hardcoded). `--no-edit` defends against an inherited `GIT_EDITOR`
 *  opening a pager mid-request.
 *
 *  Three outcomes:
 *    • FF succeeds, commits added → `ok:true, alreadyUpToDate:false`
 *    • Branch's HEAD already reachable from main → `ok:true, alreadyUpToDate:true`
 *      (observed when the user undid every commit on the session branch via 5.5)
 *    • Non-FF (another session advanced main in between) → `ok:false, reason:'not-ff'`
 *    • Anything else (missing ref, locked index, disk full) → `ok:false, reason:'other'`
 *
 *  Caller (the route handler) maps `not-ff` to HTTP 409 and `other` to 500.
 *  We don't throw on `not-ff` because it's a user-path outcome, not an
 *  exception — throwing would force the route handler to unwrap it with a
 *  catch whose shape is the same as this discriminated union anyway. */
export async function mergeSessionFFOnly(
  projectPath: string,
  branchName: string,
): Promise<MergeFFResult> {
  try {
    const { stdout } = await execFileP('git', [
      '-C',
      projectPath,
      'merge',
      '--ff-only',
      '--no-edit',
      branchName,
    ]);
    const { stdout: headOut } = await execFileP('git', [
      '-C',
      projectPath,
      'rev-parse',
      'HEAD',
    ]);
    return {
      ok: true,
      commit: headOut.trim(),
      alreadyUpToDate: ALREADY_UP_TO_DATE_RE.test(stdout),
    };
  } catch (err) {
    // execFile on non-zero exit rejects with an error shaped like
    // `{ code, stderr, stdout, ... }`. Check stderr against NOT_FF_RE to
    // distinguish the user-facing "already diverged" case from real failures.
    const e = err as { stderr?: string; message?: string };
    const stderr = typeof e.stderr === 'string' ? e.stderr : '';
    const message = stderr || e.message || 'git merge failed';
    if (NOT_FF_RE.test(stderr)) {
      return { ok: false, reason: 'not-ff', message };
    }
    return { ok: false, reason: 'other', message };
  }
}
