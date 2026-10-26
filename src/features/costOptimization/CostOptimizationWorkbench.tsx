import React, { useMemo, useState } from 'react';
import type { Site, Period, PortfolioFilters } from '../../domain/portfolio';
import { usd } from '../../domain/portfolio';
import {
  calculateSiteCostBreakdown,
  generateSiteCostRecommendation,
  summarizePortfolioCostOptimization
} from '../../domain/costOptimization';
import type { SiteCostBreakdown, SiteCostOptimizationRecommendation } from '../../domain/costOptimization';

export default function CostOptimizationWorkbench({
  sites,
  filters,
  onSite
}: {
  sites: Site[];
  filters: PortfolioFilters;
  onSite?: (site: Site) => void;
}) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [filterUnderutilizedOnly, setFilterUnderutilizedOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const summary = useMemo(() => {
    return summarizePortfolioCostOptimization(sites, filters.period);
  }, [sites, filters.period]);

  const selectedSite = useMemo(() => {
    if (!selectedSiteId) return null;
    return sites.find(s => s.id === selectedSiteId) || null;
  }, [selectedSiteId, sites]);

  const selectedBreakdown = useMemo(() => {
    if (!selectedSite) return null;
    return calculateSiteCostBreakdown(selectedSite, filters.period);
  }, [selectedSite, filters.period]);

  const selectedRecommendation = useMemo(() => {
    if (!selectedBreakdown) return null;
    return generateSiteCostRecommendation(selectedBreakdown);
  }, [selectedBreakdown]);

  const filteredRecommendations = useMemo(() => {
    return summary.recommendations.filter(rec => {
      if (filterUnderutilizedOnly) {
        const breakdown = summary.recommendations.find(r => r.siteId === rec.siteId);
        if (!breakdown?.detectedProblem.includes('Underutilized')) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return rec.siteId.toLowerCase().includes(term) ||
          rec.siteName.toLowerCase().includes(term) ||
          rec.region.toLowerCase().includes(term);
      }
      return true;
    });
  }, [summary.recommendations, filterUnderutilizedOnly, searchTerm]);

  return (
    <div className="cost-optimization-workbench">
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONAL COST OPTIMIZATION · {filters.period}</p>
          <h2>A clearer view of operating costs.</h2>
          <p>
            Decompose site-level power, diesel burn, and maintenance expenditure. Identify underutilized infrastructure and evaluate risk-adjusted remediation strategies.
          </p>
        </div>
      </div>

      {/* Metric Strip */}
      <section className="metric-strip" aria-label="Cost optimization overview">
        <div className="metric-card">
          <span>Identified Annual Savings</span>
          <strong>{usd(summary.totalIdentifiedAnnualSavingsPotential)}</strong>
          <small>Risk-adjusted base case across portfolio</small>
        </div>
        <div className="metric-card">
          <span>Monthly Diesel Fuel Burn</span>
          <strong>{usd(summary.totalDieselCost)}</strong>
          <small>{((summary.totalDieselCost / (summary.totalPortfolioOpex || 1)) * 100).toFixed(0)}% of total portfolio OPEX</small>
        </div>
        <div className="metric-card">
          <span>Cost per Traffic Unit</span>
          <strong>{summary.averageCostPerGB ? `${usd(summary.averageCostPerGB)}/GB` : 'N/A'}</strong>
          <small>Portfolio average expenditure per GB</small>
        </div>
        <div className="metric-card">
          <span>Underutilized Infrastructure</span>
          <strong>{summary.underutilizedSitesCount} sites</strong>
          <small>{usd(summary.underutilizedStrandedOpex)}/mo in stranded OPEX</small>
        </div>
      </section>

      {/* Control bar */}
      <section className="panel mb-6">
        <div className="cost-controls">
          <div className="cost-search-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filterUnderutilizedOnly}
                onChange={e => setFilterUnderutilizedOnly(e.target.checked)}
              />
              Show underutilized infrastructure only ({summary.underutilizedSitesCount} sites)
            </label>
            <input
              type="text"
              aria-label="Search cost optimization sites"
              placeholder="Search site ID, name, or region..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="subtle">Showing {filteredRecommendations.length} of {summary.recommendations.length} evaluated sites</span>
        </div>
      </section>

      {/* Main layout: Table on Left, Details on Right if selected */}
      <div className={`cost-layout ${selectedRecommendation ? 'has-selection' : ''}`}>
        {/* Sites Table */}
        <section className="panel">
          <div className="section-heading">
            <h3>Site Cost Baselines & Detected Opportunities</h3>
            <span>USD monthly aggregates</span>
          </div>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable cost optimization table">
            <table className="investment-table">
              <thead>
                <tr>
                  <th>Site / Region</th>
                  <th>Monthly OPEX</th>
                  <th>Diesel Cost</th>
                  <th>Unit Cost</th>
                  <th>Recommended Action</th>
                  <th>Annual Savings</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecommendations.map(rec => {
                  const site = sites.find(s => s.id === rec.siteId);
                  const isSelected = selectedSiteId === rec.siteId;
                  const breakdown = site ? calculateSiteCostBreakdown(site, filters.period) : null;
                  return (
                    <tr key={rec.siteId} style={{ backgroundColor: isSelected ? 'rgba(0, 102, 204, 0.08)' : undefined }}>
                      <td>
                        <strong>{rec.siteId}</strong>
                        <small style={{ display: 'block', color: '#666' }}>{rec.region} · {site?.technology}</small>
                      </td>
                      <td>{usd(breakdown?.totalOpex ?? null)}</td>
                      <td>
                        {usd(breakdown?.dieselCost ?? null)}
                        <small style={{ display: 'block', color: (breakdown?.dieselCost ?? 0) > 1000 ? '#b30000' : '#666' }}>
                          {breakdown ? `${((breakdown.dieselCost / breakdown.totalOpex) * 100).toFixed(0)}% OPEX` : ''}
                        </small>
                      </td>
                      <td>
                        {breakdown?.costPerGB ? `${usd(breakdown.costPerGB)}/GB` : 'N/A'}
                        <small style={{ display: 'block', color: '#666' }}>{usd(breakdown?.costPerAvailableHour ?? null)}/hr</small>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#e6f2ff', color: '#0055aa' }}>
                          {rec.recommendedAction.label.split(' ')[0]}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#007722' }}>{usd(rec.recommendedAction.expectedAnnualSavings.base)}</strong>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelectedSiteId(isSelected ? null : rec.siteId)}
                        >
                          {isSelected ? 'Close' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detailed Site Remediation Comparison Drawer */}
        {selectedRecommendation && selectedBreakdown && (
          <section className="panel" style={{ borderLeft: '4px solid #0055aa' }}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{selectedRecommendation.siteId} · REMEDIATION ANALYSIS</p>
                <h3>{selectedRecommendation.siteName}</h3>
              </div>
              <button className="text-button" onClick={() => setSelectedSiteId(null)}>✕ Close</button>
            </div>

            {/* Problem Detection Alert */}
            <div style={{ backgroundColor: '#fff9e6', border: '1px solid #ffe082', padding: '0.8rem 1rem', borderRadius: '6px', marginBottom: '1.2rem' }}>
              <strong style={{ color: '#996500' }}>Detected Problem: {selectedRecommendation.detectedProblem}</strong>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9rem', color: '#555' }}>{selectedRecommendation.problemEvidence}</p>
            </div>

            {/* Current Power Baseline Breakdown */}
            <h4>Monthly Power & Operating Breakdown</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.8rem', marginBottom: '1.2rem', fontSize: '0.9rem' }}>
              <div style={{ background: '#f8f9fa', padding: '0.6rem', borderRadius: '4px' }}>
                <span style={{ color: '#666' }}>Grid Availability:</span> <strong>{selectedBreakdown.powerProfile.gridReliabilityPct.toFixed(0)}%</strong>
              </div>
              <div style={{ background: '#f8f9fa', padding: '0.6rem', borderRadius: '4px' }}>
                <span style={{ color: '#666' }}>Battery Health / Autonomy:</span> <strong>{selectedBreakdown.powerProfile.batteryHealthPct.toFixed(0)}% ({selectedBreakdown.powerProfile.batteryAutonomyHours.toFixed(1)}h)</strong>
              </div>
              <div style={{ background: '#f8f9fa', padding: '0.6rem', borderRadius: '4px' }}>
                <span style={{ color: '#666' }}>Monthly Diesel Consumed:</span> <strong>{selectedBreakdown.powerProfile.monthlyDieselLiters} L ({usd(selectedBreakdown.dieselCost)})</strong>
              </div>
              <div style={{ background: '#f8f9fa', padding: '0.6rem', borderRadius: '4px' }}>
                <span style={{ color: '#666' }}>Grid Energy Expense:</span> <strong>{usd(selectedBreakdown.gridCost)} ({selectedBreakdown.powerProfile.gridKwhConsumed} kWh)</strong>
              </div>
              <div style={{ background: '#f8f9fa', padding: '0.6rem', borderRadius: '4px' }}>
                <span style={{ color: '#666' }}>Generator Maintenance:</span> <strong>{usd(selectedBreakdown.generatorMaintenanceCost)}/mo</strong>
              </div>
              <div style={{ background: '#f8f9fa', padding: '0.6rem', borderRadius: '4px' }}>
                <span style={{ color: '#666' }}>Routine Maintenance:</span> <strong>{usd(selectedBreakdown.routineMaintenanceCost)}/mo</strong>
              </div>
            </div>

            {/* Alternatives Comparison */}
            <h4>Remediation Alternatives Evaluated</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.2rem' }}>
              {selectedRecommendation.alternatives.map(alt => {
                const isRecommended = alt.kind === selectedRecommendation.recommendedAction.kind;
                return (
                  <div
                    key={alt.kind}
                    style={{
                      border: isRecommended ? '2px solid #0066cc' : '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '0.8rem 1rem',
                      background: isRecommended ? '#f4f9ff' : '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <strong>
                        {alt.label} {isRecommended && <span className="badge" style={{ background: '#007722', color: '#fff', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>RECOMMENDED</span>}
                      </strong>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>One-time CAPEX: <strong>{usd(alt.implementationCost)}</strong></span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <div>Monthly OPEX Impact: <strong>{usd(alt.monthlyOpexChange)}/mo</strong></div>
                      <div>Expected Annual Savings: <strong style={{ color: '#007722' }}>{usd(alt.expectedAnnualSavings.base)}</strong></div>
                      <div>Payback Period: <strong>{alt.paybackMonths ? `${alt.paybackMonths} months` : 'N/A'}</strong></div>
                    </div>
                    <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#555' }}>{alt.operationalImpact}</p>
                    <small style={{ color: '#777', fontStyle: 'italic' }}>Trade-off: {alt.tradeoffRationale}</small>
                  </div>
                );
              })}
            </div>

            {/* Why Preferred Rationale */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.8rem 1rem', borderRadius: '6px', marginBottom: '1rem' }}>
              <strong style={{ color: '#166534' }}>Why Recommended Action is Preferable:</strong>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9rem', color: '#374151' }}>{selectedRecommendation.whyPreferredToAlternatives}</p>
            </div>

            {/* Double-counting & Evidence Safeguards */}
            <details style={{ fontSize: '0.85rem', color: '#666' }}>
              <summary>Financial Integrity & Anti-Double-Counting Safeguards</summary>
              <p style={{ marginTop: '0.4rem' }}>{selectedRecommendation.doubleCountingCheck}</p>
              <p>{selectedRecommendation.confidenceAssessment}</p>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}
