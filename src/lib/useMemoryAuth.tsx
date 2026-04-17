import { useCallback, useRef, useState } from 'react';
import PasswordModal from '../components/PasswordModal';
import { verifyPassword } from './memory';

const SESSION_KEY = 'workpal-memory-pw';

interface PendingPrompt {
  resolve: (pw: string) => void;
  reject: (reason?: unknown) => void;
}

/** Gate that lazily prompts for the memory password and caches the verified
 *  value in sessionStorage so the user only types it once per browser session.
 *  Mount the returned `passwordModal` once near the app root. */
export function useMemoryAuth() {
  const pendingRef = useRef<PendingPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  /** Returns a verified password. Resolves on success, rejects when the user
   *  cancels the prompt. Use try/catch to handle cancellation.
   *  Pass `force: true` to skip the session cache and always re-prompt — used
   *  by destructive actions (delete) so the password gets re-entered each time. */
  const ensurePassword = useCallback(async (opts?: { force?: boolean; message?: string }): Promise<string> => {
    if (!opts?.force) {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const ok = await verifyPassword(cached);
        if (ok) return cached;
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      setError(null);
      setMessage(opts?.message);
      setOpen(true);
    });
  }, []);

  const handleSubmit = useCallback(async (pw: string) => {
    setBusy(true);
    const ok = await verifyPassword(pw);
    setBusy(false);
    if (!ok) {
      setError('Wrong password — try again');
      return;
    }
    sessionStorage.setItem(SESSION_KEY, pw);
    pendingRef.current?.resolve(pw);
    pendingRef.current = null;
    setOpen(false);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    pendingRef.current?.reject(new Error('Password prompt cancelled'));
    pendingRef.current = null;
    setOpen(false);
    setError(null);
  }, []);

  const passwordModal = (
    <PasswordModal
      open={open}
      error={error}
      busy={busy}
      message={message}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );

  return { ensurePassword, passwordModal };
}
