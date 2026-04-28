import { Router } from 'express';
import { mkdir } from 'node:fs/promises';
import { indexProjectOutputs, initProjectIfNeeded, resolveProjectFolder } from '../lib/project.js';

const router = Router();

// POST /api/project/init — 6.1: make sure ~/WorkPal/<projectSlug>/ exists and
// holds a git repo with a baseline commit. Called fire-and-forget by the
// frontend on project create and on project open (idempotent, so double-firing
// is intentional belt-and-braces). Subsequent 6.X endpoints (worktree add in
// 6.2, merge in 6.3) assume this has succeeded at least once.
router.post('/project/init', async (req, res) => {
  const { projectSlug } = req.body as { projectSlug?: unknown };
  const check = resolveProjectFolder(projectSlug);
  if (!check.ok) {
    res.status(400).json({ error: check.reason });
    return;
  }
  const projectPath = check.resolved;

  try {
    // The base folder itself may not exist yet: on "create new project" the
    // frontend calls us before any chat has written anything on disk. mkdir
    // before init so `git init` has a cwd.
    await mkdir(projectPath, { recursive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[project/init] mkdir failed for ${projectPath}:`, message);
    res.status(500).json({
      error: `Failed to create project folder: ${message}`,
    });
    return;
  }

  try {
    await initProjectIfNeeded(projectPath);
    console.log(`[project/init] ok ${projectPath}`);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[project/init] git init failed for ${projectPath}:`, message);
    res.status(500).json({
      error: `Failed to initialize project repo: ${message}`,
    });
  }
});

// POST /api/project/scan-outputs — §31: best-effort filename → absolute-path
// recovery for legacy OutputItem rows that pre-date §23 (when we started
// stamping `path` on commit). The frontend posts the names of every output
// missing a path; we walk `~/WorkPal/<projectSlug>/sessions/` once and return
// only the names with exactly one match. 0 / multiple matches are dropped so
// the caller never overwrites with a wrong path. Always responds 200 on a
// valid slug, even if sessions/ is missing or no names match — the scan is
// non-essential and shouldn't surface as an error in the UI.
router.post('/project/scan-outputs', async (req, res) => {
  const { projectSlug, names } = req.body as {
    projectSlug?: unknown;
    names?: unknown;
  };
  const check = resolveProjectFolder(projectSlug);
  if (!check.ok) {
    res.status(400).json({ error: check.reason });
    return;
  }
  if (!Array.isArray(names) || names.some((n) => typeof n !== 'string')) {
    res.status(400).json({ error: 'names must be an array of strings / names 必须是字符串数组' });
    return;
  }
  if (names.length === 0) {
    res.json({ matches: [] });
    return;
  }
  try {
    const index = await indexProjectOutputs(check.resolved);
    const matches: { name: string; path: string }[] = [];
    for (const name of names as string[]) {
      const hits = index.get(name);
      if (hits && hits.length === 1) {
        matches.push({ name, path: hits[0] });
      }
    }
    console.log(
      `[project/scan-outputs] ${check.resolved} matched ${matches.length}/${names.length}`,
    );
    res.json({ matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[project/scan-outputs] walk failed for ${check.resolved}:`, message);
    res.status(500).json({ error: `Failed to scan project outputs: ${message}` });
  }
});

export default router;
