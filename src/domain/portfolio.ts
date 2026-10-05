export const DATASET_VERSION = 'netone-demo-0.1';
export const PERIODS = ['2026-08', '2026-09'] as const;
export type Period = typeof PERIODS[number];
export type Quality = 'COMPLETE' | 'PARTIAL' | 'STALE' | 'CONFLICT';
export const STATES = ['Capacity constrained', 'Under-utilised', 'Reliability burden', 'Commercially strong', 'Strategic inclusion', 'Service risk', 'Monitor'] as const;
export type DecisionState = typeof STATES[number];
export interface Observation {
  period: Period;
  utilisation: number | null;
  growth: number | null;
  availability: number;
  faults: number;
  capex: number;
  opex: number;
  contribution: number | null;
  failureCost: number;
  quality: Quality;
  trafficGB?: number | null;
  downtimeHours?: number | null;
  sourceRef?: string;
}
export interface Site {
  id: string;
  name: string;
  region: string;
  technology: '3G' | '4G' | '5G';
  latitude: number;
  longitude: number;
  strategic: boolean;
  demo: true;
  serviceRisk?: boolean;
  incidentBurden?: number;
  linkedIncidentCount?: number;
  networkHistory?: { period: string; trafficGB: number; utilisation: number | null; downtimeHours: number; faults: number; sourceRef: string; quality: Quality }[];
  observations: Observation[];
  history: { date: string; action: string; cost: number; outcome: string }[];
}
export interface PortfolioFilters { region: string; technology: string; state: string; period: Period }
export const DEFAULT_FILTERS: PortfolioFilters = { region: 'All', technology: 'All', state: 'All', period: '2026-09' };
export function observation(site: Site, period: Period): Observation {
  const value = site.observations.find(row => row.period === period);
  if (!value) throw new Error(`Missing period ${period} for ${site.id}`);
  return value;
}
export function decisionState(site: Site, row: Observation): DecisionState {
  if (row.availability < 98 || row.faults >= 5) return 'Reliability burden';
  if (site.serviceRisk) return 'Service risk';
  if (row.utilisation !== null && row.utilisation >= 80) return 'Capacity constrained';
  if (site.strategic) return 'Strategic inclusion';
  if (row.utilisation !== null && row.utilisation < 35) return 'Under-utilised';
  if (row.contribution !== null && row.contribution >= 16000) return 'Commercially strong';
  return 'Monitor';
}
export function filterPortfolio(sites: Site[], filters: PortfolioFilters): Site[] {
  return sites.filter(site => site.observations.some(row => row.period === filters.period) && (filters.region === 'All' || site.region === filters.region)
    && (filters.technology === 'All' || site.technology === filters.technology)
    && (filters.state === 'All' || decisionState(site, observation(site, filters.period)) === filters.state));
}
export function summarise(sites: Site[], period: Period) {
  const rows = sites.map(site => observation(site, period));
  return {
    count: sites.length,
    capex: rows.reduce((sum, row) => sum + row.capex, 0),
    opex: rows.reduce((sum, row) => sum + row.opex, 0),
    contribution: rows.reduce((sum, row) => sum + (row.contribution ?? 0), 0),
    contributionKnown: rows.filter(row => row.contribution !== null).length,
    incomplete: rows.filter(row => row.quality !== 'COMPLETE').length,
    burden: rows.reduce((sum, row) => sum + row.failureCost, 0)
  };
}
export function reviewReason(site: Site, row: Observation): string {
  const state = decisionState(site, row);
  if (row.quality === 'CONFLICT') return 'Resolve conflicting network sources before an investment recommendation.';
  if (row.quality === 'STALE') return 'Refresh the utilisation observation before judging capacity.';
  if (row.utilisation === null || row.contribution === null) return 'Complete missing evidence before assessing investment value.';
  switch (state) {
    case 'Capacity constrained': return `Review capacity expansion: utilisation is ${row.utilisation}% with ${row.growth===null?'unavailable':row.growth.toFixed(2)}% month-on-month traffic growth.`;
    case 'Reliability burden': return `Review resilience or maintenance: ${row.faults} faults and ${row.availability}% availability this month.`;
    case 'Under-utilised': return 'Review demand and operating efficiency before committing more capital.';
    case 'Strategic inclusion': return 'Assess coverage and inclusion benefits alongside commercial contribution.';
    default: return 'Monitor demand and reliability; no intervention candidate has been scored yet.';
  }
}
export const usd = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
