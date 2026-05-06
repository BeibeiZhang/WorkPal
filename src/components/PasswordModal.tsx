import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import { PrimaryButton, TertiaryButton, TextField } from './shared';
import { IS_DEMO } from '../lib/demoMode';

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

/** Password prompt for destructive actions (force-path of useMemoryAuth) and
 *  any future re-verify flows. The actual password comparison happens
 *  server-side; this component just gathers the input. */
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

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canSubmit) handleSubmit();
    if (e.key === 'Escape') onCancel();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
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
            <Lock size={18} className="text-text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="password-modal-title" className="type-h2-emphasized text-text-primary">Confirm with password</h2>
            <p className="type-detail text-text-secondary mt-0.5">
              {message ?? 'Saving memory edits requires the password you set.'}
            </p>
          </div>
        </div>

        {IS_DEMO && (
          <p className="type-footnote text-text-secondary mb-2">
            Demo build — there's no real password. Edits stay local; deletes can't be confirmed.
          </p>
        )}

        <TextField
          type="password"
          value={pw}
          onChange={setPw}
          onKeyDown={handleKey}
          placeholder="Enter password"
          autoComplete="current-password"
          inputRef={inputRef}
          error={error}
        />

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
