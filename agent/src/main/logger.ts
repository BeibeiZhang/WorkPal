import { promises as fs } from 'fs';
import * as path from 'path';
import { configDir } from './config';

let logFilePath: string | null = null;

function timestamp(): string {
  return new Date().toISOString();
}

async function ensureLogFile(): Promise<string> {
  if (logFilePath) return logFilePath;
  const dir = configDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  logFilePath = path.join(dir, 'agent.log');
  return logFilePath;
}

export async function log(level: 'info' | 'warn' | 'error', msg: string): Promise<void> {
  const line = `[${timestamp()}] ${level.toUpperCase()} ${msg}`;
  // eslint-disable-next-line no-console
  console.log(line);
  try {
    const file = await ensureLogFile();
    await fs.appendFile(file, line + '\n', { mode: 0o600 });
  } catch {
    // disk full / perm issue — keep going, don't crash the agent
  }
}
