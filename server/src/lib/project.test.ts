import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listProjectMainDeliverables } from './project.js';

const execFileP = promisify(execFile);

describe('listProjectMainDeliverables — §44', () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), 'wp-proj-test-'));
    await execFileP('git', ['init', '-q'], { cwd: projectPath });
    await execFileP('git', ['config', 'user.email', 'test@local'], { cwd: projectPath });
    await execFileP('git', ['config', 'user.name', 'Test'], { cwd: projectPath });
    await execFileP(
      'git',
      ['commit', '--allow-empty', '-q', '-m', 'baseline'],
      { cwd: projectPath },
    );
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it('returns deliverable filenames from main branch', async () => {
    await writeFile(join(projectPath, 'resume.md'), '# Resume');
    await writeFile(join(projectPath, 'report.html'), '<h1>Report</h1>');
    await execFileP('git', ['add', '.'], { cwd: projectPath });
    await execFileP('git', ['commit', '-q', '-m', 'add deliverables'], { cwd: projectPath });

    const result = await listProjectMainDeliverables(projectPath);
    assert.deepEqual(result.sort(), ['report.html', 'resume.md']);
  });

  it('excludes subdirectory files', async () => {
    await mkdir(join(projectPath, 'outputs'), { recursive: true });
    await mkdir(join(projectPath, 'sessions'), { recursive: true });
    await writeFile(join(projectPath, 'outputs', 'index.html'), '<html>');
    await writeFile(join(projectPath, 'sessions', 'notes.md'), '# Notes');
    await execFileP('git', ['add', '.'], { cwd: projectPath });
    await execFileP('git', ['commit', '-q', '-m', 'add subdirs'], { cwd: projectPath });

    const result = await listProjectMainDeliverables(projectPath);
    assert.deepEqual(result, []);
  });

  it('excludes scaffolding (package.json, tsconfig.json)', async () => {
    await writeFile(join(projectPath, 'package.json'), '{}');
    await writeFile(join(projectPath, 'tsconfig.json'), '{}');
    await writeFile(join(projectPath, 'real.md'), '# Real');
    await execFileP('git', ['add', '.'], { cwd: projectPath });
    await execFileP('git', ['commit', '-q', '-m', 'add mix'], { cwd: projectPath });

    const result = await listProjectMainDeliverables(projectPath);
    assert.deepEqual(result, ['real.md']);
  });

  it('returns empty array when main branch has no files', async () => {
    const result = await listProjectMainDeliverables(projectPath);
    assert.deepEqual(result, []);
  });

  it('throws when path is not a git repo', async () => {
    const noGitDir = await mkdtemp(join(tmpdir(), 'wp-nogit-'));
    try {
      await assert.rejects(
        () => listProjectMainDeliverables(noGitDir),
      );
    } finally {
      await rm(noGitDir, { recursive: true, force: true });
    }
  });
});
