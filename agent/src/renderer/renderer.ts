type ServerState = 'running' | 'idle' | 'port-busy';

interface AgentStatus {
  version: string;
  state: ServerState;
  serverPort: number | null;
  serverError: string | null;
  portHolderPid: number | null;
  execPath: string;
  plistExec: string | null;
  autoLaunchBootstrapped: boolean;
}

interface ConfigView {
  hasApiKey: boolean;
  apiKeyPreview: string;
  autoLaunch: boolean;
}

interface PortHolderLookup {
  pid: number | null;
}

interface AgentApi {
  getStatus(): Promise<AgentStatus>;
  getConfig(): Promise<ConfigView>;
  setApiKey(key: string): Promise<ConfigView>;
  setAutoLaunch(enabled: boolean): Promise<ConfigView>;
  retryServer(): Promise<AgentStatus>;
  lookupPortHolder(): Promise<PortHolderLookup>;
  quit(): Promise<void>;
  restart(): Promise<void>;
}

declare global {
  interface Window {
    agent: AgentApi;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

function showToast(msg: string): void {
  let node = document.querySelector('.wp-toast') as HTMLElement | null;
  if (!node) {
    node = document.createElement('div');
    node.className = 'wp-toast';
    document.body.appendChild(node);
  }
  node.textContent = msg;
  node.dataset.show = 'true';
  setTimeout(() => {
    if (node) node.dataset.show = 'false';
  }, 1600);
}

function labelForState(state: ServerState, port: number | null): string {
  if (state === 'running') return `Running · :${port ?? '?'}`;
  if (state === 'port-busy') return `Port ${port ?? '?'} busy`;
  return 'Starting…';
}

function applyStatus(s: AgentStatus): void {
  $('version').textContent = `v${s.version}`;
  const wrap = $('status');
  wrap.dataset.state = s.state;
  $('status-text').textContent = labelForState(s.state, s.serverPort);

  const errBlock = $('server-error');
  const errCopy = $('server-error-text');
  const errPid = $('server-error-pid');
  if (s.state === 'port-busy') {
    errBlock.hidden = false;
    errCopy.textContent = s.serverError ?? 'Server failed to start.';
    if (s.portHolderPid && s.portHolderPid > 0) {
      errPid.hidden = false;
      errPid.textContent = `Held by PID ${s.portHolderPid}`;
    } else {
      errPid.hidden = true;
    }
  } else {
    errBlock.hidden = true;
  }
}

async function renderStatus(): Promise<void> {
  const s = await window.agent.getStatus();
  applyStatus(s);
  // First time we render a port-busy state without a PID, kick off a lookup.
  // Running the lookup in parallel with the initial render keeps the PID line
  // from flickering in on a second render cycle.
  if (s.state === 'port-busy' && !s.portHolderPid) {
    void (async () => {
      try {
        await window.agent.lookupPortHolder();
        const next = await window.agent.getStatus();
        applyStatus(next);
      } catch {
        // lookup best-effort — silent on failure
      }
    })();
  }
}

async function renderConfig(): Promise<ConfigView> {
  const c = await window.agent.getConfig();
  const toggle = $<HTMLInputElement>('auto-launch');
  toggle.checked = c.autoLaunch;
  const hint = $('api-hint');
  if (c.hasApiKey) {
    hint.textContent = `Saved — ${c.apiKeyPreview}`;
    hint.dataset.state = 'set';
  } else {
    hint.textContent = 'Not set — paste a key to activate the agent.';
    hint.dataset.state = 'unset';
  }
  return c;
}

async function refresh(): Promise<void> {
  await Promise.all([renderStatus(), renderConfig()]);
}

function bindHandlers(): void {
  $('save-api-key').addEventListener('click', async () => {
    const input = $<HTMLInputElement>('api-key');
    const raw = input.value;
    if (!raw.trim()) {
      showToast('Paste a key first');
      return;
    }
    try {
      await window.agent.setApiKey(raw);
      input.value = '';
      await renderConfig();
      showToast('Key saved');
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`);
    }
  });

  $('api-key').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      $('save-api-key').click();
    }
  });

  $<HTMLInputElement>('auto-launch').addEventListener('change', async (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    try {
      await window.agent.setAutoLaunch(enabled);
      showToast(enabled ? 'Auto-start enabled' : 'Auto-start disabled');
    } catch (err) {
      showToast(`Failed: ${(err as Error).message}`);
      await renderConfig();
    }
  });

  $('retry-server').addEventListener('click', async () => {
    const btn = $<HTMLButtonElement>('retry-server');
    btn.disabled = true;
    btn.textContent = 'Retrying…';
    try {
      const next = await window.agent.retryServer();
      applyStatus(next);
      if (next.state === 'running') {
        showToast('Server started');
      } else {
        showToast('Still blocked — check the PID shown');
      }
    } catch (err) {
      showToast(`Retry failed: ${(err as Error).message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Retry';
    }
  });

  $('restart').addEventListener('click', () => {
    void window.agent.restart();
  });

  $('quit').addEventListener('click', () => {
    void window.agent.quit();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindHandlers();
  void refresh();
  // Poll every 2s so the status flips to Running as soon as `startApiServer`
  // finishes on the main side (it's non-awaited, so the Settings window can
  // open with state=idle for a beat). Cheap — IPC roundtrip.
  setInterval(() => {
    void renderStatus();
  }, 2000);
});

export {};
