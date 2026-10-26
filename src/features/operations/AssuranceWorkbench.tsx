import { useMemo, useState } from 'react';
import { useWorkspace } from '../../components/WorkspaceProvider';
import { useSession } from '../../components/SessionGate';
import { decimal, percentage } from '../../lib/format';
import { usd } from '../../domain/portfolio';
import { businessValue } from '../../domain/assurance';
import type { CorrectiveCase, Option } from '../../domain/assurance';
import { summarizePortfolioPredictiveAssurance } from '../../domain/predictiveAssurance';

export default function AssuranceWorkbench(){
 const {workspace,command}=useWorkspace(),{user}=useSession(),p=workspace.pilot!;
 const [tab,setTab]=useState('predictive'),[message,setMessage]=useState(''),[pending,setPending]=useState(false),[note,setNote]=useState(''),[search,setSearch]=useState(''),[limit,setLimit]=useState(10);
 const [siteId,setSite]=useState(new URLSearchParams(location.search).get('caseSite')||'N078'),[obligationId,setObligation]=useState('QOS-DSASR'),[cellId,setCell]=useState('DEMO-CELL-'+(new URLSearchParams(location.search).get('caseSite')||'N078')+'-A'),[caseFindingId,setCaseFinding]=useState(''),[measurementId,setMeasurement]=useState(''),[metric,setMetric]=useState('dsasr'),[numerator,setNumerator]=useState(''),[denominator,setDenominator]=useState(''),[start,setStart]=useState('2026-09-01T00:00'),[end,setEnd]=useState('2026-09-30T23:59'),[source,setSource]=useState(''),[protocol,setProtocol]=useState('');
 const [selectedHorizon, setSelectedHorizon] = useState<'7d' | '30d' | '90d'>('30d');
 const [exemptionGround, setExemptionGround] = useState('POWER_OUTAGE_EXEMPTION_S9_7_E');
 const admin=user.role==='Admin',network=['Network','Admin'].includes(user.role),regulatory=['Regulatory','Admin'].includes(user.role),finance=['Finance','Admin'].includes(user.role);
 
 const predictiveData = useMemo(() => {
   return summarizePortfolioPredictiveAssurance(workspace.sites, '2026-09');
 }, [workspace.sites]);

 const run=async(body:object)=>{if(pending)return;setPending(true);try{await command('pilot',body as Record<string,unknown>);setMessage('Saved synthetic evidence and server-attributed audit.');}catch(e){setMessage(String(e));}finally{setPending(false)}};
 
 const handleScheduleAction = async (siteId: string, actionType: string, cost: number, impactHours: number, urgency: any) => {
   if (pending) return;
   setPending(true);
   try {
     await command('preventive-actions', {
       operation: 'schedule',
       siteId,
       actionType,
       estimatedCost: cost,
       estimatedImpactHours: impactHours,
       urgency,
       scheduledDate: '2026-10-15'
     });
     setMessage(`Preventive intervention scheduled for ${siteId}.`);
   } catch (e) {
     setMessage(String(e));
   } finally {
     setPending(false);
   }
 };

 const handleUpdateActionStatus = async (id: string, status: string) => {
   if (pending) return;
   setPending(true);
   try {
     await command('preventive-actions', {
       operation: 'update-status',
       id,
       status
     });
     setMessage(`Preventive action updated to ${status}.`);
   } catch (e) {
     setMessage(String(e));
   } finally {
     setPending(false);
   }
 };

 return <div className="assurance-workbench">
   <div className="page-heading"><div><p className="eyebrow">SERVICE ASSURANCE · SYNTHETIC</p><h2>Understand risk. Plan the response.</h2><p>Review operational risk horizons, preventive maintenance and the evidence behind service obligations.</p></div></div>
   <nav className="nav-row assurance-tabs" aria-label="Assurance workflow">{[['predictive','Predictive service assurance'],['obligations','Obligation register'],['qos','Cell QoS evidence'],['cases','Corrective cases'],['privacy','Data governance']].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setLimit(10)}}>{label}</button>)}</nav>
   <section className="panel mt-6"><p className="data-notice">No legal compliance or capital approval is inferred. Rule review records an interpretation for this synthetic pilot; actual NetOne licence, exemptions, directions and sampling protocol remain to be verified. Penalty calculations are disabled.</p><label>Review / evidence note<input aria-label="Assurance note" value={note} onChange={e=>setNote(e.target.value)} maxLength={1000}/></label>{message&&<p role="status">{message}</p>}</section>

   {tab==='predictive'&&<section className="panel mt-6">
     <div className="section-heading">
       <h3>Predictive Service Assurance & Forward Risk Horizons</h3>
       <span className="demo-badge">DETERMINISTIC RULE-BASED SCORING</span>
     </div>
     <p className="subtle">Explainable deterministic risk scoring based on power instability, equipment age, historical outage duration, and SLA drop rates. Note: Rule-based scores reflect operational risk factors and are not statistically calibrated failure probabilities.</p>
     
     <div className="metric-strip mt-4">
       <button onClick={() => setSelectedHorizon('7d')} aria-pressed={selectedHorizon === '7d'}>
         <span>7-Day Risk Horizon</span>
         <strong>{predictiveData.horizons.sevenDay.criticalCount} Critical</strong>
         <small>{predictiveData.horizons.sevenDay.highCount} high risk · Mean score {predictiveData.horizons.sevenDay.meanRiskScore.toFixed(1)}/100</small>
       </button>
       <button onClick={() => setSelectedHorizon('30d')} aria-pressed={selectedHorizon === '30d'}>
         <span>30-Day Risk Horizon</span>
         <strong>{predictiveData.horizons.thirtyDay.criticalCount} Critical</strong>
         <small>{predictiveData.horizons.thirtyDay.highCount} high risk · Mean score {predictiveData.horizons.thirtyDay.meanRiskScore.toFixed(1)}/100</small>
       </button>
       <button onClick={() => setSelectedHorizon('90d')} aria-pressed={selectedHorizon === '90d'}>
         <span>90-Day Risk Horizon</span>
         <strong>{predictiveData.horizons.ninetyDay.criticalCount} Critical</strong>
         <small>{predictiveData.horizons.ninetyDay.highCount} high risk · Mean score {predictiveData.horizons.ninetyDay.meanRiskScore.toFixed(1)}/100</small>
       </button>
       <div>
         <span>Active Interventions</span>
         <strong>{(workspace.preventiveSchedule || []).length} Scheduled</strong>
         <small>Preventive maintenance work orders in pipeline</small>
       </div>
     </div>

     <h4 className="mt-6" style={{ fontSize: '14px', fontWeight: 600 }}>Site Risk Register & Factor Contributions ({selectedHorizon} Horizon)</h4>
     <div className="table-scroll mt-2">
       <table className="investment-table">
         <thead>
           <tr>
             <th>Site ID</th>
             <th>Risk Level</th>
             <th>Score</th>
             <th>Primary Risk Driver</th>
             <th>Risk Factor Decomposition</th>
             <th>Suggested Intervention</th>
             <th>Action</th>
           </tr>
         </thead>
         <tbody>
           {predictiveData.scores.slice(0, limit).map(siteScore => {
             const hz = selectedHorizon === '7d' ? siteScore.horizons.sevenDay : selectedHorizon === '30d' ? siteScore.horizons.thirtyDay : siteScore.horizons.ninetyDay; const topFactor = [...siteScore.factors].sort((a, b) => b.weightedScore - a.weightedScore)[0]; const topIntervention = siteScore.preventiveInterventions[0];
             return (
               <tr key={siteScore.siteId}>
                 <td><strong>{siteScore.siteId}</strong></td>
                 <td>
                   <span className="state-label" style={{
                     background: hz.riskLevel === 'CRITICAL' ? '#fee2e2' : hz.riskLevel === 'HIGH' ? '#ffedd5' : hz.riskLevel === 'ELEVATED' ? '#fef9c3' : '#ecfdf5',
                     color: hz.riskLevel === 'CRITICAL' ? '#b91c1c' : hz.riskLevel === 'HIGH' ? '#c2410c' : hz.riskLevel === 'ELEVATED' ? '#854d0e' : '#047857'
                   }}>
                     {hz.riskLevel}
                   </span>
                 </td>
                 <td><strong>{hz.riskScore.toFixed(1)}</strong> / 100</td>
                 <td>{topFactor ? `${topFactor.label} (${topFactor.weightPct}%)` : 'Nominal baseline'}</td>
                 <td>
                   <small style={{ display: 'block', color: '#595959' }}>
                     {siteScore.factors.slice(0, 3).map(f => f.label.split(' ')[0] + ': ' + f.score).join(' · ')}
                   </small>
                 </td>
                 <td>
                   {topIntervention ? (
                     <div>
                       <strong>{topIntervention.title}</strong>
                       <small style={{ display: 'block' }}>{usd(topIntervention.estimatedCost)} · {topIntervention.urgency}</small>
                     </div>
                   ) : 'Monitor telemetry'}
                 </td>
                 <td>
                   {topIntervention && network && (
                     <button
                       className="text-button"
                       disabled={pending}
                       onClick={() => handleScheduleAction(siteScore.siteId, topIntervention.actionCode, topIntervention.estimatedCost, topIntervention.estimatedAvoidedOutageHours, topIntervention.urgency)}
                     >
                       Schedule Work Order →
                     </button>
                   )}
                 </td>
               </tr>
             );
           })}
         </tbody>
       </table>
     </div>
     {predictiveData.scores.length > limit && (
       <button className="text-button mt-4" onClick={() => setLimit(limit + 15)}>Show more sites ({predictiveData.scores.length - limit} remaining)</button>
     )}

     {(workspace.preventiveSchedule || []).length > 0 && (
       <div className="mt-6" style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
         <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Scheduled Preventive Interventions ({(workspace.preventiveSchedule ?? []).length})</h4>
         <div className="table-scroll mt-2">
           <table className="investment-table">
             <thead>
               <tr>
                 <th>Site ID</th>
                 <th>Action</th>
                 <th>Urgency</th>
                 <th>Cost</th>
                 <th>Est. Avoided Outage</th>
                 <th>Status</th>
                 <th>Workflow Transitions</th>
               </tr>
             </thead>
             <tbody>
               {(workspace.preventiveSchedule ?? []).map(rec => (
                 <tr key={rec.id}>
                   <td><strong>{rec.siteId}</strong></td>
                   <td>{rec.actionType}</td>
                   <td><span className="state-label">{rec.urgency}</span></td>
                   <td>{usd(rec.estimatedCost)}</td>
                   <td>{rec.estimatedImpactHours} hours</td>
                   <td><strong>{rec.status}</strong></td>
                   <td>
                     {rec.status === 'SCHEDULED' && network && (
                       <button className="text-button" onClick={() => handleUpdateActionStatus(rec.id, 'DISPATCHED')}>Dispatch Crew</button>
                     )}
                     {rec.status === 'DISPATCHED' && network && (
                       <button className="text-button" onClick={() => handleUpdateActionStatus(rec.id, 'COMPLETED')}>Mark Completed</button>
                     )}
                     {rec.status === 'COMPLETED' && (network || regulatory) && (
                       <button className="text-button" onClick={() => handleUpdateActionStatus(rec.id, 'VERIFIED')}>Verify Telemetry</button>
                     )}
                     {rec.status === 'VERIFIED' && <span className="quality complete">VERIFIED</span>}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>
     )}
   </section>}

   {tab==='obligations'&&<section className="panel mt-6"><h3>Sourced legal obligations</h3><p>Demonstration warnings stay in Service rules. Legal, internal and demonstration categories are distinct; this register contains legal sources and draft operator obligations.</p>{p.obligations.map(o=><details key={o.id} className="candidate-disclosure"><summary>{o.id} · {o.title} · v{o.version} · {o.sourceVerified?'Source retrieved':'Unverified draft'} · {o.applicability} [{o.serviceCategory || 'CELLULAR_MOBILE'}]</summary><dl><dt>Instrument / exact reference</dt><dd>{o.instrument} · {o.reference}</dd><dt>Service category</dt><dd><strong>{o.serviceCategory || 'CELLULAR_MOBILE'}</strong></dd><dt>Source</dt><dd>{o.sourceUrl?<a href={o.sourceUrl} target="_blank" rel="noreferrer">View source document</a>:'Missing NetOne document'}</dd><dt>Effective interval</dt><dd>{o.effectiveFrom||'Not verified'} → {o.effectiveTo||'No verified end date'}</dd><dt>Measurement</dt><dd>{o.level} · {o.metric||'Documentary obligation'} · {o.comparator} {o.threshold??'No encoded threshold'} {o.unit} · {o.window||'No encoded window'}</dd><dt>Definition</dt><dd>{o.numerator||'Not a numerical KPI'} / {o.denominator||'Not a numerical KPI'}</dd><dt>Applicability / exceptions</dt><dd>{o.entity}; {o.conditions}; {o.exceptions}</dd><dt>Required evidence</dt><dd>{o.requiredEvidence.join('; ')}</dd><dt>Reporting / correction</dt><dd>{o.reporting}; {o.correctiveAction}</dd><dt>Owner / review</dt><dd>{o.owner} · {o.reviewStatus} · {o.reviewer||'Unassigned'} · {o.reviewDate||'Not reviewed'}</dd></dl><p>{o.amendmentCheck}</p><p>{o.lineage.join(' → ')}</p>{regulatory&&o.sourceVerified&&<div className="action-row">{['APPLICABLE','NOT_APPLICABLE','UNASSESSED'].map(applicability=><button className="text-button" disabled={pending||!note.trim()} key={applicability} onClick={()=>run({operation:'review-obligation',id:o.id,applicability,note})}>Record {applicability.toLowerCase().replace('_',' ')} review</button>)}</div>}</details>)}</section>}
   {tab==='qos'&&<><section className="panel mt-6"><h3>Explicit cell-to-site mapping</h3><p>These fictional cell identifiers map to sites, services and technologies. No cell measurements are generated from site availability or traffic.</p><div className="weight-grid"><label>Cell<select aria-label="QoS cell" value={cellId} onChange={e=>setCell(e.target.value)}>{p.cells.map(c=><option key={c.id} value={c.id}>{c.id} → {c.siteId} · {c.technology}</option>)}</select></label><label>Obligation<select aria-label="QoS obligation" value={obligationId} onChange={e=>setObligation(e.target.value)}>{p.obligations.filter(o=>o.level==='CELL').map(o=><option key={o.id}>{o.id}</option>)}</select></label><label>Retained measurement<select aria-label="QoS measurement" value={measurementId} onChange={e=>setMeasurement(e.target.value)}><option value="">No measurement — evidence insufficient</option>{p.measurements.filter(m=>m.cellId===cellId).map(m=><option key={m.id} value={m.id}>{m.metric} · {m.period} · {m.sourceRef}</option>)}</select></label></div><button className="primary-button" disabled={pending||!network&&!regulatory} onClick={()=>run({operation:'evaluate',obligationId,cellId,measurementId})}>Evaluate supplied evidence</button><details className="candidate-disclosure"><summary>Record an independent synthetic cell measurement</summary><p>Enter fictional raw counters from a declared fixture, with the sampling protocol. Never substitute site aggregates.</p><div className="weight-grid"><label>KPI<select value={metric} onChange={e=>setMetric(e.target.value)}>{['dsasr','dsdr','cellAvailability'].map(x=><option key={x}>{x}</option>)}</select></label><label>Numerator<input aria-label="KPI numerator" type="number" value={numerator} onChange={e=>setNumerator(e.target.value)}/></label><label>Denominator<input aria-label="KPI denominator" type="number" value={denominator} onChange={e=>setDenominator(e.target.value)}/></label><label>Window start (UTC)<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Window end (UTC)<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label><label>Synthetic source reference<input aria-label="Cell measurement source" value={source} onChange={e=>setSource(e.target.value)}/></label><label>Sampling protocol / scope<input aria-label="Cell measurement protocol" value={protocol} onChange={e=>setProtocol(e.target.value)}/></label></div><button className="text-button" disabled={pending||!network||!numerator||!denominator||!source||!protocol} onClick={()=>run({operation:'measurement',cellId,metric,period:start.slice(0,7),windowStart:start+':00Z',windowEnd:end+':00Z',numerator:Number(numerator),denominator:Number(denominator),sourceRef:source,protocolRef:protocol,demo:true})}>Save synthetic cell measurement</button></details></section><section className="panel mt-6"><h3>Historical findings</h3>{p.findings.slice(-limit).reverse().map(f=><details key={f.id} className="candidate-disclosure"><summary>{f.cell?.siteId||'No cell'} · {f.obligation.id} v{f.obligation.version} · {f.state} · {percentage(f.value)}</summary><p>{f.reason}</p><p>{f.at} · {f.measurement?.sourceRef||'Missing measurement'} · {f.obligation.reference}</p>{regulatory&&f.state==='POTENTIAL_EXCEPTION'&&<div className="action-row"><button disabled={pending||!note} className="text-button" onClick={()=>run({operation:'confirm-finding',id:f.id,note})}>Record reviewer-confirmed finding</button><button disabled={pending||!note} className="text-button" onClick={()=>run({operation:'override-finding',id:f.id,exemptionGround,note})}>Apply statutory exemption override (s.9(7)(e))</button></div>}<details><summary>Frozen inputs and interpretation</summary><pre className="evidence-json">{JSON.stringify(f,null,2)}</pre></details></details>)}{p.findings.length>limit&&<button className="text-button" onClick={()=>setLimit(limit+10)}>Show more findings</button>}</section></>}
   {tab==='cases'&&<><section className="panel mt-6"><h3>Create a corrective investment case</h3><div className="weight-grid"><label>Site<select aria-label="Corrective site" value={siteId} onChange={e=>setSite(e.target.value)}>{workspace.sites.map(s=><option key={s.id}>{s.id}</option>)}</select></label><label>Linked obligation<select aria-label="Corrective obligation" value={obligationId} onChange={e=>setObligation(e.target.value)}>{p.obligations.map(o=><option key={o.id}>{o.id}</option>)}</select></label><label>Finding to retain<select aria-label="Corrective finding" value={caseFindingId} onChange={e=>setCaseFinding(e.target.value)}><option value="">No supplied finding — insufficient evidence</option>{p.findings.filter(f=>f.cell?.siteId===siteId&&f.obligation.id===obligationId).map(f=><option key={f.id} value={f.id}>{f.state} · {f.at}</option>)}</select></label><label>Case search<input aria-label="Case search" value={search} onChange={e=>setSearch(e.target.value)}/></label></div><button className="primary-button" disabled={pending||!note||!network&&!finance} onClick={()=>run({operation:'create-case',siteId,obligationId,period:'2026-09',findingId:caseFindingId,note})}>Create draft corrective case</button></section>{p.cases.filter(c=>(c.siteId+' '+c.id+' '+c.status).toLowerCase().includes(search.toLowerCase())).slice(-limit).reverse().map(c=><CaseEditor key={c.id} record={c} run={run} pending={pending} note={note} role={user.role} measurements={p.measurements.map(m=>({id:m.id,label:m.cellId+' '+m.metric+' '+m.windowStart}))}/>)}{p.cases.length>limit&&<button className="text-button" onClick={()=>setLimit(limit+10)}>Show more cases</button>}</>}
   {tab==='privacy'&&<section className="panel mt-6"><h3>Data protection governance</h3><p>Network data is aggregate and synthetic. Usernames, role assignments and attributed audit events can still be personal data. No arbitrary evidence-file uploads are enabled.</p><dl><dt>Minimisation / classification</dt><dd>Fictional network aggregates; restricted identity and audit metadata. No subscriber/customer data.</dd><dt>Retention / deletion</dt><dd>Proposed pilot policy: account data for active access, revoked tokens through expiry; decision/audit retention and deletion schedules require DPO approval before a real pilot. No automatic destruction of immutable evidence.</dd><dt>Responsibilities / processing records</dt><dd>Controller, processor, licence/exemption and DPO applicability are unassessed. Record account authentication, audit, export and hosting purposes; assess Vercel/Neon cross-border processing and agreements. See docs/data-protection-pilot.md.</dd><dt>Security / breach review</dt><dd>Separate from network incidents; no statutory notification deadline is invented and no report is sent automatically.</dd></dl>{admin&&<button className="primary-button" disabled={pending||!note} onClick={()=>run({operation:'privacy-incident',note})}>Open synthetic privacy/security review</button>}{p.privacyIncidents.map(i=><details key={i.id}><summary>Privacy review · {i.status} · {i.owner}</summary><p>{i.note}</p>{i.events.map((e,j)=><p key={j}>{e.at} · {e.actor} · {e.note}</p>)}{admin&&i.status!=='CLOSED'&&<button className="text-button" disabled={pending||!note} onClick={()=>run({operation:'privacy-review',id:i.id,status:i.status==='OPEN'?'UNDER_REVIEW':'CLOSED',note})}>{i.status==='OPEN'?'Start privacy review':'Close reviewed incident'}</button>}</details>)}</section>}
 </div>;
}
function CaseEditor({record:c,run,pending,note,role,measurements}:{record:CorrectiveCase;run:(body:object)=>Promise<void>;pending:boolean;note:string;role:string;measurements:{id:string;label:string}[]}){
 const [cause,setCause]=useState('UNKNOWN'),[causeStatus,setCauseStatus]=useState('SUSPECTED'),[refs,setRefs]=useState(''),[kind,setKind]=useState<Option['kind']>('UPGRADE'),[action,setAction]=useState('resilience'),[cost,setCost]=useState(''),[feasibility,setFeasibility]=useState('UNKNOWN'),[counterpart,setCounterpart]=useState(''),[infra,setInfra]=useState(''),[spare,setSpare]=useState(''),[access,setAccess]=useState(''),[commercial,setCommercial]=useState('UNKNOWN'),[setup,setSetup]=useState(''),[recurring,setRecurring]=useState(''),[request,setRequest]=useState('NOT_REQUESTED'),[agreement,setAgreement]=useState(''),[requestDate,setRequestDate]=useState(''),[calendar,setCalendar]=useState(''),[holidays,setHolidays]=useState(''),[approval,setApproval]=useState(''),[plan,setPlan]=useState(''),[measurement,setMeasurement]=useState('');
 const network=['Network','Admin'].includes(role),reg=['Regulatory','Admin'].includes(role),finance=['Finance','Admin'].includes(role),editable=['DRAFT','DIAGNOSIS','OPTIONS'].includes(c.status),numeric=(s:string)=>s.trim()?Number(s):null;
 const [low,setLow]=useState(''),[base,setBase]=useState(''),[high,setHigh]=useState(''),[savings,setSavings]=useState(''),[months,setMonths]=useState(''),[horizon,setHorizon]=useState(''),[businessSource,setBusinessSource]=useState(''),[reviewer,setReviewer]=useState(''),[improvement,setImprovement]=useState(''),[defer,setDefer]=useState('');
 const command=(operation:string,extra:object={})=>run({operation,id:c.id,note,...extra});
 return <section className="panel mt-6" data-case-id={c.id}><h3>{c.siteId} · {c.status}</h3><p className="subtle">Case {c.id.slice(0,8)} · {c.period}</p><p>{c.obligationId} v{c.obligationSnapshot.version} · {c.finding.state} · Cause {c.diagnosis.cause}/{c.diagnosis.status} · Engineering {c.engineeringReview?'reviewed':'pending'} · Regulatory {c.regulatoryReview?'reviewed':'pending'}</p><p className="subtle">Owner {c.owner}; {c.dueDate||'No verified corrective due date'} · {c.dueSource}. {c.incidentIds.length} incident timelines linked. Reviewing this case does not authorise expenditure.</p><details className="candidate-disclosure"><summary>Diagnosis and evidence</summary><p>{c.diagnosis.note} · {c.diagnosis.evidenceRefs.join('; ')||'Evidence missing'}</p><div className="weight-grid"><label>Cause<select aria-label="Diagnosis cause" value={cause} onChange={e=>setCause(e.target.value)}>{['UNKNOWN','POWER','CAPACITY','BACKHAUL','MAINTENANCE'].map(x=><option key={x}>{x}</option>)}</select></label><label>Diagnosis status<select aria-label="Diagnosis status" value={causeStatus} onChange={e=>setCauseStatus(e.target.value)}><option>SUSPECTED</option><option>CONFIRMED</option></select></label><label>Cause evidence references<input aria-label="Diagnosis evidence references" value={refs} onChange={e=>setRefs(e.target.value)} placeholder="Incident / engineering assessment references, comma separated"/></label></div><button className="text-button" disabled={!network||!editable||pending||!note} onClick={()=>command('diagnose',{cause,status:causeStatus,evidenceRefs:refs.split(',').map(x=>x.trim()).filter(Boolean)})}>Save diagnosis</button></details>
 <h4>Build / upgrade / share / maintain / defer</h4>{c.options.map(o=><details className="candidate-disclosure" key={o.id}><summary>{o.kind} · {o.actionCode} · {usd(o.cost)} · {o.technicalFeasibility} · {o.id===c.selectedOptionId?'Selected for review':'Alternative'}</summary><p>{businessValue(o).status}: {businessValue(o).assumption}</p><p>{o.counterpart||'Counterpart unknown'} · {o.infrastructureType||'Infrastructure unknown'} · {o.spareCapacityEvidence||'Capacity evidence unknown'} · {o.requestStatus}</p><p>Agreement {o.agreementRef||'not supplied'} · Authority approval {o.approvalRef||'not supplied'} · {o.deadlineSource}</p>{businessValue(o).net&&<p>Undiscounted low/base/high net: {Object.values(businessValue(o).net!).map(v=>usd(v)).join(' / ')}</p>}<details><summary>Assumptions and provenance</summary><pre className="evidence-json">{JSON.stringify(o,null,2)}</pre></details><button className="text-button" disabled={!editable||!finance&&!network||pending||!note} onClick={()=>command('select-option',{optionId:o.id})}>Select alternative for review</button></details>)}
 {editable&&<details className="candidate-disclosure"><summary>Add an alternative and business-case assumptions</summary><div className="weight-grid"><label>Alternative<select value={kind} onChange={e=>setKind(e.target.value as Option['kind'])}>{['BUILD','UPGRADE','SHARE','MAINTAIN','DEFER'].map(x=><option key={x}>{x}</option>)}</select></label><label>Intervention<select value={action} onChange={e=>setAction(e.target.value)}>{['capacity','resilience','backhaul','maintenance','defer'].map(x=><option key={x}>{x}</option>)}</select></label><label>Investment cost (USD; blank = unknown)<input aria-label="Alternative investment cost" type="number" value={cost} onChange={e=>setCost(e.target.value)}/></label><label>Technical feasibility<select value={feasibility} onChange={e=>setFeasibility(e.target.value)}>{['UNKNOWN','SUPPORTED','UNSUPPORTED'].map(x=><option key={x}>{x}</option>)}</select></label><label>Commercial feasibility<select value={commercial} onChange={e=>setCommercial(e.target.value)}>{['UNKNOWN','SUPPORTED','UNSUPPORTED'].map(x=><option key={x}>{x}</option>)}</select></label></div><details><summary>Sharing evidence and access dependencies</summary><div className="weight-grid">{[['Counterpart',counterpart,setCounterpart],['Infrastructure type',infra,setInfra],['Spare capacity evidence',spare,setSpare],['Access / security dependencies',access,setAccess],['Request / negotiation status',request,setRequest],['Agreement reference',agreement,setAgreement],['Approval reference',approval,setApproval],['Request date YYYY-MM-DD',requestDate,setRequestDate],['Reviewed holiday calendar reference',calendar,setCalendar],['Holiday dates (comma separated)',holidays,setHolidays],['Setup cost USD',setup,setSetup],['Recurring cost USD/month',recurring,setRecurring]].map(([label,value,setter])=><label key={String(label)}>{String(label)}<input value={String(value)} onChange={e=>(setter as (s:string)=>void)(e.target.value)}/></label>)}</div><p>A provider response date can be derived from SI 137 s.8(4) only after applicability review and a supplied request date/holiday calendar. Draft agreements are not approvals.</p></details><details><summary>Incremental financial assumptions — optional, unknown by default</summary><div className="weight-grid">{[['Incremental contribution low USD/month',low,setLow],['Incremental contribution base USD/month',base,setBase],['Incremental contribution high USD/month',high,setHigh],['OPEX savings USD/month',savings,setSavings],['Implementation months',months,setMonths],['Benefit horizon months',horizon,setHorizon],['Assumption source',businessSource,setBusinessSource],['Assumption reviewer',reviewer,setReviewer],['Expected operational improvement',improvement,setImprovement],['Defer / do nothing impact',defer,setDefer]].map(([label,value,setter])=><label key={String(label)}>{String(label)}<input value={String(value)} onChange={e=>(setter as (s:string)=>void)(e.target.value)}/></label>)}</div><p>Site contribution is not incremental benefit. Savings already including failure costs must not add those costs again. No avoided penalty is credited.</p></details><label>Post-intervention measurement plan<input aria-label="Outcome measurement plan" value={plan} onChange={e=>setPlan(e.target.value)}/></label><button className="text-button" disabled={!finance&&!network||pending||!note} onClick={()=>command('option',{option:{kind,actionCode:action,cost:numeric(cost),technicalFeasibility:feasibility,commercialFeasibility:commercial,counterpart,infrastructureType:infra,spareCapacityEvidence:spare,accessDependencies:access,requestStatus:request,agreementRef:agreement,approvalRef:approval,...(requestDate?{requestDate,holidayCalendarRef:calendar,holidayDates:holidays.split(',').map(x=>x.trim()).filter(Boolean)}:{}),setupCost:numeric(setup),recurringCost:numeric(recurring),businessCase:{incrementalContribution:{low:numeric(low),base:numeric(base),high:numeric(high)},opexSavings:numeric(savings),recurringCosts:numeric(recurring),implementationMonths:numeric(months),horizonMonths:numeric(horizon),basis:'USD nominal incremental monthly assumptions',assumptions:note,sourceRef:businessSource,reviewer,operationalImprovement:improvement||'Unknown',measurementPlan:plan,deferImpact:defer||'Unknown'}}})}>Save alternative</button></details>}
 <div className="action-row">{editable&&<><label>Verification plan<input value={plan} onChange={e=>setPlan(e.target.value)}/></label><button className="text-button" disabled={!network||pending||!note||!plan} onClick={()=>command('engineering-review',{measurementPlan:plan})}>Record engineering validation</button><button className="text-button" disabled={!reg||pending||!note} onClick={()=>command('regulatory-review')}>Record regulatory review</button><button className="primary-button" disabled={!finance||pending||!note} onClick={()=>command('submit')}>Submit for investment review</button></>}{c.status==='SUBMITTED'&&<button className="text-button" disabled={!network&&!reg||pending||!note} onClick={()=>command('review')}>Mark investment evidence reviewed</button>}{c.status==='REVIEWED'&&<><label>External capital approval / implementation reference<input value={approval} onChange={e=>setApproval(e.target.value)}/></label><button className="text-button" disabled={!network||pending||!note||!approval} onClick={()=>command('implement',{approvalRef:approval})}>Track authorised implementation</button></>}{c.status==='IMPLEMENTING'&&<button className="text-button" disabled={!network||pending||!note} onClick={()=>command('complete')}>Record implementation completion</button>}{c.status==='IMPLEMENTED'&&<><label>Independent post-intervention measurement<select aria-label="Outcome measurement" value={measurement} onChange={e=>setMeasurement(e.target.value)}><option value="">Choose measured evidence</option>{measurements.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label><button className="text-button" disabled={!network&&!reg||pending||!note||!measurement} onClick={()=>command('verify',{measurementId:measurement})}>Verify measured outcome</button></>}</div>{c.outcome&&<p>Measured outcome {percentage(c.outcome.result)} · {c.outcome.note}. No causal benefit attribution is inferred.</p>}<details className="candidate-disclosure"><summary>Retained review / implementation timeline and source chain</summary>{c.events.map((e,i)=><p key={i}>{e.at} · {e.actor} · {e.action} · {e.note}</p>)}<pre className="evidence-json">{JSON.stringify(c,null,2)}</pre></details></section>
}


