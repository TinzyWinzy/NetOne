import { pilotCommand } from './pilot.js';
import { trafficGrowth } from '../src/domain/growth.js';
import { createHash, randomUUID } from 'node:crypto';
import { PERIODS, STATES } from '../src/domain/portfolio.js';
import type { Observation, Site, PortfolioFilters } from '../src/domain/portfolio.js';
import { validateWeights, MODEL_VERSION } from '../src/domain/investments.js';
import { INCIDENT_STATES, incidentState, nextIncidentState, evaluateRules, scoreWorkspace } from '../src/domain/operations.js';
import type { Workspace, CandidateRecord, RuleVersion } from '../src/domain/operations.js';
export class CommandError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(message: string, status = 400): never { throw new CommandError(status, message); }
export function digest(value: unknown): string {
  const ordered = (v: any): any => Array.isArray(v) ? v.map(ordered) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(key => [key, ordered(v[key])])) : v;
  return createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
}
const text = (value: unknown, name: string, max = 500): string => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fail(`Provide ${name} (1–${max} characters).`);
const number = (value: unknown, name: string, min = 0, max = 1e9): number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fail(`Invalid ${name}.`);
const requireRole = (role: string, allowed: string[]) => { if (!allowed.includes(role)) fail('This operation is not permitted for your role.', 403); };
export function validateFilters(input: any, workspace: Workspace): PortfolioFilters {
  if (!input || !PERIODS.includes(input.period) || typeof input.region !== 'string' || !(input.region === 'All' || workspace.sites.some(site => site.region === input.region)) || !['All','3G','4G','5G'].includes(input.technology)) fail('Invalid portfolio filters.');
  return { period: input.period, region: input.region, technology: input.technology, state: input.state === undefined || input.state === 'All' ? 'All' : STATES.includes(input.state) ? input.state : fail('Invalid asset state.') };
}
function recordCandidate(workspace: Workspace, id: string, filters: PortfolioFilters, actor: string, at: string, configId?: string, prepared?: ReturnType<typeof scoreWorkspace>): CandidateRecord {
  const { config, candidates } = prepared || scoreWorkspace(workspace, filters, configId); const candidate = candidates.find(value => value.id === id);
  if (!candidate) fail('Candidate not found in the selected scope.',404);
  const source = { site: structuredClone(workspace.sites.find(site => site.id === candidate.siteId)!), mappings: workspace.mappings.filter(value => value.siteId === candidate.siteId), incidents: workspace.incidents.filter(value => value.siteId === candidate.siteId), evaluations: workspace.evaluations.filter(value => value.siteId === candidate.siteId && value.period === filters.period) };
  const snapshot = structuredClone({ candidate, config, source });
  const record = { id: randomUUID(), at, actor, ...snapshot, hash: digest(snapshot) }; workspace.evidence.push(record); return record;
}

export function executeCommand(workspace: Workspace, action: string, body: any, user: { username: string; role: string }, at: string): { subject: string; output: unknown; auditAction: string } {
  if (!body || body.revision !== workspace.revision) fail('Workspace changed; reload before submitting.',409);
  const actor = user.username; let subject = ''; let output: unknown;
  if (action === 'incidents') {
    requireRole(user.role,['Network','Admin']);
    if (body.operation === 'create') {
      const siteId = text(body.siteId,'site',100); if (!workspace.sites.some(site => site.id === siteId)) fail('Unknown site.');
      if (!['LOW','MEDIUM','HIGH'].includes(body.severity)) fail('Invalid severity.');
      const incident = { id: randomUUID(), siteId, type: text(body.type,'incident type',100), severity: body.severity as 'LOW'|'MEDIUM'|'HIGH', impact: text(body.impact,'management impact'), estimatedBurden: number(body.estimatedBurden,'estimated incident cost',0,1e7), demo: true as const, events: [{ id: randomUUID(), state: 'OPEN' as const, at, actor, note: text(body.note,'opening note') }] };
      workspace.incidents.push(incident); subject = incident.id; output = { incident };
    } else if (body.operation === 'transition') {
      const incident = workspace.incidents.find(value => value.id === body.id); if (!incident) fail('Incident not found.',404);
      if (body.state !== nextIncidentState(incident) || !INCIDENT_STATES.includes(body.state)) fail('Only the next lifecycle state is permitted.');
      if (at < incident.events.at(-1)!.at) fail('Event timestamp must not precede the prior event.');
      incident.events.push({ id: randomUUID(), state: body.state, at, actor, note: text(body.note,'transition evidence') }); subject = incident.id; output = { incident };
    } else fail('Unknown incident operation.');
  } else if (action === 'rules') {
    requireRole(user.role,['Regulatory','Admin']);
    if (body.operation === 'create') {
      const code = text(body.code,'rule code',80); if (!/^[A-Z0-9_-]+$/.test(code)) fail('Rule code uses uppercase letters, digits, underscores or hyphens.');
      if (!['availability','utilisation','downtimeHours','faults'].includes(body.metric) || !['<','<=','>','>='].includes(body.comparator)) fail('Invalid metric/comparator.');
      const from = text(body.effectiveFrom,'effective date',10), to = typeof body.effectiveTo === 'string' ? body.effectiveTo : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(Date.parse(from)) || new Date(from).toISOString().slice(0,10) !== from || (to && (!/^\d{4}-\d{2}-\d{2}$/.test(to) || !Number.isFinite(Date.parse(to)) || new Date(to).toISOString().slice(0,10) !== to || to <= from))) fail('Invalid effective date interval.');
      if(body.category&&!['DEMONSTRATION','INTERNAL'].includes(body.category))fail('Legal obligations use the separate sourced register; demo rules cannot be relabelled statutory.');
      const rule: RuleVersion = { category:body.category||'DEMONSTRATION', id: randomUUID(), code, version: String(Math.max(0,...workspace.rules.filter(value => value.code === code).map(value => Number(value.version))) + 1), metric: body.metric, comparator: body.comparator, threshold: number(body.threshold,'threshold',0,body.metric === 'availability' || body.metric === 'utilisation' ? 100 : body.metric === 'faults' ? 10000 : 744), effectiveFrom: from, effectiveTo: to, source: text(body.source,'demonstration rule source'), status: 'draft', createdBy: actor };
      workspace.rules.push(rule); subject = rule.id; output = { rule };
    } else if (body.operation === 'evaluate') {
      if (!PERIODS.includes(body.period)) fail('Invalid reporting period.');
      const evaluations = evaluateRules(workspace.sites,workspace.rules,body.period,at).map(record => ({ ...record,id: randomUUID() })); workspace.evaluations.push(...evaluations); subject = body.period; output = { evaluated: evaluations.length, warnings: evaluations.filter(record=>record.state==='WARNING').length };
    } else {
      const rule = workspace.rules.find(value => value.id === body.id); if (!rule) fail('Rule not found.',404);
      if (body.operation === 'review' && rule.status === 'draft') { rule.status = 'reviewed'; rule.reviewedBy = actor; rule.reviewedAt = at; rule.reviewNote = text(body.note,'review note'); }
      else if (body.operation === 'activate' && rule.status === 'reviewed') {
        const overlap = workspace.rules.some(value => value.id !== rule.id && value.code === rule.code && value.status === 'active' && value.effectiveFrom < (rule.effectiveTo || '9999-12-31') && rule.effectiveFrom < (value.effectiveTo || '9999-12-31'));
        if (overlap) fail('Retire the overlapping active version before activating this rule.');
        rule.status = 'active'; rule.activatedBy = actor; rule.activatedAt = at;
      } else if (body.operation === 'retire' && rule.status === 'active') {rule.status = 'retired';rule.retiredAt=at;rule.retiredBy=actor;} else fail('Invalid rule lifecycle transition.');
      subject = rule.id; output = { rule };
      if(body.operation==='activate'||body.operation==='retire') workspace.evaluations.push(...PERIODS.flatMap(period=>evaluateRules(workspace.sites,workspace.rules,period,at)).map(record=>({...record,id:randomUUID()})));
    }
    // Evaluation snapshots retain the original rule, including after retirement.
  } else if (action === 'config') {
    requireRole(user.role,['Finance','Admin']);
    if (body.operation === 'create') {
      if(body.weights && Object.keys(body.weights).sort().join(',') !== ['demand','growth','commercial','reliability','service','opex','strategy'].sort().join(',')) fail('Provide exactly the seven named score weights.');
      const invalid = body.weights && validateWeights(body.weights); if (!body.weights || invalid) fail(invalid || 'Provide complete weights.');
      const config = { id: randomUUID(), version: Math.max(...workspace.configs.map(value=>value.version))+1, name: text(body.name,'configuration name',120), weights: { ...body.weights }, minimumScore: number(body.minimumScore,'minimum score',0,100), createdAt: at, createdBy: actor, modelVersion: MODEL_VERSION };
      workspace.configs.push(config); subject=config.id; output={ config };
    } else if (body.operation === 'activate') { requireRole(user.role,['Admin']); if (!workspace.configs.some(value=>value.id===body.id)) fail('Configuration not found.',404); workspace.activeConfigId=body.id; subject=body.id; output={ activeConfigId:body.id }; }
    else fail('Unknown configuration operation.');
  } else if (action === 'candidate-evidence' || action === 'score') {
    requireRole(user.role,['Finance','Admin']); const filters=validateFilters(body.filters,workspace);
    if (action === 'candidate-evidence') { const record=recordCandidate(workspace,text(body.candidateId,'candidate',200),filters,actor,at,body.configId); subject=record.id; output={ evidence:record }; }
    else { const { config,candidates }=scoreWorkspace(workspace,filters,body.configId); const records=candidates.map(candidate=>recordCandidate(workspace,candidate.id,filters,actor,at,config.id,{config,candidates})); const run={id:randomUUID(),at,actor,configId:config.id,filters,candidateCount:records.length,recordIds:records.map(record=>record.id)};workspace.scoreRuns.push(run);subject=run.id;output={run}; }
  } else if (action === 'reviews') {
    if (body.operation === 'submit') { requireRole(user.role,['Finance','Admin']); if (!['candidate','scenario'].includes(body.subjectType)) fail('Invalid review subject.'); if (body.subjectType==='candidate'&&!workspace.evidence.some(value=>value.id===body.subjectId)) fail('Saved candidate evidence required.'); const review={id:randomUUID(),subjectType:body.subjectType as 'candidate'|'scenario',subjectId:text(body.subjectId,'subject ID',200),events:[{status:'SUBMITTED' as const,actor,role:user.role,at,note:text(body.note,'submission note')}]};workspace.reviews.push(review);subject=review.id;output={review}; }
    else { requireRole(user.role,['Network','Regulatory','Admin']); const review=workspace.reviews.find(value=>value.id===body.id);if(!review)fail('Review not found.',404);const prior=review.events.at(-1)!.status;const allowed=prior==='SUBMITTED'||prior==='CHANGES_REQUESTED'?['IN_REVIEW']:prior==='IN_REVIEW'?['REVIEWED','CHANGES_REQUESTED']:[];if(!allowed.includes(body.status))fail('Invalid review transition.');review.events.push({status:body.status,actor,role:user.role,at,note:text(body.note,'review evidence')});subject=review.id;output={review}; }
  } else if (action === 'pilot') { output=pilotCommand(workspace,body,user,at,fail);subject=String((output as any).case?.id||(output as any).finding?.id||body.id||body.operation);
  } else if (action === 'imports') { requireRole(user.role,['Admin']); const run=importRows(workspace,body,actor,at);subject=run.id;output={run}; }
  else fail('Unknown command.',404);
  return { subject,output,auditAction:`${action.toUpperCase().replaceAll('-','_')}_${String(body.operation || 'SAVED').toUpperCase()}` };
}

const FIELDS=['external_ref','canonical_ref','name','region','technology','latitude','longitude','period','utilisation','growth','availability','faults','trafficGB','downtimeHours','capex','opex','contribution','failureCost','currency','basis','demo'];
export function parseCSV(source: string): Record<string, unknown>[] {
  const records:string[][]=[];let row:string[]=[];let value='';let quoted=false;
  for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(value);if(row.some(Boolean))records.push(row);row=[];value='';}else value+=c;}
  if(quoted)fail('CSV has an unterminated quoted value.');row.push(value);if(row.some(Boolean))records.push(row);const headers=records.shift();if(!headers||new Set(headers).size!==headers.length||headers.some(key=>!FIELDS.includes(key)))fail('CSV requires unique, recognised canonical column names.');
  return records.map(values=>{if(values.length!==headers.length)fail('CSV row has a different number of columns.');return Object.fromEntries(headers.map((key,index)=>[key,['latitude','longitude','utilisation','growth','availability','faults','trafficGB','downtimeHours','capex','opex','contribution','failureCost'].includes(key)?values[index]===''?null:Number(values[index]):key==='demo'?values[index]==='true':values[index]]));});
}
function importRows(workspace:Workspace,body:any,actor:string,at:string) {
  const key=text(body.key,'idempotency key',100),source=text(body.source,'source name',100);if(!/^[a-zA-Z0-9_-]+$/.test(source))fail('Invalid source name.');
  const rows=body.format==='csv'?parseCSV(text(body.csv,'CSV',90000)):body.rows;if(!Array.isArray(rows)||!rows.length||rows.length>100)fail('Provide 1–100 synthetic canonical rows.');
  const hash=digest({source,rows});const prior=workspace.imports.find(run=>run.key===key);if(prior){if(prior.hash!==hash)fail('Idempotency key already belongs to a different payload.',409);return prior;}
  const run={id:randomUUID(),key,source,hash,at,actor,accepted:0,rejected:0,quarantine:[] as {row:number;reason:string}[],demo:true as const,acceptedRecords:[] as unknown[],previousRecords:[] as {siteId:string;observation:unknown}[]};
  const seen=new Set<string>();
  rows.forEach((raw:any,index:number)=>{try{
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(field=>!FIELDS.includes(field)))fail('Unrecognised fields; customer-level data is not accepted.');
    if(raw.demo!==true||raw.currency!=='USD'||raw.basis!=='Nominal synthetic monthly aggregates')fail('Only synthetic USD monthly aggregates are permitted in this demo environment.');
    const externalRef=text(raw.external_ref,'external reference',100);if(!/^[A-Za-z0-9_.:-]+$/.test(externalRef))fail('Invalid external reference.');if(!PERIODS.includes(raw.period))fail('Unsupported reporting period.');
    const unique=`${source}:${externalRef}:${raw.period}`;if(seen.has(unique))fail('Duplicate source/reference/period in batch.');seen.add(unique);
    const region=text(raw.region,'region',60),name=text(raw.name,'site name',120);if(!['3G','4G','5G'].includes(raw.technology))fail('Invalid technology.');
    const latitude=number(raw.latitude,'latitude',-90,90),longitude=number(raw.longitude,'longitude',-180,180);
    const metric=(key:string,min=0,max=1e9)=>number(raw[key],key,min,max);const nullable=(key:string,max=1e9)=>raw[key]===null?null:metric(key,0,max);
    const utilisation=nullable('utilisation',100),contribution=nullable('contribution');
    const observation:Observation={period:raw.period,utilisation,contribution,growth:null,availability:metric('availability',0,100),faults:metric('faults',0,10000),trafficGB:metric('trafficGB'),downtimeHours:metric('downtimeHours',0,744),capex:metric('capex'),opex:metric('opex'),failureCost:metric('failureCost'),quality:utilisation===null||contribution===null?'PARTIAL':'COMPLETE',sourceRef:`${source}/${externalRef}/${raw.period}/import:${run.id}`};
    if([observation.capex,observation.opex,observation.contribution,observation.failureCost].some(value=>value!==null&&Math.abs(value*100-Math.round(value*100))>0.000001))fail('Financial values require at most two decimal places.');
    if(!Number.isInteger(observation.faults)||observation.failureCost>observation.opex)fail('Faults must be integral and included failure cost must not exceed OPEX.');
    const mapping=workspace.mappings.find(value=>value.source===source&&value.externalRef===externalRef);let site=mapping?workspace.sites.find(value=>value.id===mapping.siteId):raw.canonical_ref?workspace.sites.find(value=>value.id===raw.canonical_ref):undefined;
    if(raw.canonical_ref&&!site)fail('Canonical site reference not found.');
    if(!site){site={id:`I${randomUUID().slice(0,8)}`,name,region,technology:raw.technology,latitude,longitude,strategic:false,demo:true,observations:[],history:[],networkHistory:[]};workspace.sites.push(site);}
    if(site.region!==region||site.technology!==raw.technology)fail('Mapped site identity conflicts with region/technology.');
    if(!mapping)workspace.mappings.push({id:randomUUID(),source,externalRef,siteId:site.id});
    run.previousRecords.push({siteId:site.id,observation:structuredClone(site.observations.find(row=>row.period===raw.period)||null)});
    site.observations=site.observations.filter(row=>row.period!==raw.period).concat(observation).sort((a,b)=>a.period.localeCompare(b.period));
    site.networkHistory=(site.networkHistory||[]).filter(row=>row.period!==raw.period).concat({period:raw.period,trafficGB:observation.trafficGB!,utilisation,downtimeHours:observation.downtimeHours!,faults:observation.faults,sourceRef:observation.sourceRef!,quality:observation.quality}).sort((a,b)=>a.period.localeCompare(b.period));
    run.accepted++;run.acceptedRecords.push(structuredClone(raw));
  }catch(error){run.rejected++;run.quarantine.push({row:index+1,reason:error instanceof Error?error.message:'Invalid row'});}});
  for(const site of workspace.sites)for(const row of site.observations)row.growth=trafficGrowth(site,row.period).value; workspace.imports.push(run); const periods = [...new Set(run.acceptedRecords.map((record:any)=>record.period))]; workspace.evaluations.push(...periods.flatMap(period=>evaluateRules(workspace.sites,workspace.rules,period as any,at)).map(record=>({...record,id:randomUUID()}))); return run;
}
