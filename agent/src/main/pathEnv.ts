import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { log } from './logger.js';

const execP = promisify(exec);

/* PATH harvesting for macOS menu-bar / launchd-started Electron apps.
 *
 * Problem: launchd hands GUI apps a minimal environment — PATH typically is
 *   /usr/bin:/bin:/usr/sbin:/sbin
 * which doesn't include /opt/homebrew/bin (Homebrew on Apple Silicon) or
 * /usr/local/bin (Intel Homebrew, also older tooling). So `execFile('git',
 * ...)` from inside the agent throws ENOENT on a Mac where `git --version`
 * works just fine in Terminal.
 *
 * Fix: on boot, ask the user's login shell to print its PATH, then merge the
 * result back into process.env.PATH. Future child_process.spawn() inherits
 * this enriched env automatically. One-shot cost at startup; every subsequent
 * git / claude-code-cli / node spawn benefits.
 *
 * Fallback: if the shell probe fails (exotic shell, first-run permission
 * prompt, etc.), we at least make sure the common Homebrew prefixes are on
 * PATH so the most likely git / node locations are reachable.
 */

const FALLBACK_PREFIXES = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

function uniquePrepend(existing: string, additions: string[]): string {
  const current = existing.split(':').filter(Boolean);
  const seen = new Set(current);
  const prepend: string[] = [];
  for (const p of additions) {
    if (!p) continue;
    if (!seen.has(p)) {
      prepend.push(p);
      seen.add(p);
    }
  }
  return [...prepend, ...current].join(':');
}

/** Spawn the user's login shell in interactive/login mode and print its PATH.
 *  `$SHELL` resolves to the user's default (zsh on modern macOS). `-i -c` is
 *  not ideal — interactive shell sourcing triggers rc files that may print
 *  noise; `-l -c` (login) is safer and still loads PATH-mutating profiles.
 *  The printf output is the last thing on stdout, so a final split on '\n'
 *  gives us a clean value even if `.zshenv` / `.zlogin` echoed anything. */
async function readShellPath(): Promise<string | null> {
  const shell = process.env.SHELL;
  if (!shell) return null;
  try {
    // 2-second budget is plenty for any shell-rc; beyond that the user has
    // something very weird and we'd rather fall back than hang boot.
    const { stdout } = await execP(`${shell} -l -c 'printf "%s" "$PATH"'`, {
      timeout: 2000,
    });
    const harvested = stdout.trim();
    if (!harvested) return null;
    // Last path-looking line wins — guards against rc-printed banners.
    const lines = harvested.split(/\r?\n/).filter((l) => l.includes('/'));
    return lines[lines.length - 1] ?? null;
  } catch (err) {
    await log('warn', `pathEnv: shell probe failed: ${String(err)}`);
    return null;
  }
}

/** Bootstrap PATH + homedir-tagged env so every subsequent child_process has
 *  the same shell env the user gets in Terminal. Called once from main.ts
 *  before app.whenReady() — before anything spawns git or the Claude SDK. */
export async function harvestShellEnv(): Promise<void> {
  const originalPath = process.env.PATH ?? '';
  const harvested = await readShellPath();
  const mergedBase = harvested ? uniquePrepend(originalPath, harvested.split(':')) : originalPath;
  const finalPath = uniquePrepend(mergedBase, FALLBACK_PREFIXES);
  process.env.PATH = finalPath;

  await log(
    'info',
    `pathEnv: shell=${process.env.SHELL ?? '(none)'} harvested=${harvested ? 'yes' : 'no'} PATH=${finalPath}`,
  );
}
