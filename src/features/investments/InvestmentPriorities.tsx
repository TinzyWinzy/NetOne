import { useMemo, useState } from 'react';
import { COMPONENTS, DEFAULT_WEIGHTS, MODEL_VERSION, generateCandidates, rankCandidates, validateWeights } from '../../domain/investments';
import type { Candidate, Weights } from '../../domain/investments';
import { usd } from '../../domain/portfolio';
import { useWorkspace } from '../../components/WorkspaceProvider';
import { useSession } from '../../components/SessionGate';
import { activeRules } from '../../domain/operations';
import type { PortfolioFilters, Period, Site } from '../../domain/portfolio';

export default function InvestmentPriorities({ sites, period, onSite, weights, onWeights, filters }: { filters: PortfolioFilters; sites: Site[]; period: Period; onSite: (site: Site) => void; weights: Weights; onWeights: (weights: Weights) => void }) {
  const {workspace,command}=useWorkspace(); const {user}=useSession(); const canAnalyse=['Finance','Network','Admin'].includes(user.role); const serviceRule=activeRules(workspace.rules,period).find(rule=>rule.metric==='availability'&&rule.comparator==='<')||null;
  const [draft, setDraft] = useState<Weights>(weights);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [snapshotStatus, setSnapshotStatus] = useState('');
  const [inspected, setInspected] = useState<string | null>(null);
  const all = useMemo(() => rankCandidates(generateCandidates(sites, period, weights, serviceRule)), [sites, period, weights, serviceRule]);
  const eligible = all.filter(candidate => candidate.eligible);
  const visible = includeExcluded ? all : eligible;
  const selected = selection.map(id => all.find(candidate => candidate.id === id)).filter((candidate): candidate is Candidate => !!candidate);
  const error = validateWeights(draft);
  function toggle(id: string) {
    setSelection(current => current.includes(id) ? current.filter(value => value !== id) : [...current.slice(-1), id]);
  }
  function saveSnapshot() {
    try {
      localStorage.setItem('netone-investment-snapshot', JSON.stringify({ savedAt: new Date().toISOString(), period, weights, candidates: all }));
      setSnapshotStatus(`Saved ${all.length} candidate evidence records locally. This is a browser snapshot, not a shared audit record.`);
    } catch { setSnapshotStatus('Browser storage is unavailable. No snapshot was saved.'); }
  }
  return <div className="investment-feature">
    <div className="page-heading"><div><p className="eyebrow">INVESTMENT PRIORITISATION · {MODEL_VERSION}</p><h2>Explain the priority before allocating capital</h2><p>{eligible.length} eligible interventions across {sites.length} filtered sites. Scores indicate relative demo priority, not ROI or predicted benefit.</p></div></div>
    <details className="panel model-config"><summary>Scoring assumptions and weights</summary><p className="subtle">Seven bounded 0–100 inputs × action relevance (0–1) × percentage weight. Contributions sum to the priority score. Costs are separate fictional intervention estimates. Missing, partial, stale or conflicting evidence withholds scoring. No weight renormalisation hides missing data.</p>
      <div className="weight-grid">{COMPONENTS.map(component => <label key={component.code}>{component.label}<input aria-label={`${component.label} weight`} disabled={!canAnalyse} type="number" min="0" max="100" step="1" value={Number.isNaN(draft[component.code]) ? '' : draft[component.code]} onChange={event => setDraft(current => ({ ...current, [component.code]: event.target.value === '' ? NaN : Number(event.target.value) }))} /><small>{component.transform}</small></label>)}</div>
      <p role="status">{error || 'Weights total 100%. Ready to apply.'}</p><button className="primary-button" disabled={!!error || !canAnalyse} onClick={() => { onWeights({ ...draft }); setSnapshotStatus(''); }}>Apply demo weights</button><button className="text-button ml-4" disabled={!canAnalyse} onClick={() => { setDraft({ ...DEFAULT_WEIGHTS }); onWeights({ ...DEFAULT_WEIGHTS }); }}>Restore default weights</button>
      <p className="subtle">{serviceRule ? `Service rule ${serviceRule.id} v${serviceRule.version}: availability below ${serviceRule.threshold}%. ${serviceRule.source}.` : 'No active availability rule covers this reporting period; service scoring is withheld.'} Effective dates are shown in Service rules. Relevance coefficients and eligibility thresholds are inspectable in every candidate. Applied study weights last for this page session; reload restores the active policy. Shared policy changes use Models and sensitivity. A saved evidence snapshot retains the weights used.</p>
    </details>
    <section className="panel mt-6"><div className="section-heading"><h3>Ranked investment candidates</h3><label><input type="checkbox" checked={includeExcluded} onChange={event => setIncludeExcluded(event.target.checked)} /> Show excluded candidates</label></div>
      <p className="subtle">Select two interventions to compare. A third selection replaces the oldest. Alternative actions at the same site are separate candidates; their benefits must not be added together.</p>
      <button className="primary-button" disabled={selected.length !== 2} onClick={() => { const panel = document.getElementById('candidate-comparison'); panel?.scrollIntoView({ block: 'start' }); panel?.focus(); }}>Compare selected ({selected.length}/2)</button>
      <div className="table-scroll candidate-list" tabIndex={0} aria-label="Scrollable candidate ranking"><table className="investment-table"><thead><tr><th>Compare</th><th>Rank</th><th>Site / intervention</th><th>Estimated cost</th><th>Priority / 100</th><th>Eligibility and evidence</th></tr></thead><tbody>{visible.map(candidate => <tr key={candidate.id}><td><input aria-label={`Compare ${candidate.id}`} type="checkbox" checked={selection.includes(candidate.id)} onChange={() => toggle(candidate.id)} /></td><td>{candidate.eligible ? eligible.indexOf(candidate) + 1 : '—'}</td><td><button className="site-link" onClick={() => { const site = sites.find(value => value.id === candidate.siteId); if (site) onSite(site); }}>{candidate.siteId} · {candidate.action}</button><small>{candidate.region} · {candidate.technology}</small></td><td>{usd(candidate.estimatedCost)}</td><td>{candidate.score === null ? 'Withheld' : candidate.score.toFixed(2)}</td><td><span className={`quality ${candidate.eligible ? 'complete' : 'warning'}`}>{candidate.eligible ? candidate.confidence : 'EXCLUDED'}</span><p className="subtle">{candidate.reason}</p></td></tr>)}</tbody></table></div>
      {!visible.length && <p className="empty-state">No eligible candidates match these filters. Show exclusions to inspect the reasons.</p>}
      <label className="score-inspector">Inspect one candidate<select aria-label="Inspect candidate" value={inspected ?? ''} onChange={event => setInspected(event.target.value || null)}><option value="">Choose an intervention</option>{all.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.siteId} · {candidate.action}</option>)}</select></label>
      {all.find(candidate => candidate.id === inspected) && <CandidateEvidence candidate={all.find(candidate => candidate.id === inspected)!} />}
      {['Finance','Admin'].includes(user.role)&&<button className="primary-button" onClick={async()=>{try{const data=await command('score',{filters});setSnapshotStatus(`Persisted ${data.run.candidateCount} candidate/component records under the active policy.`);}catch(error){setSnapshotStatus(String(error));}}}>Persist policy scoring run</button>}<button className="text-button" onClick={saveSnapshot}>Save local evidence snapshot</button><p className="subtle" role="status">{snapshotStatus}</p>
    </section>
    <section id="candidate-comparison" tabIndex={-1} className="panel mt-6" aria-label="Intervention comparison"><h3>Intervention comparison</h3>{selected.length < 2 ? <p>Select two candidates above to compare costs, evidence and score contributions.</p> : <div className="comparison-grid">{selected.map(candidate => <CandidateEvidence key={candidate.id} candidate={candidate} />)}</div>}</section>
  </div>;
}
export function CandidateEvidence({ candidate }: { candidate: Candidate }) {
  const {workspace,command}=useWorkspace();const {user}=useSession();const [message,setMessage]=useState('');const [pending,setPending]=useState(false);const policy=workspace.configs.find(value=>value.id===workspace.activeConfigId)!;const matches=COMPONENTS.every(component=>candidate.weights[component.code]===policy.weights[component.code]);
  return <section className="candidate-evidence">{['Finance','Admin'].includes(user.role)&&<><button className="primary-button" disabled={pending||!matches} onClick={async()=>{setPending(true);try{const data=await command('candidate-evidence',{candidateId:candidate.id,filters:{period:candidate.period,region:'All',technology:'All',state:'All'}});setMessage(`Shared evidence ${data.evidence.id} saved. Export or submit it in Decision evidence.`);}catch(error){setMessage(String(error));}finally{setPending(false);}}}>Save shared candidate evidence</button>{!matches&&<p className="subtle">Save and activate this study as a model version before saving shared policy evidence.</p>}<p className="subtle" role="status">{message}</p></>}<p className="eyebrow">{candidate.siteId} · {candidate.period} · SYNTHETIC</p><h3>{candidate.action}</h3><p><strong>{usd(candidate.estimatedCost)}</strong> estimated CAPEX · Priority {candidate.score === null ? 'withheld' : candidate.score.toFixed(2)}</p><p className="subtle">{candidate.reason}</p>
    <div className="table-scroll"><table className="investment-table component-table"><thead><tr><th>Component</th><th>Raw</th><th>0–100</th><th>Relevance</th><th>Weight</th><th>Points</th></tr></thead><tbody>{candidate.components.map(component => <tr key={component.code}><td>{COMPONENTS.find(value => value.code === component.code)!.label}<small>{COMPONENTS.find(value => value.code === component.code)!.unit}</small></td><td>{component.raw ?? 'Missing'}</td><td>{component.normalised?.toFixed(2) ?? 'Withheld'}</td><td>{component.relevance}</td><td>{component.weight}%</td><td>{component.contribution?.toFixed(2) ?? 'Withheld'}</td></tr>)}</tbody></table></div>
    <p className="subtle">Formula: normalised × relevance × weight / 100; clamp means limit to 0–100. Displayed points are rounded; totals use full precision. Ineligible candidates have no recommendation score even when complete input components are available.</p><p className="subtle">Source: {candidate.sourceRef}. Model/weights: {candidate.weightVersion}. Service evidence: {candidate.serviceEvidence.observed}% availability, {candidate.serviceEvidence.triggered ? 'below' : 'at/above'} demonstration threshold; rule {(candidate.serviceEvidence.rule?.id || 'NO-ACTIVE-RULE')} v{(candidate.serviceEvidence.rule?.version || 'none')}. No legal determination or validated intervention impact is implied.</p>
  </section>;
}
