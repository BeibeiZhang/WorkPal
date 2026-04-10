import { LayoutDashboard, BookOpen } from 'lucide-react';

export type ComingSoonView = 'overview' | 'library';

interface ComingSoonPageProps {
  view: ComingSoonView;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const TITLES: Record<ComingSoonView, { title: string; Icon: typeof LayoutDashboard }> = {
  overview: { title: 'Overview', Icon: LayoutDashboard },
  library: { title: 'Library', Icon: BookOpen },
};

const PINK_BG = '#FFAFA7';

export default function ComingSoonPage({ view, sidebarOpen, onToggleSidebar }: ComingSoonPageProps) {
  const { title, Icon } = TITLES[view];

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full" style={{ background: PINK_BG }}>

      {/* Header bar */}
      <div className="flex items-center gap-4 px-8 h-16 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors shrink-0"
            style={{ color: '#142740' }}
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor" />
              <rect width="15" height="2" rx="1" y="7" fill="currentColor" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <Icon size={20} style={{ color: '#142740' }} />
          <h1
            className="text-[20px] font-bold tracking-[-0.43px]"
            style={{
              color: '#142740',
              fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            }}
          >
            {title}
          </h1>
        </div>
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
            maxWidth: 300,
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
          Coming Soon~
        </p>
      </div>
    </div>
  );
}
