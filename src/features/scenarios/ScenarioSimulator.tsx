import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../components/WorkspaceProvider';
import { activeRules } from '../../domain/operations';
import { backend } from '../../lib/backend';
import { exportDecision } from '../../lib/exportDecision';
import { useSession } from '../../components/SessionGate';
import { generateCandidates } from '../../domain/investments';
import type { Weights } from '../../domain/investments';
import { allocateScenario, OBJECTIVES, replayScenario } from '../../domain/scenarios';
import type { SavedScenario, ScenarioResult } from '../../domain/scenarios';
import { usd } from '../../domain/portfolio';
import type { PortfolioFilters, Site } from '../../domain/portfolio';
export default function ScenarioSimulator({ sites, filters, weights }: { sites: Site[]; filters: PortfolioFilters; weights: Weights }) {
  const {workspace,command}=useWorkspace();const policy=workspace.configs.find(value=>value.id===workspace.activeConfigId)!;const serviceRule=activeRules(workspace.rules,filters.period).find(rule=>rule.metric==='availability'&&rule.comparator==='<')||null;
  const candidates = useMemo(() => generateCandidates(sites, filters.period, policy.weights, serviceRule), [sites, filters.period, weights]);
  const [budget, setBudget] = useState('250000');
  const [objective, setObjective] = useState('balanced');
  const [minimum, setMinimum] = useState(String(policy.minimumScore));
  const [mustFund, setMustFund] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [name, setName] = useState('');
  const [compare, setCompare] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [runHash,setRunHash]=useState('');const [mustRationale,setMustRationale]=useState('');const [presets,setPresets]=useState<ScenarioResult[]>([]);const [allocationLimit,setAllocationLimit]=useState(30);
  const { user } = useSession();
  const canWrite = ['Finance', 'Admin'].includes(user.role);
  useEffect(() => { backend('scenarios').then(data => setSaved(data.scenarios)).catch(failure => setMessage(failure.message)); }, []);
  async function run() {
    if (pending) return;
    setPending(true); setResult(null);
    try {
      if (!budget.trim() || !minimum.trim()) throw new Error('Enter a budget and minimum objective score.');
      const { result: next, snapshotHash } = await backend('run', { input: { budget: Number(budget), objective, minimumScore: Number(minimum), mustFundRationale:mustRationale, mustFund, excluded, filters: { ...filters } } });
      setResult(next); setRunHash(snapshotHash); setError(''); setMessage('');
    } catch (failure) { setResult(null); setError(failure instanceof Error ? failure.message : 'Scenario failed.'); } finally { setPending(false); }
  }
  async function save() {
    if (!result || pending) return;
    setPending(true);
    try {
      const data = await backend('scenarios', { input: result.input, expectedHash:runHash, name: name.trim() || `${OBJECTIVES[result.input.objective].label} ${saved.length + 1}` });
      setSaved(current => [...current, data.scenario]); setResult(data.scenario.result); setMessage('Scenario saved on the server with authenticated actor and immutable evidence.');
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Server save failed.'); } finally { setPending(false); }
  }
  const compared = saved.filter(record => compare.includes(record.id));
  return <div>
    <div className="page-heading"><div><p className="eyebrow">CAPITAL ALLOCATION · SYNTHETIC</p><h2>Test the trade-offs within a budget</h2><p>Deterministic score-per-dollar heuristic. Results are advisory and do not guarantee the globally optimal portfolio.</p></div></div>
    <section className="panel scenario-parameters"><h3>Scenario parameters</h3><div className="weight-grid">
      <label>Capital budget (USD)<input aria-label="Capital budget" type="number" min="0" step="0.01" value={budget} onChange={event => setBudget(event.target.value)} /></label>
      <label>Objective<select aria-label="Scenario objective" value={objective} onChange={event => setObjective(event.target.value)}>{Object.entries(OBJECTIVES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <label>Minimum objective score<input aria-label="Minimum objective score" type="number" min="0" max="100" value={minimum} onChange={event => setMinimum(event.target.value)} /></label>
    </div><details className="policy-details"><summary>Scoring policy and execution details</summary><p className="subtle">Current portfolio filters scope the candidate universe. Balanced uses persisted policy {policy.id} v{policy.version}. Other objectives use named presets; unsaved Capital priorities study weights do not change saved scenarios. Execution model {candidates[0]?.modelVersion}. Exact weights: {Object.entries(objective==='balanced'?policy.weights:OBJECTIVES[objective].weights).map(([key, value]) => `${key} ${value}%`).join(' · ')}.</p></details>
    <details><summary>Must-fund and exclusion constraints</summary><p className="subtle">Required candidates must meet the minimum score, eligibility and budget. Only one action per site is allowed. Conflicting required actions produce an infeasible request.</p><label>Must-fund rationale<input aria-label="Must-fund rationale" value={mustRationale} onChange={e=>setMustRationale(e.target.value)} maxLength={1000}/></label><label>Must fund<select aria-label="Must fund" multiple value={mustFund} onChange={event => setMustFund(Array.from(event.target.selectedOptions, option => option.value))}>{candidates.filter(candidate => candidate.eligible).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.siteId} · {candidate.action} · {usd(candidate.estimatedCost)}</option>)}</select></label><label>Exclude<select aria-label="Exclude candidates" multiple value={excluded} onChange={event => setExcluded(Array.from(event.target.selectedOptions, option => option.value))}>{candidates.filter(candidate => candidate.eligible).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.siteId} · {candidate.action}</option>)}</select></label><button className="text-button" onClick={() => { setMustFund([]); setExcluded([]); }}>Clear constraints</button></details>
    <div className="action-row scenario-actions"><button className="primary-button" disabled={!canWrite || pending} onClick={run}>Run scenario</button><button className="secondary-button" disabled={!canWrite||pending} onClick={async()=>{setPending(true);try{const data=await backend('compare-objectives',{input:{budget:Number(budget),minimumScore:Number(minimum),mustFund,mustFundRationale:mustRationale,excluded,filters}});setPresets(data.results);setMessage('Compared identical budget, filters, candidate evidence and policy snapshots.');}catch(e){setMessage(String(e))}finally{setPending(false)}}}>Compare Balanced / Growth / Reliability</button></div>{error && <p className="data-notice" role="alert">{error}</p>}</section>
    {!!presets.length&&<section className="panel mt-6"><h3>Same-evidence budget trade-offs</h3><div className="comparison-grid">{presets.map(r=><div key={r.input.objective}><h4>{OBJECTIVES[r.input.objective].label}</h4><AllocationSummary result={r}/></div>)}</div></section>}
    {result && <section className="panel mt-6" aria-label="Scenario result"><h3>Proposed allocation</h3><p>Budget {usd(result.input.budget)} · Proposed allocation <strong>{usd(result.spend)}</strong> · Unallocated <strong>{usd(result.unallocated)}</strong></p><p className="subtle">Snapshot: {result.input.filters.period}, {result.input.filters.region}, {result.input.filters.technology}, {result.input.filters.state} · {OBJECTIVES[result.input.objective].label} · Minimum score {result.input.minimumScore} · {result.engineVersion}. Form changes require another run; this result retains its original inputs. Objective value {result.objectiveValue.toFixed(2)} is a sum of priority points, not predicted return.</p>
      <AllocationSummary result={result}/><AllocationTable result={result} limit={allocationLimit}/>{result.allocations.length>allocationLimit&&<button className="text-button" onClick={()=>setAllocationLimit(allocationLimit+30)}>Show more allocations</button>}
      <label>Scenario name<input className="scenario-name" aria-label="Scenario name" value={name} onChange={event => setName(event.target.value)} /></label><button className="primary-button ml-4" disabled={!canWrite || pending} onClick={save}>Save scenario on server</button>
    </section>}
    <p className="subtle" role="status">{message}</p>
    <section className="panel mt-6"><h3>Saved scenarios</h3><p className="subtle">Server-backed immutable snapshots shared with authenticated demo users. Select two to compare. Finance or Admin can run, save and export; no capital approval is implied.</p>{saved.length === 0 && <p>No saved scenarios yet.</p>}{saved.map(record => <div className="priority-preview" key={record.id}><label><input aria-label={`Compare scenario ${record.name}`} type="checkbox" checked={compare.includes(record.id)} onChange={() => setCompare(current => current.includes(record.id) ? current.filter(id => id !== record.id) : [...current.slice(-1), record.id])} /> {record.name}</label><span>{usd(record.result.spend)} proposed allocation · {record.result.allocations.filter(value => value.selected).length} interventions</span><button className="text-button" onClick={() => { setResult(structuredClone(record.result)); setRunHash(''); setError(''); }}>View saved result</button><button className="text-button" disabled={!canWrite} onClick={async () => { try { await exportDecision(record.id, 'pdf'); setMessage('PDF exported and audited.'); } catch (failure) { setMessage(String(failure)); } }}>Export PDF</button><button className="text-button" disabled={!canWrite} onClick={async () => { try { await exportDecision(record.id, 'csv'); setMessage('CSV exported and audited.'); } catch (failure) { setMessage(String(failure)); } }}>Export CSV</button><button className="text-button" disabled={!canWrite} onClick={async () => { try { await exportDecision(record.id, 'json'); setMessage('JSON evidence exported and audited.'); } catch (failure) { setMessage(String(failure)); } }}>Export evidence</button><button className="text-button" disabled={!canWrite} onClick={async()=>{try{await command('reviews',{operation:'submit',subjectType:'scenario',subjectId:record.id,note:'Submitted for advisory technical and regulatory review; no capital approval.'});setMessage('Scenario submitted to the evidence review queue.');}catch(error){setMessage(String(error));}}}>Submit scenario for review</button><button className="text-button" onClick={() => { try { const replay=replayScenario(record.result); setMessage(JSON.stringify(replay) === JSON.stringify(record.result) ? 'Snapshot replay matches the saved allocation.' : 'Snapshot replay differs; review engine compatibility.'); } catch { setMessage('Saved scenario cannot be replayed with the current engine.'); } }}>Verify replay</button></div>)}</section>
    {compared.length === 2 && <section className="panel mt-6" aria-label="Scenario comparison"><h3>Scenario comparison</h3><p className="subtle">Only {compared[0].result.allocations.filter(a => a.selected && compared[1].result.allocations.some(b => b.selected && a.candidateId === b.candidateId)).length} interventions are common to both allocations. Different periods, scopes or objectives may make point totals incomparable.</p><div className="comparison-grid">{compared.map(record => <div key={record.id}><h3>{record.name}</h3><p>{OBJECTIVES[record.result.input.objective].label} · {usd(record.result.input.budget)} budget</p><p>{usd(record.result.spend)} proposed allocation · {usd(record.result.unallocated)} remaining</p><AllocationTable result={record.result} selectedOnly /></div>)}</div></section>}
  </div>;
}
function AllocationTable({ result, selectedOnly = false,limit=30 }: { result: ScenarioResult; selectedOnly?: boolean;limit?:number }) {
  return <div className="table-scroll candidate-list" tabIndex={0} role="region" aria-label="Scrollable scenario allocation"><table className="investment-table"><thead><tr><th>Site / intervention</th><th>Cost</th><th>Objective points</th><th>Allocation reason</th></tr></thead><tbody>{result.allocations.filter(allocation => !selectedOnly || allocation.selected).sort((a, b) => Number(b.selected) - Number(a.selected)).slice(0,limit).map(allocation => {
    const candidate = result.candidates.find(value => value.id === allocation.candidateId)!;
    return <tr key={allocation.candidateId}><td>{candidate.siteId} · {candidate.action}</td><td>{usd(allocation.cost)}</td><td>{allocation.objectiveScore.toFixed(2)}</td><td><strong>{allocation.selected ? 'Selected' : 'Excluded'}</strong><p className="subtle">{allocation.reason}</p></td></tr>;
  })}</tbody></table></div>;
}

function AllocationSummary({result:r}:{result:ScenarioResult}){const selected=r.allocations.filter(a=>a.selected),types=Array.from(new Set(r.candidates.map(c=>c.action)));const omitted=r.candidates.filter(c=>c.eligible&&!selected.some(a=>a.candidateId===c.id)).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,5);return <><p>{selected.length} interventions · {usd(r.spend)} proposed allocation · {usd(r.unallocated)} remaining</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Proposed intervention allocation summary"><table className="investment-table"><thead><tr><th>Type</th><th>Count</th><th>Proposed allocation</th></tr></thead><tbody>{types.map(type=>{const rows=selected.filter(a=>r.candidates.find(c=>c.id===a.candidateId)?.action===type);return <tr key={type}><td>{type}</td><td>{rows.length}</td><td>{usd(rows.reduce((sum,a)=>sum+a.cost,0))}</td></tr>})}</tbody></table></div><details className="candidate-disclosure"><summary>Why leading priority candidates were omitted</summary>{omitted.map(c=><p key={c.id}>{c.siteId} · {c.action} · {c.score?.toFixed(2)} priority: {r.allocations.find(a=>a.candidateId===c.id)?.reason}</p>)}<p>Priority ranks need; score-per-dollar allocation favours inexpensive work and enforces one action per site. It is a greedy heuristic, not global optimisation or predicted ROI. Must-fund requirements are explicit reviewer entries, never inferred from regulation.</p></details><details><summary>Exact frozen policy and applicability metadata</summary><pre className="evidence-json">{JSON.stringify({model:r.candidates[0]?.modelVersion,weights:r.objectiveWeights,policy:r.policySnapshot,regulatory:r.regulatorySnapshot},null,2)}</pre></details></>};
