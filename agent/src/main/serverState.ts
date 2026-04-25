import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ServerState } from './preload.cjs';

const execP = promisify(exec);

/* In-memory server lifecycle state shared between server.ts (writer) and
 * ipc.ts (reader). Plain module-level singletons intentionally — this isn't
 * state the renderer reloads across restarts (a relaunch rebuilds it from
 * scratch), so a class + getInstance dance would add nothing.
 *
 * ipc.ts polls getServerState() inside the agent:getStatus handler; server.ts
 * flips the fields through setState() on listen success, listen error, and
 * the retry path.
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
}

let current: State = {
  state: 'idle',
  port: null,
  errorMessage: null,
  portHolderPid: null,
};

export function getServerState(): State {
  return { ...current };
}

export function setServerRunning(port: number): void {
  current = { state: 'running', port, errorMessage: null, portHolderPid: null };
}

export function setServerIdle(): void {
  current = { state: 'idle', port: null, errorMessage: null, portHolderPid: null };
}

export function setServerPortBusy(port: number, message: string): void {
  current = {
    state: 'port-busy',
    port,
    errorMessage: message,
    // Preserve a previously-looked-up PID if we have one, so Retry → Retry
    // doesn't flash "(no PID)" between lookups. Cleared by successful start.
    portHolderPid: current.portHolderPid,
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
