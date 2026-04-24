import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { IS_DEMO } from './demoMode';
import { verifyPassword } from './memory';

const AUTH_KEY = 'workpal-auth-v1';
const LEGACY_SESSION_KEY = 'workpal-memory-pw';

interface StoredAuth {
  user: string;
  password: string;
}

interface AuthState {
  /** Whether the user has a verified credential cached. Demo mode is always true. */
  isAuthed: boolean;
  /** Display name for greetings. Empty string when not authed. */
  user: string;
  /** Verify with backend, persist to localStorage on success. Returns false on 401. */
  signIn: (user: string, password: string) => Promise<boolean>;
  /** Clear cached auth and flip back to login. No-op in demo mode. */
  signOut: () => void;
  /** Read the cached password synchronously. Used by ensurePassword and the
   *  cross-device sync layer that needs the password without prompting. */
  getCachedPassword: () => string | null;
  /** Update the cached password (e.g. after force-path re-verify in PasswordModal
   *  succeeds with a new server-side password). Keeps user unchanged. */
  updateCachedPassword: (password: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.user === 'string' && typeof parsed?.password === 'string') {
      return parsed;
    }
  } catch { /* corrupted entry — treat as missing */ }
  return null;
}

function writeStoredAuth(auth: StoredAuth) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch { /* quota — silently drop, user will re-login next reload */ }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch { /* ignore */ }
}

/** Drop the pre-login-gate sessionStorage key on first boot so the cross-device
 *  sync layer doesn't see a stale password from before the schema change. */
function migrateLegacyKey() {
  try {
    if (sessionStorage.getItem(LEGACY_SESSION_KEY)) {
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    }
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hooks always run in the same order regardless of IS_DEMO so the
  // react-hooks rule stays happy. Demo mode swaps to a synthetic always-authed
  // value at the end — no localStorage I/O, no signOut affordance.
  const [stored, setStored] = useState<StoredAuth | null>(() => {
    if (IS_DEMO) return null;
    migrateLegacyKey();
    return readStoredAuth();
  });

  const signIn = useCallback(async (user: string, password: string): Promise<boolean> => {
    const trimmedUser = user.trim();
    if (!trimmedUser || !password) return false;
    const ok = await verifyPassword(password);
    if (!ok) return false;
    const next = { user: trimmedUser, password };
    writeStoredAuth(next);
    setStored(next);
    return true;
  }, []);

  const signOut = useCallback(() => {
    clearStoredAuth();
    setStored(null);
  }, []);

  const getCachedPassword = useCallback(() => stored?.password ?? null, [stored]);

  const updateCachedPassword = useCallback((password: string) => {
    setStored((prev) => {
      if (!prev) return prev;
      const next = { ...prev, password };
      writeStoredAuth(next);
      return next;
    });
  }, []);

  // Cross-tab signOut: if another tab clears the auth key, this tab follows
  // suit so a stale signed-in tab can't continue making 401-bound requests.
  useEffect(() => {
    if (IS_DEMO) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== AUTH_KEY) return;
      if (!e.newValue) setStored(null);
      else {
        try {
          const parsed = JSON.parse(e.newValue);
          if (typeof parsed?.user === 'string' && typeof parsed?.password === 'string') {
            setStored(parsed);
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<AuthState>(() => {
    if (IS_DEMO) {
      // Demo URL must render exactly like the pre-login-gate version. The
      // hardcoded "Beibei Zhang" name was visible on the avatar menu and
      // first-name "Beibei" in the WelcomeState greeting; both surfaces now
      // read from this synthetic value.
      return {
        isAuthed: true,
        user: 'Beibei Zhang',
        signIn: async () => true,
        signOut: () => { /* no-op */ },
        getCachedPassword: () => null,
        updateCachedPassword: () => { /* no-op */ },
      };
    }
    return {
      isAuthed: !!stored,
      user: stored?.user ?? '',
      signIn,
      signOut,
      getCachedPassword,
      updateCachedPassword,
    };
  }, [stored, signIn, signOut, getCachedPassword, updateCachedPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
