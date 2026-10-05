import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorkspaceView } from '../domain/operations';
import { backend } from '../lib/backend';
const Context = createContext<{ workspace: WorkspaceView; refresh: () => Promise<void>; command: (action: string, body: Record<string, unknown>) => Promise<any> } | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('Canonical workspace provider missing.'); return value; }
export default function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace,setWorkspace]=useState<WorkspaceView|null>(null);const [error,setError]=useState('');
  const refresh=useCallback(async()=>{try{const data=await backend('workspace');setWorkspace(data.workspace);setError('');}catch(failure){setError(failure instanceof Error?failure.message:'Canonical data unavailable.');throw failure;}},[]);
  useEffect(()=>{refresh().catch(()=>undefined);},[refresh]);
  if(!workspace)return <main className="netone-shell main-area"><section className="panel"><h1>NetOne canonical evidence</h1><p role="status">{error||'Loading the shared portfolio and governance records…'}</p>{error&&<button className="primary-button" onClick={()=>refresh().catch(()=>undefined)}>Retry canonical data</button>}</section></main>;
  return <Context.Provider value={{workspace,refresh,command:async(action,body)=>{try{const data=await backend(action,{...body,revision:workspace.revision});await refresh();return data;}catch(failure){await refresh().catch(()=>undefined);throw failure;}}}}>{error&&<p className="data-notice" role="alert">{error}</p>}{children}</Context.Provider>;
}
