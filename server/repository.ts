import { promises as fs } from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { SavedScenario } from '../src/domain/scenarios';
export interface AuditRecord { id: string; actor: string; role: string; action: string; subject: string; occurredAt: string; evidenceHash: string }
interface Store { scenarios: SavedScenario[]; audit: AuditRecord[]; revoked?: { hash: string; expires: string }[] }
let queue: Promise<unknown> = Promise.resolve();
const file = () => path.join(process.env.NETONE_LOCAL_DATA_DIR || path.join(process.cwd(), '.netone-data'), 'store.json');
async function readLocal(): Promise<Store> {
  try { return JSON.parse(await fs.readFile(file(), 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { scenarios: [], audit: [] }; throw error; }
}
function db() { return process.env.NETONE_DATABASE_URL ? neon(process.env.NETONE_DATABASE_URL) : null; }
function localAllowed() { if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('NETONE_DATABASE_URL is required outside local development.'); }
export async function listScenarios(): Promise<SavedScenario[]> {
  const sql = db(); if (sql) { const rows = await sql`SELECT snapshot FROM netone_scenarios ORDER BY created_at`; return rows.map(row => row.snapshot as SavedScenario); }
  localAllowed(); await queue; return (await readLocal()).scenarios;
}
export async function listAudit(): Promise<AuditRecord[]> {
  const sql = db(); if (sql) { const rows = await sql`SELECT record FROM netone_audit ORDER BY occurred_at DESC LIMIT 500`; return rows.map(row => row.record as AuditRecord); }
  localAllowed(); await queue; return (await readLocal()).audit.slice(-500).reverse();
}
export async function isRevoked(hash: string): Promise<boolean> {
  const sql = db(); if (sql) { const rows = await sql`SELECT token_hash FROM netone_revoked_sessions WHERE token_hash = ${hash} AND expires_at > NOW()`; return rows.length > 0; }
  localAllowed(); await queue; return (await readLocal()).revoked?.some(value => value.hash === hash && Date.parse(value.expires) > Date.now()) || false;
}
export async function commit(audit: AuditRecord, scenario?: SavedScenario, revoked?: { hash: string; expires: string }): Promise<void> {
  const sql = db();
  if (sql) {
    const operations = [sql`INSERT INTO netone_audit (id, occurred_at, record) VALUES (${audit.id}, ${audit.occurredAt}, ${JSON.stringify(audit)}::jsonb)`];
    if (scenario) operations.push(sql`INSERT INTO netone_scenarios (id, owner_id, created_at, evidence_hash, snapshot) VALUES (${scenario.id}, ${audit.actor}, ${scenario.savedAt}, ${audit.evidenceHash}, ${JSON.stringify(scenario)}::jsonb)`);
    if (revoked) operations.push(sql`INSERT INTO netone_revoked_sessions (token_hash, expires_at) VALUES (${revoked.hash}, ${revoked.expires}) ON CONFLICT DO NOTHING`);
    await sql.transaction(operations); return;
  }
  localAllowed();
  const operation = queue.then(async () => {
    const store = await readLocal();
    if (scenario) store.scenarios.push(scenario);
    store.audit.push(audit);
    if (revoked) store.revoked = [...(store.revoked || []).filter(value => Date.parse(value.expires) > Date.now()), revoked];
    await fs.mkdir(path.dirname(file()), { recursive: true });
    const temporary = `${file()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(store), 'utf8');
    await fs.rename(temporary, file());
  });
  queue = operation.catch(() => undefined); await operation;
}
