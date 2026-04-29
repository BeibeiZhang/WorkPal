import { constants as fsConstants } from 'node:fs';
import { copyFile, lstat, readdir, stat } from 'node:fs/promises';
import { cp } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';

import { listNewFilesAtTop } from './git.js';

/** §20 + §30: result of a single session→ref-folder copy attempt.
 *
 *  Success shapes:
 *    - `copiedCount: N`                               — strict outputs/ copy succeeded
 *    - `copiedCount: N, usedFallback: true`           — §30 fallback copied N
 *                                                       deliverable file(s) from cwd top-level
 *    - `copiedCount: 0, warning: 'no_outputs_dir'`    — legacy compat: outputs/
 *                                                       missing AND fallback unavailable
 *                                                       (kept defensively; current code
 *                                                       paths emit `no_new_deliverables`)
 *    - `copiedCount: 0, warning: 'no_new_deliverables'` — outputs/ empty AND fallback
 *                                                       found nothing matching the
 *                                                       deliverable filter
 *
 *  Failure: fs errno mapped to one of four codes the modal renders
 *  with a friendly message (see CompleteSessionModal).
 */
export type CopyResult =
  | { ok: true; copiedCount: number; usedFallback?: false }
  | { ok: true; copiedCount: number; usedFallback: true }
  | { ok: true; copiedCount: 0; warning: 'no_outputs_dir' }
  | { ok: true; copiedCount: 0; warning: 'no_new_deliverables' }
  | {
      ok: false;
      code: 'permission_denied' | 'not_found' | 'disk_full' | 'unknown';
      message: string;
    };

/** §30 — when outputs/ is empty/missing, fall back to copying NEW files
 *  that the agent created at cwd top-level. Filter to "deliverable"
 *  extensions (markdown / docs / data / web) and exclude common
 *  scaffolding filenames so an `npm init` artifact (package.json,
 *  tsconfig.json) doesn't sneak into the user's ref folder.
 *
 *  `.json` is intentionally retained as a deliverable extension because
 *  AI flows do produce schema.json / data.json deliverables; the
 *  scaffolding block-list catches the common npm/Vite cases. README.md
 *  is NOT blocked since it's a frequent legitimate deliverable. */
const DELIVERABLE_EXT = /\.(md|txt|html|pdf|docx?|json|ya?ml|csv)$/i;
const SCAFFOLDING_BLOCK: ReadonlySet<string> = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
]);
const SCAFFOLDING_PATTERN = /^tsconfig\..+\.json$/i;

function isDeliverable(name: string): boolean {
  if (!DELIVERABLE_EXT.test(name)) return false;
  if (SCAFFOLDING_BLOCK.has(name)) return false;
  if (SCAFFOLDING_PATTERN.test(name)) return false;
  return true;
}

/** Copy `<sessionPath>/outputs/*` flat into `<refFolderPath>/`. Per §20 spec
 *  the agent's deliverables follow ARTIFACT_PROMPT's DELIVERABLE LAYOUT
 *  convention (everything under outputs/), so we strictly copy that subtree
 *  rather than the whole worktree (which would sweep in .git, scratch
 *  scaffolding, node_modules from any tooling the agent ran).
 *
 *  §30 fallback: if outputs/ is missing OR contains zero files, we look for
 *  NEW files at the cwd TOP-LEVEL whose names pass `isDeliverable`. The
 *  source list comes from one of two places:
 *
 *    • §41 — `addedFiles` param (preferred): pre-captured list of newly-
 *      ADDED top-level files from `git diff base...session --diff-filter=A`,
 *      computed by the route handler BEFORE the FF merge. Catches files the
 *      agent committed via Phase 5.5 auto-commit, which `git status` no
 *      longer sees by /merge time. Tri-state contract: `[]` means "route
 *      captured but found nothing" → no fallback to git status; `undefined`
 *      means "route did not capture" → falls through to the legacy path.
 *      This distinction prevents capture failures from silently double-
 *      running and masking bugs.
 *
 *    • Legacy — `listNewFilesAtTop` (`git status --porcelain`): catches
 *      untracked/staged files at cwd top-level. Used when `addedFiles` is
 *      undefined (back-compat for callers predating §41 + the degraded path
 *      when the route's pre-capture failed).
 *
 *  Path-jail check rejects any candidate that doesn't resolve inside the
 *  worktree. `COPYFILE_EXCL` ensures we never overwrite an existing user
 *  file in the ref folder (§30 only handles AI-NEW files; collisions skip
 *  silently and don't count toward `copiedCount`).
 *
 *  fs.cp is invoked with `force: true` (overwrite name clashes — the ref
 *  folder is user-owned and "merge" means "make it look like the new
 *  output") and `preserveTimestamps: true` (keep file mtimes so the user can
 *  diff/sort intuitively).
 */
export async function copySessionOutputsToRefFolder(
  sessionPath: string,
  refFolderPath: string,
  addedFiles?: string[],
): Promise<CopyResult> {
  const outputsDir = join(sessionPath, 'outputs');

  let outputsHasFiles = false;
  try {
    const s = await stat(outputsDir);
    if (s.isDirectory() && (await countFiles(outputsDir)) > 0) {
      outputsHasFiles = true;
    }
  } catch {
    // outputs/ missing — outputsHasFiles stays false, fallback runs.
  }

  if (outputsHasFiles) {
    try {
      await cp(outputsDir, refFolderPath, {
        recursive: true,
        force: true,
        preserveTimestamps: true,
        errorOnExist: false,
      });
      const copiedCount = await countFiles(outputsDir);
      return { ok: true, copiedCount };
    } catch (err: unknown) {
      return mapFsError(err);
    }
  }

  // §30 fallback path. §41: if route handler pre-captured `addedFiles`,
  // use it (including the empty-array case); otherwise legacy git-status.
  return copyTopLevelNewFiles(sessionPath, refFolderPath, addedFiles);
}

async function copyTopLevelNewFiles(
  sessionPath: string,
  refFolderPath: string,
  precomputedFiles?: string[],
): Promise<CopyResult> {
  let candidates: string[];
  // §41: tri-state on `precomputedFiles`. `undefined` = route didn't capture
  // → fall back to git status. `[]` = route captured but the diff was empty
  // → DO NOT fall back; treat as "truly nothing new", otherwise a capture
  // failure (caught upstream and converted to undefined) would be
  // indistinguishable from a real empty diff and silently double-run.
  if (precomputedFiles !== undefined) {
    candidates = precomputedFiles;
  } else {
    try {
      candidates = await listNewFilesAtTop(sessionPath);
    } catch (err) {
      // Worktree without git, or git binary unavailable. Don't 500 the
      // multi-target merge — surface as "no new deliverables" so the modal
      // can show a useful hint instead of a generic failure.
      console.warn('[sessionCopy] listNewFilesAtTop failed:', err);
      return { ok: true, copiedCount: 0, warning: 'no_new_deliverables' };
    }
  }

  const cwdJail = sessionPath + sep;
  const safe: string[] = [];
  for (const p of candidates) {
    if (!isDeliverable(p)) continue;
    const resolved = resolve(sessionPath, p);
    // Reject anything that resolves outside the worktree (defensive — git
    // shouldn't track files outside the repo, but `..` in a porcelain entry
    // would still escape `path.join`).
    if (resolved !== join(sessionPath, p)) continue;
    if (!resolved.startsWith(cwdJail)) continue;
    safe.push(p);
  }

  let copiedCount = 0;
  let firstError: unknown;
  for (const relPath of safe) {
    const src = join(sessionPath, relPath);
    try {
      const lst = await lstat(src);
      if (!lst.isFile()) continue; // skip symlinks / devices / dirs
      const dest = join(refFolderPath, basename(relPath));
      await copyFile(src, dest, fsConstants.COPYFILE_EXCL);
      copiedCount++;
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      // EEXIST: ref folder already has a file with this name. §30 explicitly
      // does NOT overwrite existing user files; skip silently.
      if (e.code === 'EEXIST') continue;
      // Remember the first non-EEXIST error so the route handler can surface
      // it if it's the only thing that happened. We keep going through the
      // remaining candidates so a single bad file doesn't kill a partial
      // success.
      if (!firstError) firstError = err;
    }
  }

  if (copiedCount > 0) {
    return { ok: true, copiedCount, usedFallback: true };
  }
  if (firstError) return mapFsError(firstError);
  return { ok: true, copiedCount: 0, warning: 'no_new_deliverables' };
}

function mapFsError(err: unknown): CopyResult {
  const e = err as NodeJS.ErrnoException;
  const code: 'permission_denied' | 'not_found' | 'disk_full' | 'unknown' =
    e.code === 'EACCES' || e.code === 'EPERM'
      ? 'permission_denied'
      : e.code === 'ENOENT'
        ? 'not_found'
        : e.code === 'ENOSPC'
          ? 'disk_full'
          : 'unknown';
  return { ok: false, code, message: e.message ?? String(err) };
}

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).length;
}
