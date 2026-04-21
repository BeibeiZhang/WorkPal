import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert } from 'lucide-react';
import { PrimaryButton, TertiaryButton } from './shared';
import type { PermissionKind, PermissionRequest } from '../types';

/** Modeled on the Claude Cowork permission prompt: Cancel / Always allow /
 *  Allow, with a scope-aware title so the user knows exactly what they're
 *  approving (the folder, the command, the URL). No real enforcement — the
 *  backend doesn't enforce anything yet; this is the UI surface for the
 *  Phase 4 spec's "访问外部文件要弹窗确认" flow. */

interface PermissionPromptProps {
  request: PermissionRequest | null;
  onAllow: (req: PermissionRequest) => void;
  onAlwaysAllow: (req: PermissionRequest) => void;
  onCancel: (req: PermissionRequest) => void;
}

function buildTitle(kind: PermissionKind, target: string, scope: string): string {
  switch (kind) {
    case 'file-write':
      return `Allow WorkPal to change files in "${scope}"?`;
    case 'file-read':
      return `Allow WorkPal to read "${scope}"?`;
    case 'command':
      return `Allow WorkPal to run this command?`;
    case 'external-url':
      return `Allow WorkPal to access ${scope}?`;
    default:
      return `Allow WorkPal to access ${target}?`;
  }
}

function buildBody(kind: PermissionKind, target: string): string {
  switch (kind) {
    case 'file-write':
      return 'This includes all files and subfolders. WorkPal will be able to read, edit, and permanently delete — and may share file contents with third-party tools it connects to. Be careful about exposing sensitive information.';
    case 'file-read':
      return 'WorkPal will be able to read the file contents and may share them with third-party tools it connects to. Be careful about exposing sensitive information.';
    case 'command':
      return 'WorkPal will execute this command in your shell. Only approve commands you understand — they can modify files, start processes, or reach external services.';
    case 'external-url':
      return 'WorkPal will send a request to this URL. Only approve destinations you trust — the request may include data from your session.';
    default:
      return `WorkPal is requesting access to: ${target}`;
  }
}

export default function PermissionPrompt({ request, onAllow, onAlwaysAllow, onCancel }: PermissionPromptProps) {
  useEffect(() => {
    if (!request) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel(request);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [request, onCancel]);

  if (!request) return null;

  const title = buildTitle(request.kind, request.target, request.scope);
  const body = buildBody(request.kind, request.target);
  const showTarget = request.kind === 'command' || request.kind === 'file-read' || request.kind === 'external-url';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="perm-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => onCancel(request)} />

      {/* Dialog */}
      <div
        className="panel-border relative w-[480px] max-w-[90vw] rounded-[16px] p-7 shadow-2xl"
        style={{ background: 'var(--color-bg-page)' }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-hover)' }}>
            <ShieldAlert size={20} className="text-text-primary" />
          </div>
          <h2
            id="perm-title"
            className="text-[20px] font-bold text-text-primary leading-[26px] tracking-[-0.43px] flex-1"
            style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            {title}
          </h2>
        </div>

        {/* Body */}
        <p className="text-[14px] leading-[22px] text-text-primary mb-4">{body}</p>

        {showTarget && (
          <div
            className="px-3 py-2 rounded-lg font-mono text-[13px] leading-[18px] text-text-primary break-all mb-4"
            style={{ background: 'var(--color-bg-hover)' }}
          >
            {request.target}
          </div>
        )}

        {request.reason && (
          <p className="text-[13px] leading-[18px] text-text-secondary mb-5">
            <span className="font-semibold text-text-primary">Why: </span>{request.reason}
          </p>
        )}

        {/* Actions — Cancel / Always allow / Allow */}
        <div className="flex items-center gap-3 mt-2">
          <TertiaryButton onClick={() => onCancel(request)} className="flex-1">Cancel</TertiaryButton>
          <TertiaryButton onClick={() => onAlwaysAllow(request)} className="flex-1">Always allow</TertiaryButton>
          <PrimaryButton onClick={() => onAllow(request)} className="flex-1">Allow</PrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
