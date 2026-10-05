import { DATASET_VERSION, observation, decisionState } from './portfolio.js';
import type { Period, Site } from './portfolio.js';

export const MODEL_VERSION = 'priority-demo-0.2';
export const COMPONENTS = [
  { code: 'demand', label: 'Demand pressure', unit: '%', transform: 'clamp((utilisation − 30) / 60 × 100)' },
  { code: 'growth', label: 'Demand growth', unit: '% / month', transform: 'clamp(growth / 15 × 100)' },
  { code: 'commercial', label: 'Commercial contribution', unit: 'USD / month', transform: 'clamp(contribution proxy / 20000 × 100)' },
  { code: 'reliability', label: 'Reliability burden', unit: 'faults / month', transform: 'clamp(faults / 8 × 100)' },
  { code: 'service', label: 'Service risk', unit: '% availability', transform: 'clamp((98 − availability) / 4 × 100)' },
  { code: 'opex', label: 'Operating burden', unit: 'USD / month', transform: 'clamp(failure cost / 2500 × 100)' },
  { code: 'strategy', label: 'Strategic inclusion', unit: 'tag 0/1', transform: 'inclusion tag × 100' }
] as const;
export type ComponentCode = typeof COMPONENTS[number]['code'];
export type Weights = Record<ComponentCode, number>;
export interface ServiceRule { id: string; version: string; metric: string; comparator: string; threshold: number; effectiveFrom: string; effectiveTo: string; source: string; status: string }
export const DEFAULT_WEIGHTS: Weights = { demand: 20, growth: 15, commercial: 20, reliability: 15, service: 15, opex: 10, strategy: 5 };
export const DEMO_SERVICE_RULE = {
  id: 'DEMO-AVAILABILITY', version: '1', metric: 'availability', comparator: '<', threshold: 98,
  effectiveFrom: '2026-08-01', effectiveTo: '2026-10-01',
  source: 'Synthetic product demonstration configuration; not a statutory threshold', status: 'demo'
} as const;
const ACTIONS = [
  { code: 'capacity', label: 'Capacity upgrade', cost: 65000, relevance: { demand: 1, growth: 1, commercial: 1, reliability: .2, service: .2, opex: .2, strategy: .5 } },
  { code: 'resilience', label: 'Power resilience', cost: 38000, relevance: { demand: .3, growth: .3, commercial: .7, reliability: 1, service: 1, opex: 1, strategy: .6 } },
  { code: 'backhaul', label: 'Backhaul improvement', cost: 45000, relevance: { demand: .8, growth: .9, commercial: .9, reliability: .5, service: .5, opex: .3, strategy: .7 } },
  { code: 'maintenance', label: 'Targeted maintenance', cost: 12000, relevance: { demand: .1, growth: .1, commercial: .4, reliability: .8, service: .8, opex: 1, strategy: .2 } }
] as const;
export interface ScoreComponent {
  code: ComponentCode; raw: number | null; normalised: number | null; relevance: number;
  weight: number; contribution: number | null; sourceRef: string; unit: string; normalisation: string;
}
export interface Candidate {
  configId?: string;
  id: string; siteId: string; siteName: string; region: string; technology: string; decisionState: string;
  action: string; actionCode: string; estimatedCost: number; currency: 'USD'; costBasis: string; demo: true; eligible: boolean; reason: string;
  score: number | null; confidence: 'DEMO COMPLETE' | 'INCOMPLETE';
  components: ScoreComponent[]; period: Period; datasetVersion: string; modelVersion: string;
  weightVersion: string; weights: Weights; sourceRef: string;
  serviceEvidence: { rule: ServiceRule | null; observed: number; triggered: boolean };
}
const clamp = (value: number) => Math.max(0, Math.min(100, value));
export function validateWeights(weights: Weights): string | null {
  if (!COMPONENTS.every(component => Number.isFinite(weights[component.code]) && weights[component.code] >= 0 && weights[component.code] <= 100)) return 'Weights must be finite values from 0 to 100.';
  if (Math.abs(COMPONENTS.reduce((sum, component) => sum + weights[component.code], 0) - 100) > .000001) return 'Weights must total exactly 100%.';
  return null;
}
export function generateCandidates(sites: Site[], period: Period, weights: Weights = DEFAULT_WEIGHTS, rule: ServiceRule | null = DEMO_SERVICE_RULE): Candidate[] {
  const invalid = validateWeights(weights);
  if (invalid) throw new Error(invalid);
  const weightVersion = `${MODEL_VERSION}:${COMPONENTS.map(component => weights[component.code]).join('-')}`;
  return sites.flatMap(site => {
    const row = observation(site, period);
    const missing = row.utilisation === null || row.contribution === null || !rule;
    const validMetrics = [row.growth, row.availability, row.faults, row.failureCost, row.opex].every(value => Number.isFinite(value) && value >= 0)
      && row.availability <= 100 && (row.utilisation === null || Number.isFinite(row.utilisation) && row.utilisation >= 0 && row.utilisation <= 100)
      && (row.contribution === null || Number.isFinite(row.contribution) && row.contribution >= 0);
    const dataReady = row.quality === 'COMPLETE' && !missing && validMetrics;
    const raw: Record<ComponentCode, number | null> = { demand: row.utilisation, growth: row.growth, commercial: row.contribution, reliability: row.faults, service: row.availability, opex: row.failureCost, strategy: site.strategic ? 1 : 0 };
    const normalised: Record<ComponentCode, number | null> = {
      demand: row.utilisation === null ? null : clamp((row.utilisation - 30) / 60 * 100),
      growth: clamp(row.growth / 15 * 100), commercial: row.contribution === null ? null : clamp(row.contribution / 20000 * 100),
      reliability: clamp(row.faults / 8 * 100), service: rule ? clamp((rule.threshold - row.availability) / 4 * 100) : null,
      opex: clamp(row.failureCost / 2500 * 100), strategy: site.strategic ? 100 : 0
    };
    const sourceRef = row.sourceRef || `${DATASET_VERSION}/${site.id}/${period}`;
    return ACTIONS.map(action => {
      const technicalEligible = action.code === 'capacity' ? row.utilisation !== null && row.utilisation >= 80
        : action.code === 'backhaul' ? row.utilisation !== null && row.utilisation >= 65 && row.growth >= 5
        : action.code === 'resilience' ? !!rule && row.availability < rule.threshold
        : row.faults >= 3;
      const reason = !dataReady ? `Withheld: ${!validMetrics ? 'invalid metric input' : !rule ? 'no active availability rule' : missing ? 'missing utilisation or commercial evidence' : row.quality.toLowerCase() + ' evidence'}. Complete validated inputs are required.`
        : !technicalEligible ? `Not eligible: ${action.code === 'capacity' ? 'utilisation must be at least 80%' : action.code === 'backhaul' ? 'utilisation must be at least 65% and growth at least 5%' : action.code === 'resilience' ? `availability must be below the ${rule?.threshold ?? 'unavailable'} demo threshold` : 'at least 3 faults in the reporting month are required'}.`
        : `Eligible: ${action.code === 'capacity' ? `${row.utilisation}% utilisation` : action.code === 'backhaul' ? `${row.utilisation}% utilisation and ${row.growth}% growth` : action.code === 'resilience' ? `${row.availability}% availability below the demo threshold` : `${row.faults} faults in period`}. Engineering feasibility and benefit validation remain outstanding.`;
      const components = COMPONENTS.map(component => ({ code: component.code, raw: raw[component.code], normalised: dataReady ? normalised[component.code] : null,
        relevance: action.relevance[component.code], weight: weights[component.code],
        contribution: dataReady ? normalised[component.code]! * action.relevance[component.code] * weights[component.code] / 100 : null,
        sourceRef, unit: component.unit, normalisation: component.code === 'service' ? (rule ? `clamp((${rule.threshold} − availability) / 4 × 100)` : 'No active availability rule; withheld') : component.transform }));
      return { id: `${site.id}:${action.code}:${period}`, siteId: site.id, siteName: site.name, region: site.region, technology: site.technology, decisionState: decisionState(site, row),
        action: action.label, actionCode: action.code, estimatedCost: action.cost + (Number(site.id.replace(/\D/g, '').slice(-3)) || 0) % 5 * 1000,
        currency: 'USD', costBasis: 'Fictional nominal intervention CAPEX estimate', demo: true,
        eligible: dataReady && technicalEligible, reason, score: dataReady && technicalEligible ? components.reduce((sum, component) => sum + component.contribution!, 0) : null,
        confidence: dataReady ? 'DEMO COMPLETE' : 'INCOMPLETE', components, period, datasetVersion: DATASET_VERSION, modelVersion: MODEL_VERSION,
        weightVersion, weights: { ...weights }, sourceRef,
        serviceEvidence: { rule, observed: row.availability, triggered: !!rule && row.availability < rule.threshold }
      } satisfies Candidate;
    });
  });
}
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => Number(b.eligible) - Number(a.eligible)
    || (b.score ?? -1) - (a.score ?? -1) || a.estimatedCost - b.estimatedCost || a.id.localeCompare(b.id, 'en'));
}

