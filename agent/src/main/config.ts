import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface AgentConfig {
  anthropicApiKey: string;
  autoLaunch: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), '.workpal-agent');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS: AgentConfig = {
  anthropicApiKey: '',
  autoLaunch: true,
};

export function configDir(): string {
  return CONFIG_DIR;
}

export function configPath(): string {
  return CONFIG_PATH;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

export async function readConfig(): Promise<AgentConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AgentConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULTS };
    throw err;
  }
}

export async function writeConfig(cfg: AgentConfig): Promise<void> {
  await ensureDir();
  const sanitized: AgentConfig = {
    anthropicApiKey: cfg.anthropicApiKey.trim(),
    autoLaunch: cfg.autoLaunch,
  };
  const tmp = CONFIG_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(sanitized, null, 2), { mode: 0o600 });
  await fs.rename(tmp, CONFIG_PATH);
  await fs.chmod(CONFIG_PATH, 0o600);
}

export async function updateConfig(patch: Partial<AgentConfig>): Promise<AgentConfig> {
  const current = await readConfig();
  const next: AgentConfig = { ...current, ...patch };
  if (typeof patch.anthropicApiKey === 'string') {
    next.anthropicApiKey = patch.anthropicApiKey.trim();
  }
  await writeConfig(next);
  return next;
}
