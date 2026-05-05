import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AgentRequiredHint, HeaderIconButton, PageLayout, VersionRow } from './shared';
import { IS_DEMO } from '../lib/demoMode';
import { useIsMobile } from '../lib/useIsMobile';
import { fetchVersionInfo, type VersionRowData } from '../lib/versionInfo';
import { AgentUnreachableError } from '../lib/agent';

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

interface SoftwareUpdatePageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
}

export default function SoftwareUpdatePage({ sidebarOpen, onToggleSidebar, onNewChat }: SoftwareUpdatePageProps) {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<VersionRowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchVersionInfo();
      setRows(data.rows);
      setCheckedAt(new Date(data.checkedAt));
    } catch (err) {
      if (err instanceof AgentUnreachableError) {
        setFetchError('WorkPal Agent is not running. Start the agent to check for updates.');
      } else {
        setFetchError(err instanceof Error ? err.message : 'Failed to check versions');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (IS_DEMO || isMobile) return;
    void load();
  }, [load, isMobile]);

  useEffect(() => {
    if (!checkedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [checkedAt]);

  if (IS_DEMO) {
    return (
      <PageLayout title="Software Update" bgClass="app-bg" sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} onNewChat={onNewChat}>
        <div className="flex-1 flex items-center justify-center">
          <p className="type-h2 text-text-secondary">Demo mode — updates not applicable</p>
        </div>
      </PageLayout>
    );
  }

  if (isMobile) {
    return (
      <PageLayout title="Software Update" bgClass="app-bg" sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} onNewChat={onNewChat}>
        <div className="px-4 pt-6">
          <AgentRequiredHint message="Open WorkPal Agent to check for updates" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Software Update"
      bgClass="app-bg"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onNewChat={onNewChat}
      rightSlot={
        <HeaderIconButton onClick={load} ariaLabel="Refresh" title="Refresh">
          <RefreshCw size={18} className={`text-text-primary ${loading ? 'animate-spin' : ''}`} />
        </HeaderIconButton>
      }
    >
      <div className="space-y-3 pb-6">
        {rows.length > 0 ? (
          rows.map((row) => (
            <VersionRow
              key={row.id}
              label={row.label}
              current={row.current}
              latest={row.latest}
              status={row.status}
              error={row.error}
              loading={loading && rows.length === 0}
            />
          ))
        ) : loading ? (
          Array.from({ length: 6 }, (_, i) => (
            <VersionRow
              key={i}
              label="Loading…"
              current=""
              latest={null}
              status="unknown"
              loading
            />
          ))
        ) : fetchError ? (
          <div className="panel-border rounded-[12px] p-6 text-center">
            <p className="type-detail text-text-secondary mb-3">{fetchError}</p>
            <button
              type="button"
              onClick={load}
              className="type-detail-emphasized text-accent-blue hover:underline"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {checkedAt && (
        <p className="type-caption text-text-tertiary pb-4">
          Last checked: {relativeTime(checkedAt)}
        </p>
      )}
    </PageLayout>
  );
}
