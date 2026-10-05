import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { backend } from '../lib/backend';
interface User { username: string; role: string }
const SessionContext = createContext<{ user: User; signOut: () => Promise<void> } | null>(null);
export function useSession() { const session = useContext(SessionContext); if (!session) throw new Error('Session provider missing'); return session; }
export default function SessionGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [localDemo, setLocalDemo] = useState(false);
  const [username, setUsername] = useState('finance');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { backend('session').then(data => { setUser(data.user); setLocalDemo(data.localDemo); }).catch(failure => setError(failure.message)).finally(() => setLoading(false)); }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setError('');
    try { const data = await backend('login', { username, password }); setUser(data.user); setPassword(''); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Sign-in failed.'); }
  }
  if (loading) return <main className="netone-shell main-area">Checking server session…</main>;
  if (user) return <SessionContext.Provider value={{ user, signOut: async () => { await backend('logout', {}); setUser(null); } }}>{children}</SessionContext.Provider>;
  return <main className="login-shell"><form className="panel" onSubmit={login}><p className="eyebrow">NETONE · SECURE SESSION</p><h1>Network Investment and Service Assurance Intelligence</h1><p className="subtle">Sign in to review synthetic investment evidence.</p><label>Username<input aria-label="Username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label><label>Password<input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="primary-button" type="submit">Sign in</button>{error && <p role="alert" className="data-notice">{error}</p>}{localDemo && <p className="subtle">Local demonstration accounts: finance, executive, network, regulatory, admin. Password: <strong>netone-local-demo</strong>. These accounts are disabled in production unless explicitly configured.</p>}</form></main>;
}
