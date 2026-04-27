import { Router } from 'express';
import { dialog, BrowserWindow } from 'electron';

/** §17 native folder picker. Lives in agent/main (NOT in shared/) because
 *  it imports `electron` — the dev server (server/src/) doesn't have
 *  Electron available. Dev mode falls back to a typed text input on the
 *  client side when this endpoint returns 404 (route never mounted there).
 *
 *  Wire shape: POST /api/pick-folder → { ok: true, path } on success,
 *  { ok: false, reason: 'cancelled' } when the user dismisses the picker.
 *  No path validation here — the validator at server/src/lib/referenceDirs.ts
 *  runs server-side both at save and at use time. This endpoint just
 *  surfaces the user's choice. */

const router = Router();

router.post('/pick-folder', async (_req, res) => {
  try {
    // Modal to the focused window when one exists (Settings panel is the
    // only window in this menu-bar app, opened on demand). When no window
    // is open, fall back to a modeless picker — still works on macOS.
    const focused = BrowserWindow.getFocusedWindow();
    const result = focused
      ? await dialog.showOpenDialog(focused, {
          properties: ['openDirectory'],
          message: 'Pick a reference folder for this project',
        })
      : await dialog.showOpenDialog({
          properties: ['openDirectory'],
          message: 'Pick a reference folder for this project',
        });

    if (result.canceled || result.filePaths.length === 0) {
      res.json({ ok: false, reason: 'cancelled' });
      return;
    }

    res.json({ ok: true, path: result.filePaths[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown picker error';
    res.status(500).json({ ok: false, reason: 'error', error: message });
  }
});

export default router;
