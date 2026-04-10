import { useState } from 'react';
import { ChevronDown, File, Loader } from 'lucide-react';

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

/* ── Collapsible section ────────────────────────────── */

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-stroke-outline rounded-2xl overflow-hidden bg-white dark:bg-[#1a1f2e]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center w-full px-5 py-4 text-left hover:bg-bg-hover transition-colors"
      >
        <span className="flex-1 text-[15px] font-semibold text-text-primary">{title}</span>
        <ChevronDown
          size={16}
          className={`text-text-secondary transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

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

function ActiveIcon() {
  return (
    <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 border-2 border-stroke-outline">
      <Loader size={12} className="text-text-secondary animate-spin" />
    </div>
  );
}

function PendingIcon({ number }: { number: number }) {
  return (
    <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 border-[1.5px] border-stroke-outline">
      <span className="text-[11px] font-medium text-text-secondary">{number}</span>
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
}: TaskContextPanelProps) {
  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: 280,
        background: 'var(--color-bg-page)',
      }}
    >
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pt-4 pb-6 flex flex-col gap-4 scrollbar-autohide">

        {/* Progress */}
        <Section title="Progress" defaultOpen>
          <div className="flex flex-col gap-0">
            {progress.map((step, i) => {
              const stepNumber = i + 1;

              return (
                <div key={i} className="flex items-start gap-3 relative" style={{ paddingBottom: i < progress.length - 1 ? 16 : 0 }}>
                  {/* Vertical connector line */}
                  {i < progress.length - 1 && (
                    <div
                      className="absolute left-[10px] w-px"
                      style={{
                        top: 22,
                        bottom: 0,
                        borderLeft: '1.5px solid var(--color-stroke-outline)',
                      }}
                    />
                  )}
                  {/* Step icon */}
                  {step.status === 'completed' ? (
                    <CompletedIcon />
                  ) : step.status === 'active' ? (
                    <ActiveIcon />
                  ) : (
                    <PendingIcon number={stepNumber} />
                  )}
                  {/* Step label */}
                  <span
                    className="flex-1 min-w-0 text-[13px] leading-[22px] pt-px"
                    style={{
                      color: step.status === 'completed'
                        ? 'var(--color-text-secondary)'
                        : 'var(--color-text-primary)',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Folder */}
        <Section title="Folder" defaultOpen>
          <div className="flex flex-col gap-1">
            {folder.map(f => (
              <button
                key={f.name}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <File size={16} className="text-text-secondary shrink-0" />
                <span className="text-[13px] text-text-primary truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Context */}
        <Section title="Context" defaultOpen>
          <div className="flex flex-col gap-1">
            {context.map(f => (
              <button
                key={f.name}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <File size={16} className="text-text-secondary shrink-0" />
                <span className="text-[13px] text-text-primary truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Tools active */}
        <Section title="Tools active" defaultOpen>
          <div className="flex flex-col gap-1">
            {toolsActive.map(f => (
              <button
                key={f.name}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <File size={16} className="text-text-secondary shrink-0" />
                <span className="text-[13px] text-text-primary truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
