/**
 * FRA-aligned appraisal calculation engine.
 *
 * Every function here ports a specific cell/formula from the master Excel
 * template (Villa Solia / Amlak format, version 2015 FRA standard).
 * Functions are pure: same inputs always produce same outputs, no I/O,
 * no global state. This is what lets us unit-test against real reports.
 *
 * NUMBER-PRECISION POLICY:
 *   The Excel engine uses full IEEE-754 doubles throughout. We do the
 *   same. Round only at presentation time, never inside the engine.
 */

import type {
  CostApproachInput,
  CostApproachResult,
  IncomeApproachInput,
  IncomeApproachResult,
  GRMInput,
  GRMResult,
  Comparable,
  SalesComparisonInput,
  SalesComparisonResult,
  Reconciliation,
  AppraisalReport,
  ChosenMethod,
} from "./types";

// ──────────────────────────────────────────────────────────────────────
// COST APPROACH — Excel rows 160-182
// ──────────────────────────────────────────────────────────────────────

/**
 * Derives the headline cost-approach value per the Excel formula chain.
 *
 * Excel cells, in order:
 *   G168 = K166                                 → land area assigned to project
 *   G169 = G168 * H165                          → land value share
 *   I172 = I171 * K167                          → construction cost of unit
 *   I176 = (K173 / B173) * (I172 - K174)        → irreparable depreciation
 *   I178 = K174 + I176                          → total depreciation
 *   I182 = I172 + G169 + J179 + A179 + J180 - I178
 *
 * Note on H165: the Excel formula chain (R162-R165) talks about
 * scaling for "highest & best use" by (allowedFloors/currentFloors),
 * but in the Solia sample H165 is hard-typed equal to J162 (21000).
 * We keep our engine faithful to that — H165 is an input. If the
 * appraiser wants the scaled version they enter the scaled number.
 */
export function computeCostApproach(i: CostApproachInput): CostApproachResult {
  const landPriceForHighestBestUse = i.landPricePerSqm; // H165 in practice
  const unitShareOfLandArea = i.projectLandArea;        // G168 ← K166 = G7
  const unitShareOfLandValue = unitShareOfLandArea * landPriceForHighestBestUse; // G169

  const unitConstructionCost = i.constructionCostPerSqm * i.unitAreaToValue; // I172

  // I176: (effectiveAge / economicLife) × (constructionCost - repairableDep)
  const irreparableDepreciation =
    (i.effectiveAge / i.economicLife) * (unitConstructionCost - i.repairableDepreciation);

  const totalDepreciation = i.repairableDepreciation + irreparableDepreciation; // I178

  const total =
    unitConstructionCost +
    unitShareOfLandValue +
    (i.garageShareValue ?? 0) +
    (i.gardenShareValue ?? 0) +
    (i.storageRoomValue ?? 0) -
    totalDepreciation;

  return {
    landPriceForHighestBestUse,
    unitShareOfLandArea,
    unitShareOfLandValue,
    unitConstructionCost,
    irreparableDepreciation,
    totalDepreciation,
    total,
  };
}

// ──────────────────────────────────────────────────────────────────────
// SALES COMPARISON APPROACH — Excel rows 189-217
// ──────────────────────────────────────────────────────────────────────

/**
 * Derived land value for a comparable:
 *   landValue = salePrice - (buildingPricePerSqm × buildingAreaSqm)
 * Matches A209/E209/I209.
 */
export function comparableDerivedLandValue(c: Comparable): number {
  return c.salePrice - c.buildingPricePerSqm * c.buildingAreaSqm;
}

/**
 * Weighted implied value across comparables, normalised to the subject's
 * building area. This is a sanity check we compute; the Excel relies on
 * the appraiser typing B216 manually after considering adjustments.
 *
 * If no weights supplied, equal weights are used.
 */
export function computeSalesComparison(i: SalesComparisonInput): SalesComparisonResult {
  if (i.comparables.length === 0) {
    throw new Error("Sales comparison requires at least one comparable.");
  }

  const enriched = i.comparables.map((c) => ({
    ...c,
    derivedLandValue: comparableDerivedLandValue(c),
  }));

  const totalWeight = enriched.reduce((s, c) => s + (c.weight ?? 1), 0);

  // Normalise each comparable's total price by area ratio to subject,
  // then take weighted average. This is one valid interpretation of the
  // narrative at R215 ("بحساب قيم الضبط ... وزن نسبى لكل وحدة مقارنه").
  const weightedImpliedValue = enriched.reduce((sum, c) => {
    const areaAdjusted = c.salePrice * (i.subjectBuildingArea / c.buildingAreaSqm);
    return sum + areaAdjusted * ((c.weight ?? 1) / totalWeight);
  }, 0);

  return {
    comparables: enriched,
    weightedImpliedValue,
    appraiserReconciled: i.finalValue,
  };
}

// ──────────────────────────────────────────────────────────────────────
// INCOME CAPITALIZATION APPROACH — Excel rows 218-228
// ──────────────────────────────────────────────────────────────────────

/**
 * Excel cells:
 *   J220 = L219 * 12                             → annual income
 *   C220 = J220 * 0.1                            → vacancy & expenses (default 10%)
 *   A221 = J220 - C220                           → net effective income
 *   C223 = 100 / C222                            → capital recovery rate %
 *   C224 = C223 + L223                           → cap rate %
 *   C225 = K222 * L223 / 100                     → land yield
 *   C226 = A221 - C225                           → building yield
 *   C227 = C226 / (C224 / 100)                   → building price
 *   C228 = C227 + K222                           → income approach total
 *
 * NOTE on the Excel formula: C220 hardcodes the 10% multiplier
 * (cell formula is `=J220*0.1`). We expose it as a parameter so the
 * appraiser can override per-property, but default to 0.10.
 */
export function computeIncomeApproach(i: IncomeApproachInput): IncomeApproachResult {
  const annualIncome = i.monthlyRent * 12;
  const vacancyAndExpenses = annualIncome * i.vacancyAndExpensesRate;
  const netEffectiveIncome = annualIncome - vacancyAndExpenses;

  const capitalRecoveryRate = 100 / i.remainingLife; // %
  const capRate = capitalRecoveryRate + i.interestRate;

  const landYield = (i.unitLandShareValue * i.interestRate) / 100;
  const buildingYield = netEffectiveIncome - landYield;
  const buildingPrice = buildingYield / (capRate / 100);
  const total = buildingPrice + i.unitLandShareValue;

  return {
    annualIncome,
    vacancyAndExpenses,
    netEffectiveIncome,
    capitalRecoveryRate,
    capRate,
    landYield,
    buildingYield,
    buildingPrice,
    total,
  };
}

// ──────────────────────────────────────────────────────────────────────
// GROSS RENT MULTIPLIER — Excel rows 230-235
// ──────────────────────────────────────────────────────────────────────

/**
 * Excel cells:
 *   C232 = L231 * 12                             → annual income
 *   A234 = C232 - L233                           → net effective income
 *   A235 = A234 * A231                           → GRM total
 *
 * In the Solia file, L233 reuses C220 (the income-approach vacancy figure,
 * 132,000 EGP), even though the rent assumption here (30k) is much lower.
 * That's an Excel quirk we faithfully reproduce: vacancy is the same
 * absolute number, not 10% of the GRM annual income. The appraiser can
 * override by passing a different vacancyAndExpenses value.
 */
export function computeGRM(i: GRMInput): GRMResult {
  const annualIncome = i.monthlyRent * 12;
  const netEffectiveIncome = annualIncome - i.vacancyAndExpenses;
  const total = netEffectiveIncome * i.incomeMultiplier;
  return { annualIncome, netEffectiveIncome, total };
}

// ──────────────────────────────────────────────────────────────────────
// RECONCILIATION — Excel rows 246-263
// ──────────────────────────────────────────────────────────────────────

/**
 * J262 = unitShareOfLandValue (from cost approach)
 * J263 = finalValue - J262
 * The appraiser chooses which method's value to use as J261.
 */
export function reconcile(
  costValue: number,
  salesValue: number,
  incomeValue: number,
  grmValue: number,
  unitShareOfLandValue: number,
  chosen: ChosenMethod,
  rationale: string,
  monthlyRentReconciled: number,
): Reconciliation {
  const chosenValueMap = {
    cost: costValue,
    sales_comparison: salesValue,
    income: incomeValue,
    grm: grmValue,
  } as const;

  const finalValue = chosenValueMap[chosen];
  const landValue = unitShareOfLandValue;
  const buildingValue = finalValue - landValue;

  return {
    costApproachValue: costValue,
    salesComparisonValue: salesValue,
    incomeApproachValue: incomeValue,
    grmValue,
    chosenMethod: chosen,
    rationale,
    finalValue,
    landValue,
    buildingValue,
    monthlyRentReconciled,
  };
}

// ──────────────────────────────────────────────────────────────────────
// FULL REPORT EVALUATION
// ──────────────────────────────────────────────────────────────────────

/**
 * Evaluates an entire report end-to-end. Useful for backlog ingestion
 * (where we parse an Excel into structured inputs, then re-run the
 * engine to verify the cached values match — a free correctness check).
 */
export interface EvaluatedReport {
  cost: CostApproachResult;
  sales: SalesComparisonResult;
  income: IncomeApproachResult;
  grm: GRMResult;
  reconciliation: Reconciliation;
}

export function evaluateReport(r: AppraisalReport): EvaluatedReport {
  const cost = computeCostApproach(r.costApproach);
  const sales = computeSalesComparison(r.salesComparison);
  const income = computeIncomeApproach(r.incomeApproach);
  const grm = computeGRM(r.grm);

  // Use the report's own reconciliation choice (the appraiser's judgement),
  // but recompute the derived fields (landValue, buildingValue) from the
  // freshly-computed numbers.
  const reconciliation = reconcile(
    cost.total,
    sales.appraiserReconciled,
    income.total,
    grm.total,
    cost.unitShareOfLandValue,
    r.reconciliation.chosenMethod,
    r.reconciliation.rationale,
    r.reconciliation.monthlyRentReconciled,
  );

  return { cost, sales, income, grm, reconciliation };
}

// ──────────────────────────────────────────────────────────────────────
// HELPER: Partial evaluation for live calc panel
// ──────────────────────────────────────────────────────────────────────

/**
 * Computes available method values based on partial inputs.
 * Returns null for methods that don't have enough data.
 */
export interface PartialEvaluation {
  cost: CostApproachResult | null;
  sales: { finalValue: number; weightedImpliedValue: number } | null;
  income: IncomeApproachResult | null;
  grm: GRMResult | null;
}

export function evaluatePartial(data: {
  costApproach?: Partial<CostApproachInput>;
  salesComparison?: { comparables?: Comparable[]; finalValue?: number; subjectBuildingArea?: number };
  incomeApproach?: Partial<IncomeApproachInput>;
  grm?: Partial<GRMInput>;
}): PartialEvaluation {
  let cost: CostApproachResult | null = null;
  let sales: { finalValue: number; weightedImpliedValue: number } | null = null;
  let income: IncomeApproachResult | null = null;
  let grm: GRMResult | null = null;

  // Try cost approach
  const c = data.costApproach;
  if (
    c &&
    c.landPricePerSqm !== undefined &&
    c.projectLandArea !== undefined &&
    c.unitAreaToValue !== undefined &&
    c.constructionCostPerSqm !== undefined &&
    c.economicLife !== undefined &&
    c.effectiveAge !== undefined
  ) {
    try {
      cost = computeCostApproach({
        landPricePerSqm: c.landPricePerSqm,
        allowedFloors: c.allowedFloors ?? 1,
        currentFloors: c.currentFloors ?? 1,
        totalBuiltAreaInBuilding: c.totalBuiltAreaInBuilding ?? 0,
        projectLandArea: c.projectLandArea,
        unitAreaToValue: c.unitAreaToValue,
        constructionCostPerSqm: c.constructionCostPerSqm,
        economicLife: c.economicLife,
        effectiveAge: c.effectiveAge,
        repairableDepreciation: c.repairableDepreciation ?? 0,
        gardenShareValue: c.gardenShareValue,
        garageShareValue: c.garageShareValue,
        storageRoomValue: c.storageRoomValue,
      });
    } catch {
      // Not enough data
    }
  }

  // Try sales comparison
  const s = data.salesComparison;
  if (s && s.comparables && s.comparables.length > 0 && s.finalValue !== undefined && s.subjectBuildingArea !== undefined) {
    try {
      const result = computeSalesComparison({
        subjectBuildingArea: s.subjectBuildingArea,
        subjectLandArea: 0, // Not critical for display
        comparables: s.comparables,
        finalValue: s.finalValue,
      });
      sales = {
        finalValue: result.appraiserReconciled,
        weightedImpliedValue: result.weightedImpliedValue,
      };
    } catch {
      // Not enough data
    }
  }

  // Try income approach
  const i = data.incomeApproach;
  if (
    i &&
    i.monthlyRent !== undefined &&
    i.remainingLife !== undefined &&
    i.interestRate !== undefined &&
    i.unitLandShareValue !== undefined
  ) {
    try {
      income = computeIncomeApproach({
        monthlyRent: i.monthlyRent,
        vacancyAndExpensesRate: i.vacancyAndExpensesRate ?? 0.1,
        remainingLife: i.remainingLife,
        interestRate: i.interestRate,
        unitLandShareValue: i.unitLandShareValue,
      });
    } catch {
      // Not enough data
    }
  }

  // Try GRM
  const g = data.grm;
  if (g && g.incomeMultiplier !== undefined && g.monthlyRent !== undefined && g.vacancyAndExpenses !== undefined) {
    try {
      grm = computeGRM({
        incomeMultiplier: g.incomeMultiplier,
        monthlyRent: g.monthlyRent,
        vacancyAndExpenses: g.vacancyAndExpenses,
      });
    } catch {
      // Not enough data
    }
  }

  return { cost, sales, income, grm };
}

// ──────────────────────────────────────────────────────────────────────
// NUMBER FORMATTING UTILITIES
// ──────────────────────────────────────────────────────────────────────

/**
 * Format a number as EGP currency (e.g., "1,700,000")
 */
export function formatEGP(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Format a number with Arabic numerals and currency
 */
export function formatEGPArabic(value: number): string {
  return Math.round(value).toLocaleString('ar-EG');
}

/**
 * Convert number to Arabic words (for PDF)
 * e.g., 1700000 → "مليون وسبعمائة ألف"
 */
export function numberToArabicWords(num: number): string {
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  if (num === 0) return 'صفر';

  const rounded = Math.round(num);
  const parts: string[] = [];

  // Billions
  const billions = Math.floor(rounded / 1_000_000_000);
  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else parts.push(numberToArabicWords(billions) + ' مليار');
  }

  // Millions
  const millions = Math.floor((rounded % 1_000_000_000) / 1_000_000);
  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(ones[millions] + ' ملايين');
    else parts.push(numberToArabicWords(millions) + ' مليون');
  }

  // Thousands
  const thousands = Math.floor((rounded % 1_000_000) / 1_000);
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(ones[thousands] + ' آلاف');
    else parts.push(numberToArabicWords(thousands) + ' ألف');
  }

  // Hundreds
  const remainder = rounded % 1000;
  const h = Math.floor(remainder / 100);
  const t = Math.floor((remainder % 100) / 10);
  const o = remainder % 10;

  if (h > 0) parts.push(hundreds[h]);
  if (t > 0 || o > 0) {
    if (t === 1) {
      // 10-19
      const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
      parts.push(teens[o]);
    } else {
      if (o > 0) parts.push(ones[o]);
      if (t > 1) parts.push(tens[t]);
    }
  }

  return parts.join(' و');
}
