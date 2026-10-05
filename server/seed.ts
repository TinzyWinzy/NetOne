import { initializePilot } from './pilot.js';
import { portfolio } from '../src/data/portfolio.js';
import { DEFAULT_WEIGHTS, MODEL_VERSION } from '../src/domain/investments.js';
import { evaluateRules, INCIDENT_STATES } from '../src/domain/operations.js';
import type { Workspace, Incident } from '../src/domain/operations.js';
export function seedWorkspace(): Workspace {
  const sites = structuredClone(portfolio).map((site, index) => ({ ...site,
    observations: site.observations.map(row => ({ ...row, trafficGB: Math.round((row.utilisation ?? 50) * (34 + index % 6)), downtimeHours: Number(((100 - row.availability) / 100 * (row.period === '2026-09' ? 720 : 744)).toFixed(2)), sourceRef: `netone-demo/${site.id}/${row.period}` })),
    networkHistory: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((period, month) => ({ period, trafficGB: Math.round(1400 + index * 19 + month * (60 + index % 30)), utilisation: Math.min(100, 35 + index % 50 + month * 2) as number | null, downtimeHours: Number((index % 4 + (index % 5 === 2 ? 24 : 1) - month * .1).toFixed(2)), faults: index % 5 === 2 ? Math.max(1, 9 - month) : index % 3, sourceRef: `netone-demo/history/${site.id}/${period}`, quality: 'COMPLETE' as import('../src/domain/portfolio.js').Quality }))
  }));
  // The last two points are the actual synthetic reporting observations, rather
  // than a second conflicting generator for those periods.
  for (const site of sites) for (const row of site.observations) { const point = site.networkHistory.find(value => value.period === row.period)!; point.trafficGB = row.trafficGB; point.utilisation = row.utilisation; point.downtimeHours = row.downtimeHours; point.faults = row.faults; point.quality = row.quality; }
  const incidents: Incident[] = sites.filter((_, index) => index % 7 === 2).slice(0, 14).map((site, index) => ({ id: `DEMO-INC-${index + 1}`, siteId: site.id, type: index % 2 ? 'Backhaul disruption' : 'Power instability', severity: index % 3 === 0 ? 'HIGH' : 'MEDIUM', impact: 'Synthetic service interruption and recurring restoration burden', estimatedBurden: 200 + index * 75, demo: true, events: INCIDENT_STATES.slice(0, index % 3 === 0 ? 7 : index % 3 === 1 ? 4 : 2).map((state, step) => ({ id: `DEMO-INC-${index + 1}-E${step}`, state, at: new Date(Date.UTC(2026, 8, index + 2, step * 2)).toISOString(), actor: 'synthetic-seed', note: `${state}: fictional restoration timeline; no operator action performed.` })) }));
  const config = { id: 'MODEL-DEMO-1', version: 1, name: 'Default demonstration policy', weights: { ...DEFAULT_WEIGHTS }, minimumScore: 10, createdAt: '2026-08-01T00:00:00.000Z', createdBy: 'synthetic-seed', modelVersion: MODEL_VERSION };
  const workspace: Workspace = { revision: 0, schemaVersion: '2', sites, incidents,
    rules: [{ id: 'RULE-AVAILABILITY-1', code: 'DEMO-AVAILABILITY', version: '1', metric: 'availability', comparator: '<', threshold: 98, effectiveFrom: '2026-08-01', effectiveTo: '2026-10-01', source: 'Synthetic availability demonstration; not a legal threshold', status: 'active', createdBy: 'synthetic-seed', reviewedBy: 'synthetic-seed', reviewedAt: '2026-08-01T00:00:00.000Z', activatedBy: 'synthetic-seed', activatedAt: '2026-08-01T00:00:00.000Z' }, { id: 'RULE-DOWNTIME-1', code: 'DEMO-DOWNTIME', version: '1', metric: 'downtimeHours', comparator: '>', threshold: 5, effectiveFrom: '2026-08-01', effectiveTo: '2026-10-01', source: 'Synthetic monthly downtime review prompt; not a regulatory obligation', status: 'active', createdBy: 'synthetic-seed', reviewedBy: 'synthetic-seed', reviewedAt: '2026-08-01T00:00:00.000Z', activatedBy: 'synthetic-seed', activatedAt: '2026-08-01T00:00:00.000Z' }],
    evaluations: [], configs: [config], activeConfigId: config.id, mappings: sites.map(site => ({ id: `netone-demo:${site.id}`, source: 'netone-demo', externalRef: site.id, siteId: site.id })), imports: [], evidence: [], reviews: [], scoreRuns: [] };
  workspace.evaluations = evaluateRules(sites, workspace.rules, '2026-08', '2026-08-31T23:59:59.000Z').concat(evaluateRules(sites, workspace.rules, '2026-09', '2026-09-30T23:59:59.000Z'));
  initializePilot(workspace);
  return workspace;
}
