import { cp, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** §20: result of a single session→ref-folder copy attempt. Three terminal
 *  shapes:
 *    success    — outputs/ existed and was copied (with file count for the
 *                 modal's "Merged N files" line)
 *    warning    — outputs/ doesn't exist; the call is still ok (so we don't
 *                 fail the whole multi-target merge), but the modal shows a
 *                 distinct gray icon + "AI didn't produce outputs/" hint
 *                 instead of a green checkmark
 *    failure    — fs error mapped to one of four codes the modal renders
 *                 with a friendly message (see CompleteSessionModal)
 */
export type CopyResult =
  | { ok: true; copiedCount: number }
  | { ok: true; copiedCount: 0; warning: 'no_outputs_dir' }
  | {
      ok: false;
      code: 'permission_denied' | 'not_found' | 'disk_full' | 'unknown';
      message: string;
    };

/** Copy `<sessionPath>/outputs/*` flat into `<refFolderPath>/`. Per §20 spec
 *  the agent's deliverables follow ARTIFACT_PROMPT's DELIVERABLE LAYOUT
 *  convention (everything under outputs/), so we strictly copy that subtree
 *  rather than the whole worktree (which would sweep in .git, scratch
 *  scaffolding, node_modules from any tooling the agent ran).
 *
 *  If outputs/ is missing we return success-with-warning rather than a hard
 *  error — the chat may have been pure Q&A or the agent may have ignored the
 *  layout convention; either way the caller multi-target loop should continue
 *  through any remaining ref folders.
 *
 *  fs.cp is invoked with `force: true` (overwrite name clashes — the ref
 *  folder is user-owned and "merge" means "make it look like the new
 *  output") and `preserveTimestamps: true` (keep file mtimes so the user can
 *  diff/sort intuitively).
 */
export async function copySessionOutputsToRefFolder(
  sessionPath: string,
  refFolderPath: string,
): Promise<CopyResult> {
  const outputsDir = join(sessionPath, 'outputs');

  try {
    const s = await stat(outputsDir);
    if (!s.isDirectory()) return { ok: true, copiedCount: 0, warning: 'no_outputs_dir' };
  } catch {
    return { ok: true, copiedCount: 0, warning: 'no_outputs_dir' };
  }

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
}

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).length;
}
