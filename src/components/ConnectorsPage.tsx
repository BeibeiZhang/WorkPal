import { useState } from 'react';
import { Search, Plus, Link, ChevronDown } from 'lucide-react';

/* ─── Connector data ─── */
interface Connector {
  id: string;
  name: string;
  description: string;
  logo: React.ReactNode;
}

/* Small helper: coloured circle with letter(s) */
function LogoCircle({ bg, color, children, size = 36 }: { bg: string; color: string; children: React.ReactNode; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0 font-bold"
      style={{ width: size, height: size, background: bg, color, fontSize: size * 0.4 }}
    >
      {children}
    </div>
  );
}

/* Inline SVG logos for well-known brands */
const GmailLogo = () => (
  <div className="w-9 h-9 flex items-center justify-center shrink-0">
    <img src="/icons/gmail.svg" alt="Gmail" className="w-7 h-7 object-contain" />
  </div>
);

const GoogleCalendarLogo = () => (
  <div className="w-9 h-9 flex items-center justify-center shrink-0">
    <img src="/icons/calendar.svg" alt="Google Calendar" className="w-7 h-7 object-contain" />
  </div>
);

const AsanaLogo = () => (
  <div className="w-9 h-9 flex items-center justify-center shrink-0">
    <img src="/icons/asana.svg" alt="Asana" className="w-7 h-7 object-contain" />
  </div>
);

const ZoomLogo = () => (
  <div className="w-9 h-9 flex items-center justify-center shrink-0">
    <img src="/icons/zoom.svg" alt="Zoom" className="w-7 h-7 object-contain" />
  </div>
);

/* SVG-based logos for key brands */
const SlackLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#000" size={36}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.521-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" fill="#2EB67D"/>
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.527 2.527 0 0 1-2.521-2.522 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z" fill="#ECB22E"/>
    </svg>
  </LogoCircle>
);

const JiraLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#000" size={36}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M11.53.87l-.53.53-8 8a.75.75 0 000 1.06l8 8 .53.53.53-.53 8-8a.75.75 0 000-1.06l-8-8L11.53.87z" fill="#2684FF"/>
      <path d="M12 7.8L8.2 11.6l-.1.1a.75.75 0 000 1.06l.1.1L12 16.7l3.8-3.8.1-.1a.75.75 0 000-1.06l-.1-.1L12 7.8z" fill="url(#jira-grad)"/>
      <defs><linearGradient id="jira-grad" x1="11.3" y1="9" x2="8.5" y2="12.8" gradientUnits="userSpaceOnUse"><stop stopColor="#0052CC"/><stop offset="1" stopColor="#2684FF"/></linearGradient></defs>
    </svg>
  </LogoCircle>
);

const NotionLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#000" size={36}>
    <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
      <path d="M6.017 4.313l55.333-4.09c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z" fill="#fff"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M61.35.223l-55.333 4.09C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l12.817 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.433-.387 6.99-2.917 6.99-7.193V20.637c0-2.21-.86-2.84-3.303-4.617L75.5 3.587C71.227.387 69.48-.193 62.683.39L61.35.223z" fill="#fff"/>
      <path d="M85.713 17.81c.583 0 .776.39.776.967v61.243c0 2.53-1.36 3.883-3.883 3.883L27.767 87.4c-1.943.097-2.917-.387-3.887-1.747l-9.127-12.057c-.777-1.167-.97-1.943-.97-3.113V18.193c0-1.75.583-2.917 2.527-3.113l58.887-4.277c.193 0 .387 0 .583.193l9.933 6.813zM37.27 30.383c0 1.75-.193 2.14-1.167 2.333l-3.887.777v48.6c3.497 1.943 6.413 3.113 10.103 3.113 5.437 0 7.38-1.75 11.653-7.38l17.86-28.02v26.66l-3.69.777s0 2.723 3.887 2.723l10.683-.777c.583-1.75 0-4.277-1.167-4.667l-2.917-.58V33.107l-4.08.387c-.583 1.75.193 4.277-2.527 4.667L62.083 39.52 44.613 67.34V33.3l-5.243-.777c-.583-1.557-.193-3.5-2.1-2.14z" fill="#000"/>
    </svg>
  </LogoCircle>
);

const FigmaLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#000" size={36}>
    <svg width="16" height="22" viewBox="0 0 38 57" fill="none">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/>
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83"/>
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262"/>
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/>
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/>
    </svg>
  </LogoCircle>
);

const LinearLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#000" size={36}>
    <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
      <path d="M1.22541 61.5228c-.12042-.2471-.00739-.5406.24711-.6611l17.3339-8.2024c.2545-.1205.5406-.0074.6611.2471l2.7102 5.7064c.1205.2471.0074.5406-.2471.6611L4.59688 67.4763c-.25452.1205-.54067.0074-.66109-.2471l-2.71038-5.7064z" fill="#5E6AD2"/>
      <path d="M100 50c0 27.6142-22.3858 50-50 50S0 77.6142 0 50 22.3858 0 50 0s50 22.3858 50 50zm-9.09-5.69L29.69 9.09C17.08 16.74 8.55 30.4 8.55 46.03c0 .39.01.78.02 1.16L68.48 87.1c1.78-.79 3.48-1.7 5.1-2.72L18.47 12.79 90.91 44.31c-.02-2.26-.19-4.48-.5-6.66L24.1 7.35 87.33 53.79c-.82-2.28-1.83-4.46-3.02-6.51L17.84 9.15l73.07 38.17V50l-.01-5.69z" fill="#5E6AD2"/>
    </svg>
  </LogoCircle>
);

const GoogleDriveLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#000" size={36}>
    <svg width="20" height="18" viewBox="0 0 87.3 78" fill="none">
      <path d="M6.6 66.85L3.3 72.6c-.7 1.2-.7 2.6 0 3.8.7 1.2 1.9 2 3.3 2.2h58.5c1.4-.2 2.6-1 3.3-2.2L56.8 52.6H0l6.6 14.25z" fill="#0066DA"/>
      <path d="M43.65 25.05L29.05 0 14.45 25.05 43.65 78l14.6-25.05L43.65 25.05z" fill="#00AC47"/>
      <path d="M73.55 78c.73-.1 1.4-.4 2-.8.6-.4 1.1-.9 1.4-1.5L87.3 56.4c.7-1.2.7-2.6 0-3.8L58.2 0 43.65 25.05 73.55 78z" fill="#EA4335"/>
      <path d="M43.65 25.05L58.2 0H29.05L14.45 25.05h29.2z" fill="#00832D"/>
      <path d="M56.8 52.6l-13.15-27.55H14.45L0 52.6h56.8z" fill="#2684FC"/>
      <path d="M43.65 78l29.9 0-14.75-25.4-15.15-27.55L43.65 78z" fill="#FFBA00"/>
    </svg>
  </LogoCircle>
);

const OutlookLogo = () => (
  <LogoCircle bg="#0078D4" color="#fff" size={36}>
    <span className="font-bold text-[16px]">O</span>
  </LogoCircle>
);

const DropboxLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#0061FF" size={36}>
    <svg width="18" height="16" viewBox="0 0 43 40" fill="#0061FF">
      <path d="M12.6 0L0 8.3l8.6 6.9 12.6-7.8L12.6 0zM0 22.1l12.6 8.3 8.6-7.1-12.6-7.8L0 22.1zM21.2 23.3l8.6 7.1 12.6-8.3-8.6-6.9-12.6 8.1zM42.4 8.3L29.8 0l-8.6 7.4 12.6 7.8 8.6-6.9zM21.3 25l-8.7 7.1-3.9-2.6v2.9l12.6 7.5 12.6-7.5v-2.9l-3.9 2.6L21.3 25z"/>
    </svg>
  </LogoCircle>
);

const GitHubLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#24292F" size={36}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#24292F">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  </LogoCircle>
);

const ConfluenceLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#1868DB" size={36}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M.87 18.257c-.248.382-.531.838-.75 1.195a.603.603 0 0 0 .195.828l4.17 2.55a.61.61 0 0 0 .84-.18c.203-.332.473-.79.764-1.29 1.399-2.425 2.8-2.142 5.326-.96l4.063 1.907a.614.614 0 0 0 .8-.3l1.897-4.39a.6.6 0 0 0-.3-.79c-1.245-.578-3.673-1.707-5.94-2.77C7.21 11.777 3.18 14.293.87 18.257z" fill="#1868DB"/>
      <path d="M23.131 5.743c.247-.382.53-.838.75-1.195a.603.603 0 0 0-.195-.828l-4.17-2.55a.61.61 0 0 0-.84.18c-.203.332-.473.79-.764 1.29-1.399 2.425-2.8 2.142-5.326.96L8.523 1.693a.614.614 0 0 0-.8.3L5.826 6.383a.6.6 0 0 0 .3.79c1.245.578 3.673 1.707 5.94 2.77 4.725 2.28 8.755-.237 11.065-4.2z" fill="#1868DB"/>
    </svg>
  </LogoCircle>
);

const MicrosoftTeamsLogo = () => (
  <LogoCircle bg="#464EB8" color="#fff" size={36}>
    <span className="font-bold text-[14px]">T</span>
  </LogoCircle>
);

const BrowserLogo = () => (
  <LogoCircle bg="#F8F8F8" color="#666" size={36}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  </LogoCircle>
);

/* ─── Connector lists ─── */

const RECOMMENDED_APPS: Connector[] = [
  { id: 'slack', name: 'Slack', description: 'Send messages, search channels, and manage team communication', logo: <SlackLogo /> },
  { id: 'jira', name: 'Jira', description: 'Track issues, manage sprints, and streamline project workflows', logo: <JiraLogo /> },
  { id: 'notion', name: 'Notion', description: 'Access docs, databases, and wikis from your workspace', logo: <NotionLogo /> },
  { id: 'browser', name: 'My Browser', description: 'Access the web on your own browser', logo: <BrowserLogo /> },
];

const APP_CONNECTORS: Connector[] = [
  { id: 'gmail', name: 'Gmail', description: 'Draft replies, search your inbox, and summarize email threads instantly', logo: <GmailLogo /> },
  { id: 'google-cal', name: 'Google Calendar', description: 'Understand your schedule, manage events, and optimize your time', logo: <GoogleCalendarLogo /> },
  { id: 'google-drive', name: 'Google Drive', description: 'Access your files, search instantly, and manage documents intelligently', logo: <GoogleDriveLogo /> },
  { id: 'asana', name: 'Asana', description: 'Track tasks, manage projects, and coordinate team workflows', logo: <AsanaLogo /> },
  { id: 'zoom', name: 'Zoom', description: 'Schedule meetings, access recordings, and manage conference settings', logo: <ZoomLogo /> },
  { id: 'figma', name: 'Figma', description: 'Access design files, inspect components, and export assets', logo: <FigmaLogo /> },
  { id: 'github', name: 'GitHub', description: 'Manage repos, review PRs, and track issues from your workspace', logo: <GitHubLogo /> },
  { id: 'linear', name: 'Linear', description: 'Track issues, plan cycles, and manage product development', logo: <LinearLogo /> },
  { id: 'confluence', name: 'Confluence', description: 'Search documentation, access team knowledge bases, and collaborate', logo: <ConfluenceLogo /> },
  { id: 'outlook-mail', name: 'Outlook Mail', description: 'Write, search, and manage your Outlook emails seamlessly', logo: <OutlookLogo /> },
  { id: 'teams', name: 'Microsoft Teams', description: 'Chat, call, and collaborate with your team in one place', logo: <MicrosoftTeamsLogo /> },
  { id: 'dropbox', name: 'Dropbox', description: 'Store, share, and access your files from anywhere', logo: <DropboxLogo /> },
];

interface APIConnector {
  id: string;
  name: string;
  description: string;
  logo: React.ReactNode;
}

const API_CONNECTORS: APIConnector[] = [
  { id: 'openai', name: 'OpenAI', description: 'Leverage GPT model series for intelligent text generation and processing', logo: <LogoCircle bg="#F8F8F8" color="#000" size={36}><svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.047 6.047 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg></LogoCircle> },
  { id: 'anthropic', name: 'Anthropic', description: 'Access reliable AI assistant services with safe and intelligent conversations', logo: <LogoCircle bg="#F8F8F8" color="#D4A27F" size={36}><span className="font-bold text-[16px]" style={{color:'#D4A27F'}}>A</span></LogoCircle> },
  { id: 'gemini', name: 'Google Gemini', description: 'Process multimodal content including text, images, and code seamlessly', logo: <LogoCircle bg="#F8F8F8" color="#000" size={36}><svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0z" fill="url(#gem)"/><defs><linearGradient id="gem" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#4285F4"/><stop offset=".33" stopColor="#9B72CB"/><stop offset=".66" stopColor="#D96570"/><stop offset="1" stopColor="#D96570"/></linearGradient></defs></svg></LogoCircle> },
  { id: 'perplexity', name: 'Perplexity', description: 'Search real-time information and get accurate answers with reliable citations', logo: <LogoCircle bg="#F8F8F8" color="#1A7A6D" size={36}><span className="font-bold text-[14px]" style={{color:'#1A7A6D'}}>P</span></LogoCircle> },
  { id: 'cohere', name: 'Cohere', description: 'Build enterprise AI applications and optimize text processing workflows', logo: <LogoCircle bg="#F8F8F8" color="#39594D" size={36}><span className="font-bold text-[14px]" style={{color:'#39594D'}}>C</span></LogoCircle> },
  { id: 'elevenlabs', name: 'ElevenLabs', description: 'Generate realistic voices, clone speech, and create custom audio content', logo: <LogoCircle bg="#F8F8F8" color="#000" size={36}><span className="font-bold text-[14px]">II</span></LogoCircle> },
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
        <p className="text-[13px] text-text-secondary mt-0.5 line-clamp-2" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
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

      {/* Header bar */}
      <div className="flex items-center gap-4 px-8 h-16 shrink-0" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors shrink-0"
            style={{ color: 'var(--color-icon-primary)' }}
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor"/>
              <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <Link size={20} className="text-text-primary" />
          <h1 className="text-[20px] font-bold text-text-primary tracking-[-0.43px]" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
            Connectors
          </h1>
        </div>
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
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[14px] w-full md:w-[200px]"
          style={{ borderColor: 'var(--color-stroke-outline)', background: 'var(--color-bg-hover)' }}
        >
          <Search size={16} className="shrink-0 text-text-secondary" />
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
            <p className="text-[13px] font-medium text-text-secondary mb-3 tracking-wide uppercase" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
              Recommended
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {filterBySearch(RECOMMENDED_APPS).map(c => <ConnectorCard key={c.id} connector={c} />)}
            </div>

            {/* All Apps */}
            <p className="text-[13px] font-medium text-text-secondary mb-3 tracking-wide uppercase" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 7h3a5 5 0 0 1 0 10h-3M9 17H6a5 5 0 0 1 0-10h3"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <p className="text-[14px] text-text-secondary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
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
                  <Plus size={20} className="text-text-secondary" />
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
            <p className="text-[15px] text-text-secondary" style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
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
