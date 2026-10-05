import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { portfolio } from './data/portfolio';
import { DATASET_VERSION, DEFAULT_FILTERS, STATES, decisionState, filterPortfolio, observation, summarise, usd } from './domain/portfolio';
import type { PortfolioFilters, Site } from './domain/portfolio';
import SiteInvestmentCase from './features/sites/SiteInvestmentCase';
import InvestmentPriorities from './features/investments/InvestmentPriorities';
import ScenarioSimulator from './features/scenarios/ScenarioSimulator';
import EvidenceAudit from './features/evidence/EvidenceAudit';
import { useSession } from './components/SessionGate';
import { DEFAULT_WEIGHTS, generateCandidates, rankCandidates } from './domain/investments';
import type { Weights } from './domain/investments';
const InvestmentMap = lazy(() => import('./features/sites/InvestmentMap'));
type View = 'portfolio' | 'sites' | 'map' | 'investments' | 'scenarios' | 'audit';
function readLocation(): { view: View; site: string | null } {
  const query = new URLSearchParams(window.location.search);
  const view = query.get('view');
  return { view: view === 'sites' || view === 'map' || view === 'investments' || view === 'scenarios' || view === 'audit' ? view : 'portfolio', site: query.get('site') };
}
export default function App() { const { user, signOut } = useSession();
  const [route, setRoute] = useState(readLocation);
  const [filters, setFilters] = useState<PortfolioFilters>(DEFAULT_FILTERS);
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const sites = useMemo(() => filterPortfolio(portfolio, filters), [filters]);
  const priorities = useMemo(() => rankCandidates(generateCandidates(sites, filters.period, weights)).filter(candidate => candidate.eligible), [sites, filters.period, weights]);
  const totals = summarise(sites, filters.period);
  const selected = portfolio.find(site => site.id === route.site);
  useEffect(() => {
    const onPop = () => setRoute(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  function navigate(view: View, site: string | null = null) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('view', view);
    if (site) url.searchParams.set('site', site);
    window.history.pushState({}, '', url);
    setRoute({ view, site });
    window.scrollTo({ top: 0 });
  }
  function choose<K extends keyof PortfolioFilters>(key: K, value: PortfolioFilters[K]) {
    setFilters(current => ({ ...current, [key]: value }));
  }
  const openSite = (site: Site) => navigate(route.view, site.id);
  return <ErrorBoundary>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="netone-header">
      <div className="netone-shell brand-row"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">N</span><div><p className="eyebrow">NETONE · FINANCE & TECHNOLOGY</p><h1>Network Investment Intelligence</h1></div></div><div className="session-actions"><span className="demo-badge">SYNTHETIC · {user.role}</span><button onClick={() => signOut().catch(error => alert(error.message))}>Sign out</button></div></div>
      <nav className="netone-shell nav-row" aria-label="Primary">{([['portfolio', 'Executive portfolio'], ['sites', 'Site portfolio'], ['map', 'Investment map'], ['investments', 'Capital priorities'], ['scenarios', 'Capital scenarios'], ['audit', 'Evidence audit']] as const).map(([view, label]) => <button key={view} aria-current={route.view === view ? 'page' : undefined} onClick={() => navigate(view)}>{label}</button>)}</nav>
    </header>
    <main className="netone-shell main-area" id="main-content" tabIndex={-1}>
      <p className="data-notice">Demonstration data only. All assets, financial values, intervention costs and scoring policy are fictional. Recommendations are advisory. Scenario allocations are advisory and saved through the authenticated server.</p>
      <section className="filter-bar" aria-label="Portfolio filters">
        <label>Region<select aria-label="Region" value={filters.region} onChange={event => choose('region', event.target.value)}><option>All</option>{Array.from(new Set(portfolio.map(site => site.region))).map(region => <option key={region}>{region}</option>)}</select></label>
        <label>Technology<select aria-label="Technology" value={filters.technology} onChange={event => choose('technology', event.target.value)}><option>All</option>{['3G', '4G', '5G'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Decision state<select aria-label="Decision state" value={filters.state} onChange={event => choose('state', event.target.value)}><option>All</option>{STATES.map(state => <option key={state}>{state}</option>)}</select></label>
        <label>Reporting month<select aria-label="Reporting month" value={filters.period} onChange={event => choose('period', event.target.value as PortfolioFilters['period'])}><option value="2026-09">September 2026</option><option value="2026-08">August 2026</option></select></label>
        <button className="text-button" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>
      </section>
      {route.site ? selected ? <SiteInvestmentCase site={selected} period={filters.period} weights={weights} onBack={() => navigate(route.view)} /> : <section className="panel"><h2>Site not found</h2><button className="primary-button" onClick={() => navigate('sites')}>Return to sites</button></section> : route.view === 'audit' ? <EvidenceAudit /> : route.view === 'scenarios' ? <ScenarioSimulator sites={sites} filters={filters} weights={weights} /> : route.view === 'investments' ? <InvestmentPriorities sites={sites} period={filters.period} weights={weights} onWeights={setWeights} onSite={openSite} /> : <>
        <div className="page-heading"><div><p className="eyebrow">CAPITAL PORTFOLIO / {filters.period}</p><h2>{route.view === 'portfolio' ? 'Where should the next dollar go?' : route.view === 'map' ? 'Investment map' : 'Site portfolio'}</h2><p>Connect capital, capacity and recurring operating burden.</p></div><span className="record-count" aria-live="polite">{sites.length} of 100 sites</span></div>
        {route.view === 'portfolio' && <>
          <section className="metric-strip" aria-label="Portfolio summary">
            <button onClick={() => navigate('sites')}><span>Capital deployed</span><strong>{usd(totals.capex)}</strong><small>Cumulative synthetic CAPEX at month end</small></button>
            <button onClick={() => navigate('sites')}><span>Monthly operating cost</span><strong>{usd(totals.opex)}</strong><small>Selected reporting month</small></button>
            <button onClick={() => navigate('sites')}><span>Commercial contribution proxy</span><strong>{totals.contributionKnown ? usd(totals.contribution) : 'Unavailable'}</strong><small>{totals.contributionKnown}/{totals.count} sites with values · missing values excluded</small></button>
            <button onClick={() => navigate('sites')}><span>Recurring failure cost</span><strong>{usd(totals.burden)}</strong><small>Included in OPEX · do not add twice</small></button>
          </section>
          <div className="portfolio-layout"><section className="panel"><div className="section-heading"><h3>Portfolio decision states</h3><span>One primary state per site</span></div><div className="state-list">{STATES.map(state => {
            const count = sites.filter(site => decisionState(site, observation(site, filters.period)) === state).length;
            return <button key={state} onClick={() => { choose('state', state); navigate('sites'); }}><span>{state}</span><div className="state-track"><i style={{ width: `${sites.length ? count / sites.length * 100 : 0}%` }} /></div><strong>{count}</strong></button>;
          })}</div><p className="subtle">Demo classification: reliability first, then capacity, inclusion, under-utilisation and monitor. These thresholds are not approved NetOne policy.</p></section>
          <section className="review-panel"><p className="eyebrow">EVIDENCE BEFORE ALLOCATION</p><h3>{totals.incomplete} sites need data review</h3><p>Missing values, stale utilisation or conflicting sources can change the investment case.</p><button className="primary-button" onClick={() => navigate('sites')}>Inspect site evidence →</button><p className="subtle">No capital recommendations are approved or executed by this prototype.</p></section></div>
          <section className="panel mb-6"><div className="section-heading"><h3>Leading investment candidates</h3><button className="text-button" onClick={() => navigate('investments')}>Review all capital priorities →</button></div>{priorities.slice(0, 3).map(candidate => <div className="priority-preview" key={candidate.id}><button className="site-link" onClick={() => navigate('investments', candidate.siteId)}>{candidate.siteId} · {candidate.action}</button><span>{usd(candidate.estimatedCost)} estimated cost</span><strong>{candidate.score!.toFixed(2)} / 100</strong></div>)}{!priorities.length && <p>No eligible recommendations for the selected evidence.</p>}<p className="subtle">Relative priority under the active demo weights; intervention benefits remain unvalidated.</p></section>
        </>}
        {route.view === 'map' && <Suspense fallback={<section className="panel">Loading investment map…</section>}><InvestmentMap sites={sites} period={filters.period} onSelect={openSite} /></Suspense>}
        <section className="panel"><div className="section-heading"><h3>{route.view === 'portfolio' ? 'Sites for investment review' : 'Selected site evidence'}</h3><span>USD · synthetic monthly aggregates</span></div>
          {sites.length === 0 ? <p className="empty-state">No sites match these filters. Reset filters to restore the portfolio.</p> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable site evidence"><table className="investment-table"><thead><tr><th>Site / region</th><th>Technology</th><th>Utilisation</th><th>Availability</th><th>Monthly OPEX</th><th>Decision state</th><th>Evidence</th></tr></thead><tbody>{sites.map(site => {
            const row = observation(site, filters.period);
            return <tr key={site.id}><td><button className="site-link" onClick={() => openSite(site)}>{site.id} · {site.name}</button><small>{site.region}</small></td><td>{site.technology}</td><td>{row.utilisation === null ? 'Unavailable' : `${row.utilisation}%`}</td><td>{row.availability.toFixed(1)}%</td><td>{usd(row.opex)}</td><td><span className="state-label">{decisionState(site, row)}</span></td><td><span className={`quality ${row.quality === 'COMPLETE' ? 'complete' : 'warning'}`}>{row.quality}</span></td></tr>;
          })}</tbody></table></div>}
        </section>
      </>}
    </main><footer className="netone-shell footer">RadBit Studios · NetOne executive prototype · {DATASET_VERSION} · Local synthetic fixture · No operator systems connected</footer>
  </ErrorBoundary>;
}
