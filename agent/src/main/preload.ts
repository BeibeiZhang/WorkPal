import { contextBridge, ipcRenderer } from 'electron';

export interface AgentStatus {
  version: string;
  state: 'running' | 'idle';
  execPath: string;
  plistExec: string | null;
  autoLaunchBootstrapped: boolean;
}

export interface ConfigView {
  hasApiKey: boolean;
  apiKeyPreview: string;
  autoLaunch: boolean;
}

export interface AgentApi {
  getStatus(): Promise<AgentStatus>;
  getConfig(): Promise<ConfigView>;
  setApiKey(key: string): Promise<ConfigView>;
  setAutoLaunch(enabled: boolean): Promise<ConfigView>;
  getLogs(n?: number): Promise<string[]>;
  quit(): Promise<void>;
  restart(): Promise<void>;
}

const api: AgentApi = {
  getStatus: () => ipcRenderer.invoke('agent:getStatus'),
  getConfig: () => ipcRenderer.invoke('agent:getConfig'),
  setApiKey: (key) => ipcRenderer.invoke('agent:setApiKey', key),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('agent:setAutoLaunch', enabled),
  getLogs: (n = 20) => ipcRenderer.invoke('agent:getLogs', n),
  quit: () => ipcRenderer.invoke('agent:quit'),
  restart: () => ipcRenderer.invoke('agent:restart'),
};

contextBridge.exposeInMainWorld('agent', api);
