import { File, MessageCircle, FilePlus2, FilePen, FileMinus2, GitMerge, Undo2, ShieldOff, CheckCircle2 } from 'lucide-react';
import { SideCard, SidePanelHeader, TertiaryButton } from './shared';
import type { ChangeEntry, ChangeKind } from '../types';
import { IS_DEMO, IS_CLAUDE_CODE_AVAILABLE } from '../lib/demoMode';

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
  /** Pass true for the alcohol-delivery demo chat — keeps the scripted
   *  default files/context/tools so the polished demo keeps its look. In
   *  every other case we render whatever the caller passes, and empty lists
   *  show an empty state instead of stale placeholders. */
  useDemoDefaults?: boolean;
  /** Cosmetic filesystem path shown above the Folder file list so the user
   *  can see where WorkPal is working. The Folder card is only rendered once
   *  the session folder has been materialized on disk (see
   *  `folderMaterialized`) — until then we keep the inspector silent about
   *  a workspace that doesn't exist. */
  folderPath?: string;
  /** True once the backend has `mkdir -p`'d the session folder (first
   *  Write/Edit tool call). Hides the Folder card while still false. */
  folderMaterialized?: boolean;
  /** Auto-commit log — rendered at the top of the panel. Each entry shows a
   *  kind-specific icon and an Undo button. Empty = no changes yet. */
  changes?: ChangeEntry[];
  /** Flip a change to `undone: true`. The row stays visible (greyed, with an
   *  "Undone" tag) so the user has a trail, but no real file revert happens. */
  onUndoChange?: (id: string) => void;
  /** 6.3: gate for the "Complete Session" button at the panel footer. True
   *  iff the chat lives under a project AND has materialized at least one
   *  file write. Chats outside a project (legacy Phase 5) and pure-Q&A
   *  chats never render this button. */
  canCompleteSession?: boolean;
  /** 6.3: true after the user has already merged this session's branch into
   *  the project base. Button stays visible but disabled with a success
   *  label — Phase 6 intentionally doesn't offer a "re-open" path. */
  sessionCompleted?: boolean;
  /** 6.3: open the Complete Session modal. Passed from App.tsx, which hosts
   *  the modal and manages its phase state. Undefined while the gate above
   *  is false. */
  onCompleteSession?: () => void;
}

const CHANGE_ICON: Record<ChangeKind, typeof File> = {
  create: FilePlus2,
  edit: FilePen,
  delete: FileMinus2,
  halt: ShieldOff,
};

function relativeTime(from: Date): string {
  const delta = Math.max(0, Date.now() - from.getTime());
  const s = Math.floor(delta / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Defaults (demo only) ─────────────────────────────── */

const DEMO_PROGRESS: Step[] = [
  { label: 'Find driver incident reports', status: 'completed' },
  { label: 'Identify top pain points', status: 'pending' },
  { label: 'Draft summary report', status: 'pending' },
  { label: 'Suggest recommendations', status: 'active' },
];

const DEMO_FOLDER: FileEntry[] = [
  { name: 'Instructions.md' },
  { name: 'Spark_incidents_Q3.pdf' },
  { name: 'driver_complaints.csv' },
];

const DEMO_CONTEXT: FileEntry[] = [
  { name: 'Instructions.md' },
];

const DEMO_TOOLS: FileEntry[] = [
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
  progress,
  folder,
  context,
  toolsActive,
  fullScreen = false,
  useDemoDefaults = false,
  folderPath,
  folderMaterialized = false,
  changes,
  onUndoChange,
  canCompleteSession = false,
  sessionCompleted = false,
  onCompleteSession,
}: TaskContextPanelProps) {
  // Demo chat falls back to the original scripted placeholders; real chats
  // render whatever the caller passes — an empty list shows the empty state.
  const progressList = progress ?? (useDemoDefaults ? DEMO_PROGRESS : []);
  const folderList = folder ?? (useDemoDefaults ? DEMO_FOLDER : []);
  const contextList = context ?? (useDemoDefaults ? DEMO_CONTEXT : []);
  const toolsList = toolsActive ?? (useDemoDefaults ? DEMO_TOOLS : []);
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

        {/* Changes — auto-commit log (Phase 4). Only renders when at least
             one change has happened; hidden otherwise so the panel stays
             uncluttered in simple sessions.
             5.5 LIFO rule: once any entry has a real `commit` (Claude-backed
             chat), the Undo button lives only on the latest !undone committed
             row. Once that row is undone, the row above it becomes the new
             tip and its Undo appears on hover. Demo chats (no commits
             anywhere) keep the legacy "every non-halt !undone row shows
             Undo" behavior — cosmetic flips only. */}
        {changes && changes.length > 0 && (() => {
          const anyCommitted = changes.some(c => !!c.commit);
          let undoableIdx = -1;
          if (anyCommitted) {
            for (let i = changes.length - 1; i >= 0; i--) {
              const c = changes[i];
              if (c.commit && !c.undone) { undoableIdx = i; break; }
            }
          }
          return (
          <SideCard title="Changes" defaultOpen>
            <div className="flex flex-col gap-1">
              {changes.map((change, idx) => {
                const Icon = CHANGE_ICON[change.kind];
                const showUndo = !!onUndoChange && !change.undone && change.kind !== 'halt'
                  && (anyCommitted ? idx === undoableIdx : true);
                return (
                  <div key={change.id} className="flex flex-col">
                    <div
                      className={`group flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors ${change.undone ? 'opacity-50' : ''}`}
                    >
                      <Icon size={16} className="shrink-0 text-text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className={`type-body text-text-primary truncate ${change.undone ? 'line-through' : ''}`}>
                          {change.label}
                        </div>
                        <div className="text-[11px] text-text-secondary">
                          {relativeTime(change.timestamp)}
                          {change.undone && ' · Undone'}
                        </div>
                      </div>
                      {showUndo && (
                        <button
                          type="button"
                          onClick={() => onUndoChange!(change.id)}
                          aria-label={`Undo ${change.label}`}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-bg-page transition-opacity text-text-primary"
                          title="Undo"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                    {change.undoError && (
                      <div className="px-3 pb-1 text-[11px]" style={{ color: '#B42318' }}>
                        Undo failed: {change.undoError}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SideCard>
          );
        })()}

        {/* Progress */}
        <SideCard title="Progress" defaultOpen>
          {progressList.length === 0 ? (
            <p className="text-[13px] text-text-secondary px-1">No steps yet. Send a task message to see live progress.</p>
          ) : (
            <div className="flex flex-col gap-0">
              {progressList.map((step, i) => {
                const stepNumber = i + 1;
                const isCompleted = step.status === 'completed';
                const isActive = step.status === 'active';
                return (
                  <div key={i} className="flex items-start gap-3 relative" style={{ paddingBottom: i < progressList.length - 1 ? 16 : 0 }}>
                    {/* Vertical connector line — solid after a completed step, dashed after active/pending */}
                    {i < progressList.length - 1 && (
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
          )}
        </SideCard>

        {/* Folder — hidden until the backend actually mkdir's the workspace
            on the first Write/Edit tool call. Pure conversation sessions
            never show this card. */}
        {folderMaterialized && (
          <SideCard title="Folder" defaultOpen>
            <div className="flex flex-col gap-2">
              {folderPath && (
                <div
                  className="px-2 py-1 rounded font-mono type-caption text-text-secondary truncate"
                  style={{ background: 'var(--color-bg-hover)' }}
                  title={folderPath}
                >
                  {folderPath}
                </div>
              )}
              {folderList.length === 0 ? (
                <p className="text-[13px] text-text-secondary px-1">No files in this task.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {folderList.map((f) => (
                    <button
                      key={f.name}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
                    >
                      <File size={16} className="text-text-primary shrink-0" />
                      <span className="type-body text-text-primary truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SideCard>
        )}

        {/* Context */}
        <SideCard title="Context" defaultOpen>
          {contextList.length === 0 ? (
            <p className="text-[13px] text-text-secondary px-1">No context attached.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {contextList.map((f) => (
                <button
                  key={f.name}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
                >
                  <File size={16} className="text-text-primary shrink-0" />
                  <span className="type-body text-text-primary truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </SideCard>

        {/* Tools active */}
        <SideCard title="Tools active" defaultOpen>
          {toolsList.length === 0 ? (
            <p className="text-[13px] text-text-secondary px-1">No tools running.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {toolsList.map((f) => (
                <button
                  key={f.name}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
                >
                  <File size={16} className="text-text-primary shrink-0" />
                  <span className="type-body text-text-primary truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </SideCard>
      </div>

      {/* 6.3 footer — "Complete Session" / "Session complete". Rendered
          outside the scroll area so it stays pinned at the bottom of the
          panel, visible without requiring the user to scroll past the
          Changes / Progress / Folder / Context / Tools cards. Gated on
          `canCompleteSession` (= chat.projectId && folderMaterialized);
          Phase 5 legacy chats and pure-Q&A chats don't render a footer at
          all. Already-completed chats keep the footer but disable the
          button — rolling back after a successful merge is intentionally
          not part of Phase 6 scope (principle #2 subtract).

          Deployment-aware tri-state (candidate #2):
            • localhost (IS_CLAUDE_CODE_AVAILABLE): normal behavior
            • demo Vercel (IS_DEMO): visible but disabled + bilingual title
              tooltip — HRs see the capability, can't invoke it
            • self-use Vercel (!IS_DEMO && !IS_CLAUDE_CODE_AVAILABLE):
              footer hidden entirely — Beibei's external deployment can't
              run the SDK either, so don't dangle a dead button */}
      {canCompleteSession && (IS_CLAUDE_CODE_AVAILABLE || IS_DEMO) && (
        <div
          className="shrink-0 px-3 pb-4 pt-2 border-t"
          style={{ borderColor: 'var(--color-stroke-outline)' }}
          title={
            IS_DEMO
              ? 'Demo mode — session execution disabled / Demo 模式 —— 会话执行已禁用'
              : undefined
          }
        >
          <TertiaryButton
            onClick={() => {
              if (sessionCompleted || IS_DEMO) return;
              onCompleteSession?.();
            }}
            disabled={sessionCompleted || IS_DEMO}
            fullWidth
          >
            <span className="flex items-center gap-2">
              {sessionCompleted ? (
                <CheckCircle2 size={14} style={{ color: '#028901' }} />
              ) : (
                <GitMerge size={14} />
              )}
              {sessionCompleted ? 'Session complete' : 'Complete Session'}
            </span>
          </TertiaryButton>
        </div>
      )}
    </div>
  );
}
