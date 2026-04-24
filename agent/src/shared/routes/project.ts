import { Router } from 'express';
import { mkdir } from 'node:fs/promises';
import { initProjectIfNeeded, resolveProjectFolder } from '../lib/project.js';

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
      error: `Failed to create project folder: ${message} / 创建 project 目录失败: ${message}`,
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
      error: `Failed to initialize project repo: ${message} / 初始化 project 仓库失败: ${message}`,
    });
  }
});

export default router;
