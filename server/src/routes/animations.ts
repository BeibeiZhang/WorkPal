import { Router, type Request, type Response, type NextFunction } from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const router = Router();

/* Animations live in the Vite static asset dir at the repo root.
 * From this file (server/src/routes/animations.ts) up three levels = repo root.
 * Resolved once at module load so we can reuse it for the path-traversal
 * guard below (every request resolves the requested file inside this dir
 * and verifies it didn't escape). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANIMATIONS_DIR = path.resolve(__dirname, '../../../public/animations');

/** Same gate the connector mutations use — physical file deletion is
 *  destructive and shouldn't be possible from an unauthenticated browser. */
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

/** DELETE /api/animations/:filename
 *  Removes an .mp4 from public/animations/ on disk. The frontend uses this
 *  when the user hits "Delete" on a video row in the Design System — it's
 *  the difference between *deactivating* (status flip in localStorage) and
 *  truly removing the asset.
 *
 *  Defense in depth against path traversal:
 *    1. path.basename strips any directory components.
 *    2. We require a .mp4 suffix so other assets can't be reached.
 *    3. We re-resolve and assert the absolute path stays under ANIMATIONS_DIR
 *       even after `path.basename` (defensive — basename should already make
 *       this impossible, but cheap to verify).
 */
router.delete('/animations/:filename', requirePassword, async (req, res) => {
  try {
    const raw = String(req.params.filename ?? '');
    const safe = path.basename(raw);
    if (!safe || safe !== raw) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }
    if (!safe.toLowerCase().endsWith('.mp4')) {
      res.status(400).json({ error: 'Only .mp4 files can be deleted' });
      return;
    }
    const target = path.resolve(ANIMATIONS_DIR, safe);
    if (!target.startsWith(ANIMATIONS_DIR + path.sep)) {
      res.status(400).json({ error: 'Path traversal blocked' });
      return;
    }
    try {
      await fs.unlink(target);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        res.status(404).json({ error: 'File not found', filename: safe });
        return;
      }
      throw err;
    }
    res.json({ ok: true, deleted: safe });
  } catch (err) {
    console.error('DELETE /animations failed', err);
    res.status(500).json({ error: 'Failed to delete animation' });
  }
});

export default router;
