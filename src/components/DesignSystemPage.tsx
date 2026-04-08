import { Menu } from 'lucide-react';

interface DesignSystemPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/* ---- Color swatch data ---- */
const COLORS = [
  { name: 'Text Primary', var: '--color-text-primary', light: '#142740', dark: '#FFFFFF' },
  { name: 'Text Secondary', var: '--color-text-secondary', light: 'rgba(20,39,64,0.7)', dark: 'rgba(226,243,255,0.8)' },
  { name: 'Text Tertiary', var: '--color-text-tertiary', light: 'rgba(20,39,64,0.4)', dark: 'rgba(226,243,255,0.4)' },
  { name: 'Background Page', var: '--color-bg-page', light: '#FFFFFF', dark: '#001424' },
  { name: 'Background Hover / Message', var: '--color-bg-hover', light: '#F2F3F4', dark: 'rgba(226,243,255,0.1)' },
  { name: 'Sidebar Background', var: '--color-sidebar-bg', light: '#f2f3f4', dark: '#0d2136' },
  { name: 'Stroke Outline', var: '--color-stroke-outline', light: '#E8E8E8', dark: 'rgba(115,178,255,0.2)' },
  { name: 'Stroke Toggle', var: '--color-stroke-toggle', light: '#e6e8ea', dark: 'rgba(115,178,255,0.2)' },
  { name: 'Icon Primary', var: '--color-icon-primary', light: '#001424', dark: '#FFFFFF' },
];

const SPECIAL_COLORS = [
  { name: 'Status Tag BG', value: 'rgba(2,137,1,0.1)', preview: 'rgba(2,137,1,0.1)' },
  { name: 'Status Tag Text', value: '#028901', preview: '#028901' },
  { name: 'Link / @Mention', value: '#3171ff', preview: '#3171ff' },
  { name: 'Selected Chip BG', value: 'rgba(49,113,255,0.1)', preview: 'rgba(49,113,255,0.1)' },
  { name: 'Agent Profile BG', value: '#E5E9F1', preview: '#E5E9F1' },
];

const TYPOGRAPHY = [
  { style: 'Body / Regular', font: 'SF Pro', size: '17px', weight: 400, lineHeight: '22px', spacing: '-0.43px' },
  { style: 'Body / Emphasized', font: 'SF Pro', size: '16px', weight: 700, lineHeight: '32px', spacing: '-0.43px' },
  { style: 'Detail / Regular', font: 'Inter', size: '16px', weight: 400, lineHeight: '22px', spacing: '0px' },
  { style: 'Headline / Regular', font: 'SF Pro', size: '17px', weight: 590, lineHeight: '22px', spacing: '-0.43px' },
];

const SPACING = [
  { token: 'spacing/1', value: '4px', tw: 'p-1, gap-1' },
  { token: 'spacing/2', value: '8px', tw: 'p-2, gap-2' },
  { token: 'spacing/4', value: '16px', tw: 'p-4, gap-4' },
  { token: 'spacing/5', value: '24px', tw: 'p-6, gap-6' },
  { token: 'spacing/6', value: '32px', tw: 'p-8, gap-8' },
];

const RADII = [
  { token: 'radius/xl', value: '100px', tw: 'rounded-full' },
  { token: 'radius/full', value: '1000px', tw: 'rounded-full' },
  { token: 'Outer shell', value: '40px', tw: 'rounded-[40px]' },
];

const COMPONENTS = [
  { category: 'Sidebar', items: [
    'Nav Item (Default / Hover / Active with gradient border + spinner)',
    'Search Field (rounded-full, border-stroke-toggle, bg-bg-hover)',
    'Section Accordion (Projects, Admin, Recents with ChevronDown)',
    'Account Footer (35px profile avatar + bold name + dark/light toggle)',
    'Dark/Light Toggle (pill toggle with Sun/Moon icons)',
  ]},
  { category: 'Chat Input', items: [
    'Text Field (Default / Hover / Filled / Multiline)',
    'Quick Chip (rounded-full, border-stroke-outline, gradient border on hover)',
    'Selected Chip (blue bg rgba(49,113,255,0.1), gradient border ring on hover)',
    'Icon Toolbar (Microphone, Voice, Camera, Photo, Upload - 44x44 rounded-full)',
    'Mode Selector (Chat / Tasks / Code toggle)',
    'Send Button (gradient fill, rounded-full)',
  ]},
  { category: 'Message Cards', items: [
    'Meeting Card (rich text content with meeting minutes)',
    'Research Card (summary report with expandable content)',
    'Ticket Card (checklist items with @assignee + due date)',
    'Schedule Card (radio list for time options + attendees)',
    'Agent Card - Creating (gradient icon + progress bar animation)',
    'Agent Card - Ready (120px avatar on #E5E9F1 + intro text + Set as Agent button)',
    'Agent Card - Saved (same as Ready + StatusTag "Saved")',
    'Gradient Button (h-12, gradient 74deg, box-shadow: 0 5px 15px rgba(1,44,197,0.2))',
    'Progress Bar (3px gradient bar, animate-progress-bar)',
    'Status Tag (bg: rgba(2,137,1,0.1), color: #028901)',
  ]},
  { category: 'Chat Message', items: [
    'User Bubble (right-aligned, bg-bg-message, rounded-[20px])',
    'AI Bubble (left-aligned, no background)',
    'Action Chips (post-AI response, same style as quick chips)',
    'Feedback Bar (Copy, Share, Thumbs up/down, Refresh - 16px icons)',
    'Loading Dots (3 dots: #7652B9, #B46470, #CA9D8C)',
  ]},
  { category: 'Chat Panel', items: [
    'Welcome State (gradient text "Hi, Beibei", avatar selector, quick chips)',
    'Avatar Selector (150px rounded-full, bg-bg-hover)',
    'Message List (scrollable, message-appear animation)',
  ]},
  { category: 'Onboarding', items: [
    'Step 1: Description textarea + trait chip selection',
    'Step 2: Agent creation flow (creating -> ready -> saved)',
    'Trait Chips (unselected: border-stroke-outline, selected: blue bg)',
  ]},
  { category: 'Connectors Page', items: [
    'Tab Bar (Apps / Custom API / Custom MCP)',
    'App Cards (icon + name + description + Connect button)',
    'Connected App Badge (green checkmark)',
  ]},
  { category: 'Other Pages', items: [
    'Project Page (project overview with sessions)',
    'Task Screen (task list view)',
    'Task Context Panel (inline or fullscreen overlay)',
    'Detail Panel (expandable report viewer)',
    'New Project Dialog (modal with name + description fields)',
  ]},
];

const CSS_UTILITIES = [
  { cls: '.gradient-text', desc: 'Brand gradient text (31.6deg, #7652B9 -> #B46470 -> #CA9D8C)' },
  { cls: '.gradient-btn', desc: 'Gradient fill for buttons (74deg) + box-shadow' },
  { cls: '.app-bg', desc: 'Page background with radial gradient blobs (light & dark)' },
  { cls: '.chip-gradient-hover', desc: 'Gradient border on hover for unselected chips' },
  { cls: '.onboarding-chip-selected', desc: 'Selected chip with ::before gradient ring on hover' },
  { cls: '.input-gradient-hover', desc: 'Gradient border on hover for input fields' },
  { cls: '.animate-progress-bar', desc: 'Progress bar fill animation (0% -> 100% over 2.5s)' },
  { cls: '.loading-dot', desc: 'Animated dot (use 3 in sequence for loading indicator)' },
  { cls: '.message-appear', desc: 'Fade-in-up animation for new messages' },
  { cls: '.icon-theme', desc: 'Auto-invert icons in dark mode (brightness(0) invert(1))' },
  { cls: '.toolbar-gradient-hover', desc: 'Dark-mode-only gradient border on hover for toolbar buttons' },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.43px] mt-8 mb-4 pb-2" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
      {children}
    </h2>
  );
}

export default function DesignSystemPage({ sidebarOpen, onToggleSidebar }: DesignSystemPageProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full" style={{ background: 'var(--color-bg-page)' }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
        {!sidebarOpen && (
          <button onClick={onToggleSidebar} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors">
            <Menu size={20} className="text-text-primary" />
          </button>
        )}
        <h1 className="text-[20px] font-bold text-text-primary tracking-[-0.43px]">Design System</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-12 scrollbar-autohide">
        {/* Brand Gradient */}
        <SectionTitle>Brand Gradient</SectionTitle>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <div className="gradient-btn rounded-xl" style={{ width: 200, height: 60 }} />
            <p className="text-text-secondary text-[13px]">#7652B9 → #B46470 → #CA9D8C</p>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <span className="gradient-text text-[24px] font-bold">Gradient Text</span>
            <p className="text-text-secondary text-[13px]">.gradient-text (31.6deg)</p>
          </div>
        </div>

        {/* Colors */}
        <SectionTitle>Color Tokens</SectionTitle>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {COLORS.map(c => (
            <div key={c.var} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="shrink-0 rounded-lg" style={{ width: 36, height: 36, background: `var(${c.var})`, border: '1px solid var(--color-stroke-outline)' }} />
              <div className="min-w-0">
                <p className="text-text-primary font-medium text-[13px] truncate">{c.name}</p>
                <p className="text-text-tertiary text-[12px] truncate">{c.var}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-[15px] font-semibold text-text-primary mt-6 mb-3">Special Colors</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {SPECIAL_COLORS.map(c => (
            <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <div className="shrink-0 rounded-lg" style={{ width: 36, height: 36, background: c.preview, border: '1px solid var(--color-stroke-outline)' }} />
              <div className="min-w-0">
                <p className="text-text-primary font-medium text-[13px] truncate">{c.name}</p>
                <p className="text-text-tertiary text-[12px] truncate">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <SectionTitle>Typography</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                {['Style', 'Font', 'Size', 'Weight', 'Line Height', 'Spacing'].map(h => (
                  <th key={h} className="text-text-secondary font-medium text-[13px] py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TYPOGRAPHY.map(t => (
                <tr key={t.style} style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
                  <td className="text-text-primary font-medium text-[13px] py-3 pr-4">{t.style}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.font}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.size}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.weight}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.lineHeight}</td>
                  <td className="text-text-secondary text-[13px] py-3 pr-4">{t.spacing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Spacing & Radii */}
        <SectionTitle>Spacing & Border Radius</SectionTitle>
        <div className="flex flex-wrap gap-8">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary mb-3">Spacing</h3>
            <div className="flex flex-col gap-2">
              {SPACING.map(s => (
                <div key={s.token} className="flex items-center gap-4">
                  <div className="rounded" style={{ width: parseInt(s.value), height: 16, background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)', minWidth: 4 }} />
                  <span className="text-text-primary text-[13px] font-medium w-20">{s.value}</span>
                  <span className="text-text-tertiary text-[12px]">{s.tw}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary mb-3">Border Radius</h3>
            <div className="flex flex-wrap gap-4">
              {RADII.map(r => (
                <div key={r.token} className="flex flex-col items-center gap-2">
                  <div style={{ width: 48, height: 48, borderRadius: r.value === '1000px' || r.value === '100px' ? '50%' : r.value, border: '2px solid var(--color-stroke-outline)', background: 'var(--color-bg-hover)' }} />
                  <span className="text-text-primary text-[12px] font-medium">{r.value}</span>
                  <span className="text-text-tertiary text-[11px]">{r.tw}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Components */}
        <SectionTitle>Components</SectionTitle>
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {COMPONENTS.map(group => (
            <div key={group.category} className="p-4 rounded-xl" style={{ border: '1px solid var(--color-stroke-outline)' }}>
              <h3 className="text-[15px] font-bold text-text-primary mb-3">{group.category}</h3>
              <ul className="flex flex-col gap-1.5">
                {group.items.map(item => (
                  <li key={item} className="text-text-secondary text-[13px] leading-[18px] flex items-start gap-2">
                    <span className="text-text-tertiary mt-[2px]">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CSS Utility Classes */}
        <SectionTitle>CSS Utility Classes</SectionTitle>
        <div className="flex flex-col gap-2">
          {CSS_UTILITIES.map(u => (
            <div key={u.cls} className="flex items-start gap-4 py-2" style={{ borderBottom: '1px solid var(--color-stroke-outline)' }}>
              <code className="text-[13px] font-mono shrink-0 px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-hover)', color: '#3171ff', minWidth: 200 }}>
                {u.cls}
              </code>
              <span className="text-text-secondary text-[13px]">{u.desc}</span>
            </div>
          ))}
        </div>

        {/* Live Samples */}
        <SectionTitle>Live Samples</SectionTitle>
        <div className="flex flex-wrap gap-6 items-start">
          {/* Chips */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Chips</h3>
            <div className="flex flex-wrap gap-2">
              <span className="chip-gradient-hover rounded-full border px-3 py-1 text-text-primary cursor-pointer" style={{ borderColor: 'var(--color-stroke-outline)' }}>
                Default Chip
              </span>
              <span className="rounded-full px-3 py-1 cursor-pointer onboarding-chip-selected" style={{ background: 'rgba(49,113,255,0.1)', color: '#3171ff' }}>
                Selected Chip
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Gradient Button</h3>
            <button className="gradient-btn text-white font-medium rounded-xl px-6 py-3 text-[14px]">
              Action Button
            </button>
          </div>

          {/* Status Tag */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Status Tag</h3>
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium" style={{ background: 'rgba(2,137,1,0.1)', color: '#028901' }}>
              Saved
            </span>
          </div>

          {/* Loading Dots */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary">Loading Dots</h3>
            <div className="flex items-center gap-1.5">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col gap-3 w-48">
            <h3 className="text-[15px] font-semibold text-text-primary">Progress Bar</h3>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--color-bg-hover)' }}>
              <div className="h-full rounded-full animate-progress-bar" style={{ background: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)' }} />
            </div>
          </div>
        </div>

        {/* Dark Mode */}
        <SectionTitle>Dark Mode</SectionTitle>
        <p className="text-text-secondary text-[14px] leading-[20px]">
          Dark mode is toggled via the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.dark</code> class on <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>&lt;html&gt;</code>. All components use CSS variables that automatically switch. Monochrome icons use the <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.icon-theme</code> class for auto-inversion. Gradient elements (avatars, spinner, buttons) do NOT use <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: 'var(--color-bg-hover)', color: '#3171ff' }}>.icon-theme</code>.
        </p>
      </div>
    </div>
  );
}
