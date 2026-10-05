import type { Site, Observation } from '../domain/portfolio';
import { PERIODS } from '../domain/portfolio';

const REGIONS = [
  { name: 'Harare', lat: -17.825, lon: 31.033 },
  { name: 'Bulawayo', lat: -20.15, lon: 28.583 },
  { name: 'Manicaland', lat: -18.97, lon: 32.67 },
  { name: 'Midlands', lat: -19.45, lon: 29.82 },
  { name: 'Masvingo', lat: -20.07, lon: 30.83 }
];
/** One reproducible fixture source. These are fictional assets, never operator actuals. */
export function buildPortfolio(): Site[] {
  return Array.from({ length: 100 }, (_, index) => {
    const region = REGIONS[index % REGIONS.length];
    const pattern = Math.floor(index / REGIONS.length) % 5;
    const observations: Observation[] = PERIODS.map((period, month) => {
      const utilisation = [84, 26, 62, 43, 58][pattern] + index % 6 + month * 2;
      const quality = index === 11 ? 'STALE' : index === 22 ? 'CONFLICT' : index % 19 === 0 || index % 23 === 0 ? 'PARTIAL' : 'COMPLETE';
      return {
        period, utilisation: index % 19 === 0 ? null : utilisation,
        growth: [12, 1, 4, 7, 3][pattern] + month,
        availability: pattern === 2 ? 95.2 + (index % 4) * 0.4 : 99.2 + (index % 4) * 0.2,
        faults: pattern === 2 ? 6 + index % 4 : index % 3,
        capex: 100000 + index * 2800,
        opex: 2200 + index * 35 + (pattern === 2 ? 1600 : 0),
        contribution: index % 23 === 0 ? null : 5000 + utilisation * 90 + index * 30 + month * 300,
        failureCost: pattern === 2 ? 1200 + index * 12 : index % 3 * 140,
        quality
      };
    });
    return {
      id: `N${String(index + 1).padStart(3, '0')}`,
      name: `${region.name} demonstration site ${Math.floor(index / 5) + 1}`,
      region: region.name, technology: (['3G', '4G', '5G'] as const)[index % 3],
      latitude: region.lat + ((index * 17 % 19) - 9) * 0.012,
      longitude: region.lon + ((index * 13 % 17) - 8) * 0.014,
      strategic: pattern === 3, demo: true, observations,
      history: [{ date: '2026-07-15', action: pattern === 2 ? 'Battery replacement' : 'Backhaul maintenance',
        cost: pattern === 2 ? 18000 : 7500,
        outcome: 'Synthetic historical intervention. No causal benefit has been established.' }]
    };
  });
}
export const portfolio = buildPortfolio();
