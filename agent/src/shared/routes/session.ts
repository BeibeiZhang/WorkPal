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
import { copySessionOutputsToRefFolder } from '../lib/sessionCopy.js';
import { validateReferenceDirectories } from '../lib/referenceDirs.js';

/** §20: aggregate response shape for /api/session/merge. The handler always
 *  returns this shape — single-project (no `targets` body) collapses to
 *  `results: [{ target: 'project', ... }]`, multi-target merges include one
 *  entry per requested ref folder. Frontend reads `ok` for top-level
 *  success/partial and `results[]` for per-row UI in CompleteSessionModal. */
export type MergeTargetResult =
  | { target: 'project'; ok: true; commit: string; alreadyUpToDate: boolean }
  | { target: 'project'; ok: false; reason: 'not-ff'; error: string; gitMessage: string }
  | { target: 'project'; ok: false; reason: 'other'; error: string }
  | { target: 'reference'; path: string; ok: true; copiedCount: number; usedFallback?: false }
  | { target: 'reference'; path: string; ok: true; copiedCount: number; usedFallback: true }
  | { target: 'reference'; path: string; ok: true; copiedCount: 0; warning: 'no_outputs_dir' }
  | { target: 'reference'; path: string; ok: true; copiedCount: 0; warning: 'no_new_deliverables' }
  | {
      target: 'reference';
      path: string;
      ok: false;
      code: 'permission_denied' | 'not_found' | 'disk_full' | 'invalid_path' | 'unknown';
      message: string;
    };

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

// POST /api/session/merge — 6.3 + §20: user approved the diff. Body shape:
//   {
//     projectSlug, sessionFolder,
//     targets?: { project?: boolean, referenceFolders?: string[] }
//   }
// Targets default to `{ project: true, referenceFolders: [] }` (back-compat
// for any caller predating §20). Project merge runs first and aborts the
// whole request on failure (409 non-ff / 500 other) — we never want to
// pollute ref folders if the canonical project merge couldn't go through.
// Ref folder copies run serially, each producing one MergeTargetResult; per-
// folder failures don't short-circuit each other.
router.post('/session/merge', async (req, res) => {
  const body = (req.body ?? {}) as {
    projectSlug?: unknown;
    sessionFolder?: unknown;
    targets?: { project?: unknown; referenceFolders?: unknown };
  };
  const check = await validateCompleteInputs(body);
  if (!check.ok) {
    res.status(check.status).json({ error: check.error });
    return;
  }
  const { projectPath, workingDir, branchName } = check.value;

  const wantsProject = body.targets?.project !== false;
  const requestedRefFolders = body.targets?.referenceFolders;
  const refDirsCheck = validateReferenceDirectories(requestedRefFolders ?? [], 'filter');
  const validRefDirs = refDirsCheck.resolved;
  const droppedRefDirs = refDirsCheck.dropped;

  if (!wantsProject && validRefDirs.length === 0 && droppedRefDirs.length === 0) {
    res.status(400).json({ error: 'Select at least one merge target / 至少选择一个合并目标' });
    return;
  }

  const results: MergeTargetResult[] = [];

  if (wantsProject) {
    const result = await mergeSessionFFOnly(projectPath, branchName);
    if (result.ok) {
      console.log(
        `[session/merge] project ok ${projectPath} ${branchName} → ${result.commit.slice(0, 7)}${result.alreadyUpToDate ? ' (already up to date)' : ''}`,
      );
      results.push({
        target: 'project',
        ok: true,
        commit: result.commit,
        alreadyUpToDate: result.alreadyUpToDate,
      });
    } else if (result.reason === 'not-ff') {
      console.log(
        `[session/merge] non-ff ${projectPath} ${branchName}: ${result.message.trim()}`,
      );
      results.push({
        target: 'project',
        ok: false,
        reason: 'not-ff',
        error:
          'Session cannot be fast-forwarded — another completed session has advanced the project since this session started.',
        gitMessage: result.message,
      });
      res.status(409).json({ ok: false, results });
      return;
    } else {
      console.error(
        `[session/merge] project other failure ${projectPath} ${branchName}: ${result.message.trim()}`,
      );
      results.push({
        target: 'project',
        ok: false,
        reason: 'other',
        error: `Merge failed: ${result.message}`,
      });
      res.status(500).json({ ok: false, results });
      return;
    }
  }

  for (const refPath of validRefDirs) {
    const copy = await copySessionOutputsToRefFolder(workingDir, refPath);
    if (copy.ok && 'warning' in copy) {
      console.log(`[session/merge] reference warn ${refPath}: ${copy.warning}`);
      results.push({
        target: 'reference',
        path: refPath,
        ok: true,
        copiedCount: 0,
        warning: copy.warning,
      });
    } else if (copy.ok) {
      const usedFallback = 'usedFallback' in copy && copy.usedFallback === true;
      console.log(
        `[session/merge] reference ok ${refPath} → ${copy.copiedCount} file(s)${
          usedFallback ? ' (fallback: cwd top-level)' : ''
        }`,
      );
      results.push(
        usedFallback
          ? {
              target: 'reference',
              path: refPath,
              ok: true,
              copiedCount: copy.copiedCount,
              usedFallback: true,
            }
          : {
              target: 'reference',
              path: refPath,
              ok: true,
              copiedCount: copy.copiedCount,
            },
      );
    } else {
      console.error(`[session/merge] reference fail ${refPath}: ${copy.code} ${copy.message}`);
      results.push({
        target: 'reference',
        path: refPath,
        ok: false,
        code: copy.code,
        message: copy.message,
      });
    }
  }

  for (const dropped of droppedRefDirs) {
    console.warn(`[session/merge] reference invalid_path ${dropped.path}: ${dropped.error}`);
    results.push({
      target: 'reference',
      path: dropped.path,
      ok: false,
      code: 'invalid_path',
      message: dropped.error,
    });
  }

  const allOk = results.every((r) => r.ok);
  res.json({ ok: allOk, results });
});

export default router;
