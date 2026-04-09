import { X, ChevronDown, FileText, Link } from 'lucide-react';

/* ── Types ───────────────────────────────────────────── */

interface Step {
  label: string;
  status: 'completed' | 'pending';
}

interface FileEntry {
  name: string;
  icon?: 'file' | 'design' | 'notes';
}

interface Connector {
  name: string;
  icon?: React.ReactNode;
}

interface TaskContextPanelProps {
  onClose: () => void;
  progress?: Step[];
  files?: FileEntry[];
  connectors?: Connector[];
}

/* ── Defaults ────────────────────────────────────────── */

const DEFAULT_PROGRESS: Step[] = [
  { label: 'Fetch Figma design files', status: 'completed' },
  { label: 'Identify key screens and components', status: 'completed' },
  { label: 'Compile review notes', status: 'pending' },
];

const DEFAULT_FILES: FileEntry[] = [
  { name: 'Instructions \u00b7 CLAUDE.md', icon: 'file' },
  { name: 'WorkPal.html', icon: 'design' },
  { name: 'Scratchpad', icon: 'notes' },
];

const DEFAULT_CONNECTORS: Connector[] = [
  { name: 'Figma' },
  { name: 'Asana' },
];

/* ── Font ────────────────────────────────────────────── */

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/* ── Inline SVG icons ────────────────────────────────── */

/** Green checkmark in a circle for completed steps */
function CheckedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
      <path
        d="M17.5 9.31V10a7.5 7.5 0 1 1-4.45-6.86"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 4 10 11.5l-2.25-2.25"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small file icon (16px) */
function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333l-4-4Z"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.333 1.333v4h4"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small design/layout icon (16px) */
function DesignIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <rect x="1.833" y="1.833" width="12.333" height="12.333" rx="1.5" stroke="var(--color-text-secondary)" strokeWidth="1.2" />
      <path d="M1.833 6H14.167" stroke="var(--color-text-secondary)" strokeWidth="1.2" />
      <path d="M6 6v8.167" stroke="var(--color-text-secondary)" strokeWidth="1.2" />
    </svg>
  );
}

/** Small notes icon (16px) */
function NotesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333l-4-4Z"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.333 5.333h1.334" stroke="var(--color-text-secondary)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.333 8h5.334" stroke="var(--color-text-secondary)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.333 10.667h5.334" stroke="var(--color-text-secondary)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Figma logo (16px) */
function FigmaLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <g clipPath="url(#figma-clip)">
        <path d="M5.333 15.333a2.333 2.333 0 0 0 2.334-2.333v-2.333H5.333a2.333 2.333 0 0 0 0 4.666Z" fill="#0ACF83" />
        <path d="M3 8a2.333 2.333 0 0 1 2.333-2.333h2.334V10.333H5.333A2.333 2.333 0 0 1 3 8Z" fill="#A259FF" />
        <path d="M3 3.333A2.333 2.333 0 0 1 5.333 1h2.334v4.667H5.333A2.333 2.333 0 0 1 3 3.333Z" fill="#F24E1E" />
        <path d="M7.667 1H10a2.333 2.333 0 0 1 0 4.667H7.667V1Z" fill="#FF7262" />
        <path d="M12.333 8A2.333 2.333 0 1 1 10 5.667 2.333 2.333 0 0 1 12.333 8Z" fill="#1ABCFE" />
      </g>
      <defs>
        <clipPath id="figma-clip">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Asana logo (16px) */
function AsanaLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <g clipPath="url(#asana-clip)">
        <path
          d="M11.5 6.8a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4.5 6.8a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
          fill="#F06A6A"
        />
      </g>
      <defs>
        <clipPath id="asana-clip">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

/* ── Helper: file icon picker ────────────────────────── */

function FileItemIcon({ icon }: { icon?: string }) {
  if (icon === 'design') return <DesignIcon />;
  if (icon === 'notes') return <NotesIcon />;
  return <FileIcon />;
}

/* ── Helper: connector icon picker ───────────────────── */

function ConnectorIcon({ name }: { name: string }) {
  if (name === 'Figma') return <FigmaLogo />;
  if (name === 'Asana') return <AsanaLogo />;
  return <FileText size={16} style={{ color: 'var(--color-text-secondary)' }} />;
}

/* ── Main component ──────────────────────────────────── */

export default function TaskContextPanel({
  onClose,
  progress = DEFAULT_PROGRESS,
  files = DEFAULT_FILES,
  connectors = DEFAULT_CONNECTORS,
}: TaskContextPanelProps) {
  const completedCount = progress.filter((s) => s.status === 'completed').length;

  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: 280,
        borderLeft: '1px solid var(--color-stroke-outline)',
        background: 'var(--color-bg-page)',
        fontFamily: FONT,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ padding: '16px 20px 0 20px' }}
      >
        <span
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.43px',
          }}
        >
          Task Context
        </span>
        <button
          onClick={onClose}
          className="flex items-center justify-center"
          style={{ width: 20, height: 20, color: 'var(--color-text-secondary)' }}
          aria-label="Close panel"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex flex-col overflow-y-auto flex-1 min-h-0">
        {/* Progress Section */}
        <div style={{ padding: '20px 20px 16px 20px' }}>
          {/* Progress header */}
          <div className="flex items-center justify-between" style={{ marginBottom: 0 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Progress
            </span>
            <ChevronDown
              size={16}
              style={{ color: 'var(--color-text-secondary)' }}
            />
          </div>

          {/* Steps */}
          <div className="flex flex-col" style={{ gap: 12, paddingTop: 16 }}>
            {progress.map((step, i) => (
              <div key={i} className="flex items-center" style={{ gap: 10 }}>
                {step.status === 'completed' ? (
                  <CheckedIcon />
                ) : (
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      border: '1.5px solid var(--color-stroke-outline)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                )}
                <span
                  className="flex-1 min-w-0"
                  style={{
                    fontSize: 13,
                    lineHeight: '20px',
                    fontWeight: 400,
                    color: step.status === 'completed'
                      ? 'var(--color-text-secondary)'
                      : 'var(--color-text-primary)',
                    textDecoration: step.status === 'completed' ? 'line-through' : 'none',
                  }}
                >
                  {step.label}
                </span>
              </div>
            ))}

            {/* Count */}
            <div style={{ paddingTop: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                }}
              >
                {completedCount} of {progress.length} completed
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-stroke-outline)' }} />

        {/* WorkPal Section */}
        <div style={{ padding: '16px 20px' }}>
          {/* WorkPal header */}
          <div className="flex items-center" style={{ gap: 8, paddingBottom: 12 }}>
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: 'var(--color-bg-hover)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
              }}
            >
              &#10003;
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              WorkPal
            </span>
          </div>

          {/* Files */}
          <div className="flex flex-col" style={{ gap: 2 }}>
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center"
                style={{ gap: 10, padding: '6px 8px', borderRadius: 6 }}
              >
                <FileItemIcon icon={file.icon} />
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-stroke-outline)' }} />

        {/* Context Section */}
        <div style={{ padding: '16px 20px' }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Context
          </span>

          {/* CONNECTORS label */}
          <div style={{ paddingTop: 12, paddingBottom: 8, paddingLeft: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              CONNECTORS
            </span>
          </div>

          {/* Connector items */}
          <div className="flex flex-col" style={{ gap: 2 }}>
            {connectors.map((c) => (
              <div
                key={c.name}
                className="flex items-center"
                style={{ gap: 10, padding: '6px 8px', borderRadius: 6 }}
              >
                <ConnectorIcon name={c.name} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {c.name}
                </span>
              </div>
            ))}

            {/* Add connector */}
            <div
              className="flex items-center"
              style={{
                gap: 10,
                padding: '6px 8px',
                borderRadius: 6,
                color: 'var(--color-text-secondary)',
              }}
            >
              <Link size={12} />
              <span style={{ fontSize: 13, fontWeight: 400 }}>
                Add connector...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
