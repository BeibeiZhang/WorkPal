import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Copy, FilePlus2, FilePen, FileMinus2, Loader2, XCircle } from 'lucide-react';
import { Checkbox, PrimaryButton, TertiaryButton } from './shared';
import type { SessionDiffEntry, SessionMergeTargetResult } from '../lib/api';

/** 6.3 + §20 Complete Session modal — visual states driven by `phase`:
 *    loading          → spinner, diff POST in-flight
 *    ready            → file list rendered + (if refs attached) target
 *                       checkboxes; user can Cancel or Merge
 *    empty            → diff came back empty (Undo-all edge case)
 *    merging          → Merge POST in-flight
 *    success          → ✅ + auto-close timer (single-target-only path)
 *    partial-success  → §20: per-target rows (✓ / warn / ✗) when the user
 *                       picked refs. Replaces `success` whenever results
 *                       contain ref folder targets, even if all succeeded.
 *    not-ff           → ❌ + bilingual error + CLI command
 *    other            → ❌ + bilingual error
 *  Chrome mirrors PermissionPrompt: createPortal + fixed inset-0 + Esc-to-
 *  cancel (ignored while mid-merge so a stray key press can't leave the UI
 *  in a half-applied state). */

export type CompleteSessionPhase =
  | { kind: 'loading' }
  | { kind: 'ready'; files: SessionDiffEntry[] }
  | { kind: 'empty' }
  | { kind: 'merging' }
  | { kind: 'success'; alreadyUpToDate: boolean }
  | { kind: 'partial-success'; results: SessionMergeTargetResult[] }
  | { kind: 'error-not-ff'; message: string; cliCommand: string }
  | { kind: 'error-other'; message: string };

interface CompleteSessionModalProps {
  phase: CompleteSessionPhase;
  onCancel: () => void;
  onMerge: (targets: { project: boolean; referenceFolders: string[] }) => void;
  /** §20: project's attached reference folders. When non-empty, the modal
   *  renders a target selector (project + each ref folder as checkboxes).
   *  Empty/undefined → modal degrades to the original single-action flow. */
  referenceFolders?: string[];
}

const STATUS_ICON = {
  A: FilePlus2,
  M: FilePen,
  D: FileMinus2,
} as const;

const STATUS_COLOR = {
  A: 'var(--color-accent-green)',
  M: 'var(--color-accent-blue)',
  D: 'var(--color-error)',
} as const;

const STATUS_LABEL = {
  A: 'Added',
  M: 'Modified',
  D: 'Deleted',
} as const;

function basename(path: string): string {
  const t = path.replace(/\/+$/, '');
  const idx = t.lastIndexOf('/');
  return idx < 0 ? t : t.slice(idx + 1);
}

function formatCount(n: number): string {
  // -1 sentinel from server means binary file; numstat can't count lines.
  if (n < 0) return '—';
  return String(n);
}

export default function CompleteSessionModal({
  phase,
  onCancel,
  onMerge,
  referenceFolders,
}: CompleteSessionModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // §20: target selection state. Project defaults to checked (preserves
  // pre-§20 behavior); ref folders default to unchecked so the user has to
  // opt in. The list is keyed by absolute path — duplicates are blocked
  // upstream by the project store's referenceDirectories validation.
  const refFolders = useMemo(() => referenceFolders ?? [], [referenceFolders]);
  const hasRefFolders = refFolders.length > 0;
  const [projectChecked, setProjectChecked] = useState(true);
  const [refsChecked, setRefsChecked] = useState<Record<string, boolean>>({});

  const selectedRefFolders = useMemo(
    () => refFolders.filter((p) => refsChecked[p]),
    [refFolders, refsChecked],
  );
  const noTargetSelected = !projectChecked && selectedRefFolders.length === 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Swallow Esc while a merge is in flight — we don't have a cancel
      // signal wired through to the server, and showing a half-cancelled
      // state is worse than making the user wait a beat.
      if (phase.kind === 'merging' || phase.kind === 'loading') return;
      onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [phase.kind, onCancel]);

  // Only 'copied' auto-reverts; 'failed' sticks until the next click so the
  // user has time to read the fallback hint. Effect cleanup handles both
  // rapid double-clicks (new timeout replaces old) and unmount.
  useEffect(() => {
    if (copyState !== 'copied') return;
    const id = setTimeout(() => setCopyState('idle'), 1500);
    return () => clearTimeout(id);
  }, [copyState]);

  const handleCopy = async (text: string) => {
    // navigator.clipboard requires a secure context (localhost counts). If
    // it's missing or writeText rejects (Safari private mode, perm denied),
    // fall back to an inline hint — no toast / alert per 6.4 spec.
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const title =
    phase.kind === 'success' || phase.kind === 'partial-success'
      ? 'Session complete'
      : phase.kind === 'error-not-ff' || phase.kind === 'error-other'
        ? 'Could not complete session'
        : 'Complete Session';

  const mergeDisabled =
    phase.kind !== 'ready' || phase.files.length === 0 || noTargetSelected;

  const cancelLabel =
    phase.kind === 'success' ||
    phase.kind === 'partial-success' ||
    phase.kind === 'error-not-ff' ||
    phase.kind === 'error-other'
      ? 'Close'
      : 'Cancel';

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-session-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (phase.kind === 'merging' || phase.kind === 'loading') return;
          onCancel();
        }}
      />

      <div
        className="panel-border relative w-[520px] max-w-[92vw] max-h-[82vh] rounded-[16px] p-7 shadow-2xl flex flex-col"
        style={{
          background: 'var(--color-bg-page)',
        }}
      >
        <h2
          id="complete-session-title"
          className="type-h1--emphasized text-text-primary mb-3"
        >
          {title}
        </h2>

        {/* ── loading ─────────────────────────────────── */}
        {phase.kind === 'loading' && (
          <div className="flex items-center gap-3 py-6 text-text-primary">
            <Loader2 size={18} className="animate-spin" />
            <span className="type-detail">Analyzing changes…</span>
          </div>
        )}

        {/* ── ready (file list + §20 target selector) ─── */}
        {phase.kind === 'ready' && (
          <>
            <p className="type-detail text-text-primary mb-3">
              {phase.files.length === 1
                ? '1 file changed in this session.'
                : `${phase.files.length} files changed in this session.`}
            </p>
            <div className={`overflow-y-auto min-h-0 -mx-1 px-1 ${hasRefFolders ? 'max-h-[180px] mb-3' : 'flex-1 mb-4'}`}>
              <div className="flex flex-col gap-1">
                {phase.files.map((f) => {
                  const Icon = STATUS_ICON[f.status];
                  const color = STATUS_COLOR[f.status];
                  return (
                    <div
                      key={f.path}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
                      title={`${STATUS_LABEL[f.status]} — ${f.path}`}
                    >
                      <Icon size={16} className="shrink-0" style={{ color }} />
                      <span className="flex-1 min-w-0 type-detail text-text-primary truncate">
                        {basename(f.path)}
                      </span>
                      <span className="shrink-0 font-mono type-caption text-accent-green">
                        +{formatCount(f.insertions)}
                      </span>
                      <span className="shrink-0 font-mono type-caption text-error">
                        -{formatCount(f.deletions)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* §20 target selector — only renders when this project has
             *  reference folders attached. Without refs the modal stays in
             *  its pre-§20 single-action shape (Merge button merges into the
             *  project base implicitly).
             */}
            {hasRefFolders && (
              <div className="flex-1 overflow-y-auto min-h-0 mb-3 -mx-1 px-1 border-t border-stroke-outline pt-3">
                <p className="type-detail-emphasized text-text-primary mb-2 px-3">Merge into:</p>
                <Checkbox
                  checked={projectChecked}
                  onChange={setProjectChecked}
                  label="Project main"
                  hint="Save to project knowledge for future sessions"
                />
                {refFolders.map((path) => (
                  <Checkbox
                    key={path}
                    checked={!!refsChecked[path]}
                    onChange={(next) =>
                      setRefsChecked((prev) => ({ ...prev, [path]: next }))
                    }
                    label={basename(path)}
                    hint={path}
                  />
                ))}
                {noTargetSelected && (
                  <p className="type-caption text-text-secondary mt-1 px-3">
                    Select at least one target.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── empty diff (edge case: all commits undone) ── */}
        {phase.kind === 'empty' && (
          <p className="type-detail text-text-primary mb-4">
            Nothing to merge — this session made no net changes to the
            project.
          </p>
        )}

        {/* ── merging ─────────────────────────────────── */}
        {phase.kind === 'merging' && (
          <div className="flex items-center gap-3 py-6 text-text-primary">
            <Loader2 size={18} className="animate-spin" />
            <span className="type-detail">Merging…</span>
          </div>
        )}

        {/* ── success ─────────────────────────────────── */}
        {phase.kind === 'success' && (
          <div className="flex items-start gap-3 py-3">
            <CheckCircle2 size={22} className="shrink-0 mt-[2px] text-accent-green" />
            <div className="flex-1">
              <p className="type-detail text-text-primary mb-2">
                {phase.alreadyUpToDate
                  ? 'No changes — project knowledge already up to date with this session.'
                  : 'Saved to project knowledge — future sessions in this project can read these outputs.'}
              </p>
              <p className="type-detail leading-[20px] text-text-secondary">
                The worktree remains for reference and will be cleaned up
                automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── partial-success (§20 multi-target results) ─ */}
        {phase.kind === 'partial-success' && (
          <div className="flex-1 overflow-y-auto min-h-0 mb-4 -mx-1 px-1">
            <div className="flex flex-col gap-2">
              {phase.results.map((r, i) => {
                const labelPath =
                  r.target === 'project' ? 'Project main' : basename(r.path);
                const subPath = r.target === 'reference' ? r.path : undefined;
                return (
                  <div
                    key={`${r.target}-${r.target === 'reference' ? r.path : 'project'}-${i}`}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg"
                  >
                    {targetResultIcon(r)}
                    <div className="flex-1 min-w-0">
                      <p className="type-detail text-text-primary truncate">{labelPath}</p>
                      {subPath && (
                        <p className="type-caption text-text-secondary truncate">
                          {subPath}
                        </p>
                      )}
                      <p className={`type-caption ${targetResultColorClass(r)}`}>
                        {targetResultMessage(r)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── error: not-ff ───────────────────────────── */}
        {phase.kind === 'error-not-ff' && (
          <>
            <p className="type-detail text-text-primary mb-3">
              {phase.message}
            </p>
            <p className="type-detail leading-[20px] text-text-secondary mb-2">
              Resolve in terminal:
            </p>
            <div className="relative">
              <pre className="pl-3 pr-12 py-2 rounded-lg font-mono type-caption text-text-primary whitespace-pre-wrap break-all select-all bg-bg-hover">
                {phase.cliCommand}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(phase.cliCommand)}
                aria-label="Copy command"
                className="absolute top-1.5 right-1.5 flex items-center justify-center w-7 h-7 rounded-md border border-stroke-outline bg-bg-page hover:bg-bg-hover text-text-secondary transition-colors cursor-pointer"
              >
                <Copy size={14} />
              </button>
            </div>
            {/* Reserved row for flash/fallback so layout doesn't shift. */}
            <div className="min-h-[16px] mt-1 mb-4 text-right">
              {copyState === 'copied' && (
                <span className="type-footnote font-medium text-accent-green">
                  Copied!
                </span>
              )}
              {copyState === 'failed' && (
                <span className="type-footnote text-text-secondary">
                  Copy failed — select and ⌘C
                </span>
              )}
            </div>
          </>
        )}

        {/* ── error: other ────────────────────────────── */}
        {phase.kind === 'error-other' && (
          <p className="type-detail text-text-primary mb-4 whitespace-pre-wrap break-words">
            {phase.message}
          </p>
        )}

        {/* ── action row ──────────────────────────────── */}
        <div className="flex items-center gap-3 mt-auto pt-2">
          <TertiaryButton
            onClick={onCancel}
            disabled={phase.kind === 'merging' || phase.kind === 'loading'}
            className="flex-1"
          >
            {cancelLabel}
          </TertiaryButton>
          {(phase.kind === 'ready' ||
            phase.kind === 'empty' ||
            phase.kind === 'loading' ||
            phase.kind === 'merging') && (
            <PrimaryButton
              onClick={() =>
                onMerge({
                  project: hasRefFolders ? projectChecked : true,
                  referenceFolders: selectedRefFolders,
                })
              }
              disabled={mergeDisabled}
              className="flex-1"
            >
              {phase.kind === 'merging' ? 'Merging…' : 'Merge'}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── §20 partial-success row helpers ─────
 * Three states share one row layout: success (green check + count),
 * warning (gray AlertCircle + "AI didn't produce outputs/" hint), failure
 * (red XCircle + friendly per-code message). Warning is deliberately NOT
 * red — see CLAUDE.md flagged review #4: a missing outputs/ dir is the
 * agent skipping the layout convention, not a true failure.
 */

function targetResultIcon(r: SessionMergeTargetResult) {
  if (r.target === 'reference' && r.ok && 'warning' in r) {
    return (
      <AlertCircle size={20} className="shrink-0 mt-[2px] text-text-tertiary" />
    );
  }
  if (r.ok) {
    return (
      <CheckCircle2 size={20} className="shrink-0 mt-[2px] text-accent-green" />
    );
  }
  return <XCircle size={20} className="shrink-0 mt-[2px] text-error" />;
}

function targetResultColorClass(r: SessionMergeTargetResult): string {
  if (r.target === 'reference' && r.ok && 'warning' in r) return 'text-text-tertiary';
  if (r.ok) return 'text-text-secondary';
  return 'text-error';
}

function targetResultMessage(r: SessionMergeTargetResult): string {
  if (r.target === 'project') {
    if (r.ok) {
      return r.alreadyUpToDate
        ? 'Already up to date.'
        : 'Saved to project knowledge.';
    }
    return r.error;
  }
  // reference target
  if (r.ok && 'warning' in r) {
    if (r.warning === 'no_new_deliverables') {
      return 'No new deliverable files — try outputs/<filename> next time.';
    }
    return "AI didn't produce outputs/ — nothing copied to this folder.";
  }
  if (r.ok && 'usedFallback' in r && r.usedFallback) {
    return r.copiedCount === 1
      ? 'Merged 1 file from session root — AI wrote outside outputs/.'
      : `Merged ${r.copiedCount} files from session root — AI wrote outside outputs/.`;
  }
  if (r.ok) {
    return r.copiedCount === 1
      ? 'Merged 1 file.'
      : `Merged ${r.copiedCount} files.`;
  }
  switch (r.code) {
    case 'permission_denied':
      return "Couldn't write to this folder — check folder permissions.";
    case 'not_found':
      return 'This folder no longer exists.';
    case 'disk_full':
      return 'Disk is full.';
    case 'invalid_path':
      return r.message;
    case 'unknown':
    default:
      return r.message;
  }
}
