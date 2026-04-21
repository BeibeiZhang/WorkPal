import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import { PrimaryButton, TertiaryButton } from './shared';

interface PasswordModalProps {
  open: boolean;
  /** Inline error to surface below the input (e.g. "Wrong password"). */
  error?: string | null;
  busy?: boolean;
  /** Body copy under the title — lets callers explain what action is gated. */
  message?: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

/** Numeric PIN prompt shown before any memory mutation. The actual password
 *  comparison happens server-side; this component just gathers the input. */
export default function PasswordModal({ open, error, busy, message, onSubmit, onCancel }: PasswordModalProps) {
  const [pw, setPw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPw('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = pw.length > 0 && !busy;

  const handleSubmit = () => {
    if (canSubmit) onSubmit(pw);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleSubmit();
    if (e.key === 'Escape') onCancel();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="panel-border relative w-[400px] max-w-[90vw] rounded-[12px] p-7 shadow-2xl"
        style={{ background: 'var(--color-bg-page)' }}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors"
        >
          <X size={18} className="text-text-primary" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-bg-message)' }}
          >
            <Lock size={18} className="text-text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-text-primary leading-tight">Confirm with password</h2>
            <p className="text-[13px] text-text-secondary leading-tight mt-0.5">
              {message ?? 'Saving memory edits requires the password you set.'}
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter password"
          className="w-full px-3 py-2 rounded-lg text-[15px] text-text-primary placeholder-text-tertiary outline-none"
          style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-stroke-outline)' }}
        />

        {error && (
          <p className="mt-2 text-[12px]" style={{ color: '#c0392b' }}>{error}</p>
        )}

        <div className="flex items-center gap-2 justify-end mt-5">
          <TertiaryButton onClick={onCancel}>Cancel</TertiaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? 'Verifying…' : 'Confirm'}
          </PrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
