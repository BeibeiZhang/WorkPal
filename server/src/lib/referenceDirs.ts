import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve as pathResolve, sep } from 'node:path';
import { WORKPAL_ROOT } from './paths.js';

/** Per-project reference directory validation.
 *
 *  Reference directories are external knowledge folders the user attaches to
 *  a project. The Claude Agent SDK gets them via `additionalDirectories` so
 *  Read/Glob/Grep can reach files outside the session worktree. Every path
 *  flows through this validator twice:
 *    1) on save  (POST/PUT /api/projects/:id) — friendly error to the UI
 *    2) on use   (every /api/claude-chat request) — drop invalid silently
 *                so a stale path never fails the whole request, just gets
 *                stripped from the SDK call.
 *
 *  The check list is deliberate: anything filesystem-touching (existsSync,
 *  isDirectory) only makes sense when running on the user's Mac. Vercel
 *  serverless skips this validator and stores paths as-is — the local agent
 *  re-validates on use, which is the only place the path actually matters
 *  (the SDK runs locally). */

/** The 13 absolute paths a reference directory must NOT equal. `/Users` is
 *  here as a root-only block — `/Users/beibei/...` (anything under a user's
 *  home) is the entire point of this feature, so we only reject the literal
 *  `/Users` directory itself. */
const SYSTEM_BLOCKLIST = new Set<string>([
  '/',
  '/etc',
  '/bin',
  '/sbin',
  '/usr',
  '/var',
  '/dev',
  '/private',
  '/System',
  '/Library',
  '/Volumes',
  '/tmp',
  '/Users',
]);

export type ValidateResult =
  | { ok: true; resolved: string }
  | { ok: false; error: string };

/** Validate a single path. Returns the resolved absolute path on success
 *  (use this resolved value when persisting / passing to the SDK so we
 *  don't carry through whatever the user originally pasted). */
export function validateReferenceDirectory(input: unknown): ValidateResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { ok: false, error: 'Path required / 路径不能为空' };
  }

  if (!isAbsolute(input)) {
    return {
      ok: false,
      error: 'Path must be absolute / 必须是绝对路径',
    };
  }

  // Reject `..` BEFORE resolve — `pathResolve` would silently flatten it
  // and we want to be explicit that traversal isn't accepted, not just
  // tolerated-then-collapsed.
  if (input.split(sep).some((seg) => seg === '..')) {
    return {
      ok: false,
      error: 'Path traversal not allowed / 不允许路径穿越',
    };
  }

  const resolved = pathResolve(input);

  if (SYSTEM_BLOCKLIST.has(resolved)) {
    return {
      ok: false,
      error: 'System directory not allowed / 系统目录不允许',
    };
  }

  // Reject anything inside ~/WorkPal/. Two rules collapse into one check:
  //   - "not inside another project's worktree" (every project is jailed
  //     under WORKPAL_ROOT, so any path beneath it is some project's tree)
  //   - reference folders are external knowledge by definition
  if (resolved === WORKPAL_ROOT || resolved.startsWith(WORKPAL_ROOT + sep)) {
    return {
      ok: false,
      error: "Cannot reference another project's folder / 不能指向另一个 project 的目录",
    };
  }

  if (!existsSync(resolved)) {
    return {
      ok: false,
      error: 'Folder not found / 文件夹不存在',
    };
  }

  let stat;
  try {
    stat = statSync(resolved);
  } catch {
    return { ok: false, error: 'Folder not found / 文件夹不存在' };
  }
  if (!stat.isDirectory()) {
    return {
      ok: false,
      error: 'Path must be a folder / 必须是文件夹',
    };
  }

  return { ok: true, resolved };
}

/** Validate an entire array. On `mode: 'strict'` (used at save time), the
 *  first failure short-circuits with an error pointing at the bad path.
 *  On `mode: 'filter'` (used at SDK call time), invalid paths are dropped
 *  silently and the surviving subset is returned. */
export function validateReferenceDirectories(
  input: unknown,
  mode: 'strict',
): { ok: true; resolved: string[] } | { ok: false; error: string; badPath?: string };
export function validateReferenceDirectories(
  input: unknown,
  mode: 'filter',
): { ok: true; resolved: string[]; dropped: { path: string; error: string }[] };
export function validateReferenceDirectories(
  input: unknown,
  mode: 'strict' | 'filter',
):
  | { ok: true; resolved: string[]; dropped?: { path: string; error: string }[] }
  | { ok: false; error: string; badPath?: string } {
  if (input === undefined || input === null) {
    if (mode === 'filter') return { ok: true, resolved: [], dropped: [] };
    return { ok: true, resolved: [] };
  }
  if (!Array.isArray(input)) {
    if (mode === 'filter') return { ok: true, resolved: [], dropped: [] };
    return { ok: false, error: 'referenceDirectories must be an array / referenceDirectories 必须是数组' };
  }

  const resolved: string[] = [];
  const dropped: { path: string; error: string }[] = [];
  for (const raw of input) {
    const result = validateReferenceDirectory(raw);
    if (result.ok) {
      // Dedupe — duplicates would just waste SDK context.
      if (!resolved.includes(result.resolved)) resolved.push(result.resolved);
    } else {
      if (mode === 'strict') {
        return {
          ok: false,
          error: result.error,
          badPath: typeof raw === 'string' ? raw : undefined,
        };
      }
      dropped.push({ path: typeof raw === 'string' ? raw : String(raw), error: result.error });
    }
  }
  if (mode === 'filter') return { ok: true, resolved, dropped };
  return { ok: true, resolved };
}
