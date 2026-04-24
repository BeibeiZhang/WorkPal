import { promises as fs } from 'node:fs';
import { exec } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';
import { promisify } from 'node:util';
import { log } from './logger.js';

const execAsync = promisify(exec);

const LABEL = 'com.workpal.agent';
const PLIST_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

export function plistPath(): string {
  return PLIST_PATH;
}

function renderPlist(execPath: string): string {
  const logDir = path.join(os.homedir(), '.workpal-agent');
  const stdout = path.join(logDir, 'launchd.log');
  const stderr = path.join(logDir, 'launchd.err');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${execPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>ProcessType</key>
    <string>Interactive</string>
    <key>StandardOutPath</key>
    <string>${stdout}</string>
    <key>StandardErrorPath</key>
    <string>${stderr}</string>
</dict>
</plist>
`;
}

function parseExecFromPlist(xml: string): string | null {
  // ProgramArguments[0] is the first <string> inside the <array> after the ProgramArguments key.
  const match = xml.match(/<key>ProgramArguments<\/key>\s*<array>\s*<string>([^<]+)<\/string>/);
  return match ? match[1] : null;
}

async function uid(): Promise<string> {
  return String(os.userInfo().uid);
}

async function isBootstrapped(): Promise<boolean> {
  const u = await uid();
  try {
    const { stdout } = await execAsync(`launchctl print gui/${u}/${LABEL}`);
    return stdout.length > 0;
  } catch {
    return false;
  }
}

async function bootstrap(): Promise<void> {
  const u = await uid();
  await execAsync(`launchctl bootstrap gui/${u} "${PLIST_PATH}"`);
  await log('info', `launchd: bootstrapped ${LABEL}`);
}

async function bootout(): Promise<void> {
  const u = await uid();
  try {
    await execAsync(`launchctl bootout gui/${u}/${LABEL}`);
    await log('info', `launchd: booted out ${LABEL}`);
  } catch (err: unknown) {
    // "Could not find service" = already unloaded. Silent.
    const msg = (err as Error).message || '';
    if (/Could not find|No such process|not loaded/i.test(msg)) {
      await log('info', `launchd: ${LABEL} was not loaded (ok)`);
      return;
    }
    throw err;
  }
}

async function writePlist(execPath: string): Promise<void> {
  const dir = path.dirname(PLIST_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PLIST_PATH, renderPlist(execPath), { mode: 0o644 });
  await log('info', `launchd: wrote plist at ${PLIST_PATH} (exec=${execPath})`);
}

export async function readExistingPlistExec(): Promise<string | null> {
  try {
    const xml = await fs.readFile(PLIST_PATH, 'utf8');
    return parseExecFromPlist(xml);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function enableAutoLaunch(currentExec: string): Promise<void> {
  const existing = await readExistingPlistExec();
  const bootstrapped = await isBootstrapped();

  if (existing === currentExec && bootstrapped) {
    await log('info', 'launchd: already registered with matching path; no-op');
    return;
  }

  if (bootstrapped) await bootout();
  await writePlist(currentExec);
  await bootstrap();
}

export async function disableAutoLaunch(): Promise<void> {
  await bootout();
  try {
    await fs.unlink(PLIST_PATH);
    await log('info', `launchd: removed plist ${PLIST_PATH}`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/**
 * Self-heal: compare process.execPath against the plist ProgramArguments[0].
 * If the user moved the app (e.g. Downloads → /Applications), silently rewrite + rebootstrap.
 */
export async function reconcileAutoLaunch(currentExec: string, wantAutoLaunch: boolean): Promise<void> {
  if (!wantAutoLaunch) {
    const existing = await readExistingPlistExec();
    if (existing !== null) await disableAutoLaunch();
    return;
  }
  await enableAutoLaunch(currentExec);
}

export async function autoLaunchStatus(): Promise<{ plistExists: boolean; bootstrapped: boolean; execPath: string | null }> {
  const execPath = await readExistingPlistExec();
  const bootstrapped = await isBootstrapped();
  return { plistExists: execPath !== null, bootstrapped, execPath };
}
