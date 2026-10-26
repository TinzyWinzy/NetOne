import type { Site, Observation, Period } from './portfolio.js';
import { observation, usd } from './portfolio.js';

export interface PowerProfile {
  gridReliabilityPct: number;       // Grid availability (0-100%)
  generatorCapacityKva: number;      // e.g. 20, 30, 45 kVA
  dieselConsumptionLph: number;      // Liters per run hour (e.g. 2.8 - 4.5 L/h)
  monthlyDieselLiters: number;       // Liters consumed in month
  dieselPricePerLiter: number;       // USD/liter (e.g. 1.45)
  monthlyDieselCost: number;         // USD
  gridKwhConsumed: number;           // kWh
  gridTariffPerKwh: number;          // USD/kWh (e.g. 0.14)
  monthlyGridCost: number;           // USD
  batteryCapacityAh: number;         // Ampere-hours (e.g. 200, 400 Ah)
  batteryHealthPct: number;          // Battery state-of-health (0-100%)
  batteryAutonomyHours: number;      // Backup autonomy (hours)
  monthlyBatteryReserve: number;     // Monthly amortized replacement reserve
  monthlyGeneratorMaintenance: number; // Regular servicing and oil/filters
  solarInstalledKwp: number;         // Existing solar capacity (kWp)
  recurrentMaintenanceCost: number;  // Routine site maintenance
}

export interface SiteCostBreakdown {
  siteId: string;
  siteName: string;
  region: string;
  technology: string;
  period: Period;
  totalOpex: number;
  powerOpex: number;
  dieselCost: number;
  gridCost: number;
  batteryReserveCost: number;
  generatorMaintenanceCost: number;
  routineMaintenanceCost: number;
  failureCostInOpex: number;         // Explicitly identified to prevent double-counting
  trafficGB: number | null;
  downtimeHours: number;
  costPerGB: number | null;          // USD/GB
  costPerAvailableHour: number;      // USD per operational hour
  underutilized: boolean;            // Flag for low utilization / high unit cost
  powerProfile: PowerProfile;
  evidenceQuality: 'COMPLETE' | 'PARTIAL' | 'STALE' | 'CONFLICT';
}

export type RemediationStrategyKind = 
  | 'SOLAR_HYBRID' 
  | 'GRID_BESS_STABILIZER' 
  | 'GENSET_EFFICIENCY_OVERHAUL' 
  | 'INFRASTRUCTURE_SHARING' 
  | 'MAINTAIN_CURRENT';

export interface RemediationAlternative {
  kind: RemediationStrategyKind;
  label: string;
  implementationCost: number;       // One-time CAPEX (USD)
  monthlyOpexChange: number;         // Change in monthly OPEX (negative = savings)
  expectedMonthlySavings: {
    low: number;
    base: number;
    high: number;
  };
  expectedAnnualSavings: {
    low: number;
    base: number;
    high: number;
  };
  paybackMonths: number | null;
  riskAdjustedNetAnnualBenefit: number; // 1-year net (Annual savings - CAPEX) or annualized ROI
  operationalImpact: string;
  confidence: 'HIGH' | 'MEDIUM' | 'INSUFFICIENT_DATA';
  tradeoffRationale: string;
}

export interface SiteCostOptimizationRecommendation {
  siteId: string;
  siteName: string;
  region: string;
  period: Period;
  detectedProblem: string;
  problemEvidence: string;
  recommendedAction: RemediationAlternative;
  alternatives: RemediationAlternative[];
  confidenceAssessment: string;
  whyPreferredToAlternatives: string;
  doubleCountingCheck: string;
}

export interface PortfolioCostOptimizationSummary {
  period: Period;
  totalPortfolioOpex: number;
  totalDieselCost: number;
  totalGridCost: number;
  totalMaintenanceCost: number;
  averageCostPerGB: number | null;
  averageCostPerAvailableHour: number;
  underutilizedSitesCount: number;
  underutilizedStrandedOpex: number;
  totalIdentifiedAnnualSavingsPotential: number; // Risk-adjusted base case
  recommendations: SiteCostOptimizationRecommendation[];
}

/**
 * Deterministically constructs power profile from site characteristics and observation.
 */
export function derivePowerProfile(site: Site, row: Observation): PowerProfile {
  const index = Number(site.id.replace(/\D/g, '')) || 1;
  const isHarareOrBulawayo = ['Harare', 'Bulawayo'].includes(site.region);
  
  // Grid reliability: higher in metro, lower in rural/provincial
  const gridReliabilityPct = isHarareOrBulawayo 
    ? Math.max(60, Math.min(92, 85 - (index % 7) * 3))
    : Math.max(35, Math.min(75, 60 - (index % 9) * 4));
  
  const outageHours = (row.period === '2026-09' ? 720 : 744) * (1 - gridReliabilityPct / 100);
  const generatorCapacityKva = [20, 30, 45, 30, 20][index % 5];
  const dieselConsumptionLph = 2.4 + (generatorCapacityKva / 20) * 0.7; // 3.1 - 4.0 L/h
  
  // Diesel runs for portion of grid outage (some covered by battery)
  const batteryHealthPct = Math.max(40, Math.min(98, 95 - (index % 8) * 6));
  const batteryCapacityAh = [200, 300, 400, 500, 300][index % 5];
  const batteryAutonomyHours = (batteryCapacityAh / 100) * (batteryHealthPct / 100) * 1.5; // ~2.5 - 7 hours
  
  // Diesel run hours = grid outage hours minus battery buffer
  const dieselRunHours = Math.max(10, outageHours * Math.max(0.3, 1 - (batteryAutonomyHours / 12)));
  const monthlyDieselLiters = Math.round(dieselRunHours * dieselConsumptionLph);
  const dieselPricePerLiter = 1.45;
  const monthlyDieselCost = Math.round(monthlyDieselLiters * dieselPricePerLiter);
  
  const gridHours = (row.period === '2026-09' ? 720 : 744) - outageHours;
  const sitePowerDrawKw = site.technology === '5G' ? 4.2 : site.technology === '4G' ? 2.8 : 1.9;
  const gridKwhConsumed = Math.round(gridHours * sitePowerDrawKw);
  const gridTariffPerKwh = 0.14;
  const monthlyGridCost = Math.round(gridKwhConsumed * gridTariffPerKwh);
  
  const monthlyBatteryReserve = Math.round(250 + (batteryCapacityAh / 100) * 80 * (1 - batteryHealthPct / 200));
  const monthlyGeneratorMaintenance = Math.round(180 + dieselRunHours * 1.25);
  const solarInstalledKwp = index % 4 === 1 ? 4.5 : index % 6 === 3 ? 8.0 : 0;
  
  // Routine maintenance = total opex minus power components
  const computedPowerOpex = monthlyDieselCost + monthlyGridCost + monthlyBatteryReserve + monthlyGeneratorMaintenance;
  const recurrentMaintenanceCost = Math.max(200, Math.round(row.opex - computedPowerOpex - row.failureCost));

  return {
    gridReliabilityPct,
    generatorCapacityKva,
    dieselConsumptionLph,
    monthlyDieselLiters,
    dieselPricePerLiter,
    monthlyDieselCost,
    gridKwhConsumed,
    gridTariffPerKwh,
    monthlyGridCost,
    batteryCapacityAh,
    batteryHealthPct,
    batteryAutonomyHours,
    monthlyBatteryReserve,
    monthlyGeneratorMaintenance,
    solarInstalledKwp,
    recurrentMaintenanceCost
  };
}

/**
 * Calculates detailed site cost breakdown with unit cost metrics.
 */
export function calculateSiteCostBreakdown(site: Site, period: Period): SiteCostBreakdown {
  const row = observation(site, period);
  const power = derivePowerProfile(site, row);
  const hoursInMonth = period === '2026-09' ? 720 : 744;
  const operationalHours = hoursInMonth * (row.availability / 100);
  const downtimeHours = row.downtimeHours ?? Number(((100 - row.availability) / 100 * hoursInMonth).toFixed(2));
  
  const trafficGB = row.trafficGB ?? null;
  const costPerGB = (trafficGB && trafficGB > 0) ? Number((row.opex / trafficGB).toFixed(4)) : null;
  const costPerAvailableHour = operationalHours > 0 ? Number((row.opex / operationalHours).toFixed(2)) : 0;
  
  // Underutilized criteria: utilization < 35% or costPerGB > $1.80/GB
  const underutilized = (row.utilisation !== null && row.utilisation < 35) || (costPerGB !== null && costPerGB > 1.8);
  const powerOpex = power.monthlyDieselCost + power.monthlyGridCost + power.monthlyBatteryReserve + power.monthlyGeneratorMaintenance;

  return {
    siteId: site.id,
    siteName: site.name,
    region: site.region,
    technology: site.technology,
    period,
    totalOpex: row.opex,
    powerOpex,
    dieselCost: power.monthlyDieselCost,
    gridCost: power.monthlyGridCost,
    batteryReserveCost: power.monthlyBatteryReserve,
    generatorMaintenanceCost: power.monthlyGeneratorMaintenance,
    routineMaintenanceCost: power.recurrentMaintenanceCost,
    failureCostInOpex: row.failureCost,
    trafficGB,
    downtimeHours,
    costPerGB,
    costPerAvailableHour,
    underutilized,
    powerProfile: power,
    evidenceQuality: row.quality
  };
}

/**
 * Evaluates alternative remediation strategies for a site.
 */
export function evaluateRemediationAlternatives(breakdown: SiteCostBreakdown): RemediationAlternative[] {
  const { powerProfile, totalOpex, underutilized, costPerGB, failureCostInOpex } = breakdown;
  const diesel = powerProfile.monthlyDieselCost;
  const alternatives: RemediationAlternative[] = [];

  // Strategy 1: Solar PV + BESS Hybrid Conversion
  // Eliminates 80-85% of diesel consumption and reduces generator maintenance by 75%
  const solarCapex = 38000 + (powerProfile.generatorCapacityKva > 30 ? 6000 : 0);
  const solarDieselSavings = Math.round(diesel * 0.82);
  const solarGenMaintSavings = Math.round(powerProfile.monthlyGeneratorMaintenance * 0.70);
  const solarMonthlySavingsBase = solarDieselSavings + solarGenMaintSavings;
  const solarMonthlyLow = Math.round(solarMonthlySavingsBase * 0.80);
  const solarMonthlyHigh = Math.round(solarMonthlySavingsBase * 1.15);
  const solarPayback = solarMonthlySavingsBase > 0 ? Number((solarCapex / solarMonthlySavingsBase).toFixed(1)) : null;

  alternatives.push({
    kind: 'SOLAR_HYBRID',
    label: 'Solar PV (12 kWp) + BESS Hybrid Conversion',
    implementationCost: solarCapex,
    monthlyOpexChange: -solarMonthlySavingsBase,
    expectedMonthlySavings: { low: solarMonthlyLow, base: solarMonthlySavingsBase, high: solarMonthlyHigh },
    expectedAnnualSavings: { low: solarMonthlyLow * 12, base: solarMonthlySavingsBase * 12, high: solarMonthlyHigh * 12 },
    paybackMonths: solarPayback,
    riskAdjustedNetAnnualBenefit: Math.round(solarMonthlySavingsBase * 12 * 0.90 - (solarCapex / 3)), // 3-year amortized net
    operationalImpact: `Reduces diesel run time by ~82% (~${Math.round(powerProfile.monthlyDieselLiters * 0.82)} L/mo saved). Shields site from grid outages.`,
    confidence: breakdown.evidenceQuality === 'COMPLETE' ? 'HIGH' : 'MEDIUM',
    tradeoffRationale: 'Highest upfront CAPEX, but provides the deepest structural OPEX reduction and decouples site uptime from fuel logistics.'
  });

  // Strategy 2: Grid Power Stabilizer & High-Cycle LFP Battery Bank
  // Cuts diesel runs by 55% by utilizing stabilized grid windows to rapidly charge LFP cells
  const gridBessCapex = 24000;
  const bessDieselSavings = Math.round(diesel * 0.55);
  const bessMaintSavings = Math.round(powerProfile.monthlyGeneratorMaintenance * 0.45);
  const bessMonthlyBase = bessDieselSavings + bessMaintSavings;
  const bessPayback = bessMonthlyBase > 0 ? Number((gridBessCapex / bessMonthlyBase).toFixed(1)) : null;

  alternatives.push({
    kind: 'GRID_BESS_STABILIZER',
    label: 'Fast-Charge LFP Battery Bank & Grid Stabilizer',
    implementationCost: gridBessCapex,
    monthlyOpexChange: -bessMonthlyBase,
    expectedMonthlySavings: { low: Math.round(bessMonthlyBase * 0.75), base: bessMonthlyBase, high: Math.round(bessMonthlyBase * 1.10) },
    expectedAnnualSavings: { low: Math.round(bessMonthlyBase * 9), base: bessMonthlyBase * 12, high: Math.round(bessMonthlyBase * 13.2) },
    paybackMonths: bessPayback,
    riskAdjustedNetAnnualBenefit: Math.round(bessMonthlyBase * 12 * 0.85 - (gridBessCapex / 3)),
    operationalImpact: `Extends clean battery runtime to 8+ hours. Captures grid power when live, avoiding generator start during short drops.`,
    confidence: 'HIGH',
    tradeoffRationale: 'Moderate CAPEX with rapid payback (under 24 months) where grid power is available at least 50% of the time.'
  });

  // Strategy 3: Generator Overhaul & Fuel Telemetry Sensor Suite
  // Eliminates fuel waste/theft and restores combustion efficiency (20-25% fuel savings)
  const gensetCapex = 11000;
  const gensetMonthlyBase = Math.round(diesel * 0.22 + powerProfile.monthlyGeneratorMaintenance * 0.30);
  const gensetPayback = gensetMonthlyBase > 0 ? Number((gensetCapex / gensetMonthlyBase).toFixed(1)) : null;

  alternatives.push({
    kind: 'GENSET_EFFICIENCY_OVERHAUL',
    label: 'Generator Major Overhaul & Ultrasonic Fuel Telemetry',
    implementationCost: gensetCapex,
    monthlyOpexChange: -gensetMonthlyBase,
    expectedMonthlySavings: { low: Math.round(gensetMonthlyBase * 0.70), base: gensetMonthlyBase, high: Math.round(gensetMonthlyBase * 1.20) },
    expectedAnnualSavings: { low: Math.round(gensetMonthlyBase * 8.4), base: gensetMonthlyBase * 12, high: Math.round(gensetMonthlyBase * 14.4) },
    paybackMonths: gensetPayback,
    riskAdjustedNetAnnualBenefit: Math.round(gensetMonthlyBase * 12 * 0.80 - (gensetCapex / 2)),
    operationalImpact: 'Stops fuel loss, recalibrates fuel injection, and provides tamper-evident diesel telemetry to NOC.',
    confidence: 'HIGH',
    tradeoffRationale: 'Low upfront cost intervention suitable for sites where full solar conversion is physically or budget-constrained.'
  });

  // Strategy 4: Active Infrastructure Sharing (SI 137/2016) or Capacity Rightsizing
  if (underutilized) {
    const sharingSetupCapex = 5500;
    // Sharing halves site energy and tower rental burden
    const sharingMonthlyBase = Math.round(totalOpex * 0.38);
    const sharingPayback = Number((sharingSetupCapex / sharingMonthlyBase).toFixed(1));

    alternatives.push({
      kind: 'INFRASTRUCTURE_SHARING',
      label: 'SI 137/2016 Active Site Colocation & Cost Sharing',
      implementationCost: sharingSetupCapex,
      monthlyOpexChange: -sharingMonthlyBase,
      expectedMonthlySavings: { low: Math.round(sharingMonthlyBase * 0.65), base: sharingMonthlyBase, high: Math.round(sharingMonthlyBase * 1.15) },
      expectedAnnualSavings: { low: Math.round(sharingMonthlyBase * 7.8), base: sharingMonthlyBase * 12, high: Math.round(sharingMonthlyBase * 13.8) },
      paybackMonths: sharingPayback,
      riskAdjustedNetAnnualBenefit: Math.round(sharingMonthlyBase * 12 * 0.75 - sharingSetupCapex),
      operationalImpact: 'Converts underutilized physical asset into a shared multitenant node under POTRAZ SI 137 framework, splitting power/security OPEX.',
      confidence: 'MEDIUM',
      tradeoffRationale: 'Immediate remediation for stranded cost where local subscriber demand cannot organically absorb dedicated capacity.'
    });
  }

  // Baseline Strategy: Maintain Current Status Quo
  alternatives.push({
    kind: 'MAINTAIN_CURRENT',
    label: 'Maintain Current Operational Baseline',
    implementationCost: 0,
    monthlyOpexChange: 0,
    expectedMonthlySavings: { low: 0, base: 0, high: 0 },
    expectedAnnualSavings: { low: 0, base: 0, high: 0 },
    paybackMonths: null,
    riskAdjustedNetAnnualBenefit: 0,
    operationalImpact: 'No operational change. Continued exposure to diesel price volatility and recurrent engine wear.',
    confidence: 'HIGH',
    tradeoffRationale: 'Accepts existing cost structure when capital budget is prioritized elsewhere.'
  });

  return alternatives;
}

/**
 * Synthesizes the optimal cost optimization recommendation for a site.
 */
export function generateSiteCostRecommendation(breakdown: SiteCostBreakdown): SiteCostOptimizationRecommendation {
  const alternatives = evaluateRemediationAlternatives(breakdown);
  const { powerProfile, totalOpex, underutilized, costPerGB } = breakdown;
  const diesel = powerProfile.monthlyDieselCost;

  let detectedProblem = '';
  let problemEvidence = '';
  let recommendedKind: RemediationStrategyKind = 'MAINTAIN_CURRENT';
  let whyPreferred = '';

  if (underutilized) {
    detectedProblem = 'Underutilized infrastructure with elevated unit cost';
    problemEvidence = `Monthly traffic of ${breakdown.trafficGB ?? 'N/A'} GB generates a unit cost of ${usd(costPerGB)}/GB vs portfolio benchmark of $0.95/GB, while consuming ${usd(totalOpex)}/mo in OPEX.`;
    recommendedKind = 'INFRASTRUCTURE_SHARING';
    whyPreferred = 'Sharing site infrastructure under SI 137/2016 recovers stranded capital and splits power and physical security costs with a colocation partner.';
  } else if (diesel > 1200) {
    detectedProblem = 'Heavy diesel dependency driven by severe grid instability';
    problemEvidence = `Site consumes ${powerProfile.monthlyDieselLiters} liters of diesel monthly (${usd(diesel)}/mo, ${(diesel / totalOpex * 100).toFixed(0)}% of OPEX) with grid availability at only ${powerProfile.gridReliabilityPct.toFixed(0)}%.`;
    recommendedKind = 'SOLAR_HYBRID';
    whyPreferred = 'Solar PV + BESS delivers an ~82% reduction in monthly fuel burn ($' + Math.round(diesel * 0.82) + '/mo saved), yielding the highest 3-year risk-adjusted net return.';
  } else if (powerProfile.batteryHealthPct < 65 && diesel > 600) {
    detectedProblem = 'Degraded battery bank triggering premature generator starts';
    problemEvidence = `Battery state of health is ${powerProfile.batteryHealthPct.toFixed(0)}% (only ${powerProfile.batteryAutonomyHours.toFixed(1)}h autonomy), causing the generator to fire even during brief power dips.`;
    recommendedKind = 'GRID_BESS_STABILIZER';
    whyPreferred = 'Upgrading to fast-charging LFP batteries resolves the short-cycle autonomy deficit for less than 65% of the cost of full solar conversion.';
  } else if (powerProfile.monthlyGeneratorMaintenance > 400) {
    detectedProblem = 'Excessive generator servicing and mechanical wear';
    problemEvidence = `Generator maintenance expenditure is ${usd(powerProfile.monthlyGeneratorMaintenance)}/mo across ${powerProfile.generatorCapacityKva} kVA genset.`;
    recommendedKind = 'GENSET_EFFICIENCY_OVERHAUL';
    whyPreferred = 'Mechanical overhaul and digital fuel sensors optimize fuel air mixture and prevent unrecorded fuel depletion at minimal CAPEX.';
  } else {
    detectedProblem = 'Stable operational baseline within normal parameters';
    problemEvidence = `Power and maintenance expenditure (${usd(breakdown.powerOpex)}/mo) align with regional efficiency targets.`;
    recommendedKind = 'MAINTAIN_CURRENT';
    whyPreferred = 'Site does not justify capital remediation at present; priority should remain on higher-burden infrastructure.';
  }

  const recommendedAction = alternatives.find(a => a.kind === recommendedKind) || alternatives[0];

  return {
    siteId: breakdown.siteId,
    siteName: breakdown.siteName,
    region: breakdown.region,
    period: breakdown.period,
    detectedProblem,
    problemEvidence,
    recommendedAction,
    alternatives,
    confidenceAssessment: breakdown.evidenceQuality === 'COMPLETE' 
      ? 'High confidence: grounded in complete synthetic telemetry and billing logs.' 
      : 'Moderate confidence: observations contain partial or stale records; field validation advised.',
    whyPreferredToAlternatives: whyPreferred,
    doubleCountingCheck: 'Savings reflect energy and maintenance reductions only. Failure costs (' + usd(breakdown.failureCostInOpex) + ') are already embedded in OPEX and are not added as secondary benefits.'
  };
}

/**
 * Summarizes operational cost optimization across the entire portfolio.
 */
export function summarizePortfolioCostOptimization(sites: Site[], period: Period): PortfolioCostOptimizationSummary {
  const breakdowns = sites.map(site => calculateSiteCostBreakdown(site, period));
  const recommendations = breakdowns.map(b => generateSiteCostRecommendation(b));

  const totalPortfolioOpex = breakdowns.reduce((sum, b) => sum + b.totalOpex, 0);
  const totalDieselCost = breakdowns.reduce((sum, b) => sum + b.dieselCost, 0);
  const totalGridCost = breakdowns.reduce((sum, b) => sum + b.gridCost, 0);
  const totalMaintenanceCost = breakdowns.reduce((sum, b) => sum + b.generatorMaintenanceCost + b.routineMaintenanceCost, 0);

  const totalTraffic = breakdowns.reduce((sum, b) => sum + (b.trafficGB || 0), 0);
  const averageCostPerGB = totalTraffic > 0 ? Number((totalPortfolioOpex / totalTraffic).toFixed(4)) : null;

  const validHourlySites = breakdowns.filter(b => b.costPerAvailableHour > 0);
  const averageCostPerAvailableHour = validHourlySites.length > 0 
    ? Number((validHourlySites.reduce((sum, b) => sum + b.costPerAvailableHour, 0) / validHourlySites.length).toFixed(2)) 
    : 0;

  const underutilized = breakdowns.filter(b => b.underutilized);
  const underutilizedStrandedOpex = underutilized.reduce((sum, b) => sum + b.totalOpex, 0);

  const totalIdentifiedAnnualSavingsPotential = recommendations.reduce(
    (sum, r) => sum + (r.recommendedAction.expectedAnnualSavings.base || 0), 
    0
  );

  return {
    period,
    totalPortfolioOpex,
    totalDieselCost,
    totalGridCost,
    totalMaintenanceCost,
    averageCostPerGB,
    averageCostPerAvailableHour,
    underutilizedSitesCount: underutilized.length,
    underutilizedStrandedOpex,
    totalIdentifiedAnnualSavingsPotential,
    recommendations
  };
}
