import AssuranceWorkbench from './features/operations/AssuranceWorkbench';
import InterventionIntelligence from './features/interventions/InterventionIntelligence';
import CostOptimizationWorkbench from './features/costOptimization/CostOptimizationWorkbench';
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
import { DEFAULT_WEIGHTS, generateCandidates, rankCandidates } from './domain/investments';
import type { Weights } from './domain/investments';
import { summarizePortfolioCostOptimization } from './domain/costOptimization';
import { summarizePortfolioPredictiveAssurance } from './domain/predictiveAssurance';

const InvestmentMap = lazy(() => import('./features/sites/InvestmentMap'));
type View = 'portfolio' | 'cost-optimization' | 'sites' | 'map' | 'investments' | 'scenarios' | 'audit' | 'network' | 'incidents' | 'regulatory' | 'config' | 'data' | 'evidence' | 'assurance' | 'interventions';
const operationalViews = ['network','incidents','regulatory','config','data','evidence','assurance'];
function readLocation(): { view: View; site: string | null } {
  const query = new URLSearchParams(window.location.search);
  const view = query.get('view');
  return { view: view === 'cost-optimization' || view === 'sites' || view === 'map' || view === 'investments' || view === 'scenarios' || view === 'audit' || view === 'interventions' || operationalViews.includes(view || '') ? view as View : 'portfolio', site: query.get('site') };
}


export default function App() { return null; }
