interface AgentStatus {
  version: string;
  state: 'running' | 'idle';
  execPath: string;
  plistExec: string | null;
  autoLaunchBootstrapped: boolean;
}

interface ConfigView {
  hasApiKey: boolean;
  apiKeyPreview: string;
  autoLaunch: boolean;
}

interface AgentApi {
  getStatus(): Promise<AgentStatus>;
  getConfig(): Promise<ConfigView>;
  setApiKey(key: string): Promise<ConfigView>;
  setAutoLaunch(enabled: boolean): Promise<ConfigView>;
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

async function renderStatus(): Promise<void> {
  const s = await window.agent.getStatus();
  $('version').textContent = `v${s.version}`;
  const txt = $('status-text');
  const wrap = $('status');
  wrap.dataset.state = s.state;
  txt.textContent = s.state === 'running' ? 'Running' : 'Idle';
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
});

export {};
