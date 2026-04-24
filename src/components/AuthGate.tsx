import { type ReactNode } from 'react';
import { useAuth } from '../lib/useAuth';
import LoginScreen from './LoginScreen';

/** Render `<LoginScreen />` until the user has a cached credential, then
 *  render the wrapped app. The hook order is identical on both branches —
 *  the gate is a React component, not a conditional hook in App. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <LoginScreen />;
  return <>{children}</>;
}
