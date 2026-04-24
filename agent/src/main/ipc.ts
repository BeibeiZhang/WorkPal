import { app, ipcMain } from 'electron';
import { readConfig, updateConfig } from './config';
import { autoLaunchStatus, reconcileAutoLaunch } from './launchd';
import { tailMemory, log } from './logger';

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

export function registerIpc(opts: { onQuit: () => void; onRestart: () => void }) {
  ipcMain.handle('agent:getStatus', async () => {
    const ls = await autoLaunchStatus();
    return {
      version: app.getVersion(),
      state: 'running' as const,
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

  ipcMain.handle('agent:getLogs', async (_e, n: number = 20) => tailMemory(n));

  ipcMain.handle('agent:quit', async () => {
    await log('info', 'quit requested via IPC');
    opts.onQuit();
  });

  ipcMain.handle('agent:restart', async () => {
    await log('info', 'restart requested via IPC');
    opts.onRestart();
  });
}
