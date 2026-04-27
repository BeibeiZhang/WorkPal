import { Router } from 'express';
import { access } from 'node:fs/promises';
import { basename, join, resolve as pathResolve, sep } from 'node:path';
import { homedir } from 'node:os';
import {
  diffSessionVsBase,
  mergeSessionFFOnly,
  SESSION_BRANCH_RE,
} from '../lib/git.js';
import { initProjectIfNeeded, resolveProjectFolder } from '../lib/project.js';
import { WORKPAL_ROOT } from '../lib/paths.js';

const router = Router();

/** Local copy of claudeChat.ts's `resolveSessionFolder` — same shape, same
 *  contract (expand `~/`, resolve absolute, reject paths that escape
 *  WORKPAL_ROOT). Duplicated here deliberately for 6.3: pulling it into a
 *  shared module would mean touching the claudeChat.ts import graph on a
 *  live-tested code path, so we postpone the dedupe to a follow-up cleanup
 *  step. Error messages are bilingual out of the gate (principle #8) —
 *  claudeChat.ts's copy is patched to match in the same commit so the two
 *  don't drift. */
function resolveSessionFolder(
  folder: unknown,
): { ok: true; resolved: string } | { ok: false; reason: string } {
  if (typeof folder !== 'string' || folder.length === 0) {
    return { ok: false, reason: 'sessionFolder is required / sessionFolder 必填' };
  }
  const expanded =
    folder === '~'
      ? homedir()
      : folder.startsWith('~/')
        ? pathResolve(homedir(), folder.slice(2))
        : folder;
  const resolved = pathResolve(expanded);
  if (resolved !== WORKPAL_ROOT && !resolved.startsWith(WORKPAL_ROOT + sep)) {
    return {
      ok: false,
      reason:
        'sessionFolder must be under ~/WorkPal/ / sessionFolder 必须在 ~/WorkPal/ 下',
    };
  }
  return { ok: true, resolved };
}

/** Full 5-step validation chain shared by both 6.3 routes. Returns either the
 *  validated values the handler needs (projectPath + workingDir + branchName)
 *  or a `{ status, error }` pair the handler can blindly respond with. The
 *  five steps (in order) map exactly to the review-locked table — every 400
 *  exit has a single, named trigger, which is easier to cover in the
 *  acceptance tests than an if-ladder with mixed error shapes. */
interface ValidInputs {
  projectPath: string;
  workingDir: string;
  branchName: string;
}
type ValidateResult =
  | { ok: true; value: ValidInputs }
  | { ok: false; status: number; error: string };

async function validateCompleteInputs(body: {
  projectSlug?: unknown;
  sessionFolder?: unknown;
}): Promise<ValidateResult> {
  // ① projectSlug — hard-exclude Phase 5 legacy: 6.3 is worktree-only.
  const projectCheck = resolveProjectFolder(body.projectSlug);
  if (!projectCheck.ok) {
    return { ok: false, status: 400, error: projectCheck.reason };
  }
  const projectPath = projectCheck.resolved;

  // ② sessionFolder — under ~/WorkPal/ + expand ~.
  const folderCheck = resolveSessionFolder(body.sessionFolder);
  if (!folderCheck.ok) {
    return { ok: false, status: 400, error: folderCheck.reason };
  }
  const workingDir = folderCheck.resolved;

  // ③ cross-project containment — the sessionFolder must live under
  // <projectPath>/sessions/. Blocks "projectSlug A + sessionFolder under B"
  // which would merge A's branch namespace against B's on-disk state.
  const expectedParent = pathResolve(projectPath, 'sessions') + sep;
  if (!workingDir.startsWith(expectedParent)) {
    return {
      ok: false,
      status: 400,
      error:
        'sessionFolder must live under ~/WorkPal/<projectSlug>/sessions/ / sessionFolder 必须在 ~/WorkPal/<projectSlug>/sessions/ 下',
    };
  }

  // ④ derive branchName — never trust a client-supplied name. Matches the
  // formula 6.2 uses at the /claude-chat request boundary.
  const sessionSlug = basename(workingDir.replace(/\/+$/, ''));
  const branchName = `session/${sessionSlug}`;
  if (!SESSION_BRANCH_RE.test(branchName)) {
    return {
      ok: false,
      status: 400,
      error:
        'sessionFolder slug contains characters not allowed in a git branch name / sessionFolder slug 含有不能用于 git 分支名的字符',
    };
  }

  // ⑤ project repo must exist — 6.1 init should have fired by now, but if
  // the user's storage got into a weird state (deleted ~/WorkPal/ out from
  // under us) we return 404 instead of 400: the input was fine, the server
  // state isn't.
  try {
    await access(join(projectPath, '.git'));
  } catch {
    return {
      ok: false,
      status: 404,
      error: 'Project has no git repo yet — open the project once to initialize.',
    };
  }

  return { ok: true, value: { projectPath, workingDir, branchName } };
}

// POST /api/session/complete — 6.3: user clicked "Complete Session". Return
// the file-level diff preview (status + line counts) so the modal can render
// the rows. Does NOT merge — that's a separate POST with the same validation.
router.post('/session/complete', async (req, res) => {
  const check = await validateCompleteInputs(req.body ?? {});
  if (!check.ok) {
    res.status(check.status).json({ error: check.error });
    return;
  }
  const { projectPath, branchName } = check.value;

  // Defensive: 6.1 + 6.2 usually guarantee the repo, but a race on project
  // creation → "Complete Session" would trip step ⑤ above with a 404 that
  // hides behind fire-and-forget timing. This call is idempotent (no-op past
  // the first init) and costs one `stat(.git)` per call thereafter.
  try {
    await initProjectIfNeeded(projectPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[session/complete] initProjectIfNeeded failed: ${message}`);
    res.status(500).json({
      error: `Failed to prepare project repo: ${message}`,
    });
    return;
  }

  try {
    const files = await diffSessionVsBase(projectPath, branchName);
    console.log(
      `[session/complete] ${projectPath} ${branchName} → ${files.length} file(s)`,
    );
    res.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[session/complete] diff failed: ${message}`);
    res.status(500).json({
      error: `Failed to compute session diff: ${message}`,
    });
  }
});

// POST /api/session/merge — 6.3: user approved the diff. Attempt a
// `git merge --ff-only` in the project base. 409 on non-FF (another session
// was completed in between — 6.4 will surface the CLI hand-off); 500 on
// anything else git complains about.
router.post('/session/merge', async (req, res) => {
  const check = await validateCompleteInputs(req.body ?? {});
  if (!check.ok) {
    res.status(check.status).json({ error: check.error });
    return;
  }
  const { projectPath, branchName } = check.value;

  const result = await mergeSessionFFOnly(projectPath, branchName);
  if (result.ok) {
    console.log(
      `[session/merge] ok ${projectPath} ${branchName} → ${result.commit.slice(0, 7)}${result.alreadyUpToDate ? ' (already up to date)' : ''}`,
    );
    res.json({
      ok: true,
      commit: result.commit,
      alreadyUpToDate: result.alreadyUpToDate,
    });
    return;
  }

  if (result.reason === 'not-ff') {
    console.log(
      `[session/merge] non-ff ${projectPath} ${branchName}: ${result.message.trim()}`,
    );
    res.status(409).json({
      ok: false,
      reason: 'not-ff',
      error: 'Session cannot be fast-forwarded — another completed session has advanced the project since this session started.',
      gitMessage: result.message,
    });
    return;
  }

  console.error(
    `[session/merge] other failure ${projectPath} ${branchName}: ${result.message.trim()}`,
  );
  res.status(500).json({
    ok: false,
    reason: 'other',
    error: `Merge failed: ${result.message}`,
  });
});

export default router;
