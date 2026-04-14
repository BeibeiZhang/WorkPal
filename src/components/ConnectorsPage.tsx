import { useState } from 'react';
import { Search, Plus, ChevronDown, Globe } from 'lucide-react';
import { iconAsana, iconGmail, iconZoom, iconDoc20, iconSheet } from '../assets';
import { FilterChip, StatusTag } from './shared';

/* ─── Connector data ─── */
interface Connector {
  id: string;
  name: string;
  /** Official site domain — logo is fetched directly from this site's favicon */
  domain?: string;
  /** When true, show Connected tag instead of Connect button */
  connected?: boolean;
}

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
  { id: 'gmail', name: 'Gmail', domain: 'mail.google.com', connected: true },
  { id: 'google-cal', name: 'Google Calendar', domain: 'calendar.google.com' },
  { id: 'google-docs', name: 'Google Docs', domain: 'docs.google.com', connected: true },
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

/* ─── ConnectorCard ─── compact spec: icon + name + Connected tag / Connect button */
function ConnectorCard({ connector }: { connector: Connector }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border border-stroke-outline"
      style={{ background: 'var(--color-bg-page)' }}
    >
      <BrandLogo id={connector.id} name={connector.name} domain={connector.domain} />
      <span
        className="flex-1 text-[13px] text-text-primary font-medium truncate"
        style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
      >
        {connector.name}
      </span>
      {connector.connected ? (
        <StatusTag variant="success" label="Connected" size="sm" showIcon={false} />
      ) : (
        <button className="text-[11px] px-3 py-1 rounded-full border border-stroke-outline text-text-primary hover:bg-bg-hover transition-colors">
          Connect
        </button>
      )}
    </div>
  );
}

/* ─── Main page ─── */
interface ConnectorsPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function ConnectorsPage({ sidebarOpen, onToggleSidebar }: ConnectorsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('apps');
  const [search, setSearch] = useState('');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'apps', label: 'Apps' },
    { id: 'custom-api', label: 'Custom API' },
    { id: 'custom-mcp', label: 'Custom MCP' },
  ];

  /* Filter connectors by search */
  const filterBySearch = <T extends { name: string }>(items: T[]) =>
    search ? items.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full" style={{ background: 'var(--color-bg-page)' }}>

      {/* Header bar — toggle only */}
      <div className="flex items-center gap-4 px-4 h-12 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors shrink-0 text-text-primary"
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor"/>
              <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>

      {/* Page title — Agent Design style */}
      <div className="px-8 pb-2 shrink-0">
        <h1
          className="text-[40px] font-bold text-text-primary leading-[48px] tracking-[-0.5px]"
          style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          Connectors
        </h1>
      </div>

      {/* Tabs + Search row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between px-8 pt-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {tabs.map(tab => (
            <FilterChip
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[14px] w-full md:w-[200px]"
          style={{ background: 'var(--color-bg-hover)' }}
        >
          <Search size={16} className="shrink-0 text-text-primary" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[14px] text-text-primary placeholder-text-secondary"
          />
        </div>
      </div>


      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {/* ── Apps tab ── */}
        {activeTab === 'apps' && (
          <>
            {/* Recommended */}
            <p className="text-[13px] font-medium text-text-primary mb-3 tracking-wide uppercase" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              Recommended
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-8">
              {filterBySearch(RECOMMENDED_APPS).map(c => <ConnectorCard key={c.id} connector={c} />)}
            </div>

            {/* All Apps */}
            <p className="text-[13px] font-medium text-text-primary mb-3 tracking-wide uppercase" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              Apps
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filterBySearch(APP_CONNECTORS).map(c => <ConnectorCard key={c.id} connector={c} />)}
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
                <path d="M15 7h3a5 5 0 0 1 0 10h-3M9 17H6a5 5 0 0 1 0-10h3"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
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

              {filterBySearch(API_CONNECTORS).map(c => <ConnectorCard key={c.id} connector={c} />)}
            </div>
          </>
        )}

        {/* ── Custom MCP tab ── */}
        {activeTab === 'custom-mcp' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-text-primary opacity-40">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 7h3a5 5 0 0 1 0 10h-3M9 17H6a5 5 0 0 1 0-10h3"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41"/>
              </svg>
            </div>
            <p className="text-[15px] text-text-primary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              No custom MCP added yet.
            </p>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] font-medium text-white transition-colors"
              style={{ background: 'var(--color-text-primary)' }}
            >
              <Plus size={16} />
              Add custom MCP
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
