import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ServerState, CertState, UpdateState } from './preload.cjs';

const execP = promisify(exec);

/* In-memory server lifecycle state shared between server.ts (writer) and
 * ipc.ts (reader). Plain module-level singletons intentionally — this isn't
 * state the renderer reloads across restarts (a relaunch rebuilds it from
 * scratch), so a class + getInstance dance would add nothing.
 *
 * ipc.ts polls getServerState() inside the agent:getStatus handler; server.ts
 * flips the fields through setState() on listen success, listen error, and
 * the retry path.
 *
 * 7.3: certState lives here too as an INDEPENDENT axis (per Beibei clarify
 * #2 — don't union into `state`). Server-listen state and CA-trust state
 * change for unrelated reasons (port collisions vs sudo cancel) and the
 * renderer surfaces them in two separate cards, so they need to be set/read
 * independently.
 *
 * 7.5: updateState is the fourth such axis. The boot-time GitHub Releases
 * check (updateCheck.ts) is the sole writer; it flips state from the default
 * 'unknown' to 'up-to-date' or 'available' and stores the latest tag +
 * download URL. Renderer surfaces the Update card only when 'available'.
 */

interface State {
  state: ServerState;
  port: number | null;
  /** One-line copy the Settings window surfaces beside the "Port busy" tag.
   *  Empty on success. */
  errorMessage: string | null;
  /** PID of whoever currently holds :3001. Null until the renderer explicitly
   *  asks (agent:lookupPortHolder) — lsof is a subprocess so don't spawn it
   *  on every status poll. */
  portHolderPid: number | null;
  /** Local-CA trust status. 'unknown' until cert bootstrap runs; then one of
   *  installed/not-installed. Flips to 'installing' while osascript awaits
   *  the user's password, and 'error' on cancel / install failure / boot-time
   *  renewal failure. Independent of `state` above. */
  certState: CertState;
  /** Bilingual copy shown beside the Local HTTPS tag in cert-error. Always
   *  ends with a "建议重装 / reinstall recommended" hint per clarify #4 so
   *  the user has a clear next step instead of staring at bare "Failed". */
  certError: string | null;
  /** 7.5: GitHub Releases check result. */
  updateState: UpdateState;
  /** Latest release tag (e.g. "v0.1.1") when updateState === 'available'. */
  updateLatestVersion: string | null;
  /** /releases/latest URL the Update card "Download" button opens. */
  updateDownloadUrl: string | null;
}

let current: State = {
  state: 'idle',
  port: null,
  errorMessage: null,
  portHolderPid: null,
  certState: 'unknown',
  certError: null,
  updateState: 'unknown',
  updateLatestVersion: null,
  updateDownloadUrl: null,
};

export function getServerState(): State {
  return { ...current };
}

export function setServerRunning(port: number): void {
  current = {
    ...current,
    state: 'running',
    port,
    errorMessage: null,
    portHolderPid: null,
  };
}

export function setServerIdle(): void {
  current = {
    ...current,
    state: 'idle',
    port: null,
    errorMessage: null,
    portHolderPid: null,
  };
}

export function setServerPortBusy(port: number, message: string): void {
  current = {
    ...current,
    state: 'port-busy',
    port,
    errorMessage: message,
    // Preserve a previously-looked-up PID if we have one, so Retry → Retry
    // doesn't flash "(no PID)" between lookups. Cleared by successful start.
    portHolderPid: current.portHolderPid,
  };
}

const REINSTALL_HINT = ' Try reinstalling WorkPal Agent.';

export function setCertInstalled(): void {
  current = { ...current, certState: 'installed', certError: null };
}

export function setCertNotInstalled(): void {
  current = { ...current, certState: 'not-installed', certError: null };
}

export function setCertInstalling(): void {
  current = { ...current, certState: 'installing', certError: null };
}

/** `reason` should already be bilingual (the install / renewal paths build
 *  bilingual messages). We tack on the reinstall hint here so every error
 *  the user sees ends with concrete next-step copy (clarify #4). */
export function setCertError(reason: string): void {
  const msg = reason.endsWith('。') || reason.endsWith('.') ? reason : reason + '.';
  current = { ...current, certState: 'error', certError: msg + REINSTALL_HINT };
}

/** 7.5: boot check completed and we're already running the latest. Card
 *  hidden in this state — there's nothing for the user to do. */
export function setUpdateUpToDate(): void {
  current = {
    ...current,
    updateState: 'up-to-date',
    updateLatestVersion: null,
    updateDownloadUrl: null,
  };
}

/** 7.5: a newer release exists. Settings shows the Update card with the
 *  version + Download button opening `downloadUrl`. */
export function setUpdateAvailable(latestVersion: string, downloadUrl: string): void {
  current = {
    ...current,
    updateState: 'available',
    updateLatestVersion: latestVersion,
    updateDownloadUrl: downloadUrl,
  };
}

/** Shell out to `lsof` to find the process holding :3001 (or whichever port
 *  serverState currently targets). Returns null if nothing's listening, if
 *  lsof isn't available, or if we can't parse the output. Users see the PID
 *  in the Settings "Port busy" card so they know which process to close.
 *
 *  Not automatic — called only by the agent:lookupPortHolder IPC, triggered
 *  by the renderer after port-busy state is detected. */
export async function findPortHolder(): Promise<number | null> {
  const port = current.port ?? 3001;
  try {
    // `-iTCP:3001 -sTCP:LISTEN` restricts to listeners; `-P -n` skips DNS +
    // service-name lookups (faster + deterministic output); `-t` prints just
    // the PID, one per line. First PID wins if multiple bind (shouldn't
    // happen on a single port).
    const { stdout } = await execP(`lsof -iTCP:${port} -sTCP:LISTEN -P -n -t`, {
      timeout: 2000,
    });
    const pidStr = stdout.trim().split(/\r?\n/)[0];
    const pid = pidStr ? parseInt(pidStr, 10) : NaN;
    if (!Number.isFinite(pid) || pid <= 0) {
      current = { ...current, portHolderPid: null };
      return null;
    }
    current = { ...current, portHolderPid: pid };
    return pid;
  } catch {
    // lsof returns exit code 1 when nothing matches — that's "no listener",
    // not a failure. Either way, report null.
    current = { ...current, portHolderPid: null };
    return null;
  }
}
