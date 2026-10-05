import { COMPONENTS, DEFAULT_WEIGHTS } from './investments.js';
import type { Candidate, Weights } from './investments.js';
import type { PortfolioFilters } from './portfolio.js';
export const ENGINE_VERSION = 'greedy-demo-0.4';
export const OBJECTIVES: Record<string, { label: string; weights: Weights }> = {
  balanced: { label: 'Balanced', weights: DEFAULT_WEIGHTS },
  commercial: { label: 'Commercial return', weights: { demand: 15, growth: 10, commercial: 60, reliability: 5, service: 5, opex: 5, strategy: 0 } },
  growth: { label: 'Growth', weights: { demand: 40, growth: 40, commercial: 10, reliability: 0, service: 0, opex: 0, strategy: 10 } },
  reliability: { label: 'Reliability', weights: { demand: 0, growth: 0, commercial: 5, reliability: 45, service: 25, opex: 25, strategy: 0 } },
  service: { label: 'Demonstration service screening', weights: { demand: 0, growth: 0, commercial: 0, reliability: 20, service: 65, opex: 5, strategy: 10 } },
  assurance: { label: 'Service Assurance · evidence gated', weights: {demand:0,growth:0,commercial:0,reliability:20,service:65,opex:5,strategy:10}},
  inclusion: { label: 'Inclusion', weights: { demand: 5, growth: 10, commercial: 0, reliability: 5, service: 5, opex: 0, strategy: 75 } }
};
export interface ScenarioInput { mustFundRationale?:string; budget: number; objective: string; minimumScore: number; mustFund: string[]; excluded: string[]; filters: PortfolioFilters }
export interface Allocation { candidateId: string; selected: boolean; cost: number; objectiveScore: number; reason: string }
export interface ScenarioResult { policySnapshot?:unknown;regulatorySnapshot?:unknown;engineVersion: string; input: ScenarioInput; objectiveWeights: Weights; candidates: Candidate[]; allocations: Allocation[]; spend: number; unallocated: number; objectiveValue: number }
export interface SavedScenario { id: string; name: string; savedAt: string; result: ScenarioResult }
const cents = (value: number) => {
  const rounded = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(rounded) || Math.abs(value * 100 - rounded) > .000001) throw new Error('Money must be a non-negative amount with at most two decimal places.');
  return rounded;
};
export function allocateScenario(candidates: Candidate[], input: ScenarioInput, balancedWeights?: Weights): ScenarioResult {
  const budget = cents(input.budget);
  const objective = input.objective === 'balanced' && balancedWeights ? { ...OBJECTIVES.balanced, weights: balancedWeights } : OBJECTIVES[input.objective];
  if (!objective) throw new Error('Unknown scenario objective.');
  if (!Number.isFinite(input.minimumScore) || input.minimumScore < 0 || input.minimumScore > 100) throw new Error('Minimum objective score must be between 0 and 100.');
  if (new Set(candidates.map(candidate => candidate.id)).size !== candidates.length) throw new Error('Duplicate candidate identifiers.');
  for (const candidate of candidates) {
    if (candidate.currency !== 'USD' || candidate.costBasis !== 'Fictional nominal intervention CAPEX estimate' || candidate.period !== input.filters.period) throw new Error('Candidates have incompatible currency, financial basis or reporting period.');
    if (cents(candidate.estimatedCost) === 0) throw new Error('Candidate cost must be positive.');
  }
  const score = (candidate: Candidate) => candidate.eligible ? COMPONENTS.reduce((sum, component) => {
    const evidence = candidate.components.find(value => value.code === component.code);
    if (!evidence || evidence.normalised === null || !Number.isFinite(evidence.normalised) || evidence.normalised < 0 || evidence.normalised > 100 || !Number.isFinite(evidence.relevance) || evidence.relevance < 0 || evidence.relevance > 1) throw new Error('Eligible candidate has invalid score evidence.');
    return sum + evidence.normalised * evidence.relevance * objective.weights[component.code] / 100;
  }, 0) : 0;
  const scope = (candidate: Candidate) => (input.filters.region === 'All' || candidate.region === input.filters.region) && (input.filters.technology === 'All' || candidate.technology === input.filters.technology) && (input.filters.state === 'All' || candidate.decisionState === input.filters.state);
  const must = new Set(input.mustFund);
  const excluded = new Set(input.excluded);
  for (const id of [...must, ...excluded]) if (!candidates.some(candidate => candidate.id === id)) throw new Error('A constrained candidate is unavailable in this portfolio.');
  const allocations = candidates.map(candidate => ({ candidateId: candidate.id, selected: false, cost: candidate.estimatedCost, objectiveScore: score(candidate), reason: '' }));
  const usedSites = new Set<string>();
  let spent = 0;
  const choose = (candidate: Candidate, required: boolean) => {
    const allocation = allocations.find(value => value.candidateId === candidate.id)!;
    let reason = input.objective==='assurance'&&!candidate.serviceAssuranceSupported ? 'Service Assurance withheld: reviewed obligation applicability, confirmed cell finding, cause-specific engineering evidence and regulatory review required.' : !candidate.eligible ? candidate.reason : !scope(candidate) ? 'Outside region or technology constraints.' : excluded.has(candidate.id) ? 'Explicitly excluded.' : allocation.objectiveScore < input.minimumScore || allocation.objectiveScore <= 0 ? 'Below minimum objective value.' : usedSites.has(candidate.siteId) ? 'An alternative intervention at this site is already selected.' : spent + cents(candidate.estimatedCost) > budget ? 'Insufficient remaining budget.' : '';
    if (required && reason) throw new Error(`Must-fund constraint infeasible for ${candidate.id}: ${reason}`);
    if (reason) { allocation.reason = reason; return; }
    spent += cents(candidate.estimatedCost); usedSites.add(candidate.siteId); allocation.selected = true;
    allocation.reason = required ? 'Selected as must-fund; all eligibility and budget constraints satisfied.' : 'Selected by objective score per dollar, within constraints.';
  };
  candidates.filter(candidate => must.has(candidate.id)).sort((a, b) => a.id.localeCompare(b.id, 'en')).forEach(candidate => choose(candidate, true));
  const ranked = candidates.filter(candidate => !must.has(candidate.id)).sort((a, b) => score(b) / cents(b.estimatedCost) - score(a) / cents(a.estimatedCost) || score(b) - score(a) || a.id.localeCompare(b.id, 'en'));
  ranked.forEach(candidate => choose(candidate, false));
  return structuredClone({ engineVersion: ENGINE_VERSION, input, objectiveWeights: objective.weights, candidates, allocations, spend: spent / 100, unallocated: (budget - spent) / 100, objectiveValue: allocations.filter(value => value.selected).reduce((sum, value) => sum + value.objectiveScore, 0) });
}


/** Replay supported historical greedy engines using frozen evidence only. */
export function replayScenario(snapshot:ScenarioResult):ScenarioResult {if(!['greedy-demo-0.3',ENGINE_VERSION].includes(snapshot.engineVersion))throw new Error('Saved engine is unsupported; retain original evidence without recomputing under new defaults.');const result=allocateScenario(snapshot.candidates,snapshot.input,snapshot.objectiveWeights);return {...result,engineVersion:snapshot.engineVersion,...(snapshot.policySnapshot?{policySnapshot:structuredClone(snapshot.policySnapshot)}:{}),...(snapshot.regulatorySnapshot?{regulatorySnapshot:structuredClone(snapshot.regulatorySnapshot)}:{})};}
