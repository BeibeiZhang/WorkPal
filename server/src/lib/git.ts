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
