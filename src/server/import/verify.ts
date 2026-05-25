/**
 * Engine Verification Module
 *
 * Compares extracted values from imported files against engine-computed values.
 * Used to determine if an Excel import can be auto-approved (>99% match)
 * or requires human review.
 */

import {
  computeCostApproach,
  computeIncomeApproach,
  computeGRM,
} from '../../lib/appraisal/engine';
import type {
  CostApproachInput,
  CostApproachResult,
  IncomeApproachInput,
  IncomeApproachResult,
  GRMInput,
  GRMResult,
} from '../../lib/appraisal/types';

export interface FieldDiscrepancy {
  field: string;
  label: string; // Human-readable field name
  typed: number; // Value from the imported file
  computed: number; // Value computed by the engine
  delta: number; // Absolute difference
  deltaPercent: number; // Percentage difference
}

export interface VerificationResult {
  matchPercent: number; // 0-100
  isAutoApprovable: boolean; // matchPercent >= 99
  discrepancies: FieldDiscrepancy[];
  engineComputed: {
    costApproach?: CostApproachResult;
    incomeApproach?: IncomeApproachResult;
    grm?: GRMResult;
  };
  fieldCount: number;
  matchedFields: number;
}

// Tolerance for floating point comparison (0.01%)
const FLOAT_TOLERANCE = 0.0001;

// Auto-approve threshold (99%)
const AUTO_APPROVE_THRESHOLD = 99;

/**
 * Verify extracted data against engine computations
 */
export function verifyExtractedData(
  extracted: Record<string, unknown>
): VerificationResult {
  const discrepancies: FieldDiscrepancy[] = [];
  let fieldCount = 0;
  let matchedFields = 0;

  const engineComputed: VerificationResult['engineComputed'] = {};

  // ═══════════════════════════════════════════════════════════════════════
  // COST APPROACH VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════
  const costData = extracted.costApproach as Record<string, unknown> | undefined;
  if (costData && hasRequiredCostInputs(costData)) {
    const input = buildCostApproachInput(costData, extracted);
    const computed = computeCostApproach(input);
    engineComputed.costApproach = computed;

    // Compare computed values against typed values
    const typedComputed = (costData._computed || {}) as Record<string, unknown>;

    fieldCount += compareCostFields(
      typedComputed,
      computed,
      discrepancies,
      (matches) => { matchedFields += matches; }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INCOME APPROACH VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════
  const incomeData = extracted.incomeApproach as Record<string, unknown> | undefined;
  if (incomeData && hasRequiredIncomeInputs(incomeData)) {
    const input = buildIncomeApproachInput(incomeData, extracted);
    const computed = computeIncomeApproach(input);
    engineComputed.incomeApproach = computed;

    // Compare computed values
    const typedComputed = (incomeData._computed || {}) as Record<string, unknown>;

    fieldCount += compareIncomeFields(
      typedComputed,
      computed,
      discrepancies,
      (matches) => { matchedFields += matches; }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GRM VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════
  const grmData = extracted.grm as Record<string, unknown> | undefined;
  if (grmData && hasRequiredGRMInputs(grmData)) {
    const input = buildGRMInput(grmData);
    const computed = computeGRM(input);
    engineComputed.grm = computed;

    // Compare computed values
    const typedComputed = (grmData._computed || {}) as Record<string, unknown>;

    fieldCount += compareGRMFields(
      typedComputed,
      computed,
      discrepancies,
      (matches) => { matchedFields += matches; }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CALCULATE MATCH PERCENTAGE
  // ═══════════════════════════════════════════════════════════════════════
  const matchPercent = fieldCount > 0
    ? (matchedFields / fieldCount) * 100
    : 0;

  return {
    matchPercent,
    isAutoApprovable: matchPercent >= AUTO_APPROVE_THRESHOLD && discrepancies.length === 0,
    discrepancies,
    engineComputed,
    fieldCount,
    matchedFields,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════

function hasRequiredCostInputs(data: Record<string, unknown>): boolean {
  return (
    typeof data.landPricePerSqm === 'number' &&
    typeof data.constructionCostPerSqm === 'number' &&
    typeof data.economicLife === 'number' &&
    typeof data.effectiveAge === 'number'
  );
}

function hasRequiredIncomeInputs(data: Record<string, unknown>): boolean {
  return (
    typeof data.monthlyRent === 'number' &&
    typeof data.remainingLife === 'number' &&
    typeof data.interestRate === 'number'
  );
}

function hasRequiredGRMInputs(data: Record<string, unknown>): boolean {
  return (
    typeof data.incomeMultiplier === 'number' &&
    typeof data.monthlyRent === 'number'
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT BUILDERS
// ═══════════════════════════════════════════════════════════════════════

function buildCostApproachInput(
  costData: Record<string, unknown>,
  extracted: Record<string, unknown>
): CostApproachInput {
  const physical = (extracted.physical || {}) as Record<string, unknown>;

  return {
    landPricePerSqm: costData.landPricePerSqm as number,
    allowedFloors: (costData.allowedFloors as number) || 1,
    currentFloors: (costData.currentFloors as number) || 1,
    totalBuiltAreaInBuilding: (costData.totalBuiltAreaInBuilding as number) || 0,
    projectLandArea: (costData.projectLandArea as number) || (physical.projectLandArea as number) || 0,
    unitAreaToValue: (costData.unitAreaToValue as number) || (physical.unitGrossArea as number) || 0,
    constructionCostPerSqm: costData.constructionCostPerSqm as number,
    economicLife: costData.economicLife as number,
    effectiveAge: costData.effectiveAge as number,
    repairableDepreciation: (costData.repairableDepreciation as number) || 0,
    gardenShareValue: costData.gardenShareValue as number | undefined,
    garageShareValue: costData.garageShareValue as number | undefined,
    storageRoomValue: costData.storageRoomValue as number | undefined,
  };
}

function buildIncomeApproachInput(
  incomeData: Record<string, unknown>,
  extracted: Record<string, unknown>
): IncomeApproachInput {
  // Get unit land share value from cost approach computed values
  const costData = (extracted.costApproach || {}) as Record<string, unknown>;
  const costComputed = (costData._computed || {}) as Record<string, unknown>;
  const unitLandShareValue = (incomeData.unitLandShareValue as number) ||
    (costComputed.unitShareOfLandValue as number) || 0;

  // Calculate vacancy rate from amount if we have annualIncome
  // The Excel stores the expense AMOUNT (e.g., 132,000) not the rate (0.1)
  let vacancyRate = incomeData.vacancyAndExpensesRate as number | undefined;
  if (vacancyRate === undefined || vacancyRate === null) {
    const vacancyAmount = incomeData.vacancyAndExpensesAmount as number | undefined;
    const annualIncome = incomeData.annualIncome as number | undefined;
    if (vacancyAmount && annualIncome && annualIncome > 0) {
      vacancyRate = vacancyAmount / annualIncome;
    } else {
      vacancyRate = 0.1; // Default 10%
    }
  }

  return {
    monthlyRent: incomeData.monthlyRent as number,
    vacancyAndExpensesRate: vacancyRate,
    remainingLife: incomeData.remainingLife as number,
    interestRate: incomeData.interestRate as number,
    unitLandShareValue,
  };
}

function buildGRMInput(grmData: Record<string, unknown>): GRMInput {
  return {
    incomeMultiplier: grmData.incomeMultiplier as number,
    monthlyRent: grmData.monthlyRent as number,
    vacancyAndExpenses: (grmData.vacancyAndExpenses as number) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FIELD COMPARISON HELPERS
// ═══════════════════════════════════════════════════════════════════════

function compareField(
  typed: unknown,
  computed: number,
  fieldName: string,
  label: string,
  discrepancies: FieldDiscrepancy[],
  addMatches: (count: number) => void
): number {
  // Field count (1 if both values exist, 0 otherwise)
  if (typeof typed !== 'number' || typeof computed !== 'number') {
    return 0;
  }

  const delta = Math.abs(typed - computed);
  const deltaPercent = computed !== 0 ? (delta / Math.abs(computed)) * 100 : (typed !== 0 ? 100 : 0);

  if (deltaPercent <= FLOAT_TOLERANCE * 100) {
    // Values match
    addMatches(1);
  } else {
    // Values differ
    discrepancies.push({
      field: fieldName,
      label,
      typed: typed as number,
      computed,
      delta,
      deltaPercent,
    });
  }

  return 1; // One field compared
}

function compareCostFields(
  typed: Record<string, unknown>,
  computed: CostApproachResult,
  discrepancies: FieldDiscrepancy[],
  addMatches: (count: number) => void
): number {
  let count = 0;

  count += compareField(typed.landPriceForHighestBestUse, computed.landPriceForHighestBestUse,
    'costApproach.landPriceForHighestBestUse', 'Land Price (H&BU)', discrepancies, addMatches);

  count += compareField(typed.unitShareOfLandArea, computed.unitShareOfLandArea,
    'costApproach.unitShareOfLandArea', 'Unit Land Area Share', discrepancies, addMatches);

  count += compareField(typed.unitShareOfLandValue, computed.unitShareOfLandValue,
    'costApproach.unitShareOfLandValue', 'Unit Land Value Share', discrepancies, addMatches);

  count += compareField(typed.unitConstructionCost, computed.unitConstructionCost,
    'costApproach.unitConstructionCost', 'Unit Construction Cost', discrepancies, addMatches);

  count += compareField(typed.irreparableDepreciation, computed.irreparableDepreciation,
    'costApproach.irreparableDepreciation', 'Irreparable Depreciation', discrepancies, addMatches);

  count += compareField(typed.totalDepreciation, computed.totalDepreciation,
    'costApproach.totalDepreciation', 'Total Depreciation', discrepancies, addMatches);

  count += compareField(typed.total, computed.total,
    'costApproach.total', 'Cost Approach Total', discrepancies, addMatches);

  return count;
}

function compareIncomeFields(
  typed: Record<string, unknown>,
  computed: IncomeApproachResult,
  discrepancies: FieldDiscrepancy[],
  addMatches: (count: number) => void
): number {
  let count = 0;

  count += compareField(typed.annualIncome, computed.annualIncome,
    'incomeApproach.annualIncome', 'Annual Income', discrepancies, addMatches);

  count += compareField(typed.netEffectiveIncome, computed.netEffectiveIncome,
    'incomeApproach.netEffectiveIncome', 'Net Effective Income', discrepancies, addMatches);

  count += compareField(typed.capitalRecoveryRate, computed.capitalRecoveryRate,
    'incomeApproach.capitalRecoveryRate', 'Capital Recovery Rate', discrepancies, addMatches);

  count += compareField(typed.capRate, computed.capRate,
    'incomeApproach.capRate', 'Cap Rate', discrepancies, addMatches);

  count += compareField(typed.landYield, computed.landYield,
    'incomeApproach.landYield', 'Land Yield', discrepancies, addMatches);

  count += compareField(typed.buildingYield, computed.buildingYield,
    'incomeApproach.buildingYield', 'Building Yield', discrepancies, addMatches);

  count += compareField(typed.buildingPrice, computed.buildingPrice,
    'incomeApproach.buildingPrice', 'Building Price', discrepancies, addMatches);

  count += compareField(typed.total, computed.total,
    'incomeApproach.total', 'Income Approach Total', discrepancies, addMatches);

  return count;
}

function compareGRMFields(
  typed: Record<string, unknown>,
  computed: GRMResult,
  discrepancies: FieldDiscrepancy[],
  addMatches: (count: number) => void
): number {
  let count = 0;

  count += compareField(typed.annualIncome, computed.annualIncome,
    'grm.annualIncome', 'GRM Annual Income', discrepancies, addMatches);

  count += compareField(typed.netEffectiveIncome, computed.netEffectiveIncome,
    'grm.netEffectiveIncome', 'GRM Net Effective Income', discrepancies, addMatches);

  count += compareField(typed.total, computed.total,
    'grm.total', 'GRM Total', discrepancies, addMatches);

  return count;
}

/**
 * Format discrepancies for display
 */
export function formatDiscrepancies(discrepancies: FieldDiscrepancy[]): string {
  if (discrepancies.length === 0) {
    return 'All computed values match.';
  }

  return discrepancies.map(d => {
    const sign = d.computed > d.typed ? '+' : '-';
    return `${d.label}: typed ${d.typed.toLocaleString()}, computed ${d.computed.toLocaleString()} (${sign}${d.deltaPercent.toFixed(2)}%)`;
  }).join('\n');
}

/**
 * Quick check if data is likely valid for verification
 */
export function canVerify(extracted: Record<string, unknown>): boolean {
  const costData = extracted.costApproach as Record<string, unknown> | undefined;
  const incomeData = extracted.incomeApproach as Record<string, unknown> | undefined;
  const grmData = extracted.grm as Record<string, unknown> | undefined;

  // Need at least one approach with enough data
  return (
    (costData && hasRequiredCostInputs(costData)) ||
    (incomeData && hasRequiredIncomeInputs(incomeData)) ||
    (grmData && hasRequiredGRMInputs(grmData))
  );
}
