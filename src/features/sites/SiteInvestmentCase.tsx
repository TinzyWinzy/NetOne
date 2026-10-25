import { useMemo } from 'react';
import { supportCandidate } from '../../domain/assurance';
import { trafficGrowth } from '../../domain/growth';
import { percentage } from '../../lib/format';
import { DATASET_VERSION, decisionState, observation, reviewReason, usd } from '../../domain/portfolio';
import type { Period, Site } from '../../domain/portfolio';
import { generateCandidates, rankCandidates } from '../../domain/investments';
import type { Weights } from '../../domain/investments';
import { useWorkspace } from '../../components/WorkspaceProvider';
import { activeRules } from '../../domain/operations';
import { SiteNetworkEvidence } from '../operations/OperationsWorkbench';
import { CandidateEvidence } from '../investments/InvestmentPriorities';
import { calculateSiteCostBreakdown, generateSiteCostRecommendation } from '../../domain/costOptimization';
import { evaluateSitePredictiveAssurance } from '../../domain/predictiveAssurance';
import { compareModernizationOptions } from '../../domain/financialModels';

export default function SiteInvestmentCase({ site, period, onBack, weights }: { site: Site; period: Period; onBack: () => void; weights: Weights }) {
  const { workspace } = useWorkspace();
  const serviceRule = activeRules(workspace.rules, period).find(rule => rule.metric === 'availability' && rule.comparator === '<') || null;
  const row = observation(site, period);
  const candidates = rankCandidates(generateCandidates([site], period, weights, serviceRule).map(c => supportCandidate(c, workspace.pilot?.cases || [], workspace.pilot?.obligations)));
  const recommendation = candidates.find(candidate => candidate.eligible);

  const costBreakdown = useMemo(() => calculateSiteCostBreakdown(site, period), [site, period]);
  const costRec = useMemo(() => generateSiteCostRecommendation(costBreakdown), [costBreakdown]);
  const predictiveRisk = useMemo(() => evaluateSitePredictiveAssurance(site, period), [site, period]);
  const modernization = useMemo(() => compareModernizationOptions(site, period), [site, period]);

  return <article aria-label="Site investment case">
    <button className="text-button" onClick={onBack}>← Back to portfolio</button>
    <div className="page-heading">
      <div>
        <p className="eyebrow">SITE INVESTMENT CASE · SYNTHETIC</p>
        <h2>{site.id} · {site.name}</h2>
        <p>{site.region} · {site.technology} · Radio access site · {site.strategic ? 'Inclusion coverage' : 'Standard strategic classification'}</p>
      </div>
      <span className="state-label">{decisionState(site, row)}</span>
    </div>
    
    <p><a className="text-button" href={`?view=assurance&caseSite=${site.id}`}>Open cell QoS evidence and corrective alternatives</a></p>
    
    <section className="case-decision">
      <p className="eyebrow">ADVISORY DEMO INVESTMENT CASE</p>
      <h3>{recommendation ? `${recommendation.action} · ${recommendation.score!.toFixed(2)} / 100 priority` : reviewReason(site, row)}</h3>
      <p>{recommendation ? recommendation.reason : 'No eligible scored intervention with current evidence and demo rules.'} Evidence quality: <strong>{row.quality}</strong>.</p>
    </section>

    {/* Operational Cost Baseline & Remediation Panel */}
    <section className="panel mt-6" aria-label="Operational Cost Baseline">
      <div className="section-heading">
        <h3>Operational Cost Baseline & Unit Economics</h3>
        <span className="quality complete">OPEX DECOMPOSITION</span>
      </div>
      <p className="subtle">Site-level power baseline and unit metrics (diesel fuel burn, grid electricity, battery & generator degradation):</p>
      
      <div className="metric-strip mt-4">
        <div><span>Diesel Expenditure</span><strong>{usd(costBreakdown.powerProfile.monthlyDieselCost)}</strong><small>{costBreakdown.powerProfile.monthlyDieselLiters.toFixed(0)} L · {costBreakdown.powerProfile.generatorCapacityKva} kVA gen</small></div>
        <div><span>Grid Electricity</span><strong>{usd(costBreakdown.powerProfile.monthlyGridCost)}</strong><small>{costBreakdown.powerProfile.gridKwhConsumed.toFixed(0)} kWh consumed</small></div>
        <div><span>Cost Per Traffic Unit</span><strong>{costBreakdown.costPerGB !== null ? `${usd(costBreakdown.costPerGB)} / GB` : 'Unavailable'}</strong><small>{row.trafficGB ? `${row.trafficGB.toLocaleString()} GB traffic` : 'Missing traffic'}</small></div>
        <div><span>Cost Per Available Hour</span><strong>{usd(costBreakdown.costPerAvailableHour)} / hr</strong><small>{row.availability.toFixed(1)}% uptime</small></div>
      </div>

      {costBreakdown.underutilized && (
        <div className="data-notice mt-4" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
          <strong>Underutilized Infrastructure Detected:</strong> Unit cost per traffic unit exceeds benchmark or capacity utilization is below economic threshold.
          <div style={{ marginTop: '6px', fontSize: '11px' }}>
            Recommended Remediation Strategy: <strong>{costRec.recommendedAction.label}</strong>.
            Alternatives evaluated: Power Right-Sizing, Multi-Operator Sharing (SI 137), Micro-Solar, Decommission/Relocate.
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', background: '#fafafa', padding: '14px', borderRadius: '6px', border: '1px solid #e5e5e5' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 600 }}>Optimal Remediation Alternative: {costRec.recommendedAction.label}</h4>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>{costRec.recommendedAction.operationalImpact}</p>
        <dl style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
          <dt>Implementation CAPEX</dt><dd><strong>{usd(costRec.recommendedAction.implementationCost)}</strong></dd>
          <dt>Expected Annual Savings</dt><dd><strong>{usd(costRec.recommendedAction.expectedAnnualSavings.base)} / yr</strong></dd>
          <dt>Payback Period</dt><dd>{costRec.recommendedAction.paybackMonths !== null ? `${(costRec.recommendedAction.paybackMonths / 12).toFixed(1)} years` : 'Beyond 36m'}</dd>
          <dt>Confidence Assessment</dt><dd><span className="quality complete">{costRec.recommendedAction.confidence}</span></dd>
        </dl>
        <p className="subtle" style={{ margin: '8px 0 0' }}><strong>Why preferable:</strong> {costRec.whyPreferredToAlternatives}</p>
      </div>
    </section>

    {/* Predictive Risk & Forward Assurance */}
    <section className="panel mt-6" aria-label="Predictive Risk Assessment">
      <div className="section-heading">
        <h3>Predictive Service Assurance & Risk Horizons</h3>
        <span className="demo-badge">DETERMINISTIC MULTI-HORIZON</span>
      </div>
      <p className="subtle">Forward risk scoring combining power instability, hardware age, historical faults, and SLA drops:</p>
      
      <div className="metric-strip mt-4">
        <div>
          <span>7-Day Risk Horizon</span>
          <strong style={{ color: predictiveRisk.horizons.sevenDay.riskLevel === 'CRITICAL' ? '#b91c1c' : predictiveRisk.horizons.sevenDay.riskLevel === 'HIGH' ? '#c2410c' : '#18181a' }}>
            {predictiveRisk.horizons.sevenDay.riskLevel}
          </strong>
          <small>Score: {predictiveRisk.horizons.sevenDay.riskScore.toFixed(1)} / 100</small>
        </div>
        <div>
          <span>30-Day Risk Horizon</span>
          <strong style={{ color: predictiveRisk.horizons.thirtyDay.riskLevel === 'CRITICAL' ? '#b91c1c' : predictiveRisk.horizons.thirtyDay.riskLevel === 'HIGH' ? '#c2410c' : '#18181a' }}>
            {predictiveRisk.horizons.thirtyDay.riskLevel}
          </strong>
          <small>Score: {predictiveRisk.horizons.thirtyDay.riskScore.toFixed(1)} / 100</small>
        </div>
        <div>
          <span>90-Day Risk Horizon</span>
          <strong style={{ color: predictiveRisk.horizons.ninetyDay.riskLevel === 'CRITICAL' ? '#b91c1c' : predictiveRisk.horizons.ninetyDay.riskLevel === 'HIGH' ? '#c2410c' : '#18181a' }}>
            {predictiveRisk.horizons.ninetyDay.riskLevel}
          </strong>
          <small>Score: {predictiveRisk.horizons.ninetyDay.riskScore.toFixed(1)} / 100</small>
        </div>
        <div>
          <span>Primary Risk Driver</span>
          <strong>{predictiveRisk.factors[0]?.label || 'Nominal'}</strong>
          <small>Score: {predictiveRisk.factors[0]?.score.toFixed(0) || 0}/100</small>
        </div>
      </div>
    </section>

    {/* Technology Modernization Appraisal */}
    <section className="panel mt-6" aria-label="Technology Modernization Comparison">
      <div className="section-heading">
        <h3>Technology Modernization Alternatives ({site.technology} Base Station)</h3>
        <span className="state-label">FINANCIAL MODEL</span>
      </div>
      <p className="subtle">Comprehensive comparison of RAN and power modernization options with infrastructure prerequisite validation:</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
        {modernization.map(opt => (
          <div key={opt.optionCode} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '6px', padding: '14px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600 }}>{opt.title}</h4>
            <dl style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px', marginTop: '8px' }}>
              <dt>Required CAPEX</dt><dd>{usd(opt.capex)}</dd>
              <dt>Incremental Revenue</dt><dd>{usd(opt.monthlyRevenueIncremental * 12)} / yr</dd>
              <dt>Contribution Margin</dt><dd>{usd(opt.monthlyContributionMargin * 12)} / yr</dd>
              <dt>OPEX Savings</dt><dd>{usd(opt.monthlyOpexSavings * 12)} / yr</dd>
              <dt>36-Month NPV</dt><dd><strong>{usd(opt.npv36Months)}</strong></dd>
              <dt>Payback Period</dt><dd>{opt.paybackMonths ? `${opt.paybackMonths} mos` : 'Beyond 36m'}</dd>
              <dt>Status</dt><dd><span className="state-label">{opt.status}</span></dd>
            </dl>
            <div style={{ marginTop: '8px', borderTop: '1px solid #f0f0f0', paddingTop: '6px' }}>
              <span style={{ fontSize: '10px', color: opt.prerequisites.satisfied ? '#047857' : '#b91c1c' }}>
                Prerequisites: {opt.prerequisites.satisfied ? '✓ Satisfied' : `✗ Deficient: ${opt.prerequisites.missingPrerequisites.join(', ')}`}
              </span>
              <p className="subtle" style={{ margin: '4px 0 0' }}>{opt.recommendationRationale}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="panel mt-6">
      <h3>Cell service-assurance evidence</h3>
      <p>Monthly site aggregates do not establish cell-level regulatory compliance. Demonstration service warnings are separate.</p>
      {workspace.pilot?.findings.filter(f => f.cell?.siteId === site.id).slice(-5).reverse().map(f => (
        <details key={f.id}><summary>{f.obligation.id} v{f.obligation.version} · {f.state} · {percentage(f.value)}</summary><p>{f.reason} · {f.obligation.reference} · {f.measurement?.sourceRef || 'Missing cell counters'}</p></details>
      ))}
      {!workspace.pilot?.findings.some(f => f.cell?.siteId === site.id) && <p>No cell finding has been established: supplied KPI evidence is insufficient.</p>}
    </section>

    <div className="mt-6"><SiteNetworkEvidence site={site}/></div>

    <div className="case-grid">
      <section className="panel">
        <h3>Demand and reliability</h3>
        <dl>
          <dt>Reporting month</dt><dd>{period}</dd>
          <dt>Utilisation</dt><dd>{row.utilisation === null ? 'Unavailable' : `${row.utilisation}%`}</dd>
          <dt>Capacity headroom</dt><dd>{row.utilisation === null ? 'Unavailable' : `${100 - row.utilisation}%`}</dd>
          <dt>Traffic growth · month-on-month</dt><dd>{percentage(trafficGrowth(site, period).value)} · {trafficGrowth(site, period).status}</dd>
          <dt>Growth evidence</dt><dd>{trafficGrowth(site, period).priorPeriod} → {period}; {trafficGrowth(site, period).priorGB ?? 'missing'} → {trafficGrowth(site, period).currentGB ?? 'missing'} GB. {trafficGrowth(site, period).definition}</dd>
          <dt>Availability</dt><dd>{row.availability.toFixed(1)}%</dd>
          <dt>Faults in period</dt><dd>{row.faults}</dd>
        </dl>
        <p className="subtle">{row.quality === 'STALE' ? 'Utilisation was last observed in July 2026 and carried forward. Refresh before a capacity decision.' : row.quality === 'CONFLICT' ? 'Synthetic network sources disagree by 18 percentage points on utilisation. The displayed fixture value is unresolved.' : 'Synthetic aggregate observations for the selected month.'}</p>
      </section>

      <section className="panel">
        <h3>Financial evidence</h3>
        <dl>
          <dt>Capital deployed at month end</dt><dd>{usd(row.capex)}</dd>
          <dt>Monthly OPEX</dt><dd>{usd(row.opex)}</dd>
          <dt>Monthly contribution proxy</dt><dd>{usd(row.contribution)}</dd>
          <dt>Failure cost included in OPEX</dt><dd>{usd(row.failureCost)}</dd>
          <dt>Currency and basis</dt><dd>USD · nominal demo values</dd>
        </dl>
        <p className="subtle">Contribution is a fictional commercial proxy, not measured revenue or validated profit. Missing values stay unavailable.</p>
      </section>

      <section className="panel">
        <h3>Strategy and service evidence</h3>
        <p>{site.strategic ? 'Demonstration inclusion tag: retain coverage considerations alongside commercial contribution.' : 'No special inclusion or critical-service tag in this fixture.'}</p>
        <p className="subtle">The versioned demonstration availability rule is evaluated in each candidate below. No NetOne regulatory rule has been validated; these are service review prompts, not legal conclusions.</p>
        <h3 className="mt-6">Observed movement</h3>
        {site.observations.map(metric => <p key={metric.period}>{metric.period}: {metric.utilisation === null ? 'Utilisation unavailable' : `${metric.utilisation}% utilisation`} · {metric.availability.toFixed(1)}% availability</p>)}
      </section>

      <section className="panel">
        <h3>Intervention history</h3>
        {site.history.map(item => <div className="history-item" key={item.date}><p className="eyebrow">{item.date} · DEMONSTRATION</p><h4>{item.action}</h4><p>{usd(item.cost)} · {item.outcome}</p></div>)}
        <h3 className="mt-6">Evidence provenance</h3>
        <p className="subtle">Source: {DATASET_VERSION} / {site.id} / {period}. Stored in the shared canonical evidence workspace. All values are synthetic. No customer data or operator feeds are used.</p>
      </section>
    </div>

    <section className="panel mt-6" aria-label="Site investment candidates">
      <h3>Interventions and score evidence</h3>
      <p className="subtle">Alternative actions are not a combined programme. Scores express demo priority, not financial return.</p>
      {candidates.map(candidate => <details className="candidate-disclosure" key={candidate.id}><summary>{candidate.action} · {usd(candidate.estimatedCost)} · {candidate.score === null ? 'Excluded / score withheld' : `${candidate.score.toFixed(2)} / 100`}</summary><CandidateEvidence candidate={candidate} /></details>)}
    </section>
  </article>;
}

