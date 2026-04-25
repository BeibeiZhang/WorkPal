import { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme, shell } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from './config.js';
import { reconcileAutoLaunch, autoLaunchStatus, plistPath } from './launchd.js';
import { registerIpc } from './ipc.js';
import { log } from './logger.js';
import { startApiServer, stopApiServer, retryApiServer, setCertMaterial } from './server.js';
import { harvestShellEnv } from './pathEnv.js';
import { bootstrapCerts, caKeychainStatus } from './cert.js';
import { bootstrapUpdateCheck } from './updateCheck.js';
import {
  getServerState,
  setCertInstalled,
  setCertNotInstalled,
  setCertError,
} from './serverState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = app.getVersion();
const IS_DEV = !app.isPackaged;

// After 7.2: tsconfig rootDir expands from `src/main` to `src` so shared route
// code compiles alongside main. Output layout:
//   agent/dist-main/main/main.js            ← this file
//   agent/dist-main/main/preload.cjs
//   agent/dist-main/shared/routes/*.js
//   agent/dist-renderer/index.html          (sibling of dist-main)
//   agent/assets/*.png                      (sibling of dist-main)
// Packaged .app follows the same relative layout inside app.asar, so
// `path.resolve(__dirname, '..', '..')` reaches the project root in both.
function appRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let isQuitting = false;

function rendererFile(): string {
  return path.join(appRoot(), 'dist-renderer', 'index.html');
}

function preloadFile(): string {
  // `.cjs` because preload scripts must be CommonJS when sandbox:true — the
  // sandboxed V8 context preload runs in doesn't support ESM. The rest of the
  // agent main compiles to ESM (package.json `type: module`) so the Claude
  // Agent SDK (pure ESM) can be imported without dynamic-import gymnastics.
  return path.join(__dirname, 'preload.cjs');
}

function assetsDir(): string {
  return path.join(appRoot(), 'assets');
}

function buildTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(assetsDir(), 'menuIconTemplate.png');
  const img = nativeImage.createFromPath(iconPath);
  img.setTemplateImage(true);
  return img;
}

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    // 7.3: bumped 420 → 560 for the new Local HTTPS card. Three full-width
    // cards (Status / API key / Local HTTPS) + footer fit at 560 with no
    // scrollbar; tunable up if Beibei wants more breathing room in live test.
    width: 480,
    height: 560,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'WorkPal Agent',
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: preloadFile(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(rendererFile()).catch((err) => {
    void log('error', `loadFile failed: ${String(err)}`);
  });

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function ensureSettingsWindow(): BrowserWindow {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    settingsWindow = createSettingsWindow();
  }
  return settingsWindow;
}

function showSettings(): void {
  const win = ensureSettingsWindow();
  win.show();
  win.focus();
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `WorkPal Agent v${VERSION}`, enabled: false },
    { type: 'separator' },
    { label: 'Open Settings', click: () => showSettings() },
    { type: 'separator' },
    { label: 'Quit', click: () => quitApp() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`WorkPal Agent v${VERSION}`);
}

function createTray(): void {
  tray = new Tray(buildTrayIcon());
  rebuildTrayMenu();
  tray.on('click', () => showSettings());

  nativeTheme.on('updated', () => {
    // template image auto-inverts; no icon swap needed.
    // rebuild menu only if we ever want theme-dependent labels.
  });
}

function quitApp(): void {
  isQuitting = true;
  void log('info', 'quit: tearing down tray + windows');
  if (tray) {
    tray.destroy();
    tray = null;
  }
  for (const w of BrowserWindow.getAllWindows()) {
    w.destroy();
  }
  app.quit();
}

function restartApp(): void {
  void log('info', 'restart: relaunching');
  app.relaunch();
  isQuitting = true;
  app.exit(0);
}

async function bootstrapAutoLaunch(): Promise<void> {
  const cfg = await readConfig();
  const before = await autoLaunchStatus();
  await log(
    'info',
    `boot: execPath=${process.execPath} plist=${plistPath()} existingExec=${before.execPath ?? '(none)'} bootstrapped=${before.bootstrapped} wantAutoLaunch=${cfg.autoLaunch}`,
  );

  if (IS_DEV) {
    await log('info', 'boot: dev mode — skipping launchd registration');
    return;
  }

  try {
    await reconcileAutoLaunch(process.execPath, cfg.autoLaunch);
  } catch (err) {
    await log('error', `boot: launchd reconcile failed: ${String(err)}`);
  }
}

function setupSingleInstanceLock(): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    void log('warn', 'single-instance: another WorkPal Agent is already running; exiting');
    app.quit();
    return false;
  }
  app.on('second-instance', () => {
    void log('info', 'second-instance: surfacing settings window');
    showSettings();
  });
  return true;
}

async function main(): Promise<void> {
  if (!setupSingleInstanceLock()) return;

  // LSUIElement is in Info.plist for packaged builds; dock.hide() covers dev mode.
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  // 7.2: harvest PATH from user's login shell before anything spawns `git` /
  // `claude-code-cli`. launchd-started GUI apps inherit a minimal PATH
  // (/usr/bin:/bin:/usr/sbin:/sbin) that misses Homebrew's /opt/homebrew/bin
  // and any shell-installed tooling. This is a well-known macOS-GUI trap; we
  // fix it once at boot so every subsequent child_process.spawn sees the full
  // PATH the user has in Terminal.
  await harvestShellEnv();

  await app.whenReady();

  registerIpc({
    onQuit: () => quitApp(),
    onRestart: () => restartApp(),
    onRetryServer: () => retryApiServer(),
  });

  createTray();
  await log('info', `tray: created (version ${VERSION})`);

  void bootstrapAutoLaunch();

  // 7.5: GitHub Releases boot check. Non-awaited — completes in ~5s
  // (timeout) at most; result populates the updateState axis, which the
  // Settings 5th card surfaces only when 'available'. Failures (network
  // down, rate limit, GitHub outage) leave state at 'unknown' and the card
  // hidden; nothing here can block boot.
  void bootstrapUpdateCheck();

  // 7.3: bootstrap CA + server leaf BEFORE startApiServer (HTTPS listener
  // can't bind without cert material). bootstrapCerts() always returns a
  // usable bundle — fresh-generated on first launch, reused on subsequent,
  // renewed in place if leaf is <30d. Renewal failure leaves the old
  // (still-valid) bundle in place and surfaces certError; HTTPS keeps
  // working until the leaf actually expires.
  let certBootstrapped = false;
  try {
    const result = await bootstrapCerts();
    setCertMaterial({ key: result.bundle.serverKeyPem, cert: result.bundle.serverCertPem });
    certBootstrapped = true;
    if (result.renewalError) {
      // Per clarify #1: renewal-success is silent, only failure surfaces.
      setCertError(`Cert renewal failed / 证书续期失败: ${result.renewalError}`);
    } else {
      // Detect Keychain trust independently (orphan / first-launch / installed).
      const status = await caKeychainStatus();
      if (status === 'matching') {
        setCertInstalled();
      } else {
        // Both 'absent' and 'mismatch' funnel to the same "click Install"
        // UX — installing the on-disk CA into Keychain auto-heals either
        // case (a stale orphan entry just gets shadowed by the new one).
        setCertNotInstalled();
        await log('info', `cert: keychain status=${status} — surfacing install card`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `cert: bootstrap failed — ${msg}`);
    setCertError(`Cert bootstrap failed / 证书初始化失败: ${msg}`);
    // Without cert material, the HTTPS listener cannot start. Skip
    // startApiServer — Settings will show cert-error and the user has the
    // reinstall hint to act on. Agent stays alive so the user can quit cleanly.
  }

  if (certBootstrapped) {
    // 7.2: start local HTTPS API on 127.0.0.1:3001. Non-awaited — if
    // EADDRINUSE (Beibei also runs `npm --prefix server run dev` on the same
    // port), the server records the failure in serverState and keeps the
    // agent alive so Settings can show a "Port busy" state with a Retry button.
    void startApiServer();
  }

  // First-launch onboarding: surface Settings whenever the user has
  // something to act on — missing API key OR cert in any non-installed
  // state. Reading certState (set above by the bootstrap try/catch) is the
  // canonical signal: it covers fresh / silent-renewal / renewal-fail /
  // bootstrap-throw uniformly, including the case where the CA is still
  // trusted in Keychain but boot-time renewal failed (HTTPS keeps working
  // for ~30 days, but we want the user to see the cert-error card now —
  // not the day it actually breaks). Replaces an earlier `caKeychainStatus()`
  // re-probe that missed this case.
  const cfg = await readConfig();
  const certNeedsInstall = getServerState().certState !== 'installed';
  if (!cfg.anthropicApiKey || certNeedsInstall) {
    await log(
      'info',
      `onboarding: surfacing settings (apiKey=${cfg.anthropicApiKey ? 'set' : 'missing'}, certState=${getServerState().certState})`,
    );
    showSettings();
  }

  app.on('window-all-closed', () => {
    // Menu-bar app: closing the Settings window must NOT quit.
    // On macOS the default is already to stay alive; the BrowserWindow
    // 'close' handler in createSettingsWindow hides rather than destroys.
  });

  app.on('before-quit', () => {
    isQuitting = true;
    // Best-effort close of the Express listener so the port is free for the
    // next launch. Fire-and-forget — `before-quit` is synchronous from
    // Electron's perspective, but stopApiServer resolves fast in practice.
    void stopApiServer();
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal boot error', err);
  app.exit(1);
});
