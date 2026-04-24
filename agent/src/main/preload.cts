import { contextBridge, ipcRenderer } from 'electron';

/** 7.2: three-state API server health.
 *   running    — listening on :serverPort, /api/* reachable.
 *   idle       — pre-startup or post-shutdown. Transient.
 *   port-busy  — bind failed (EADDRINUSE). Agent process itself is fine. */
export type ServerState = 'running' | 'idle' | 'port-busy';

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
  quit: () => ipcRenderer.invoke('agent:quit'),
  restart: () => ipcRenderer.invoke('agent:restart'),
};

contextBridge.exposeInMainWorld('agent', api);
