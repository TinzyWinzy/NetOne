import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { portfolio } from '../src/data/portfolio.js';
import { filterPortfolio, PERIODS, STATES } from '../src/domain/portfolio.js';
import { generateCandidates } from '../src/domain/investments.js';
import { allocateScenario } from '../src/domain/scenarios.js';
import type { ScenarioInput, SavedScenario } from '../src/domain/scenarios.js';
import { commit, listScenarios, listAudit, isRevoked, loadWorkspace, saveWorkspace, RevisionConflict } from './repository.js';
import { databaseUrl } from './database.js';
import { seedWorkspace } from './seed.js';
import { executeCommand, digest, CommandError, validateFilters } from './commands.js';
import { enrichSites, scoreWorkspace, sensitivity } from '../src/domain/operations.js';
import type { Workspace } from '../src/domain/operations.js';
export type Role = 'Executive' | 'Finance' | 'Network' | 'Regulatory' | 'Admin';
export interface Identity { username: string; role: Role }
interface Account extends Identity { salt: string; hash: string }
export interface RequestData { method: string; action: string; id?: string; cookie?: string; origin?: string; host: string; body?: any }
export interface ResponseData { status: number; body: unknown; headers?: Record<string, string> }
const production = () => !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const localSecret = randomBytes(32).toString('hex');
const roles: Role[] = ['Executive', 'Finance', 'Network', 'Regulatory', 'Admin'];
const localAccounts: Account[] = roles.map(role => {
  const salt = randomBytes(16).toString('hex');
  return { username: role.toLowerCase(), role, salt, hash: scryptSync('netone-local-demo', salt, 32).toString('hex') };
});
function secret() {
  const value = process.env.NETONE_AUTH_SECRET;
  if (production() && (!value || value.length < 32 || !process.env.NETONE_USERS_JSON || !databaseUrl() || !process.env.NETONE_PUBLIC_ORIGIN)) throw new Error('NetOne authentication, users, database and public origin must be configured for deployment.');
  return value || localSecret;
}
function accounts(): Account[] {
  if (!process.env.NETONE_USERS_JSON) return localAccounts;
  const values = JSON.parse(process.env.NETONE_USERS_JSON) as Account[];
  if (!Array.isArray(values) || !values.every(value => typeof value.username === 'string' && roles.includes(value.role) && /^[a-f0-9]{32}$/.test(value.salt) && /^[a-f0-9]{64}$/.test(value.hash))) throw new Error('Invalid NetOne account configuration.');
  return values;
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');
async function identity(cookie = ''): Promise<Identity | null> {
  try {
    const token = cookie.split(';').map(value => value.trim()).find(value => value.startsWith('netone_session='))?.slice('netone_session='.length);
    if (!token) return null;
    const [payload, signature] = token.split('.'); const expected = sign(payload);
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (session.expires <= Date.now() || session.expires > Date.now() + 8 * 3600000) return null;
    if (await isRevoked(createHash('sha256').update(token).digest('hex'))) return null;
    const account = accounts().find(value => value.username === session.username && value.role === session.role);
    return account ? { username: account.username, role: account.role } : null;
  } catch { return null; }
}
function cookie(value: string, maxAge: number) { return `netone_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${production() ? '; Secure' : ''}`; }
function canonical(value: any): any { return Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value; }
const evidenceHash = (data: unknown) => createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
const audit = async (actor: Identity, action: string, subject: string, data: unknown, scenario?: SavedScenario, revoked?: { hash: string; expires: string }) => commit({ id: randomUUID(), actor: actor.username, role: actor.role, action, subject, occurredAt: new Date().toISOString(), evidenceHash: evidenceHash(data) }, scenario, revoked);
const failures = new Map<string, { count: number; until: number }>();
async function getWorkspace(): Promise<Workspace> {
  const existing = await loadWorkspace(); if (existing) return existing;
  const workspace = seedWorkspace();
  try { await saveWorkspace(workspace, -1, { id: randomUUID(), actor: 'synthetic-seed', role: 'System', action: 'CANONICAL_SEED', subject: 'workspace', occurredAt: new Date().toISOString(), evidenceHash: digest(workspace) }); }
  catch (error) { if (!(error instanceof RevisionConflict)) throw error; }
  return (await loadWorkspace())!;
}
export async function handleNetOne(request: RequestData): Promise<ResponseData> {
  try {
    secret();
    if (!['GET', 'POST'].includes(request.method)) return { status: 405, body: { error: 'Method not allowed.' } };
    if (request.method === 'POST') {
      const expected = process.env.NETONE_PUBLIC_ORIGIN || `http://${request.host}`;
      if (request.origin !== expected) return { status: 403, body: { error: 'Same-origin request required.' } };
    }
    const user = await identity(request.cookie);
    if (request.action === 'session' && request.method === 'GET') return { status: 200, body: { user, localDemo: !production() && !process.env.NETONE_USERS_JSON, persistence: databaseUrl() ? 'PostgreSQL' : 'Local server file' } };
    if (request.action === 'login' && request.method === 'POST') {
      const username = typeof request.body?.username === 'string' ? request.body.username : '';
      const password = typeof request.body?.password === 'string' ? request.body.password : '';
      if (username.length > 100 || password.length > 256) return { status: 400, body: { error: 'Invalid credentials.' } };
      const attempt = failures.get(username);
      if (attempt && attempt.until > Date.now() && attempt.count >= 5) return { status: 429, body: { error: 'Too many login attempts. Try again in 15 minutes.' } };
      const account = accounts().find(value => value.username === username);
      const hash = scryptSync(password, account?.salt || 'invalid-account', 32);
      if (!account || !timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))) {
        failures.set(username, { count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1, until: Date.now() + 15 * 60000 });
        return { status: 401, body: { error: 'Incorrect username or password.' } };
      }
      failures.delete(username);
      const actor = { username: account.username, role: account.role };
      await audit(actor, 'LOGIN', username, actor);
      const payload = Buffer.from(JSON.stringify({ ...actor, expires: Date.now() + 8 * 3600000 })).toString('base64url');
      return { status: 200, body: { user: actor }, headers: { 'Set-Cookie': cookie(`${payload}.${sign(payload)}`, 28800) } };
    }
    if (!user) return { status: 401, body: { error: 'Authentication required.' } };
    if (request.action === 'workspace' && request.method === 'GET') {
      const workspace = await getWorkspace();
      return { status: 200, body: { workspace: { ...workspace, evidence: workspace.evidence.map(({ candidate, source, ...record }) => ({ ...record, candidateId: candidate.id, siteId: candidate.siteId, action: candidate.action, score: candidate.score, period: candidate.period })), imports: user.role === 'Admin' ? workspace.imports : workspace.imports.map(({ quarantine, acceptedRecords, previousRecords, ...run }) => ({ ...run, quarantine: [] })) } } };
    }
    if (request.action === 'sensitivity' && request.method === 'POST') {
      if (!['Finance','Network','Admin'].includes(user.role)) return { status: 403, body: { error: 'Sensitivity analysis permission required.' } };
      const workspace = await getWorkspace(); const result = sensitivity(workspace, validateFilters(request.body?.filters, workspace), request.body?.configId);
      await audit(user, 'SENSITIVITY_RUN', workspace.activeConfigId, result); return { status: 200, body: { result } };
    }
    if (request.action === 'candidate-evidence' && request.method === 'GET') { const workspace = await getWorkspace(); const evidence = workspace.evidence.find(record => record.id === request.id); return evidence ? { status: 200, body: { evidence } } : { status: 404, body: { error: 'Evidence record not found.' } }; }
    if (request.action === 'candidate-export' && request.method === 'POST') {
      if (!['Finance','Admin'].includes(user.role)) return { status:403, body:{error:'Finance or Admin export permission required.'} };
      const workspace=await getWorkspace();const evidence=workspace.evidence.find(record=>record.id===request.id);if(!evidence)return {status:404,body:{error:'Evidence not found.'}};
      await audit(user,'CANDIDATE_EXPORTED',evidence.id,evidence);return {status:200,body:{evidence,exportedBy:user.username,exportedAt:new Date().toISOString(),dataStatus:'SYNTHETIC'}};
    }
    if (['incidents','rules','config','score','imports','candidate-evidence','reviews'].includes(request.action) && request.method === 'POST') {
      const previousWorkspace=await getWorkspace();const workspace=structuredClone(previousWorkspace);
      if(request.action==='reviews'&&request.body?.operation==='submit'&&request.body?.subjectType==='scenario'&&!(await listScenarios()).some(record=>record.id===request.body.subjectId))return {status:404,body:{error:'Saved scenario not found.'}};
      const expected=workspace.revision;const command=executeCommand(workspace,request.action,request.body,user,new Date().toISOString());workspace.revision++;
      await saveWorkspace(workspace,expected,{id:randomUUID(),actor:user.username,role:user.role,action:command.auditAction,subject:command.subject,occurredAt:new Date().toISOString(),evidenceHash:digest(command.output),beforeHash:digest(previousWorkspace),afterHash:digest(workspace)},previousWorkspace);
      return {status:200,body:{...command.output as object,revision:workspace.revision}};
    }
    if (request.action === 'logout' && request.method === 'POST') {
      const token = request.cookie!.split(';').map(value => value.trim()).find(value => value.startsWith('netone_session='))!.slice('netone_session='.length);
      const session = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
      await audit(user, 'LOGOUT', user.username, user, undefined, { hash: createHash('sha256').update(token).digest('hex'), expires: new Date(session.expires).toISOString() });
      return { status: 200, body: { ok: true }, headers: { 'Set-Cookie': cookie('', 0) } };
    }
    if (request.action === 'audit' && request.method === 'GET') {
      if (!['Finance', 'Regulatory', 'Admin'].includes(user.role)) return { status: 403, body: { error: 'Audit access denied.' } };
      return { status: 200, body: { audit: await listAudit() } };
    }
    if (request.action === 'scenarios' && request.method === 'GET') return { status: 200, body: { scenarios: await listScenarios() } };
    if (['scenarios', 'run'].includes(request.action) && request.method === 'POST') {
      if (!['Finance', 'Admin'].includes(user.role)) return { status: 403, body: { error: 'Finance or Admin permission required to save scenarios.' } };
      const input = request.body?.input as ScenarioInput;
      if (!input || !input.filters || !PERIODS.includes(input.filters.period) || typeof input.filters.region !== 'string' || typeof input.filters.technology !== 'string' || !(input.filters.state === 'All' || STATES.includes(input.filters.state as any)) || !Array.isArray(input.mustFund) || !Array.isArray(input.excluded) || input.mustFund.length > 400 || input.excluded.length > 400 || ![...input.mustFund, ...input.excluded].every(value => typeof value === 'string')) return { status: 400, body: { error: 'Invalid scenario input.' } };
      const workspace = await getWorkspace();
      if (!(input.filters.region === 'All' || workspace.sites.some(site => site.region === input.filters.region)) || !['All', '3G', '4G', '5G'].includes(input.filters.technology)) return { status: 400, body: { error: 'Unknown portfolio filter.' } };
      let result;
      try { const scored = scoreWorkspace(workspace,input.filters); result = allocateScenario(scored.candidates, input, scored.config.weights); } catch (error) { return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid allocation.' } }; }
      if (request.action === 'run') { await audit(user, 'SCENARIO_RUN', randomUUID(), result); return { status: 200, body: { result, snapshotHash: digest(result) } }; }
      if (request.body?.expectedHash && request.body.expectedHash !== digest(result)) return {status:409,body:{error:'Canonical evidence or policy changed after this run. Run the scenario again before saving.'}};
      const scenario: SavedScenario = { id: randomUUID(), savedAt: new Date().toISOString(), name: typeof request.body.name === 'string' ? request.body.name.trim().slice(0, 120) || 'Capital scenario' : 'Capital scenario', result };
      await audit(user, 'SCENARIO_SAVED', scenario.id, scenario, scenario);
      return { status: 201, body: { scenario } };
    }
    if (request.action === 'export' && request.method === 'POST') {
      if (!['Finance', 'Admin'].includes(user.role)) return { status: 403, body: { error: 'Finance or Admin permission required to export.' } };
      const scenario = (await listScenarios()).find(value => value.id === request.id);
      if (!scenario) return { status: 404, body: { error: 'Scenario not found.' } };
      await audit(user, 'SCENARIO_EXPORTED', scenario.id, scenario);
      return { status: 200, body: { scenario, evidenceHash: evidenceHash(scenario), exportedBy: user.username, dataStatus: 'SYNTHETIC', exportedAt: new Date().toISOString() } };
    }
    return { status: 404, body: { error: 'Operation not found.' } };
  } catch (error) { if(error instanceof CommandError)return {status:error.status,body:{error:error.message}};if(error instanceof RevisionConflict)return {status:409,body:{error:error.message}};return { status: 503, body: { error: 'NetOne service unavailable. Check dedicated backend configuration and storage.' } }; }
}


