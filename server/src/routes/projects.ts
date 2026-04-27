import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listProjects,
  getProject,
  upsertProject,
  deleteProject,
  bulkUpsertProjects,
  type ProjectRecord,
} from '../lib/projectStore.js';
import { validateReferenceDirectories } from '../lib/referenceDirs.js';

const router = Router();

/** Validate `referenceDirectories` if present. Returns the resolved array
 *  on success (use this instead of the raw input so we persist canonical
 *  absolute paths). On failure, sends a 400 with the bilingual error and
 *  returns null so the caller can short-circuit. */
function validateRefDirsOrSend400(
  incoming: ProjectRecord,
  res: Response,
): string[] | null {
  const result = validateReferenceDirectories(incoming.referenceDirectories, 'strict');
  if (!result.ok) {
    res.status(400).json({
      error: result.error,
      badPath: result.badPath,
    });
    return null;
  }
  return result.resolved;
}

function requirePassword(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.MEMORY_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'MEMORY_PASSWORD not configured on server' });
    return;
  }
  const provided = req.header('x-memory-password');
  if (provided !== expected) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  next();
}

// Note: route ordering — the /projects/* router is mounted in server/index.ts
// alongside /api/project (singular, the existing init/openFile/openFolder
// routes). Keep paths distinct: /projects (this router) vs /project/* (legacy).

router.get('/projects', requirePassword, async (_req, res) => {
  try {
    const projects = await listProjects();
    res.json({ projects });
  } catch (err) {
    console.error('GET /projects failed', err);
    res.status(500).json({ error: 'Failed to read projects' });
  }
});

router.post('/projects/bulk-upsert', requirePassword, async (req, res) => {
  try {
    const body = req.body as { projects?: ProjectRecord[] };
    if (!Array.isArray(body?.projects)) {
      res.status(400).json({ error: 'Missing projects[]' });
      return;
    }
    const inserted = await bulkUpsertProjects(body.projects);
    res.json({ inserted });
  } catch (err) {
    console.error('POST /projects/bulk-upsert failed', err);
    res.status(500).json({ error: 'Failed to bulk-upsert projects' });
  }
});

router.post('/projects', requirePassword, async (req, res) => {
  try {
    const project = req.body as ProjectRecord;
    if (!project?.id || !project?.name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const refDirs = validateRefDirsOrSend400(project, res);
    if (refDirs === null) return;
    const saved = await upsertProject({
      ...project,
      files: project.files ?? [],
      outputs: project.outputs ?? [],
      referenceDirectories: refDirs,
    });
    res.json({ project: saved });
  } catch (err) {
    console.error('POST /projects failed', err);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

router.get('/projects/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await getProject(id);
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ project });
  } catch (err) {
    console.error('GET /projects/:id failed', err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

router.put('/projects/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const incoming = req.body as ProjectRecord;
    const refDirs = validateRefDirsOrSend400(incoming, res);
    if (refDirs === null) return;
    const saved = await upsertProject({
      ...incoming,
      id,
      files: incoming.files ?? [],
      outputs: incoming.outputs ?? [],
      referenceDirectories: refDirs,
    });
    res.json({ project: saved });
  } catch (err) {
    console.error('PUT /projects/:id failed', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/projects/:id', requirePassword, async (req, res) => {
  try {
    const id = String(req.params.id);
    const ok = await deleteProject(id);
    if (!ok) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /projects/:id failed', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
