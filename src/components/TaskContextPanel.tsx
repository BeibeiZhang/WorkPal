import { File, MessageCircle } from 'lucide-react';
import { SideCard, SidePanelHeader } from './shared';

/* ── Types ───────────────────────────────────────────── */

interface Step {
  label: string;
  status: 'completed' | 'active' | 'pending';
}

interface FileEntry {
  name: string;
}

interface TaskContextPanelProps {
  onClose: () => void;
  progress?: Step[];
  folder?: FileEntry[];
  context?: FileEntry[];
  toolsActive?: FileEntry[];
  fullScreen?: boolean;
}

/* ── Defaults ────────────────────────────────────────── */

const DEFAULT_PROGRESS: Step[] = [
  { label: 'Find driver incident reports', status: 'completed' },
  { label: 'Identify top pain points', status: 'pending' },
  { label: 'Draft summary report', status: 'pending' },
  { label: 'Suggest recommendations', status: 'active' },
];

const DEFAULT_FOLDER: FileEntry[] = [
  { name: 'Instructions.md' },
  { name: 'Spark_incidents_Q3.pdf' },
  { name: 'driver_complaints.csv' },
];

const DEFAULT_CONTEXT: FileEntry[] = [
  { name: 'Instructions.md' },
];

const DEFAULT_TOOLS: FileEntry[] = [
  { name: 'Instructions.md' },
];

/* ── Progress step icons ────────────────────────────── */

function CompletedIcon() {
  return (
    <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0"
      style={{ background: '#3171ff' }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ActiveIcon({ number }: { number: number }) {
  return (
    <div
      className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 border-[1.5px]"
      style={{ borderColor: '#3171ff' }}
    >
      <span className="text-[11px] font-medium" style={{ color: '#3171ff' }}>{number}</span>
    </div>
  );
}

function PendingIcon({ number }: { number: number }) {
  return (
    <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 border-[1.5px] border-stroke-outline">
      <span className="text-[11px] font-medium text-text-primary">{number}</span>
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

export default function TaskContextPanel({
  onClose,
  progress = DEFAULT_PROGRESS,
  folder = DEFAULT_FOLDER,
  context = DEFAULT_CONTEXT,
  toolsActive = DEFAULT_TOOLS,
  fullScreen = false,
}: TaskContextPanelProps) {
  return (
    <div
      className="flex flex-col h-full shrink-0 max-w-full"
      style={{
        width: 280,
        // Overlay mode must be solid (no bleed-through onto ConversationPanel).
        // In-flow mode inherits the shell background.
        background: fullScreen ? 'var(--color-bg-page)' : undefined,
      }}
    >
      {/* Header with collapse-back toggle */}
      <SidePanelHeader onClose={onClose} closeIcon="panel-right" closeLabel="Collapse panel" />
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-6 flex flex-col gap-4 scrollbar-autohide">

        {/* Progress */}
        <SideCard title="Progress" defaultOpen>
          <div className="flex flex-col gap-0">
            {progress.map((step, i) => {
              const stepNumber = i + 1;

              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              return (
                <div key={i} className="flex items-start gap-3 relative" style={{ paddingBottom: i < progress.length - 1 ? 16 : 0 }}>
                  {/* Vertical connector line — solid after a completed step, dashed after active/pending */}
                  {i < progress.length - 1 && (
                    <div
                      className="absolute left-[10px] w-px"
                      style={{
                        top: 22,
                        bottom: 0,
                        borderLeft: isCompleted
                          ? '1.5px solid #3171ff'
                          : '1.5px dashed var(--color-stroke-outline)',
                      }}
                    />
                  )}
                  {/* Step icon */}
                  {isCompleted ? (
                    <CompletedIcon />
                  ) : isActive ? (
                    <ActiveIcon number={stepNumber} />
                  ) : (
                    <PendingIcon number={stepNumber} />
                  )}
                  {/* Step label */}
                  <span
                    className="flex-1 min-w-0 text-[13px] leading-[22px] pt-px"
                    style={{
                      color: isCompleted
                        ? 'var(--color-text-secondary)'
                        : 'var(--color-text-primary)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                    }}
                  >
                    {step.label}
                  </span>
                  {/* Active step: chat bubble icon at the right */}
                  {isActive && (
                    <MessageCircle size={16} className="text-text-primary shrink-0 mt-[3px]" />
                  )}
                </div>
              );
            })}
          </div>
        </SideCard>

        {/* Folder */}
        <SideCard title="Folder" defaultOpen>
          <div className="flex flex-col gap-1">
            {folder.map(f => (
              <button
                key={f.name}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <File size={16} className="text-text-primary shrink-0" />
                <span className="text-[13px] text-text-primary truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </SideCard>

        {/* Context */}
        <SideCard title="Context" defaultOpen>
          <div className="flex flex-col gap-1">
            {context.map(f => (
              <button
                key={f.name}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <File size={16} className="text-text-primary shrink-0" />
                <span className="text-[13px] text-text-primary truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </SideCard>

        {/* Tools active */}
        <SideCard title="Tools active" defaultOpen>
          <div className="flex flex-col gap-1">
            {toolsActive.map(f => (
              <button
                key={f.name}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <File size={16} className="text-text-primary shrink-0" />
                <span className="text-[13px] text-text-primary truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </SideCard>
      </div>
    </div>
  );
}
