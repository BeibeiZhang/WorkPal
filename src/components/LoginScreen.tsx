import { useState, useRef } from 'react';
import { User, Lock } from 'lucide-react';
import { PrimaryButton, TextField } from './shared';
import { useAuth } from '../lib/useAuth';

/** Full-screen login gate — username + password verified against the backend
 *  via /api/memories/verify. Username is currently a UI placeholder (backend
 *  validates only the password against MEMORY_PASSWORD); persisting it lets
 *  future multi-user support be a backend-only change with no UI churn.
 *
 *  Both inputs ship `autocomplete="username"` / `autocomplete="current-password"`
 *  so Mac + iOS Safari Keychain can autofill. */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const canSubmit = user.trim().length > 0 && password.length > 0 && !busy;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    const ok = await signIn(user, password);
    setBusy(false);
    if (!ok) {
      setError('Wrong username or password');
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center app-bg">
      <form
        onSubmit={handleSubmit}
        className="panel-border w-[420px] max-w-[90vw] rounded-[16px] p-8 flex flex-col gap-6"
        style={{ background: 'var(--color-bg-page)', boxShadow: 'var(--shadow-popup)' }}
      >
        <div className="flex flex-col gap-2">
          <h1 className="type-h1 gradient-text">WorkPal</h1>
          <p className="type-detail text-text-secondary">
            Sign in to sync your chats, projects, and memory across devices.
          </p>
        </div>

        <TextField
          label="Username"
          name="username"
          value={user}
          onChange={setUser}
          autoComplete="username"
          autoFocus
          placeholder="Your name"
          leadingIcon={<User size={16} />}
          inputRef={userRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              passwordRef.current?.focus();
            }
          }}
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Enter password"
          leadingIcon={<Lock size={16} />}
          error={error}
          inputRef={passwordRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />

        <PrimaryButton onClick={() => void handleSubmit()} disabled={!canSubmit} fullWidth>
          {busy ? 'Signing in…' : 'Sign in'}
        </PrimaryButton>
      </form>
    </div>
  );
}
