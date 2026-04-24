import { useCallback, useRef, useState } from 'react';
import PasswordModal from '../components/PasswordModal';
import { verifyPassword } from './memory';
import { useAuth } from './useAuth';

interface PendingPrompt {
  resolve: (pw: string) => void;
  reject: (reason?: unknown) => void;
}

/** Gate that returns the verified memory password.
 *
 *  Default path (`ensurePassword()`): the login gate already cached a
 *  verified password at sign-in, so we resolve synchronously from useAuth.
 *  No modal pops up for first-touch memory edits or connector toggles.
 *
 *  Force path (`ensurePassword({ force: true })`): destructive actions
 *  (delete memory) re-prompt anyway. The modal hits `/api/memories/verify`
 *  on submit — if the server password rotated since login, the user can
 *  type the new one and we update the cache so subsequent syncs recover
 *  without bouncing back to the login screen.
 *
 *  Mount the returned `passwordModal` once near the app root. */
export function useMemoryAuth() {
  const { getCachedPassword, updateCachedPassword } = useAuth();
  const pendingRef = useRef<PendingPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const ensurePassword = useCallback(async (opts?: { force?: boolean; message?: string }): Promise<string> => {
    if (!opts?.force) {
      const cached = getCachedPassword();
      if (cached) return cached;
      // Defensive: AuthGate guarantees we're authed before App mounts, so
      // a missing cache here means something racy. Fall through to the
      // modal so the call doesn't deadlock.
    }
    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      setError(null);
      setMessage(opts?.message);
      setOpen(true);
    });
  }, [getCachedPassword]);

  const handleSubmit = useCallback(async (pw: string) => {
    setBusy(true);
    const ok = await verifyPassword(pw);
    setBusy(false);
    if (!ok) {
      setError('Wrong password — try again');
      return;
    }
    // Sync the cache to whatever password the server just accepted. If the
    // user typed a rotated password here, future flush/hydrate calls pick up
    // the new value automatically — no signOut/re-login round trip.
    updateCachedPassword(pw);
    pendingRef.current?.resolve(pw);
    pendingRef.current = null;
    setOpen(false);
    setError(null);
  }, [updateCachedPassword]);

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
