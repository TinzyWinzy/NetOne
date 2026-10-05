import { TowerTelemetry, SI_LIMITS } from '../types';
export function towerFine(_t: TowerTelemetry): number { throw new Error('Penalty calculation disabled: verified provision, applicability and regulatory assessment required.'); }

export function outageFine(_t: TowerTelemetry): number { throw new Error('Penalty calculation disabled: verified provision, applicability and regulatory assessment required.'); }

export function exposureOf(t: TowerTelemetry): number {
  return Math.max(towerFine(t), 0) + outageFine(t);
}

export type RiskLevel = 'NORMAL' | 'MEDIUM' | 'HIGH' | 'BREACH';

/**
 * Early-warning engine per PRD FR-1.2: flag within 10% margin of SI 154 limits
 * before breach. DSASR warning at <=96% (limit 95%), DSDR warning at >=1.8%
 * (limit 2%), CA warning at <70% (limit 67%). Outage warning at >120m (2hr SLA).
 */
export function riskLevel(t: TowerTelemetry): RiskLevel {
  if (
    t.cellAvailabilityPercent < SI_LIMITS.cellAvailability ||
    t.dsasrPercent < SI_LIMITS.dsasr ||
    t.dsdrPercent > SI_LIMITS.dsdr ||
    (t.status === 'Offline' && t.activeOutageDurationMinutes > SI_LIMITS.outageFreeMinutes)
  ) {
    return 'BREACH';
  }
  if (
    t.status === 'Offline' ||
    t.activeOutageDurationMinutes > 120 ||
    t.cellAvailabilityPercent < 70 ||
    t.dsasrPercent <= 96 ||
    t.dsdrPercent >= 1.8
  ) {
    return 'HIGH';
  }
  if (
    t.status === 'Backup Battery' ||
    t.cellAvailabilityPercent < 80 ||
    t.dsasrPercent <= 97 ||
    t.dsdrPercent >= 1.5
  ) {
    return 'MEDIUM';
  }
  return 'NORMAL';
}

/** Fine accrued for a live outage clock given elapsed seconds. */
export function penaltyForElapsed(_elapsedSec: number): number {
  throw new Error('Penalty calculation disabled: verified scope, provision and regulatory assessment required.');
}
