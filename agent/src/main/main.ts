import { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme, shell } from 'electron';
import * as path from 'path';
import { readConfig } from './config';
import { reconcileAutoLaunch, autoLaunchStatus, plistPath } from './launchd';
import { registerIpc } from './ipc';
import { log } from './logger';

const VERSION = app.getVersion();
const IS_DEV = !app.isPackaged;

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let isQuitting = false;

function rendererFile(): string {
  return path.join(__dirname, '..', 'dist-renderer', 'index.html');
}

function preloadFile(): string {
  return path.join(__dirname, 'preload.js');
}

function assetsDir(): string {
  return path.join(__dirname, '..', 'assets');
}

function buildTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(assetsDir(), 'menuIconTemplate.png');
  const img = nativeImage.createFromPath(iconPath);
  img.setTemplateImage(true);
  return img;
}

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 420,
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

  await app.whenReady();

  registerIpc({
    onQuit: () => quitApp(),
    onRestart: () => restartApp(),
  });

  createTray();
  await log('info', `tray: created (version ${VERSION})`);

  void bootstrapAutoLaunch();

  // First-launch onboarding: if no API key yet, show settings on first boot.
  const cfg = await readConfig();
  if (!cfg.anthropicApiKey) {
    await log('info', 'onboarding: no API key — surfacing settings window');
    showSettings();
  }

  app.on('window-all-closed', () => {
    // Menu-bar app: closing the Settings window must NOT quit.
    // On macOS the default is already to stay alive; the BrowserWindow
    // 'close' handler in createSettingsWindow hides rather than destroys.
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal boot error', err);
  app.exit(1);
});
