import { contextBridge, ipcRenderer } from 'electron';

/** 7.2: three-state API server health.
 *   running    — listening on :serverPort, /api/* reachable.
 *   idle       — pre-startup or post-shutdown. Transient.
 *   port-busy  — bind failed (EADDRINUSE). Agent process itself is fine. */
export type ServerState = 'running' | 'idle' | 'port-busy';

/** 7.3: local-CA trust state, independent from ServerState (per Beibei
 *   clarify #2 — separate axis, separate Settings card).
 *   unknown        — pre-bootstrap; only seen during the first ~ms of boot.
 *   not-installed  — CA absent from System Keychain (first launch, or orphan
 *                    after a userData wipe). User clicks Install to trigger sudo.
 *   installing     — osascript dialog is up; awaiting password.
 *   installed      — CA present in Keychain AND its hash matches on-disk CA.
 *   error          — install cancelled / failed, or boot-time renewal failed.
 *                    `certError` carries the bilingual reason + reinstall hint. */
export type CertState = 'unknown' | 'not-installed' | 'installing' | 'installed' | 'error';

/** 7.5: GitHub Releases auto-update state — fourth independent axis (after
 *   server / cert / port). Driven by a single boot-time check against the
 *   GitHub API; renderer surfaces the Update card only when state ===
 *   'available'.
 *   unknown     — pre-check or check failed (network down, rate-limited,
 *                 GitHub outage). Card hidden — boot proceeds normally.
 *   up-to-date  — current version >= latest release tag. Card hidden.
 *   available   — newer release exists. Card visible with version + Download
 *                 button opening /releases/latest in the user's browser. */
export type UpdateState = 'unknown' | 'up-to-date' | 'available';

export interface AgentStatus {
  version: string;
  state: ServerState;
  /** Port the agent is bound to (or tried to bind to). Null before the first
   *  startApiServer() call completes. */
  serverPort: number | null;
  /** Human-readable error copy when state === 'port-busy'. Null otherwise. */
  serverError: string | null;
  /** PID of the process currently holding :3001, if we've looked it up.
   *  Populated lazily via agent:lookupPortHolder — don't block getStatus on it. */
  portHolderPid: number | null;
  /** Local-CA trust state (independent of `state`). */
  certState: CertState;
  /** Bilingual error copy when certState === 'error'. Null otherwise. */
  certError: string | null;
  /** Update-availability state (7.5, independent of all above). */
  updateState: UpdateState;
  /** Latest release tag when updateState === 'available' (e.g. "v0.1.1").
   *  Null otherwise. */
  updateLatestVersion: string | null;
  /** URL the Settings Update card "Download" button opens. We always point
   *  at the rolling /releases/latest URL (not a tag-pinned html_url) so a
   *  delay between boot check and click still lands on whatever's newest.
   *  Null when no update is available. */
  updateDownloadUrl: string | null;
  execPath: string;
  plistExec: string | null;
  autoLaunchBootstrapped: boolean;
}

export interface ConfigView {
  hasApiKey: boolean;
  apiKeyPreview: string;
  autoLaunch: boolean;
}

export interface PortHolderLookup {
  pid: number | null;
}

export interface AgentApi {
  getStatus(): Promise<AgentStatus>;
  getConfig(): Promise<ConfigView>;
  setApiKey(key: string): Promise<ConfigView>;
  setAutoLaunch(enabled: boolean): Promise<ConfigView>;
  retryServer(): Promise<AgentStatus>;
  lookupPortHolder(): Promise<PortHolderLookup>;
  /** Trigger the sudo flow to add the local CA into the System Keychain.
   *  Resolves with the latest AgentStatus (certState = 'installed' or
   *  'error'). Never throws across the IPC boundary — failures land in
   *  certError. */
  installCa(): Promise<AgentStatus>;
  /** 7.5: opens the GitHub /releases/latest URL in the user's default
   *  browser. Used by the Update card "Download" button. URL is hardcoded
   *  in the main process (constrained by design — renderer can't be tricked
   *  into opening arbitrary URLs through this bridge). */
  openLatestRelease(): Promise<void>;
  quit(): Promise<void>;
  restart(): Promise<void>;
}

const api: AgentApi = {
  getStatus: () => ipcRenderer.invoke('agent:getStatus'),
  getConfig: () => ipcRenderer.invoke('agent:getConfig'),
  setApiKey: (key) => ipcRenderer.invoke('agent:setApiKey', key),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('agent:setAutoLaunch', enabled),
  retryServer: () => ipcRenderer.invoke('agent:retryServer'),
  lookupPortHolder: () => ipcRenderer.invoke('agent:lookupPortHolder'),
  installCa: () => ipcRenderer.invoke('agent:installCa'),
  openLatestRelease: () => ipcRenderer.invoke('agent:openLatestRelease'),
  quit: () => ipcRenderer.invoke('agent:quit'),
  restart: () => ipcRenderer.invoke('agent:restart'),
};

contextBridge.exposeInMainWorld('agent', api);
