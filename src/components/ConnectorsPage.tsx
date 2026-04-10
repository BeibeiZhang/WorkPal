import { useState } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';

/* ─── Connector data ─── */
interface Connector {
  id: string;
  name: string;
  description: string;
  logo: React.ReactNode;
}

/* Unified monochrome logo — uses system primary color */
function BrandLogo({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0 font-bold text-text-primary"
      style={{
        width: 36,
        height: 36,
        background: 'var(--color-bg-hover)',
        fontSize: 14,
        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {initial}
    </div>
  );
}

/* ─── Connector lists ─── */

const RECOMMENDED_APPS: Connector[] = [
  { id: 'slack', name: 'Slack', description: 'Send messages, search channels, and manage team communication', logo: <BrandLogo name="Slack" /> },
  { id: 'jira', name: 'Jira', description: 'Track issues, manage sprints, and streamline project workflows', logo: <BrandLogo name="Jira" /> },
  { id: 'notion', name: 'Notion', description: 'Access docs, databases, and wikis from your workspace', logo: <BrandLogo name="Notion" /> },
  { id: 'browser', name: 'My Browser', description: 'Access the web on your own browser', logo: <BrandLogo name="My Browser" /> },
];

const APP_CONNECTORS: Connector[] = [
  { id: 'gmail', name: 'Gmail', description: 'Draft replies, search your inbox, and summarize email threads instantly', logo: <BrandLogo name="Gmail" /> },
  { id: 'google-cal', name: 'Google Calendar', description: 'Understand your schedule, manage events, and optimize your time', logo: <BrandLogo name="Google Calendar" /> },
  { id: 'google-drive', name: 'Google Drive', description: 'Access your files, search instantly, and manage documents intelligently', logo: <BrandLogo name="Google Drive" /> },
  { id: 'asana', name: 'Asana', description: 'Track tasks, manage projects, and coordinate team workflows', logo: <BrandLogo name="Asana" /> },
  { id: 'zoom', name: 'Zoom', description: 'Schedule meetings, access recordings, and manage conference settings', logo: <BrandLogo name="Zoom" /> },
  { id: 'figma', name: 'Figma', description: 'Access design files, inspect components, and export assets', logo: <BrandLogo name="Figma" /> },
  { id: 'github', name: 'GitHub', description: 'Manage repos, review PRs, and track issues from your workspace', logo: <BrandLogo name="GitHub" /> },
  { id: 'linear', name: 'Linear', description: 'Track issues, plan cycles, and manage product development', logo: <BrandLogo name="Linear" /> },
  { id: 'confluence', name: 'Confluence', description: 'Search documentation, access team knowledge bases, and collaborate', logo: <BrandLogo name="Confluence" /> },
  { id: 'outlook-mail', name: 'Outlook Mail', description: 'Write, search, and manage your Outlook emails seamlessly', logo: <BrandLogo name="Outlook Mail" /> },
  { id: 'teams', name: 'Microsoft Teams', description: 'Chat, call, and collaborate with your team in one place', logo: <BrandLogo name="Microsoft Teams" /> },
  { id: 'dropbox', name: 'Dropbox', description: 'Store, share, and access your files from anywhere', logo: <BrandLogo name="Dropbox" /> },
];

interface APIConnector {
  id: string;
  name: string;
  description: string;
  logo: React.ReactNode;
}

const API_CONNECTORS: APIConnector[] = [
  { id: 'openai', name: 'OpenAI', description: 'Leverage GPT model series for intelligent text generation and processing', logo: <BrandLogo name="OpenAI" /> },
  { id: 'anthropic', name: 'Anthropic', description: 'Access reliable AI assistant services with safe and intelligent conversations', logo: <BrandLogo name="Anthropic" /> },
  { id: 'gemini', name: 'Google Gemini', description: 'Process multimodal content including text, images, and code seamlessly', logo: <BrandLogo name="Google Gemini" /> },
  { id: 'perplexity', name: 'Perplexity', description: 'Search real-time information and get accurate answers with reliable citations', logo: <BrandLogo name="Perplexity" /> },
  { id: 'cohere', name: 'Cohere', description: 'Build enterprise AI applications and optimize text processing workflows', logo: <BrandLogo name="Cohere" /> },
  { id: 'elevenlabs', name: 'ElevenLabs', description: 'Generate realistic voices, clone speech, and create custom audio content', logo: <BrandLogo name="ElevenLabs" /> },
];

/* ─── Tab type ─── */
type Tab = 'apps' | 'custom-api' | 'custom-mcp';

/* ─── ConnectorCard ─── */
function ConnectorCard({ connector }: { connector: Connector | APIConnector }) {
  return (
    <button
      className="flex items-center gap-4 p-4 rounded-2xl border transition-all text-left hover:shadow-sm group"
      style={{ borderColor: 'var(--color-stroke-outline)', background: 'var(--color-bg-page)' }}
    >
      {connector.logo}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-primary truncate" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
          {connector.name}
        </p>
        <p className="text-[13px] text-text-primary mt-0.5 line-clamp-2" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
          {connector.description}
        </p>
      </div>
    </button>
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
  const filterBySearch = <T extends { name: string; description: string }>(items: T[]) =>
    search ? items.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())) : items;

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
        <div className="flex items-center gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative pb-2 text-[15px] font-medium transition-colors"
              style={{
                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: 'var(--color-text-primary)' }}
                />
              )}
            </button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {filterBySearch(RECOMMENDED_APPS).map(c => <ConnectorCard key={c.id} connector={c} />)}
            </div>

            {/* All Apps */}
            <p className="text-[13px] font-medium text-text-primary mb-3 tracking-wide uppercase" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              Apps
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Add custom API card */}
              <button
                className="flex items-center gap-4 p-4 rounded-2xl border border-dashed transition-all text-left hover:shadow-sm"
                style={{ borderColor: 'var(--color-stroke-outline)' }}
              >
                <div
                  className="flex items-center justify-center rounded-xl shrink-0"
                  style={{ width: 36, height: 36 }}
                >
                  <Plus size={20} className="text-text-primary" />
                </div>
                <p className="text-[15px] font-semibold text-text-primary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                  Add custom API
                </p>
              </button>

              {filterBySearch(API_CONNECTORS).map(c => <ConnectorCard key={c.id} connector={c} />)}
            </div>
          </>
        )}

        {/* ── Custom MCP tab ── */}
        {activeTab === 'custom-mcp' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-text-secondary opacity-40">
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
