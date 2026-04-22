import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Copy, FilePlus2, FilePen, FileMinus2, Loader2 } from 'lucide-react';
import { PrimaryButton, TertiaryButton } from './shared';
import type { SessionDiffEntry } from '../lib/api';

/** 6.3 Complete Session modal — six visual states driven by `phase`:
 *    loading  → spinner, diff POST in-flight
 *    ready    → file list rendered, user can Cancel or Merge
 *    empty    → diff came back empty (Undo-all edge case)
 *    merging  → Merge POST in-flight
 *    success  → ✅ + auto-close timer
 *    not-ff   → ❌ + bilingual error + CLI command
 *    other    → ❌ + bilingual error
 *  Chrome mirrors PermissionPrompt: createPortal + fixed inset-0 + Esc-to-
 *  cancel (ignored while mid-merge so a stray key press can't leave the UI
 *  in a half-applied state). */

export type CompleteSessionPhase =
  | { kind: 'loading' }
  | { kind: 'ready'; files: SessionDiffEntry[] }
  | { kind: 'empty' }
  | { kind: 'merging' }
  | { kind: 'success'; alreadyUpToDate: boolean }
  | { kind: 'error-not-ff'; message: string; cliCommand: string }
  | { kind: 'error-other'; message: string };

interface CompleteSessionModalProps {
  phase: CompleteSessionPhase;
  onCancel: () => void;
  onMerge: () => void;
}

const STATUS_ICON = {
  A: FilePlus2,
  M: FilePen,
  D: FileMinus2,
} as const;

const STATUS_COLOR = {
  A: '#028901', // green — matches ChangeEntry 'create'
  M: '#3171ff', // blue — matches ChangeEntry 'edit'
  D: '#B42318', // red — matches ChangeEntry 'delete'
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
}: CompleteSessionModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

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
    phase.kind === 'success'
      ? 'Session complete'
      : phase.kind === 'error-not-ff' || phase.kind === 'error-other'
        ? 'Could not complete session'
        : 'Complete Session';

  const mergeDisabled =
    phase.kind !== 'ready' || phase.files.length === 0;

  const cancelLabel =
    phase.kind === 'success' || phase.kind === 'error-not-ff' || phase.kind === 'error-other'
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
          className="type-h1 text-text-primary mb-3"
          style={{
            fontFamily:
              'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          }}
        >
          {title}
        </h2>

        {/* ── loading ─────────────────────────────────── */}
        {phase.kind === 'loading' && (
          <div className="flex items-center gap-3 py-6 text-text-primary">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[14px]">Analyzing changes…</span>
          </div>
        )}

        {/* ── ready (file list) ───────────────────────── */}
        {phase.kind === 'ready' && (
          <>
            <p className="type-detail text-text-primary mb-3">
              {phase.files.length === 1
                ? '1 file will merge into the project base.'
                : `${phase.files.length} files will merge into the project base.`}
            </p>
            <div className="flex-1 overflow-y-auto min-h-0 mb-4 -mx-1 px-1">
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
                      <span className="flex-1 min-w-0 text-[13px] text-text-primary truncate">
                        {basename(f.path)}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[12px]"
                        style={{ color: '#028901' }}
                      >
                        +{formatCount(f.insertions)}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[12px]"
                        style={{ color: '#B42318' }}
                      >
                        -{formatCount(f.deletions)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── empty diff (edge case: all commits undone) ── */}
        {phase.kind === 'empty' && (
          <p className="type-detail text-text-primary mb-4">
            Nothing to merge — this session made no net changes to the
            project.
            <br />
            <span className="text-text-secondary">
              本会话没有净改动。
            </span>
          </p>
        )}

        {/* ── merging ─────────────────────────────────── */}
        {phase.kind === 'merging' && (
          <div className="flex items-center gap-3 py-6 text-text-primary">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[14px]">Merging…</span>
          </div>
        )}

        {/* ── success ─────────────────────────────────── */}
        {phase.kind === 'success' && (
          <div className="flex items-start gap-3 py-3">
            <CheckCircle2
              size={22}
              className="shrink-0 mt-[2px]"
              style={{ color: '#028901' }}
            />
            <div className="flex-1">
              <p className="type-detail text-text-primary mb-2">
                {phase.alreadyUpToDate
                  ? 'No changes — project was already up to date with this session.'
                  : "Session merged into the project base."}
              </p>
              <p className="text-[13px] leading-[20px] text-text-secondary">
                The worktree remains for reference and will be cleaned up
                automatically.
                <br />
                工作树保留作参考,将被自动清理。
              </p>
            </div>
          </div>
        )}

        {/* ── error: not-ff ───────────────────────────── */}
        {phase.kind === 'error-not-ff' && (
          <>
            <p className="type-detail text-text-primary mb-3">
              {phase.message}
            </p>
            <p className="text-[13px] leading-[20px] text-text-secondary mb-2">
              Resolve in terminal:
              <br />
              请在终端解决:
            </p>
            <div className="relative">
              <pre
                className="pl-3 pr-12 py-2 rounded-lg font-mono text-[12px] leading-[18px] text-text-primary whitespace-pre-wrap break-all select-all"
                style={{ background: 'var(--color-bg-hover)' }}
              >
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
                <span
                  className="text-[11px] leading-[16px] font-medium"
                  style={{ color: '#028901' }}
                >
                  Copied! / 已复制
                </span>
              )}
              {copyState === 'failed' && (
                <span className="text-[11px] leading-[16px] text-text-secondary">
                  Copy failed — select and ⌘C / 复制失败 — 请选中后 ⌘C
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
              onClick={onMerge}
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
