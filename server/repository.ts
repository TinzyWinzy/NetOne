import { promises as fs } from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { databaseUrl } from './database.js';
import { createHash } from 'node:crypto';
import type { Workspace } from '../src/domain/operations.js';
import type { SavedScenario } from '../src/domain/scenarios.js';
export interface AuditRecord { id: string; actor: string; role: string; action: string; subject: string; occurredAt: string; evidenceHash: string; beforeHash?: string; afterHash?: string }
interface Store { scenarios: SavedScenario[]; audit: AuditRecord[]; revoked?: { hash: string; expires: string }[]; workspace?: Workspace }
let queue: Promise<unknown> = Promise.resolve();
const file = () => path.join(process.env.NETONE_LOCAL_DATA_DIR || path.join(process.cwd(), '.netone-data'), 'store.json');
async function readLocal(): Promise<Store> {
  try { return JSON.parse(await fs.readFile(file(), 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { scenarios: [], audit: [] }; throw error; }
}
function db() { const url = databaseUrl(); return url ? neon(url) : null; }
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

export class RevisionConflict extends Error {}
export function canonicalId(key: string): string {
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key)) return key;
  const hash = createHash('sha256').update('netone:' + key).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
export async function loadWorkspace(): Promise<Workspace | null> {
  const sql = db(); if (sql) { const rows = await sql`SELECT snapshot FROM netone_workspace WHERE id='current'`; return rows[0]?.snapshot as Workspace || null; }
  localAllowed(); await queue; return structuredClone((await readLocal()).workspace || null);
}
export async function saveWorkspace(workspace: Workspace, expectedRevision: number, audit: AuditRecord, previous?: Workspace): Promise<void> {
  const sql = db();
  if (workspace.revision !== expectedRevision + 1) throw new RevisionConflict('Invalid workspace revision.');
  if (sql) {
    const operations = [sql`SELECT netone_replace_workspace(${expectedRevision}, ${JSON.stringify(workspace)}::jsonb)`];
    const previousIds: Record<string, Set<string>> = previous ? {
      netone_interventions: new Set(previous.sites.flatMap(site=>site.history.map((record,index)=>canonicalId(`intervention:${site.id}:${record.date}:${index}`)))),
      netone_source_mappings:new Set(previous.mappings.map(record=>canonicalId(record.id))),
      netone_incident_events:new Set(previous.incidents.flatMap(record=>record.events.map(event=>canonicalId(event.id)))),
      netone_rule_evaluations:new Set(previous.evaluations.map(record=>canonicalId(record.id))),
      netone_model_configs:new Set(previous.configs.map(record=>canonicalId(record.id))),
      netone_candidate_evidence:new Set(previous.evidence.map(record=>canonicalId(record.id))),
      netone_investment_candidates:new Set(previous.evidence.map(record=>canonicalId(record.id+':candidate'))),
      netone_score_components:new Set(previous.evidence.flatMap(record=>record.candidate.components.map(component=>canonicalId(record.id+':'+component.code)))),
      netone_import_runs:new Set(previous.imports.map(record=>canonicalId(record.id))),
      netone_score_runs:new Set(previous.scoreRuns.map(record=>canonicalId(record.id)))
    } : {};
    function project(table: string, rows: Record<string, unknown>[], columns: Record<string, string>, immutable = false) {
      if (immutable && previousIds[table]) rows=rows.filter(row=>!previousIds[table].has(String(row.id)));
      if (!rows.length) return;
      const keys = Object.keys(columns);
      const update = immutable ? 'DO NOTHING' : 'DO UPDATE SET ' + keys.filter(key => key !== 'id').map(key => `${key}=EXCLUDED.${key}`).join(',');
      operations.push(sql!.query(`INSERT INTO ${table} (${keys.join(',')}) SELECT ${keys.join(',')} FROM jsonb_to_recordset($1::jsonb) AS records(${keys.map(key => `${key} ${columns[key]}`).join(',')}) ON CONFLICT(id) ${update}`, [JSON.stringify(rows)]));
    }
    const siteId = (id: string) => canonicalId('site:' + id);
    const interval = (period: string) => { const [year,month]=period.split('-').map(Number); return {period_start:new Date(Date.UTC(year,month-1,1)).toISOString(),period_end:new Date(Date.UTC(year,month,1)).toISOString()}; };
    project('netone_sites', workspace.sites.map(site => ({ id: siteId(site.id), external_ref: site.id, snapshot: site })), { id: 'uuid', external_ref: 'text', snapshot: 'jsonb' });
    const units: Record<string, string> = { utilisation: '%', growth: '%/month', availability: '%', faults: 'count/month', trafficGB: 'GB/month', downtimeHours: 'hours/month' };
    const metrics:Record<string,unknown>[]=workspace.sites.flatMap(site => site.observations.flatMap(row => Object.entries(units).map(([metric, unit]) => ({ id: canonicalId(`metric:${site.id}:${row.period}:${metric}`), site_id: siteId(site.id), metric_code: metric, period: row.period, ...interval(row.period), value: row[metric as keyof typeof row] ?? null, unit, quality: row.quality, source_ref: row.sourceRef || `netone-demo/${site.id}/${row.period}`, demo: true }))));
    metrics.push(...workspace.sites.flatMap(site=>(site.networkHistory||[]).filter(point=>!site.observations.some(row=>row.period===point.period)).flatMap(point=>['trafficGB','utilisation','downtimeHours','faults'].map(metric=>({id:canonicalId(`metric:${site.id}:${point.period}:${metric}`),site_id:siteId(site.id),metric_code:metric,period:point.period,...interval(point.period),value:point[metric as 'trafficGB'|'utilisation'|'downtimeHours'|'faults'],unit:units[metric],quality:point.quality,source_ref:point.sourceRef,demo:true})))));
    project('netone_metrics',metrics, { id: 'uuid', site_id: 'uuid', metric_code: 'text', period: 'text', period_start:'timestamptz',period_end:'timestamptz',value: 'numeric', unit: 'text', quality: 'text', source_ref: 'text', demo: 'boolean' });
    project('netone_financials', workspace.sites.flatMap(site => site.observations.map(row => ({ id: canonicalId(`finance:${site.id}:${row.period}`), site_id: siteId(site.id), period: row.period, currency: 'USD', basis: 'Nominal synthetic monthly aggregates', snapshot: { capex: row.capex, opex: row.opex, contribution: row.contribution, failureCost: row.failureCost, quality: row.quality, sourceRef: row.sourceRef, demo: true } }))), { id: 'uuid', site_id: 'uuid', period: 'text', currency: 'text', basis: 'text', snapshot: 'jsonb' });
    project('netone_interventions', workspace.sites.flatMap(site => site.history.map((record, index) => ({ id: canonicalId(`intervention:${site.id}:${record.date}:${index}`), site_id: siteId(site.id), snapshot: record }))), { id: 'uuid', site_id: 'uuid', snapshot: 'jsonb' }, true);
    project('netone_source_mappings', workspace.mappings.map(record => ({ id: canonicalId(record.id), site_id: siteId(record.siteId), source: record.source, external_ref: record.externalRef })), { id: 'uuid', site_id: 'uuid', source: 'text', external_ref: 'text' }, true);
    project('netone_incidents', workspace.incidents.map(record => ({ id: canonicalId(record.id), site_id: siteId(record.siteId), status: record.events.at(-1)!.state, snapshot: record })), { id: 'uuid', site_id: 'uuid', status: 'text', snapshot: 'jsonb' });
    project('netone_incident_events', workspace.incidents.flatMap(record => record.events.map(event => ({ id: canonicalId(event.id), incident_id: canonicalId(record.id), snapshot: event }))), { id: 'uuid', incident_id: 'uuid', snapshot: 'jsonb' }, true);
    project('netone_rule_versions', workspace.rules.map(record => ({ id: canonicalId(record.id), code: record.code, version: record.version, status: record.status, snapshot: record })), { id: 'uuid', code: 'text', version: 'text', status: 'text', snapshot: 'jsonb' });
    project('netone_rule_evaluations', workspace.evaluations.map(record => ({ id: canonicalId(record.id), site_id: siteId(record.siteId), rule_id: canonicalId(record.ruleId), snapshot: record })), { id: 'uuid', site_id: 'uuid', rule_id: 'uuid', snapshot: 'jsonb' }, true);
    project('netone_model_configs', workspace.configs.map(record => ({ id: canonicalId(record.id), version: record.version, snapshot: record })), { id: 'uuid', version: 'integer', snapshot: 'jsonb' }, true);
    project('netone_candidate_evidence', workspace.evidence.map(record => ({ id: canonicalId(record.id), site_id: siteId(record.candidate.siteId), config_id: canonicalId(record.config.id), evidence_hash: record.hash, snapshot: record })), { id: 'uuid', site_id: 'uuid', config_id: 'uuid', evidence_hash: 'text', snapshot: 'jsonb' }, true);
    project('netone_investment_candidates', workspace.evidence.map(record=>({id:canonicalId(record.id+':candidate'),evidence_id:canonicalId(record.id),site_id:siteId(record.candidate.siteId),candidate_key:record.candidate.id,model_version:record.candidate.modelVersion,score:record.candidate.score,snapshot:record.candidate})),{id:'uuid',evidence_id:'uuid',site_id:'uuid',candidate_key:'text',model_version:'text',score:'numeric',snapshot:'jsonb'},true);
    project('netone_score_components', workspace.evidence.flatMap(record => record.candidate.components.map(component => ({ id: canonicalId(record.id + ':' + component.code), evidence_id: canonicalId(record.id), component_code: component.code, snapshot: component }))), { id: 'uuid', evidence_id: 'uuid', component_code: 'text', snapshot: 'jsonb' }, true);
    project('netone_import_runs', workspace.imports.map(record => ({ id: canonicalId(record.id), import_key: record.key, snapshot: record })), { id: 'uuid', import_key: 'text', snapshot: 'jsonb' }, true);
    project('netone_reviews', workspace.reviews.map(record => ({ id: canonicalId(record.id), snapshot: record })), { id: 'uuid', snapshot: 'jsonb' });
    project('netone_score_runs', workspace.scoreRuns.map(record => ({ id: canonicalId(record.id), snapshot: record })), { id: 'uuid', snapshot: 'jsonb' }, true);
    if(workspace.pilot){const p=workspace.pilot;
      project('netone_obligation_versions',p.obligations.map(o=>({id:canonicalId(o.id+':'+o.version),snapshot:o})),{id:'uuid',snapshot:'jsonb'},true);
      project('netone_cells',p.cells.map(c=>({id:canonicalId(c.id),site_id:siteId(c.siteId),snapshot:c})),{id:'uuid',site_id:'uuid',snapshot:'jsonb'});
      project('netone_cell_measurements',p.measurements.map(m=>({id:canonicalId(m.id),cell_id:canonicalId(m.cellId),snapshot:m})),{id:'uuid',cell_id:'uuid',snapshot:'jsonb'},true);
      project('netone_obligation_findings',p.findings.map(f=>({id:canonicalId(f.id),snapshot:f})),{id:'uuid',snapshot:'jsonb'},true);
      project('netone_corrective_cases',p.cases.map(c=>({id:canonicalId(c.id),site_id:siteId(c.siteId),snapshot:c})),{id:'uuid',site_id:'uuid',snapshot:'jsonb'});
      project('netone_privacy_reviews',p.privacyIncidents.map(r=>({id:canonicalId(r.id),snapshot:r})),{id:'uuid',snapshot:'jsonb'});
    }
    operations.push(sql`INSERT INTO netone_audit(id,occurred_at,record) VALUES(${audit.id},${audit.occurredAt},${JSON.stringify(audit)}::jsonb)`);
    try { await sql.transaction(operations); } catch (error) { if ((error as { code?: string }).code === '40001') throw new RevisionConflict('Workspace changed; reload and retry.'); throw error; }
    return;
  }
  localAllowed();
  const operation = queue.then(async () => {
    const store = await readLocal(); if ((store.workspace?.revision ?? -1) !== expectedRevision) throw new RevisionConflict('Workspace changed; reload and retry.');
    store.workspace = structuredClone(workspace); store.audit.push(audit);
    await fs.mkdir(path.dirname(file()), { recursive: true }); await fs.writeFile(file() + '.tmp', JSON.stringify(store), 'utf8'); await fs.rename(file() + '.tmp', file());
  });
  queue = operation.catch(() => undefined); await operation;
}
