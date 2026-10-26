import AssuranceWorkbench from './features/operations/AssuranceWorkbench';
import CostOptimizationWorkbench from './features/costOptimization/CostOptimizationWorkbench';
import InterventionIntelligence from './features/interventions/InterventionIntelligence';
import { LayoutDashboard, RadioTower, Map, ChartNoAxesCombined, SlidersHorizontal, ShieldCheck, Activity, Wrench, Database, FileCheck2, Settings2, LogOut, ChevronRight, Menu, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useWorkspace } from './components/WorkspaceProvider';
import { enrichSites, activeRules } from './domain/operations';
import OperationsWorkbench from './features/operations/OperationsWorkbench';
import { DATASET_VERSION, DEFAULT_FILTERS, STATES, decisionState, filterPortfolio, observation, summarise, usd } from './domain/portfolio';
import type { PortfolioFilters, Site } from './domain/portfolio';
import SiteInvestmentCase from './features/sites/SiteInvestmentCase';
import InvestmentPriorities from './features/investments/InvestmentPriorities';
import ScenarioSimulator from './features/scenarios/ScenarioSimulator';
import EvidenceAudit from './features/evidence/EvidenceAudit';
import { useSession } from './components/SessionGate';
import { generateCandidates, rankCandidates } from './domain/investments';
import type { Weights } from './domain/investments';
const InvestmentMap = lazy(() => import('./features/sites/InvestmentMap'));
type View = 'portfolio' | 'sites' | 'map' | 'investments' | 'scenarios' | 'audit' | 'network' | 'incidents' | 'regulatory' | 'config' | 'data' | 'evidence' | 'assurance' | 'cost-optimization' | 'interventions';
const navigation = [
  { label: 'Workspace', items: [['portfolio', 'Executive portfolio', LayoutDashboard], ['sites', 'Site portfolio', RadioTower], ['map', 'Investment map', Map], ['investments', 'Capital priorities', ChartNoAxesCombined], ['scenarios', 'Capital scenarios', SlidersHorizontal], ['cost-optimization', 'Cost optimization', Settings2]] },
  { label: 'Network & assurance', items: [['network', 'Network intelligence', Activity], ['assurance', 'Service assurance', ShieldCheck], ['interventions', 'Interventions', Wrench], ['incidents', 'Incident evidence', RadioTower]] },
  { label: 'Governance', items: [['regulatory', 'Service rules', FileCheck2], ['config', 'Models and sensitivity', Settings2], ['data', 'Data imports', Database], ['evidence', 'Decision evidence', FileCheck2], ['audit', 'Evidence audit', ShieldCheck]] }
] as const;
const operationalViews = ['network','incidents','regulatory','config','data','evidence','assurance'];
function readLocation(): { view: View; site: string | null } {
  const query = new URLSearchParams(window.location.search);
  const view = query.get('view');
  return { view: navigation.some(group => group.items.some(item => item[0] === view)) ? view as View : 'portfolio', site: query.get('site') };
}
export default function App() { const { user, signOut } = useSession(); const { workspace } = useWorkspace(); const policy = workspace.configs.find(value => value.id === workspace.activeConfigId)!;
  const [route, setRoute] = useState(readLocation);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const trigger = document.querySelector<HTMLButtonElement>('.mobile-menu');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
      if (event.key !== 'Tab' || !sidebar) return;
      const controls = Array.from(sidebar.querySelectorAll<HTMLElement>('a, button:not(:disabled)')).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); trigger?.focus(); };
  }, [menuOpen]);
  const [filters, setFilters] = useState<PortfolioFilters>(DEFAULT_FILTERS);
  const [weights, setWeights] = useState<Weights>({ ...policy.weights });
  useEffect(() => setWeights({ ...policy.weights }), [policy.id]);
  const portfolio = useMemo(() => enrichSites(workspace, filters.period), [workspace, filters.period]);
  const serviceRule = activeRules(workspace.rules, filters.period).find(rule => rule.metric === 'availability' && rule.comparator === '<') || null;
  const sites = useMemo(() => filterPortfolio(portfolio, filters), [filters, portfolio]);
  const priorities = useMemo(() => rankCandidates(generateCandidates(sites, filters.period, weights, serviceRule)).filter(candidate => candidate.eligible), [sites, filters.period, weights]);
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
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }
  function choose<K extends keyof PortfolioFilters>(key: K, value: PortfolioFilters[K]) {
    setFilters(current => ({ ...current, [key]: value }));
  }
  const openSite = (site: Site) => navigate(route.view, site.id);
  return <ErrorBoundary>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="app-frame">
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Workspace navigation">
      <a className="sidebar-brand" href="?view=portfolio"><span className="brand-mark">N<span>•</span></span><div><strong>NetOne<span className="brand-dot">.</span></strong><small>Investment intelligence</small></div></a>
      <button className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20}/></button>
      <div className="workspace-switch"><span className="workspace-avatar">N</span><div><strong>Finance & technology</strong><small>Executive workspace</small></div><ChevronRight size={15}/></div>
      {navigation.map(group => <nav className="sidebar-nav" key={group.label} aria-label={group.label}><p>{group.label}</p>{group.items.map(([view, label, Icon]) => <button key={view} aria-current={route.view === view ? 'page' : undefined} onClick={() => navigate(view)}><Icon size={17} strokeWidth={1.6}/><span>{label}</span>{route.view === view && <span className="nav-dot"/>}</button>)}</nav>)}
      <div className="sidebar-bottom"><div className="prototype-note"><span className="status-dot"/>Synthetic environment<small>Advisory decisions only</small></div><div className="user-profile"><span className="user-avatar">{user.username.slice(0, 2).toUpperCase()}</span><div><strong>{user.username}</strong><small>{user.role}</small></div><button aria-label="Sign out" title="Sign out" onClick={() => signOut().catch(error => alert(error.message))}><LogOut size={17}/></button></div></div>
    </aside>
    {menuOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <div className="workspace-content">
    <header className="workspace-topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={21}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{navigation.flatMap(group => [...group.items]).find(item => item[0] === route.view)?.[1]}</strong></div><span className="environment-label"><span className="status-dot"/>Demo environment</span></header>
    <main className="netone-shell main-area" id="main-content" tabIndex={-1}>
      <h1 className="sr-only">NetOne investment intelligence</h1>
      <details className="data-notice dataset-notice"><summary>Synthetic data | advisory decisions only</summary><p>All assets, financial values, intervention costs and scoring policy are fictional. Recommendations and allocations are advisory; saved evidence is retained through the authenticated server.</p></details>
      {!route.site && ['portfolio', 'sites', 'map'].includes(route.view) && (<div className="page-heading"><div><p className="eyebrow">YOUR NETWORK. BETTER DECISIONS.</p><h2>{route.view === 'portfolio' ? 'Where should the next dollar go?' : route.view === 'map' ? 'Investment map' : 'Site portfolio'}</h2><p>A clear view of capital, capacity and the cost of keeping your network connected.</p></div><span className="record-count" aria-live="polite"><RadioTower size={14}/>{sites.length} of {portfolio.length} sites</span></div>)}
      <section className="filter-bar" aria-label="Portfolio filters">
        <label>Region<select aria-label="Region" value={filters.region} onChange={event => choose('region', event.target.value)}><option>All</option>{Array.from(new Set(portfolio.map(site => site.region))).map(region => <option key={region}>{region}</option>)}</select></label>
        <label>Technology<select aria-label="Technology" value={filters.technology} onChange={event => choose('technology', event.target.value)}><option>All</option>{['3G', '4G', '5G'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Decision state<select aria-label="Decision state" value={filters.state} onChange={event => choose('state', event.target.value)}><option>All</option>{STATES.map(state => <option key={state}>{state}</option>)}</select></label>
        <label>Reporting month<select aria-label="Reporting month" value={filters.period} onChange={event => choose('period', event.target.value as PortfolioFilters['period'])}><option value="2026-09">September 2026</option><option value="2026-08">August 2026</option></select></label>
        <button className="text-button" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>
      </section>
      {route.site ? selected && selected.observations.some(row => row.period === filters.period) ? <SiteInvestmentCase site={selected} period={filters.period} weights={weights} onBack={() => navigate(route.view)} /> : <section className="panel"><h2>Site not found</h2><button className="primary-button" onClick={() => navigate('sites')}>Return to sites</button></section> : route.view === 'cost-optimization' ? <CostOptimizationWorkbench sites={sites} filters={filters} onSite={openSite}/> : route.view === 'interventions' ? <InterventionIntelligence/> : route.view==='assurance' ? <AssuranceWorkbench/> : operationalViews.includes(route.view) ? <OperationsWorkbench view={route.view} sites={sites} filters={filters} onSite={openSite} /> : route.view === 'audit' ? <EvidenceAudit /> : route.view === 'scenarios' ? <ScenarioSimulator sites={sites} filters={filters} weights={weights} /> : route.view === 'investments' ? <InvestmentPriorities filters={filters} sites={sites} period={filters.period} weights={weights} onWeights={setWeights} onSite={openSite} /> : <>

        {route.view === 'portfolio' && <>
          <section className="metric-strip" aria-label="Portfolio summary">
            <button onClick={() => navigate('sites')}><span>Capital deployed</span><strong>{usd(totals.capex)}</strong><small>Cumulative synthetic CAPEX at month end</small></button>
            <button onClick={() => navigate('sites')}><span>Monthly operating cost</span><strong>{usd(totals.opex)}</strong><small>Selected reporting month</small></button>
            <button onClick={() => navigate('sites')}><span>Known contribution subtotal</span><strong>{totals.contributionKnown ? usd(totals.contribution) : 'Unavailable'}</strong><small>{totals.contributionKnown}/{totals.count} sites with values · missing values excluded</small></button>
            <button onClick={() => navigate('sites')}><span>Recurring failure cost</span><strong>{usd(totals.burden)}</strong><small>Included in OPEX · do not add twice</small></button>
          </section>
          <section className="panel exceptions-panel"><h3>Service and incident exceptions</h3><p>{sites.filter(site=>site.serviceRisk).length} sites with active demonstration warnings · {sites.reduce((sum,site)=>sum+(site.linkedIncidentCount||0),0)} linked incident records.</p><p className="subtle">Incident estimates are separate from recorded OPEX and are not added to it. Regulatory outputs are advisory review prompts.</p><div className="action-row"><button className="text-button" onClick={()=>navigate('regulatory')}>Inspect rule evidence</button><button className="text-button" onClick={()=>navigate('incidents')}>Inspect incident lifecycles</button></div></section><div className="portfolio-layout"><section className="panel"><div className="section-heading"><h3>Portfolio decision states</h3><span>One primary state per site</span></div><div className="state-list">{STATES.map(state => {
            const count = sites.filter(site => decisionState(site, observation(site, filters.period)) === state).length;
            return <button key={state} onClick={() => { choose('state', state); navigate('sites'); }}><span>{state}</span><div className="state-track"><i style={{ width: `${sites.length ? count / sites.length * 100 : 0}%` }} /></div><strong>{count}</strong></button>;
          })}</div><p className="subtle">Demo classification: reliability, service risk, capacity, inclusion, under-utilisation, commercial strength and monitor. These thresholds are not approved NetOne policy.</p></section>
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
    </main><footer className="netone-shell footer"><span>NetOne · Investment intelligence</span><span>{DATASET_VERSION} · Synthetic evidence · No operator systems connected</span></footer>
    </div></div>
  </ErrorBoundary>;
}
