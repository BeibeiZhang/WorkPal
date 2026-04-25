import { app, ipcMain } from 'electron';
import { readConfig, updateConfig } from './config.js';
import { autoLaunchStatus, reconcileAutoLaunch } from './launchd.js';
import { log } from './logger.js';
import {
  getServerState,
  findPortHolder,
  setCertInstalled,
  setCertInstalling,
  setCertError,
} from './serverState.js';
import { caKeychainStatus, installCaToKeychain } from './cert.js';

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
    // `certState` / `certError` drive the Local HTTPS card on a separate axis.
    return {
      version: app.getVersion(),
      state: server.state,
      serverPort: server.port,
      serverError: server.errorMessage,
      portHolderPid: server.portHolderPid,
      certState: server.certState,
      certError: server.certError,
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

  ipcMain.handle('agent:installCa', async () => {
    setCertInstalling();
    await log('info', 'cert: install requested via IPC — opening sudo prompt');
    try {
      await installCaToKeychain();
      // Re-detect to make absolutely sure the trust took: hash-compare the
      // on-disk CA against what's now in Keychain. If `security` says the
      // hash doesn't match (race or stale entry blocking the new one), we
      // surface that as an error rather than declaring success.
      const status = await caKeychainStatus();
      if (status === 'matching') {
        setCertInstalled();
      } else {
        setCertError(
          `Install completed but Keychain hash didn't verify (${status}). / 安装已完成但 Keychain 校验未通过 (${status})。`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await log('error', `cert: install failed — ${msg}`);
      setCertError(msg);
    }
    // Return latest full status so the renderer can re-render both cards in
    // one round-trip without a follow-up getStatus poll.
    const server = getServerState();
    const ls = await autoLaunchStatus();
    return {
      version: app.getVersion(),
      state: server.state,
      serverPort: server.port,
      serverError: server.errorMessage,
      portHolderPid: server.portHolderPid,
      certState: server.certState,
      certError: server.certError,
      execPath: process.execPath,
      plistExec: ls.execPath,
      autoLaunchBootstrapped: ls.bootstrapped,
    };
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
