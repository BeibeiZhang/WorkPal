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

/** Stage everything in `cwd` and commit with a subject derived from the tool
 *  call. Returns the new HEAD hash. Callers should only invoke this after a
 *  successful file-mutating tool_result — commits on failed writes would
 *  pollute the undo stack with empty-diff or phantom entries. */
export async function commitAfterTool(
  cwd: string,
  args: { sessionId: string; toolName: string; summary: string },
): Promise<CommitResult> {
  const sidShort = args.sessionId.slice(0, SID_PREFIX) || 'anon';
  const summary = truncate(args.summary.replace(/\s+/g, ' ').trim(), SUMMARY_MAX);
  const subject = `Session ${sidShort} – ${args.toolName} – ${summary}`;

  await execFileP('git', ['add', '-A'], { cwd });
  // --allow-empty covers the edge case where the tool reported success but
  // produced no diff (e.g. Edit that rewrote a file to its existing contents).
  // Without this the commit would throw and the undo stack would silently
  // desync from the Change entries in the UI.
  await execFileP(
    'git',
    ['commit', '--allow-empty', '-q', '-m', subject],
    { cwd },
  );
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
