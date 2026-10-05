import type { Site, Period, PortfolioFilters } from './portfolio.js';
import { observation, filterPortfolio } from './portfolio.js';
import { DEFAULT_WEIGHTS, generateCandidates, rankCandidates } from './investments.js';
import type { Weights, Candidate, ServiceRule } from './investments.js';

export const INCIDENT_STATES = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'FIELD_RESPONSE', 'RESTORED', 'VERIFIED', 'CLOSED'] as const;
export type IncidentState = typeof INCIDENT_STATES[number];
export interface IncidentEvent { id: string; state: IncidentState; at: string; actor: string; note: string }
export interface Incident { id: string; siteId: string; type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; impact: string; estimatedBurden: number; demo: true; events: IncidentEvent[] }
export interface RuleVersion extends ServiceRule { code: string; metric: 'availability' | 'downtimeHours' | 'faults' | 'utilisation'; comparator: '<' | '<=' | '>' | '>='; status: 'draft' | 'reviewed' | 'active' | 'retired'; createdBy: string; reviewedBy?: string; reviewedAt?: string; reviewNote?: string; activatedBy?: string; activatedAt?: string; retiredBy?: string; retiredAt?: string }
export interface RuleEvaluation { id: string; siteId: string; period: Period; ruleId: string; ruleVersion: string; rule: RuleVersion; observed: number | null; state: 'NORMAL' | 'WARNING' | 'INCOMPLETE'; evaluatedAt: string; sourceRef: string; demo: true }
export interface ModelConfig { id: string; version: number; name: string; weights: Weights; minimumScore: number; createdAt: string; createdBy: string; modelVersion: string }
export interface SourceMapping { id: string; source: string; externalRef: string; siteId: string }
export interface ImportRun { id: string; key: string; source: string; hash: string; at: string; actor: string; accepted: number; rejected: number; quarantine: { row: number; reason: string }[]; demo: true; acceptedRecords?: unknown[]; previousRecords?: { siteId: string; observation: unknown }[] }
export interface CandidateRecord { id: string; at: string; actor: string; candidate: Candidate; config: ModelConfig; source: { site: Site; mappings: SourceMapping[]; incidents: Incident[]; evaluations: RuleEvaluation[] }; hash: string }
export interface Review { id: string; subjectType: 'candidate' | 'scenario'; subjectId: string; events: { status: 'SUBMITTED' | 'IN_REVIEW' | 'REVIEWED' | 'CHANGES_REQUESTED'; actor: string; role: string; at: string; note: string }[] }
export interface ScoreRun { id: string; at: string; actor: string; configId: string; filters: PortfolioFilters; candidateCount: number; recordIds: string[] }
export interface Workspace { revision: number; schemaVersion: '2'; sites: Site[]; incidents: Incident[]; rules: RuleVersion[]; evaluations: RuleEvaluation[]; configs: ModelConfig[]; activeConfigId: string; mappings: SourceMapping[]; imports: ImportRun[]; evidence: CandidateRecord[]; reviews: Review[]; scoreRuns: ScoreRun[] }
export type WorkspaceView = Omit<Workspace, 'evidence'> & { evidence: (Omit<CandidateRecord, 'source' | 'candidate'> & { candidateId: string; siteId: string; action: string; score: number | null; period: Period })[] };

export function incidentState(incident: Incident): IncidentState { return incident.events[incident.events.length - 1].state; }
export function nextIncidentState(incident: Incident): IncidentState | undefined { return INCIDENT_STATES[INCIDENT_STATES.indexOf(incidentState(incident)) + 1]; }
export function activeRules(rules: RuleVersion[], period: Period): RuleVersion[] {
  const start = `${period}-01`; const [year,month]=period.split('-').map(Number);const end=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
  return rules.filter(rule => rule.status === 'active' && rule.effectiveFrom <= start && (!rule.effectiveTo || rule.effectiveTo >= end));
}
export function evaluateRules(sites: Site[], rules: RuleVersion[], period: Period, at: string): RuleEvaluation[] {
  return sites.filter(site => site.observations.some(row => row.period === period)).flatMap(site => activeRules(rules, period).map(rule => {
    const row = observation(site, period); const value = row[rule.metric] ?? null;
    const usable = row.quality === 'COMPLETE' && value !== null;
    const triggered = usable && (rule.comparator === '<' ? value! < rule.threshold : rule.comparator === '<=' ? value! <= rule.threshold : rule.comparator === '>' ? value! > rule.threshold : value! >= rule.threshold);
    return { id: `${rule.id}:${site.id}:${period}:${at}`, siteId: site.id, period, ruleId: rule.id, ruleVersion: rule.version, rule: structuredClone(rule), observed: value, state: !usable ? 'INCOMPLETE' as const : triggered ? 'WARNING' as const : 'NORMAL' as const, evaluatedAt: at, sourceRef: row.sourceRef || `netone-demo/${site.id}/${period}`, demo: true as const };
  }));
}
export function enrichSites(workspace: Pick<Workspace, 'sites' | 'incidents' | 'rules'>, period: Period): Site[] {
  const warnings = evaluateRules(workspace.sites, workspace.rules, period, 'current');
  return workspace.sites.map(site => ({ ...site, serviceRisk: warnings.some(event => event.siteId === site.id && event.state === 'WARNING'), incidentBurden: workspace.incidents.filter(incident => incident.siteId === site.id && incidentState(incident) !== 'CLOSED').reduce((sum, incident) => sum + incident.estimatedBurden, 0), linkedIncidentCount: workspace.incidents.filter(incident => incident.siteId === site.id).length }));
}
export function scoreWorkspace(workspace: Pick<Workspace, 'sites' | 'incidents' | 'rules' | 'configs' | 'activeConfigId'>, filters: PortfolioFilters, configId = workspace.activeConfigId) {
  const config = workspace.configs.find(value => value.id === configId);
  if (!config) throw new Error('Model configuration not found.');
  const rules = activeRules(workspace.rules, filters.period);
  const rule = rules.find(value => value.metric === 'availability' && value.comparator === '<') || null;
  const candidates = rankCandidates(generateCandidates(filterPortfolio(enrichSites(workspace, filters.period), filters), filters.period, config.weights, rule));
  return { config, candidates: candidates.map(candidate=>({...candidate,configId:config.id,weightVersion:`${candidate.weightVersion};config:${config.id}:v${config.version}`})) };
}
export function sensitivity(workspace: Pick<Workspace, 'sites' | 'incidents' | 'rules' | 'configs' | 'activeConfigId'>, filters: PortfolioFilters, configId?: string) {
  const { config, candidates } = scoreWorkspace(workspace, filters, configId);
  const ranked = candidates.filter(candidate => candidate.eligible);
  const weights: Record<string, Weights> = { 'Utilisation only': { ...DEFAULT_WEIGHTS, demand: 100, growth: 0, commercial: 0, reliability: 0, service: 0, opex: 0, strategy: 0 }, 'Commercial only': { demand: 0, growth: 0, commercial: 100, reliability: 0, service: 0, opex: 0, strategy: 0 }, 'Equal weights': { demand: 100 / 7, growth: 100 / 7, commercial: 100 / 7, reliability: 100 / 7, service: 100 / 7, opex: 100 / 7, strategy: 100 / 7 } };
  for (const delta of [-5, 5]) { const changed = { ...config.weights }; const amount = Math.min(Math.abs(delta), delta > 0 ? changed.commercial : changed.demand); changed.demand += Math.sign(delta) * amount; changed.commercial -= Math.sign(delta) * amount; weights[`Demand ${delta > 0 ? '+' : ''}${amount}pp / commercial ${delta > 0 ? '-' : '+'}${amount}pp`] = changed; }
  return { config, baseTop: ranked.slice(0, 10).map(value => value.id), baselines: Object.entries(weights).map(([name, value]) => {
    const alternative = scoreWorkspace({ ...workspace, configs: [{ ...config, weights: value }] }, filters, config.id).candidates.filter(candidate => candidate.eligible);
    const top = alternative.slice(0, 10).map(candidate => candidate.id);
    return { name, weights: value, top, overlap: top.filter(id => ranked.slice(0, 10).some(candidate => candidate.id === id)).length, changes: top.map((id, index) => ({ id, previousRank: ranked.findIndex(candidate => candidate.id === id) + 1, rank: index + 1 })) };
  }), thresholds: [0, config.minimumScore, Math.min(100, config.minimumScore + 10), 75].filter((value, index, values) => values.indexOf(value) === index).map(threshold => ({ threshold, count: ranked.filter(candidate => candidate.score! >= threshold).length })) };
}
