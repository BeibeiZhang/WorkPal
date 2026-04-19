import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

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
