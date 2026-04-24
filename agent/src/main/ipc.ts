import { app, ipcMain } from 'electron';
import { readConfig, updateConfig } from './config.js';
import { autoLaunchStatus, reconcileAutoLaunch } from './launchd.js';
import { log } from './logger.js';
import { getServerState, findPortHolder } from './serverState.js';

function previewKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return key.slice(0, 4) + '…' + key.slice(-4);
}

async function buildConfigView() {
  const cfg = await readConfig();
  return {
    hasApiKey: cfg.anthropicApiKey.length > 0,
    apiKeyPreview: previewKey(cfg.anthropicApiKey),
    autoLaunch: cfg.autoLaunch,
  };
}

export function registerIpc(opts: {
  onQuit: () => void;
  onRestart: () => void;
  onRetryServer: () => Promise<void> | void;
}) {
  ipcMain.handle('agent:getStatus', async () => {
    const [ls, server] = await Promise.all([autoLaunchStatus(), Promise.resolve(getServerState())]);
    // Front-facing `state` now reflects the API server, not the process. The
    // process is always alive when this IPC responds — what the user cares
    // about in Settings is "is the local API listening for web-UI calls?".
    // `serverError` / `portHolderPid` drive the Port-busy copy + Retry button.
    return {
      version: app.getVersion(),
      state: server.state,
      serverPort: server.port,
      serverError: server.errorMessage,
      portHolderPid: server.portHolderPid,
      execPath: process.execPath,
      plistExec: ls.execPath,
      autoLaunchBootstrapped: ls.bootstrapped,
    };
  });

  ipcMain.handle('agent:getConfig', async () => buildConfigView());

  ipcMain.handle('agent:setApiKey', async (_e, key: string) => {
    await updateConfig({ anthropicApiKey: key });
    await log('info', `config: anthropicApiKey updated (${previewKey(key.trim())})`);
    return buildConfigView();
  });

  ipcMain.handle('agent:setAutoLaunch', async (_e, enabled: boolean) => {
    const cfg = await updateConfig({ autoLaunch: enabled });
    await reconcileAutoLaunch(process.execPath, cfg.autoLaunch);
    await log('info', `config: autoLaunch set to ${enabled}`);
    return buildConfigView();
  });

  ipcMain.handle('agent:retryServer', async () => {
    await log('info', 'server: retry requested via IPC');
    await opts.onRetryServer();
    return getServerState();
  });

  ipcMain.handle('agent:lookupPortHolder', async () => {
    // `lsof` lookup only fires on user request — running it speculatively on
    // every getStatus poll would be wasteful (it spawns a subprocess).
    const pid = await findPortHolder();
    return { pid };
  });

  ipcMain.handle('agent:quit', async () => {
    await log('info', 'quit requested via IPC');
    opts.onQuit();
  });

  ipcMain.handle('agent:restart', async () => {
    await log('info', 'restart requested via IPC');
    opts.onRestart();
  });
}
