import { Router } from 'express';
import { access } from 'node:fs/promises';
import { join, resolve as pathResolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { reapProjectOrphans, type ReapError } from '../lib/reaper.js';
import { resolveProjectFolder } from '../lib/project.js';
import { WORKPAL_ROOT } from '../lib/paths.js';

const router = Router();

/** Local copy of the shared `resolveSessionFolder` — session.ts has the same
 *  function for the same reason (6.3 deferred the dedupe to avoid touching
 *  claudeChat.ts's import graph on a live-tested path). Bilingual reason
 *  strings match principle #8. */
function resolveSessionFolder(
  folder: unknown,
): { ok: true; resolved: string } | { ok: false; reason: string } {
  if (typeof folder !== 'string' || folder.length === 0) {
    return {
      ok: false,
      reason: 'sessionFolder is required / sessionFolder 必填',
    };
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

/** Per-project skip reasons the summary surfaces to the frontend. The
 *  frontend `console.warn`s on any non-undefined value so a dev tailing the
 *  browser console can spot payload bugs (slug typo, cross-project leak)
 *  even though the endpoint always returns 200. */
type SkipReason = 'no-git' | 'invalid-slug' | 'invalid-session-path';

interface ProjectSummary {
  projectSlug: string;
  reapedCount: number;
  prunedCount: number;
  errors: ReapError[];
  skipped?: SkipReason;
  /** Human-readable, bilingual. Present iff `skipped` is set. */
  skippedReason?: string;
}

/** POST /api/reaper/run — 6.5 orphan worktree reaper endpoint.
 *
 *  Body: `{ projects: [{ projectSlug, activeSessionFolders: string[] }] }`
 *  Response: `{ summary: ProjectSummary[] }` — always 200 on valid top-level
 *  shape, regardless of per-project failures.
 *
 *  Validation policy (locked 2026-04-19 in 6.5 planning):
 *    • Top-level shape wrong (missing/non-array `projects`) → 400 bilingual.
 *    • Per-project validation failure (bad slug, bad session path, no
 *      `.git`) → record in `summary[i].skipped` + continue. This is a
 *      mount-time sweep across many projects; one bad input shouldn't
 *      wedge cleanup for the others.
 *
 *  Never reaps worktrees in projects not listed here: if the user's
 *  localStorage was cleared, we have nothing to cross-reference and
 *  intentionally do nothing (principle #7 — don't destroy on ambiguous
 *  signals). */
router.post('/reaper/run', async (req, res) => {
  const body = (req.body ?? {}) as { projects?: unknown };

  if (!Array.isArray(body.projects)) {
    res.status(400).json({
      error: 'projects must be an array / projects 必须是数组',
    });
    return;
  }

  const summary: ProjectSummary[] = [];

  for (const raw of body.projects) {
    if (!raw || typeof raw !== 'object') {
      summary.push({
        projectSlug: '<invalid>',
        reapedCount: 0,
        prunedCount: 0,
        errors: [],
        skipped: 'invalid-slug',
        skippedReason:
          'project entry must be an object / project 条目必须是对象',
      });
      continue;
    }
    const { projectSlug, activeSessionFolders } = raw as {
      projectSlug?: unknown;
      activeSessionFolders?: unknown;
    };

    const projectCheck = resolveProjectFolder(projectSlug);
    if (!projectCheck.ok) {
      summary.push({
        projectSlug:
          typeof projectSlug === 'string' ? projectSlug : '<invalid>',
        reapedCount: 0,
        prunedCount: 0,
        errors: [],
        skipped: 'invalid-slug',
        skippedReason: projectCheck.reason,
      });
      continue;
    }
    const projectPath = projectCheck.resolved;
    // After resolveProjectFolder succeeds we know projectSlug is a non-empty
    // string — the narrowing is lost across the function boundary so we
    // re-assert here rather than leaning on `as string`.
    const slugForSummary =
      typeof projectSlug === 'string' ? projectSlug : '<invalid>';

    if (!Array.isArray(activeSessionFolders)) {
      summary.push({
        projectSlug: slugForSummary,
        reapedCount: 0,
        prunedCount: 0,
        errors: [],
        skipped: 'invalid-session-path',
        skippedReason:
          'activeSessionFolders must be an array / activeSessionFolders 必须是数组',
      });
      continue;
    }

    // Validate every session path + enforce cross-project containment — the
    // same guard 6.3's /api/session/complete uses. A single bad path skips
    // the entire project rather than silently ignoring that one chat; the
    // frontend's console.warn surfaces the issue so the dev can fix the
    // payload construction.
    const expectedParent = pathResolve(projectPath, 'sessions') + sep;
    const resolvedActive = new Set<string>();
    let skipReason: string | null = null;
    for (const rawPath of activeSessionFolders) {
      const folderCheck = resolveSessionFolder(rawPath);
      if (!folderCheck.ok) {
        skipReason = folderCheck.reason;
        break;
      }
      if (!folderCheck.resolved.startsWith(expectedParent)) {
        skipReason =
          'sessionFolder must live under ~/WorkPal/<projectSlug>/sessions/ / sessionFolder 必须在 ~/WorkPal/<projectSlug>/sessions/ 下';
        break;
      }
      // Normalize trailing slashes here so the reaper's Set membership check
      // matches porcelain output (which never carries trailing slashes).
      resolvedActive.add(folderCheck.resolved.replace(/\/+$/, ''));
    }
    if (skipReason) {
      summary.push({
        projectSlug: slugForSummary,
        reapedCount: 0,
        prunedCount: 0,
        errors: [],
        skipped: 'invalid-session-path',
        skippedReason: skipReason,
      });
      continue;
    }

    // Fresh project that hasn't been chatted into yet — no `.git` means
    // nothing to reap. Record as `no-git` skip so a dev can distinguish
    // "legitimately empty" from real errors in the summary.
    try {
      await access(join(projectPath, '.git'));
    } catch {
      summary.push({
        projectSlug: slugForSummary,
        reapedCount: 0,
        prunedCount: 0,
        errors: [],
        skipped: 'no-git',
        skippedReason:
          'project has no git repo yet / project 尚未初始化 git',
      });
      continue;
    }

    const result = await reapProjectOrphans(projectPath, resolvedActive);
    console.log(
      `[reaper] ${slugForSummary}: reaped=${result.reapedCount} pruned=${result.prunedCount} errors=${result.errors.length}`,
    );
    summary.push({
      projectSlug: slugForSummary,
      reapedCount: result.reapedCount,
      prunedCount: result.prunedCount,
      errors: result.errors,
    });
  }

  res.json({ summary });
});

export default router;
