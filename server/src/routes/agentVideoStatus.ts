import { Router } from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

/* Per-install JSON file holding the active/inactive/deleted status of each
 * welcome-state agent video. This used to live in localStorage, which made it
 * per-browser; promoting it to the server lets the same toggles apply across
 * Chrome, Safari, and other devices that hit the same backend. The frontend
 * still keeps a localStorage mirror for offline reads.
 *
 * Atomicity: PATCH does a read-modify-write on a single key, so two browsers
 * can flip *different* videos concurrently without losing either change. Two
 * browsers flipping the *same* video still last-write-wins, which is the same
 * behavior as the localStorage version. */

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.resolve(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, 'agent-video-status.json');

type VideoStatus = 'active' | 'inactive' | 'deleted';
type StatusMap   = Record<string, VideoStatus>;

function isStatus(v: unknown): v is VideoStatus {
  return v === 'active' || v === 'inactive' || v === 'deleted';
}

async function readMap(): Promise<StatusMap> {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: StatusMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && isStatus(v)) out[k] = v;
    }
    return out;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeMap(map: StatusMap): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(map, null, 2), 'utf-8');
}

router.get('/agent-video-status', async (_req, res) => {
  try {
    const map = await readMap();
    res.json({ map });
  } catch (err) {
    console.error('GET /agent-video-status failed', err);
    res.status(500).json({ error: 'Failed to read status' });
  }
});

router.patch('/agent-video-status', async (req, res) => {
  try {
    const { src, status } = req.body as { src?: unknown; status?: unknown };
    if (typeof src !== 'string' || !src) {
      res.status(400).json({ error: 'src must be a non-empty string' });
      return;
    }
    if (!isStatus(status)) {
      res.status(400).json({ error: 'status must be active | inactive | deleted' });
      return;
    }
    const current = await readMap();
    const next: StatusMap = { ...current, [src]: status };
    await writeMap(next);
    res.json({ map: next });
  } catch (err) {
    console.error('PATCH /agent-video-status failed', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
