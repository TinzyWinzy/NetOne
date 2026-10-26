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
  const [pending, setPending] = useState(false);
  useEffect(() => { backend('session').then(data => { setUser(data.user); setLocalDemo(data.localDemo); }).catch(failure => setError(failure.message)).finally(() => setLoading(false)); }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setError(''); setPending(true);
    try { const data = await backend('login', { username, password }); setUser(data.user); setPassword(''); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Sign-in failed.'); } finally { setPending(false); }
  }
  if (loading) return <main className="netone-shell main-area">Checking server session…</main>;
  if (user) return <SessionContext.Provider value={{ user, signOut: async () => { await backend('logout', {}); setUser(null); } }}>{children}</SessionContext.Provider>;
  return <main className="login-shell"><section className="login-story" aria-label="NetOne investment intelligence"><a className="sidebar-brand" href="/"><span className="brand-mark" aria-hidden="true">N<span>•</span></span><div><strong>NetOne<span className="brand-dot">.</span></strong><small>Investment intelligence</small></div></a><p className="eyebrow">FINANCE & TECHNOLOGY, CONNECTED</p><h2>A stronger network starts with a clearer decision.</h2><p>Bring capital planning, network performance and service assurance into one considered view.</p><small>NetOne · Network Investment and Service Assurance Intelligence</small></section><div className="login-form-wrap"><form className="login-form" onSubmit={login}><p className="eyebrow">YOUR EXECUTIVE WORKSPACE</p><div><h1>Welcome back.</h1><p className="subtle">Sign in to review your network investment evidence.</p></div><label>Username<input aria-label="Username" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /></label><label>Password<input aria-label="Password" type="password" autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="primary-button" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>{error && <p role="alert" className="data-notice">{error}</p>}{localDemo && <details className="login-demo"><summary>Local demonstration access</summary><p>Accounts: finance, executive, network, regulatory, admin.<br/>Password: <strong>netone-local-demo</strong>.<br/>These accounts are disabled in production unless explicitly configured.</p></details>}<p className="subtle">Synthetic evidence · Advisory decisions only</p></form></div></main>;
}
