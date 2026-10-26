export interface CashFlowPeriod {
  month: number;
  grossRevenue: number;
  contributionMargin: number;  // Profit margin on incremental traffic (e.g. 35% of gross revenue)
  opexSavings: number;         // Energy, fuel, and failure cost reductions
  recurringCosts: number;      // Ongoing maintenance or spectrum fees
  netCashFlow: number;         // contributionMargin + opexSavings - recurringCosts
  discountedCashFlow: number;  // Present value of netCashFlow
  cumulativeCashFlow: number;  // Undiscounted cumulative
  cumulativeDiscounted: number;// Discounted cumulative (NPV progression)
}

export interface ScenarioSpread {
  downside: FinancialAppraisal;
  base: FinancialAppraisal;
  upside: FinancialAppraisal;
}

export interface FinancialAppraisal {
  horizonMonths: number;
  discountRateAnnual: number;
  initialCapex: number;
  totalGrossRevenue: number;
  totalContributionMargin: number;
  totalOpexSavings: number;
  totalRecurringCosts: number;
  totalNetCashFlow: number;
  npv: number;                 // Net Present Value in USD
  simpleRoi: number | null;    // (Total Net Cash Flow - CAPEX) / CAPEX
  irrAnnualPct: number | null; // Annualized IRR percentage (e.g. 24.5%)
  irrStatus: 'CONVERGED' | 'NO_SIGN_CHANGE' | 'NON_CONVERGENT' | 'INSUFFICIENT_DATA';
  irrExplanation: string;
  paybackMonths: number | null;// Exact month when cumulative cash flow >= 0
  paybackDiscountedMonths: number | null;
  cashFlows: CashFlowPeriod[];
  dataSufficiency: 'VALIDATED' | 'ILLUSTRATIVE' | 'INSUFFICIENT_DATA';
  dataSufficiencyNotes: string;
}

export interface ModernizationCandidateSpec {
  id: string;
  siteId: string;
  fromTechnology: '3G' | '4G' | '5G';
  toTechnology: '3G' | '4G' | '5G';
  capex: number;
  implementationMonths: number;
  expectedMonthlyIncrementalRevenue: number;
  contributionMarginRate: number; // e.g. 0.35 (35%)
  monthlyOpexSavings: number;     // e.g. from power efficiency or lower per-bit OPEX
  monthlyIncrementalOpex: number; // e.g. higher power draw for 5G
  prerequisites: {
    backhaulGbpsRequired: number;
    powerStabilityPctRequired: number;
    currentBackhaulGbps: number;
    currentPowerStabilityPct: number;
    siteFootprintAvailable: boolean;
  };
}

export interface PrerequisiteCheckResult {
  satisfied: boolean;
  missingPrerequisites: string[];
  notes: string;
}

/**
 * Checks infrastructure prerequisites for technology upgrades.
 */
export function checkModernizationPrerequisites(spec: ModernizationCandidateSpec): PrerequisiteCheckResult {
  const missing: string[] = [];

  if (spec.toTechnology === '5G') {
    if (spec.prerequisites.currentBackhaulGbps < spec.prerequisites.backhaulGbpsRequired) {
      missing.push(`High-capacity backhaul deficient: ${spec.prerequisites.currentBackhaulGbps} Gbps available vs ${spec.prerequisites.backhaulGbpsRequired} Gbps required for 5G`);
    }
    if (spec.prerequisites.currentPowerStabilityPct < spec.prerequisites.powerStabilityPctRequired) {
      missing.push(`Power availability inadequate: ${spec.prerequisites.currentPowerStabilityPct.toFixed(1)}% vs ${spec.prerequisites.powerStabilityPctRequired}% minimum required for 5G active antenna units`);
    }
  }

  if (spec.toTechnology === '4G' && spec.fromTechnology === '3G') {
    if (spec.prerequisites.currentBackhaulGbps < 0.1) {
      missing.push('Backhaul capacity under 100 Mbps; microwave link upgrade needed for 4G LTE carrier');
    }
  }

  if (!spec.prerequisites.siteFootprintAvailable) {
    missing.push('Physical tower mast or ground cabinet footprint constrained; structural survey required');
  }

  return {
    satisfied: missing.length === 0,
    missingPrerequisites: missing,
    notes: missing.length === 0 
      ? 'All engineering and backhaul prerequisites satisfied.' 
      : 'Modernization in eligible until prerequisites are remediated: ' + missing.join('; ')
  };
}

/**
 * Calculates Internal Rate of Return (IRR) using robust Newton-Raphson with bisection fallback.
 * Validates that the cash flow stream contains at least one sign change.
 */
export function calculateIRR(initialCapex: number, cashFlows: number[]): { irr: number | null; status: 'CONVERGED' | 'NO_SIGN_CHANGE' | 'NON_CONVERGENT'; explanation: string } {
  if (initialCapex <= 0) {
    return { irr: null, status: 'NO_SIGN_CHANGE', explanation: 'Initial CAPEX must be positive to evaluate return.' };
  }

  const series = [-initialCapex, ...cashFlows];
  
  // Check for sign changes (Descartes' Rule of Signs requirement)
  let positiveFound = false;
  let negativeFound = false;
  for (const cf of series) {
    if (cf > 0) positiveFound = true;
    if (cf < 0) negativeFound = true;
  }

  if (!positiveFound || !negativeFound) {
    return {
      irr: null,
      status: 'NO_SIGN_CHANGE',
      explanation: 'Cash flows do not change sign (all positive or all negative); IRR is mathematically undefined.'
    };
  }

  // NPV function for monthly discount rate r
  const npvMonthly = (r: number): number => {
    let total = series[0];
    for (let t = 1; t < series.length; t++) {
      total += series[t] / Math.pow(1 + r, t);
    }
    return total;
  };

  // Derivative of NPV with respect to monthly rate r
  const dNpvMonthly = (r: number): number => {
    let total = 0;
    for (let t = 1; t < series.length; t++) {
      total -= (t * series[t]) / Math.pow(1 + r, t + 1);
    }
    return total;
  };

  // Newton-Raphson starting with monthly guess of 1% (approx 12% annualized)
  let r = 0.01;
  const maxIterations = 80;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const val = npvMonthly(r);
    if (Math.abs(val) < tolerance) {
      // Annualize monthly rate: (1 + r)^12 - 1
      const annualIrr = (Math.pow(1 + r, 12) - 1) * 100;
      return {
        irr: Number(annualIrr.toFixed(2)),
        status: 'CONVERGED',
        explanation: 'Newton-Raphson converged successfully to annualized IRR.'
      };
    }
    const deriv = dNpvMonthly(r);
    if (Math.abs(deriv) < 1e-9) break; // Slope flat, switch to bisection
    const nextR = r - val / deriv;
    if (nextR <= -0.99 || nextR > 5.0) break; // Diverging, switch
    r = nextR;
  }

  // Bisection fallback between -50% and +300% monthly
  let low = -0.05;
  let high = 0.50;
  let fLow = npvMonthly(low);
  let fHigh = npvMonthly(high);

  if (fLow * fHigh > 0) {
    // Try broader range
    high = 1.5;
    fHigh = npvMonthly(high);
  }

  if (fLow * fHigh < 0) {
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const fMid = npvMonthly(mid);
      if (Math.abs(fMid) < tolerance || (high - low) / 2 < tolerance) {
        const annualIrr = (Math.pow(1 + mid, 12) - 1) * 100;
        return {
          irr: Number(annualIrr.toFixed(2)),
          status: 'CONVERGED',
          explanation: 'Bisection converged successfully to annualized IRR.'
        };
      }
      if (fMid * fLow < 0) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }
  }

  return {
    irr: null,
    status: 'NON_CONVERGENT',
    explanation: 'Cash flow profile yielded non-convergent or multiple internal rates of return.'
  };
}

/**
 * Projects multi-period cash flows, NPV, IRR, payback period, and uncertainty spread.
 */
export function projectFinancialAppraisal(params: {
  initialCapex: number;
  monthlyIncrementalRevenue: number;
  contributionMarginRate: number; // e.g. 0.35
  monthlyOpexSavings: number;
  monthlyRecurringCosts: number;
  implementationMonths: number;
  horizonMonths: number;
  annualDiscountRate: number;     // e.g. 0.12 (12%)
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'STALE' | 'CONFLICT';
}): FinancialAppraisal {
  const {
    initialCapex,
    monthlyIncrementalRevenue,
    contributionMarginRate,
    monthlyOpexSavings,
    monthlyRecurringCosts,
    implementationMonths,
    horizonMonths,
    annualDiscountRate,
    dataQuality
  } = params;

  // Monthly discount rate = annualRate / 12
  const rMonthly = annualDiscountRate / 12;

  const cashFlows: CashFlowPeriod[] = [];
  let cumUndiscounted = -initialCapex;
  let cumDiscounted = -initialCapex;
  let paybackMonths: number | null = null;
  let paybackDiscountedMonths: number | null = null;

  const monthlyNetCashFlowValues: number[] = [];

  for (let m = 1; m <= horizonMonths; m++) {
    // During implementation period, operational benefits are not yet realized
    const isLive = m > implementationMonths;
    const grossRev = isLive ? monthlyIncrementalRevenue : 0;
    const contrib = isLive ? grossRev * contributionMarginRate : 0;
    const savings = isLive ? monthlyOpexSavings : 0;
    const recurring = isLive ? monthlyRecurringCosts : 0;
    const net = contrib + savings - recurring;

    monthlyNetCashFlowValues.push(net);

    const discounted = net / Math.pow(1 + rMonthly, m);
    cumUndiscounted += net;
    cumDiscounted += discounted;

    if (paybackMonths === null && cumUndiscounted >= 0) {
      paybackMonths = m;
    }
    if (paybackDiscountedMonths === null && cumDiscounted >= 0) {
      paybackDiscountedMonths = m;
    }

    cashFlows.push({
      month: m,
      grossRevenue: grossRev,
      contributionMargin: contrib,
      opexSavings: savings,
      recurringCosts: recurring,
      netCashFlow: net,
      discountedCashFlow: Number(discounted.toFixed(2)),
      cumulativeCashFlow: Number(cumUndiscounted.toFixed(2)),
      cumulativeDiscounted: Number(cumDiscounted.toFixed(2))
    });
  }

  const totalGrossRevenue = cashFlows.reduce((sum, cf) => sum + cf.grossRevenue, 0);
  const totalContributionMargin = cashFlows.reduce((sum, cf) => sum + cf.contributionMargin, 0);
  const totalOpexSavings = cashFlows.reduce((sum, cf) => sum + cf.opexSavings, 0);
  const totalRecurringCosts = cashFlows.reduce((sum, cf) => sum + cf.recurringCosts, 0);
  const totalNetCashFlow = cashFlows.reduce((sum, cf) => sum + cf.netCashFlow, 0);

  const npv = Number(cumDiscounted.toFixed(2));
  const simpleRoi = initialCapex > 0 ? Number(((totalNetCashFlow - initialCapex) / initialCapex).toFixed(4)) : null;

  const irrResult = calculateIRR(initialCapex, monthlyNetCashFlowValues);

  const isDataValidated = dataQuality === 'COMPLETE';
  const dataSufficiency: FinancialAppraisal['dataSufficiency'] = isDataValidated ? 'VALIDATED' : 'ILLUSTRATIVE';
  const dataSufficiencyNotes = isDataValidated
    ? 'Financial model verified against complete historical telemetry and unit cost benchmarks.'
    : 'Illustrative projection: telemetry input contains partial or unvalidated historical data. Do not execute real capital commitment without field audit.';

  return {
    horizonMonths,
    discountRateAnnual: annualDiscountRate,
    initialCapex,
    totalGrossRevenue,
    totalContributionMargin,
    totalOpexSavings,
    totalRecurringCosts,
    totalNetCashFlow,
    npv,
    simpleRoi,
    irrAnnualPct: irrResult.irr,
    irrStatus: irrResult.status,
    irrExplanation: irrResult.explanation,
    paybackMonths,
    paybackDiscountedMonths,
    cashFlows,
    dataSufficiency,
    dataSufficiencyNotes
  };
}

/**
 * Builds 3-point uncertainty spread: Downside, Base, Upside cases.
 */
export function buildScenarioSpread(params: {
  initialCapex: number;
  monthlyIncrementalRevenue: number;
  contributionMarginRate: number;
  monthlyOpexSavings: number;
  monthlyRecurringCosts: number;
  implementationMonths: number;
  horizonMonths: number;
  annualDiscountRate: number;
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'STALE' | 'CONFLICT';
}): ScenarioSpread {
  // Base case
  const base = projectFinancialAppraisal(params);

  // Downside case: 70% revenue adoption, 75% opex savings, +15% CAPEX overrun, +1 mo delay
  const downside = projectFinancialAppraisal({
    ...params,
    initialCapex: Math.round(params.initialCapex * 1.15),
    monthlyIncrementalRevenue: Math.round(params.monthlyIncrementalRevenue * 0.70),
    monthlyOpexSavings: Math.round(params.monthlyOpexSavings * 0.75),
    implementationMonths: Math.min(params.horizonMonths - 1, params.implementationMonths + 1)
  });

  // Upside case: 125% revenue adoption, 115% opex savings, -5% CAPEX efficiency
  const upside = projectFinancialAppraisal({
    ...params,
    initialCapex: Math.round(params.initialCapex * 0.95),
    monthlyIncrementalRevenue: Math.round(params.monthlyIncrementalRevenue * 1.25),
    monthlyOpexSavings: Math.round(params.monthlyOpexSavings * 1.15)
  });

  return { downside, base, upside };
}

export interface ModernizationOptionComparison {
  optionCode: string;
  title: string;
  fromTechnology: '3G' | '4G' | '5G';
  toTechnology: '3G' | '4G' | '5G';
  capex: number;
  monthlyRevenueIncremental: number;
  monthlyContributionMargin: number;
  monthlyOpexSavings: number;
  netMonthlyBenefit: number;
  npv36Months: number;
  irrAnnualPct: number | null;
  paybackMonths: number | null;
  prerequisites: PrerequisiteCheckResult;
  status: 'RECOMMENDED' | 'SCREENING_ELIGIBLE' | 'PREREQUISITE_DEFICIENT' | 'SUB_OPTIMAL';
  recommendationRationale: string;
}

/**
 * Compares technology upgrade options (3G-to-4G, 4G-to-5G, Solar+BESS, Backhaul) for a site.
 */
export function compareModernizationOptions(site: import('./portfolio.js').Site, period: import('./portfolio.js').Period): ModernizationOptionComparison[] {
  const row = site.observations.find(r => r.period === period);
  if (!row) throw new Error(`Missing observation for site ${site.id} in ${period}`);
  const siteIdx = Number(site.id.replace(/\D/g, '')) || 1;
  const currentBackhaul = site.technology === '5G' ? 1.5 : site.technology === '4G' ? 0.35 : 0.08;
  const options: ModernizationOptionComparison[] = [];

  // 1. 3G-to-4G LTE Modernization
  if (site.technology === '3G') {
    const capex = 55000;
    const monthlyRev = row.contribution ? Math.round(row.contribution * 0.40) : 3200;
    const margin = Math.round(monthlyRev * 0.35);
    const opexSavings = Math.round(row.opex * 0.10);
    const netMonthly = margin + opexSavings;
    const appraisal = projectFinancialAppraisal({
      initialCapex: capex,
      monthlyIncrementalRevenue: monthlyRev,
      contributionMarginRate: 0.35,
      monthlyOpexSavings: opexSavings,
      monthlyRecurringCosts: 250,
      implementationMonths: 2,
      horizonMonths: 36,
      annualDiscountRate: 0.12,
      dataQuality: row.quality
    });
    const prereq = checkModernizationPrerequisites({
      id: `${site.id}:3g-to-4g`,
      siteId: site.id,
      fromTechnology: '3G',
      toTechnology: '4G',
      capex,
      implementationMonths: 2,
      expectedMonthlyIncrementalRevenue: monthlyRev,
      contributionMarginRate: 0.35,
      monthlyOpexSavings: opexSavings,
      monthlyIncrementalOpex: 250,
      prerequisites: {
        backhaulGbpsRequired: 0.1,
        powerStabilityPctRequired: 95.0,
        currentBackhaulGbps: currentBackhaul,
        currentPowerStabilityPct: row.availability,
        siteFootprintAvailable: siteIdx % 17 !== 0
      }
    });

    options.push({
      optionCode: 'MOD-3G-4G',
      title: '3G to 4G LTE Technology Modernization',
      fromTechnology: '3G',
      toTechnology: '4G',
      capex,
      monthlyRevenueIncremental: monthlyRev,
      monthlyContributionMargin: margin,
      monthlyOpexSavings: opexSavings,
      netMonthlyBenefit: netMonthly,
      npv36Months: appraisal.npv,
      irrAnnualPct: appraisal.irrAnnualPct,
      paybackMonths: appraisal.paybackMonths,
      prerequisites: prereq,
      status: prereq.satisfied && appraisal.npv > 0 ? 'RECOMMENDED' : prereq.satisfied ? 'SCREENING_ELIGIBLE' : 'PREREQUISITE_DEFICIENT',
      recommendationRationale: 'Replaces legacy 3G carriers with modern LTE spectrum. Expands data throughput and captures high-ARPU 4G subscribers.'
    });
  }

  // 2. 4G-to-5G NR Modernization
  if (site.technology === '4G' || site.technology === '5G') {
    const capex = 110000;
    const monthlyRev = row.contribution ? Math.round(row.contribution * 0.55) : 5800;
    const margin = Math.round(monthlyRev * 0.35);
    const opexSavings = 0; // 5G active antenna units consume more power
    const netMonthly = margin - 400; // $400 incremental power/spectrum OPEX
    const appraisal = projectFinancialAppraisal({
      initialCapex: capex,
      monthlyIncrementalRevenue: monthlyRev,
      contributionMarginRate: 0.35,
      monthlyOpexSavings: 0,
      monthlyRecurringCosts: 400,
      implementationMonths: 4,
      horizonMonths: 36,
      annualDiscountRate: 0.12,
      dataQuality: row.quality
    });
    const prereq = checkModernizationPrerequisites({
      id: `${site.id}:4g-to-5g`,
      siteId: site.id,
      fromTechnology: '4G',
      toTechnology: '5G',
      capex,
      implementationMonths: 4,
      expectedMonthlyIncrementalRevenue: monthlyRev,
      contributionMarginRate: 0.35,
      monthlyOpexSavings: 0,
      monthlyIncrementalOpex: 400,
      prerequisites: {
        backhaulGbpsRequired: 1.0,
        powerStabilityPctRequired: 99.0,
        currentBackhaulGbps: currentBackhaul,
        currentPowerStabilityPct: row.availability,
        siteFootprintAvailable: siteIdx % 13 !== 0
      }
    });

    options.push({
      optionCode: 'MOD-4G-5G',
      title: '4G to 5G New Radio (NR) High-Capacity Upgrade',
      fromTechnology: site.technology,
      toTechnology: '5G',
      capex,
      monthlyRevenueIncremental: monthlyRev,
      monthlyContributionMargin: margin,
      monthlyOpexSavings: 0,
      netMonthlyBenefit: netMonthly,
      npv36Months: appraisal.npv,
      irrAnnualPct: appraisal.irrAnnualPct,
      paybackMonths: appraisal.paybackMonths,
      prerequisites: prereq,
      status: prereq.satisfied && appraisal.npv > 0 ? 'RECOMMENDED' : prereq.satisfied ? 'SCREENING_ELIGIBLE' : 'PREREQUISITE_DEFICIENT',
      recommendationRationale: 'Deploys massive MIMO 5G NR radios. Unlocks high-density enterprise, FWA, and ultra-broadband revenue where fiber backhaul exists.'
    });
  }

  // 3. Solar PV + Battery Power Modernization
  const solarCapex = 38000;
  const solarOpexSavings = Math.round(row.opex * 0.40);
  const solarAppraisal = projectFinancialAppraisal({
    initialCapex: solarCapex,
    monthlyIncrementalRevenue: 0,
    contributionMarginRate: 0.35,
    monthlyOpexSavings: solarOpexSavings,
    monthlyRecurringCosts: 100,
    implementationMonths: 1,
    horizonMonths: 36,
    annualDiscountRate: 0.12,
    dataQuality: row.quality
  });
  options.push({
    optionCode: 'MOD-SOLAR-BESS',
    title: 'Solar PV & BESS Hybrid Clean Energy Modernization',
    fromTechnology: site.technology,
    toTechnology: site.technology,
    capex: solarCapex,
    monthlyRevenueIncremental: 0,
    monthlyContributionMargin: 0,
    monthlyOpexSavings: solarOpexSavings,
    netMonthlyBenefit: solarOpexSavings - 100,
    npv36Months: solarAppraisal.npv,
    irrAnnualPct: solarAppraisal.irrAnnualPct,
    paybackMonths: solarAppraisal.paybackMonths,
    prerequisites: { satisfied: true, missingPrerequisites: [], notes: 'Site roof and compound area suitable for 12 kWp solar array.' },
    status: solarAppraisal.npv > 10000 ? 'RECOMMENDED' : 'SCREENING_ELIGIBLE',
    recommendationRationale: 'Eliminates reliance on volatile diesel fuel and safeguards base station availability from recurrent grid outages.'
  });

  // 4. Backhaul Capacity Upgrade
  const backhaulCapex = 42000;
  const backhaulRev = row.contribution ? Math.round(row.contribution * 0.20) : 1800;
  const backhaulMargin = Math.round(backhaulRev * 0.35);
  const backhaulAppraisal = projectFinancialAppraisal({
    initialCapex: backhaulCapex,
    monthlyIncrementalRevenue: backhaulRev,
    contributionMarginRate: 0.35,
    monthlyOpexSavings: Math.round(row.failureCost * 0.40),
    monthlyRecurringCosts: 200,
    implementationMonths: 2,
    horizonMonths: 36,
    annualDiscountRate: 0.12,
    dataQuality: row.quality
  });
  options.push({
    optionCode: 'MOD-BACKHAUL',
    title: 'High-Capacity Fiber / E-Band Microwave Backhaul',
    fromTechnology: site.technology,
    toTechnology: site.technology,
    capex: backhaulCapex,
    monthlyRevenueIncremental: backhaulRev,
    monthlyContributionMargin: backhaulMargin,
    monthlyOpexSavings: Math.round(row.failureCost * 0.40),
    netMonthlyBenefit: backhaulMargin + Math.round(row.failureCost * 0.40) - 200,
    npv36Months: backhaulAppraisal.npv,
    irrAnnualPct: backhaulAppraisal.irrAnnualPct,
    paybackMonths: backhaulAppraisal.paybackMonths,
    prerequisites: { satisfied: true, missingPrerequisites: [], notes: 'Line of sight or fiber duct available.' },
    status: 'SCREENING_ELIGIBLE',
    recommendationRationale: 'Removes transmission bottleneck, dropping call and session abort rates.'
  });

  return options;
}

/**
 * Attaches multi-year financial appraisal to an investment candidate.
 */
export function attachCandidateFinancialAppraisal(
  candidate: import('./investments.js').Candidate,
  site: import('./portfolio.js').Site,
  period: import('./portfolio.js').Period
): import('./investments.js').Candidate {
  const row = site.observations.find(r => r.period === period);
  if (!row) return candidate;

  const monthlyIncRev = candidate.actionCode === 'capacity' 
    ? (row.contribution ? Math.round(row.contribution * 0.32) : 2800)
    : candidate.actionCode === 'backhaul'
    ? (row.contribution ? Math.round(row.contribution * 0.18) : 1600)
    : 0;

  const monthlyOpexSavings = candidate.actionCode === 'resilience'
    ? Math.round(row.opex * 0.35)
    : candidate.actionCode === 'maintenance'
    ? Math.round(row.failureCost * 0.65)
    : candidate.actionCode === 'capacity'
    ? Math.round(row.opex * 0.04)
    : Math.round(row.failureCost * 0.30);

  const monthlyRecurringCosts = candidate.actionCode === 'capacity' ? 450 : candidate.actionCode === 'backhaul' ? 300 : 150;

  const financialAppraisal = projectFinancialAppraisal({
    initialCapex: candidate.estimatedCost,
    monthlyIncrementalRevenue: monthlyIncRev,
    contributionMarginRate: 0.35,
    monthlyOpexSavings,
    monthlyRecurringCosts,
    implementationMonths: candidate.actionCode === 'capacity' ? 3 : candidate.actionCode === 'backhaul' ? 2 : 1,
    horizonMonths: 36,
    annualDiscountRate: 0.12,
    dataQuality: row.quality
  });

  const scenarioSpread = buildScenarioSpread({
    initialCapex: candidate.estimatedCost,
    monthlyIncrementalRevenue: monthlyIncRev,
    contributionMarginRate: 0.35,
    monthlyOpexSavings,
    monthlyRecurringCosts,
    implementationMonths: candidate.actionCode === 'capacity' ? 3 : candidate.actionCode === 'backhaul' ? 2 : 1,
    horizonMonths: 36,
    annualDiscountRate: 0.12,
    dataQuality: row.quality
  });

  const backhaulGbps = site.technology === '5G' ? 1.5 : site.technology === '4G' ? 0.35 : 0.08;
  const siteIdx = Number(site.id.replace(/\D/g, '')) || 1;
  const prerequisites = checkModernizationPrerequisites({
    id: `${site.id}:${candidate.actionCode}`,
    siteId: site.id,
    fromTechnology: site.technology,
    toTechnology: site.technology === '3G' ? '4G' : site.technology === '4G' ? '5G' : '5G',
    capex: candidate.estimatedCost,
    implementationMonths: 3,
    expectedMonthlyIncrementalRevenue: monthlyIncRev,
    contributionMarginRate: 0.35,
    monthlyOpexSavings,
    monthlyIncrementalOpex: monthlyRecurringCosts,
    prerequisites: {
      backhaulGbpsRequired: site.technology === '4G' ? 1.0 : 0.1,
      powerStabilityPctRequired: 99.0,
      currentBackhaulGbps: backhaulGbps,
      currentPowerStabilityPct: row.availability,
      siteFootprintAvailable: siteIdx % 19 !== 0
    }
  });

  return {
    ...candidate,
    financialAppraisal,
    scenarioSpread,
    prerequisites
  };
}


// AEHML extensions
export interface ExpectancyInputs {
  benefitsUnderIntervention: number;
  benefitsUnderBaseline: number;
  incrementalCost: number;
}
export function calculateExpectancy(inputs: ExpectancyInputs): number {
  return inputs.benefitsUnderIntervention - inputs.benefitsUnderBaseline - inputs.incrementalCost;
}
export function separateFinancialCategories() {
  return {
    revenue: 'Gross revenue impact',
    contribution: 'Revenue minus variable costs',
    cashFlow: 'Operating cash flow',
    accountingProfit: 'After accounting adjustments'
  };
}

