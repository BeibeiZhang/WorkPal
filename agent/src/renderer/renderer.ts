type ServerState = 'running' | 'idle' | 'port-busy';
type CertState = 'unknown' | 'not-installed' | 'installing' | 'installed' | 'error';
type UpdateState = 'unknown' | 'up-to-date' | 'available';

interface AgentStatus {
  version: string;
  state: ServerState;
  serverPort: number | null;
  serverError: string | null;
  portHolderPid: number | null;
  certState: CertState;
  certError: string | null;
  updateState: UpdateState;
  updateLatestVersion: string | null;
  updateDownloadUrl: string | null;
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
  installCa(): Promise<AgentStatus>;
  openLatestRelease(): Promise<void>;
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

/* 7.3: copy table for the Local HTTPS card. Body strings allow simple HTML
 * (the renderer uses .innerHTML for the body cell only — no user input
 * flows through). */
const CERT_COPY: Record<CertState, { tag: string; body: string }> = {
  unknown: {
    tag: 'Checking…',
    body: 'Checking certificate state…',
  },
  'not-installed': {
    tag: 'Setup needed',
    body: 'Browsers need a trusted local certificate to reach WorkPal Agent. macOS will pop a confirmation prompt.',
  },
  installing: {
    tag: 'Installing…',
    body: 'Approve the macOS confirmation prompt to continue.',
  },
  installed: {
    tag: 'Installed',
    body: 'Local certificate is trusted. The agent serves HTTPS to your browsers.',
  },
  error: {
    // body cell is filled from s.certError (carries the reinstall hint)
    tag: 'Failed',
    body: '',
  },
};

function applyCertCard(s: AgentStatus): void {
  const tag = $('cert-status');
  const tagText = $('cert-status-text');
  const body = $('cert-body');
  const btn = $<HTMLButtonElement>('install-ca');

  tag.dataset.state = s.certState;
  const copy = CERT_COPY[s.certState];
  tagText.textContent = copy.tag;
  if (s.certState === 'error' && s.certError) {
    // Carries the reinstall hint per setCertError() in serverState.
    body.textContent = s.certError;
  } else {
    body.innerHTML = copy.body;
  }

  // Per Beibei: no Reinstall affordance on installed state — uninstall.sh
  // owns the destructive path. Button is shown only when an action makes
  // sense: not-installed (start install) or error (retry install).
  if (s.certState === 'not-installed') {
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Install local certificate';
  } else if (s.certState === 'error') {
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Retry';
  } else if (s.certState === 'installing') {
    btn.hidden = false;
    btn.disabled = true;
    btn.textContent = 'Installing…';
  } else {
    // installed / unknown — no action button.
    btn.hidden = true;
  }
}

/* 7.5: Update card mirrors AgentStatus.updateState. Card is hidden unless
 * updateState === 'available' — 'unknown' (boot in progress / check
 * failed) and 'up-to-date' both hide the card so Settings stays compact
 * for the common case. */
function applyUpdateCard(s: AgentStatus): void {
  const card = $('update-card');
  if (s.updateState === 'available' && s.updateLatestVersion) {
    card.hidden = false;
    // Strip the leading 'v' for cleaner reading inside the uppercase
    // StatusTag (the card title carries the "version" framing already).
    $('update-version-tag').textContent = s.updateLatestVersion.replace(/^v/i, '');
  } else {
    card.hidden = true;
  }
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

  applyCertCard(s);
  applyUpdateCard(s);
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

  $('install-ca').addEventListener('click', async () => {
    const btn = $<HTMLButtonElement>('install-ca');
    if (btn.disabled) return;
    // Optimistic UI flip — the IPC handler will set 'installing' inside the
    // main process too, but the local flip avoids the multi-second sudo
    // dialog feeling like a frozen button. installCa() never throws across
    // the IPC boundary; it returns the updated AgentStatus either way.
    btn.disabled = true;
    btn.textContent = 'Installing…';
    try {
      const next = await window.agent.installCa();
      applyStatus(next);
      if (next.certState === 'installed') {
        showToast('Certificate installed');
      } else if (next.certState === 'error') {
        showToast('Install failed');
      }
    } catch (err) {
      // Defensive — IPC handler shouldn't throw (it converts to certError),
      // but if Electron itself drops the connection we surface a toast.
      showToast(`IPC failed: ${(err as Error).message}`);
    }
  });

  $('open-release').addEventListener('click', () => {
    // Fire-and-forget: openExternal can take ~200ms to hand off to launchd
    // (browser open is async on macOS), but the renderer doesn't need the
    // result. The IPC handler logs success / failure on the main side.
    void window.agent.openLatestRelease();
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
