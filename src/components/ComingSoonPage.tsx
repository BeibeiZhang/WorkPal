export type ComingSoonView = 'overview' | 'library';

interface ComingSoonPageProps {
  view: ComingSoonView;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const TITLES: Record<ComingSoonView, string> = {
  overview: 'Overview',
  library: 'Library',
};

const PINK_BG = '#FFAFA7';

export default function ComingSoonPage({ view, sidebarOpen, onToggleSidebar }: ComingSoonPageProps) {
  const title = TITLES[view];

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full" style={{ background: PINK_BG }}>

      {/* Header bar — toggle only */}
      <div className="flex items-center gap-4 px-4 h-12 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/20 transition-colors shrink-0"
            style={{ color: '#142740' }}
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor" />
              <rect width="15" height="2" rx="1" y="7" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>

      {/* Page title — Agent Design style */}
      <div className="px-8 pb-2 shrink-0">
        <h1
          className="type-display"
          style={{
            color: '#142740',
            fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          }}
        >
          {title}
        </h1>
      </div>

      {/* Content — centered video + Coming Soon text */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <video
          src="/animations/overview-hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full rounded-3xl"
          style={{
            minWidth: 300,
            maxWidth: 450,
            objectFit: 'contain',
          }}
        />
        <p
          className="text-center"
          style={{
            color: '#142740',
            fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.43px',
          }}
        >
          Dashboard function coming soon
        </p>
      </div>
    </div>
  );
}
