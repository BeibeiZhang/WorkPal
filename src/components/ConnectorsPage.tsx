import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown, Globe } from 'lucide-react';
import { iconAsana, iconGmail, iconZoom, iconDoc20, iconSheet } from '../assets';
import { FilterChip, ConnectorCard, SecondaryButton, PageLayout, SearchBox } from './shared';
import { fetchConnectors, connectMock, disconnect, googleAuthStartUrl, ConnectorAuthError } from '../lib/connectors';
import { useMemoryAuth } from '../lib/useMemoryAuth';

/* ─── Connector data ─── */
interface Connector {
  id: string;
  name: string;
  /** Official site domain — logo is fetched directly from this site's favicon */
  domain?: string;
  /** When true, show Connected tag instead of Connect button */
  connected?: boolean;
}

/** Connectors that go through the real Google OAuth popup instead of the
 *  800ms mock spinner. Must match server/src/routes/connectors.ts's
 *  OAUTH_CONNECTORS set. */
const OAUTH_IDS = new Set<string>(['gmail', 'google-cal']);

/* Local icon library — prefer these over remote favicons when available.
   Keys match Connector.id. */
const LOCAL_ICONS: Record<string, string> = {
  gmail: iconGmail,
  asana: iconAsana,
  zoom: iconZoom,
  'google-docs': iconDoc20,
  'google-sheets': iconSheet,
};

/* Brand logo — prefers a local SVG from the icon library; falls back to
   Google's favicon service for connectors without a library asset. */
function BrandLogo({ id, name, domain }: { id: string; name: string; domain?: string }) {
  const localIcon = LOCAL_ICONS[id];
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-hover shrink-0 overflow-hidden">
      {localIcon ? (
        <img src={localIcon} alt={`${name} logo`} className="w-5 h-5 object-contain" />
      ) : domain ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt={`${name} logo`}
          className="w-5 h-5 object-contain"
        />
      ) : (
        <Globe size={18} className="text-text-primary" />
      )}
    </div>
  );
}

/* ─── Connector lists ─── */

const RECOMMENDED_APPS: Connector[] = [
  { id: 'slack', name: 'Slack', domain: 'slack.com' },
  { id: 'jira', name: 'Jira', domain: 'atlassian.com' },
  { id: 'notion', name: 'Notion', domain: 'notion.so' },
  { id: 'browser', name: 'My Browser' },
];

const APP_CONNECTORS: Connector[] = [
  { id: 'gmail', name: 'Gmail', domain: 'mail.google.com' },
  { id: 'google-cal', name: 'Google Calendar', domain: 'calendar.google.com' },
  { id: 'google-docs', name: 'Google Docs', domain: 'docs.google.com' },
  { id: 'google-sheets', name: 'Google Sheets', domain: 'sheets.google.com' },
  { id: 'google-drive', name: 'Google Drive', domain: 'drive.google.com' },
  { id: 'asana', name: 'Asana', domain: 'asana.com' },
  { id: 'zoom', name: 'Zoom', domain: 'zoom.us' },
  { id: 'figma', name: 'Figma', domain: 'figma.com' },
  { id: 'github', name: 'GitHub', domain: 'github.com' },
  { id: 'linear', name: 'Linear', domain: 'linear.app' },
  { id: 'confluence', name: 'Confluence', domain: 'confluence.atlassian.com' },
  { id: 'outlook-mail', name: 'Outlook Mail', domain: 'outlook.com' },
  { id: 'teams', name: 'Microsoft Teams', domain: 'teams.microsoft.com' },
  { id: 'dropbox', name: 'Dropbox', domain: 'dropbox.com' },
];

const API_CONNECTORS: Connector[] = [
  { id: 'openai', name: 'OpenAI', domain: 'openai.com' },
  { id: 'anthropic', name: 'Anthropic', domain: 'anthropic.com' },
  { id: 'gemini', name: 'Google Gemini', domain: 'gemini.google.com' },
  { id: 'perplexity', name: 'Perplexity', domain: 'perplexity.ai' },
  { id: 'cohere', name: 'Cohere', domain: 'cohere.com' },
  { id: 'elevenlabs', name: 'ElevenLabs', domain: 'elevenlabs.io' },
];

/* ─── Tab type ─── */
type Tab = 'apps' | 'custom-api' | 'custom-mcp';

/* ─── Main page ─── */
interface ConnectorsPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
}

export default function ConnectorsPage({ sidebarOpen, onToggleSidebar, onNewChat }: ConnectorsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('apps');
  const [search, setSearch] = useState('');
  /** Map of connector id → true when user-initiated flow is in flight (mock
   *  delay or OAuth popup). Drives the inline spinner pill. */
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  /** Canonical connected-state map from the server. Merged over the static
   *  lists above at render time — absence here means disconnected. */
  const [statusMap, setStatusMap] = useState<Record<string, 'connected' | 'disconnected'>>({});
  const { ensurePassword, passwordModal } = useMemoryAuth();

  const refresh = useCallback(async () => {
    try {
      const list = await fetchConnectors();
      const next: Record<string, 'connected' | 'disconnected'> = {};
      for (const c of list) next[c.id] = c.status;
      setStatusMap(next);
    } catch (err) {
      console.warn('Failed to load connectors', err);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Mark a connector as in-flight for the visual spinner state.
  const setIsConnecting = (id: string, flag: boolean) => {
    setConnecting((prev) => {
      const next = { ...prev };
      if (flag) next[id] = true;
      else delete next[id];
      return next;
    });
  };

  /** Handles the OAuth popup flow: opens a 500x700 window to the start URL,
   *  listens for the `postMessage` the callback page sends, and polls the
   *  status endpoint every 2s (max 60s) as a fallback in case postMessage is
   *  blocked (COOP, ad-blockers, sandboxed iframes). Resolves when the
   *  connector shows up as connected or the timeout elapses. */
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);
  const openGoogleOAuth = useCallback(async (id: 'gmail' | 'google-cal') => {
    setIsConnecting(id, true);
    const startUrl = googleAuthStartUrl(id);
    const features = 'width=500,height=700,menubar=no,toolbar=no,location=no,status=no';
    const popup = window.open(startUrl, 'workpal-oauth', features);
    popupRef.current = popup;

    let resolved = false;
    const cleanup = () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      window.removeEventListener('message', onMessage);
      setIsConnecting(id, false);
    };
    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      void refresh();
      if (!ok) {
        console.warn(`OAuth flow for ${id} did not complete before timeout`);
      }
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      if ((data as { source?: unknown }).source !== 'workpal-oauth') return;
      finish((data as { status?: unknown }).status === 'ok');
    };
    window.addEventListener('message', onMessage);

    // Fallback polling — hits /api/connectors every 2s, up to 60s total.
    let elapsed = 0;
    pollRef.current = window.setInterval(async () => {
      elapsed += 2000;
      try {
        const list = await fetchConnectors();
        const row = list.find((c) => c.id === id);
        if (row?.status === 'connected') { finish(true); return; }
      } catch { /* ignore — keep polling until timeout */ }
      if (elapsed >= 60_000) { finish(false); return; }
      if (popup && popup.closed && elapsed >= 4_000) { finish(false); return; }
    }, 2000);
  }, [refresh]);

  const handleConnect = useCallback(async (id: string) => {
    if (OAUTH_IDS.has(id)) {
      await openGoogleOAuth(id as 'gmail' | 'google-cal');
      return;
    }
    let password: string;
    try {
      password = await ensurePassword({
        message: 'Connecting an integration requires the password you set.',
      });
    } catch {
      return;
    }
    setIsConnecting(id, true);
    // 800ms deliberate pause so the "Connecting…" pill reads as an action,
    // not an instant flip.
    await new Promise((r) => setTimeout(r, 800));
    try {
      await connectMock(id, password);
      await refresh();
    } catch (err) {
      if (err instanceof ConnectorAuthError) {
        console.warn('Wrong password while connecting', id);
      } else {
        console.error('Failed to connect', id, err);
      }
    } finally {
      setIsConnecting(id, false);
    }
  }, [ensurePassword, openGoogleOAuth, refresh]);

  const handleDisconnect = useCallback(async (id: string) => {
    let password: string;
    try {
      password = await ensurePassword({
        message: 'Disconnecting an integration requires the password you set.',
      });
    } catch {
      return;
    }
    setIsConnecting(id, true);
    try {
      await disconnect(id, password);
      await refresh();
    } catch (err) {
      console.error('Failed to disconnect', id, err);
    } finally {
      setIsConnecting(id, false);
    }
  }, [ensurePassword, refresh]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'apps', label: 'Apps' },
    { id: 'custom-api', label: 'Custom API' },
    { id: 'custom-mcp', label: 'Custom MCP' },
  ];

  /* Merge server-side status onto the hardcoded lists. */
  const withStatus = useCallback((items: Connector[]): Connector[] => items.map((c) => ({
    ...c,
    connected: statusMap[c.id] === 'connected' || (!(c.id in statusMap) && c.connected === true),
  })), [statusMap]);

  /* Filter connectors by search */
  const filterBySearch = <T extends { name: string }>(items: T[]) =>
    search ? items.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) : items;

  const renderCard = (c: Connector) => (
    <ConnectorCard
      key={c.id}
      name={c.name}
      connected={c.connected}
      connecting={!!connecting[c.id]}
      onConnect={() => void handleConnect(c.id)}
      onDisconnect={() => void handleDisconnect(c.id)}
      logo={<BrandLogo id={c.id} name={c.name} domain={c.domain} />}
    />
  );

  return (
    <>
      <PageLayout
        title="Connectors"
        bgClass="app-bg"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onNewChat={onNewChat}
        rightSlot={<SearchBox value={search} onChange={setSearch} placeholder="Search" />}
        filters={
          <div className="flex items-center gap-2 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible scrollbar-autohide -mx-4 sm:mx-0 px-4 sm:px-0">
            {tabs.map((tab) => (
              <FilterChip
                key={tab.id}
                label={tab.label}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        }
      >
        {/* ── Apps tab ── */}
        {activeTab === 'apps' && (
          <>
            {/* Recommended */}
            <p className="text-[13px] font-medium text-text-primary mb-3 tracking-wide uppercase" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              Recommended
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-8">
              {filterBySearch(withStatus(RECOMMENDED_APPS)).map(renderCard)}
            </div>

            {/* All Apps */}
            <p className="text-[13px] font-medium text-text-primary mb-3 tracking-wide uppercase" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              Apps
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filterBySearch(withStatus(APP_CONNECTORS)).map(renderCard)}
            </div>
          </>
        )}

        {/* ── Custom API tab ── */}
        {activeTab === 'custom-api' && (
          <>
            {/* Info banner */}
            <div
              className="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-6"
              style={{ background: 'var(--color-bg-hover)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 7h3a5 5 0 0 1 0 10h-3M9 17H6a5 5 0 0 1 0-10h3" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <p className="text-[14px] text-text-primary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                Connect WorkPal to any third-party service using your own API keys.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Add custom API card */}
              <button
                className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed border-stroke-outline hover:bg-bg-hover transition-colors text-left"
                style={{ background: 'var(--color-bg-page)' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-hover shrink-0">
                  <Plus size={16} className="text-text-primary" />
                </div>
                <span
                  className="flex-1 text-[13px] text-text-primary font-medium"
                  style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  Add custom API
                </span>
              </button>

              {filterBySearch(withStatus(API_CONNECTORS)).map(renderCard)}
            </div>
          </>
        )}

        {/* ── Custom MCP tab ── */}
        {activeTab === 'custom-mcp' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-text-primary opacity-40">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 7h3a5 5 0 0 1 0 10h-3M9 17H6a5 5 0 0 1 0-10h3" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41" />
              </svg>
            </div>
            <p className="text-[15px] text-text-primary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              No custom MCP added yet.
            </p>
            <SecondaryButton className="gap-2">
              <Plus size={16} />
              Add custom MCP
              <ChevronDown size={14} />
            </SecondaryButton>
          </div>
        )}
      </PageLayout>
      {passwordModal}
    </>
  );
}
