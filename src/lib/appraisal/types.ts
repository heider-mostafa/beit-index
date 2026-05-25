/**
 * Type definitions for the FRA-aligned appraisal calculation engine.
 *
 * These types mirror the inputs and outputs of the Excel template
 * (Villa Solia / Amlak format, version 2015 FRA standard).
 */

// ──────────────────────────────────────────────────────────────────────
// ENUMS
// ──────────────────────────────────────────────────────────────────────

export type PropertyType = 'apartment' | 'villa' | 'duplex' | 'compound_unit' | 'roof';
export type ReportKind = 'brief' | 'narrative_limited' | 'narrative_full';
export type Tenancy = 'owner_occupied' | 'vacant' | 'rented';
export type FinishingLevel = 'luxury' | 'super_lux' | 'full' | 'half' | 'shell';
export type SaleTiming = 'current_offer' | 'recent_sale' | 'historical';
export type PaymentTerms = 'cash' | 'installments' | 'mortgage';
export type ChosenMethod = 'cost' | 'sales_comparison' | 'income' | 'grm';

// ──────────────────────────────────────────────────────────────────────
// COST APPROACH — Excel rows 160-182
// ──────────────────────────────────────────────────────────────────────

export interface CostApproachInput {
  /** J162 / H165 — Land price per m² for highest & best use */
  landPricePerSqm: number;
  /** A164 — Allowed floors in the area */
  allowedFloors: number;
  /** K164 — Current floors built */
  currentFloors: number;
  /** A166 — Total built area in the building (decorative in this template) */
  totalBuiltAreaInBuilding: number;
  /** K166 ← G7 — Project land area (unit's share of land) */
  projectLandArea: number;
  /** K167 ← M7 — Unit area to value (gross area) */
  unitAreaToValue: number;
  /** I171 — Construction cost per m² */
  constructionCostPerSqm: number;
  /** B173 — Economic life in years */
  economicLife: number;
  /** K173 — Effective age in years */
  effectiveAge: number;
  /** K174 — Repairable depreciation (usually 0) */
  repairableDepreciation: number;
  /** J179 — Garden share value (optional) */
  gardenShareValue?: number;
  /** A179 — Garage share value (optional) */
  garageShareValue?: number;
  /** J180 — Storage room value (optional) */
  storageRoomValue?: number;
}

export interface CostApproachResult {
  /** H165 — Land price for highest & best use */
  landPriceForHighestBestUse: number;
  /** G168 — Unit's share of land area */
  unitShareOfLandArea: number;
  /** G169 — Unit's share of land value */
  unitShareOfLandValue: number;
  /** I172 — Unit construction cost */
  unitConstructionCost: number;
  /** I176 — Irreparable depreciation */
  irreparableDepreciation: number;
  /** I178 — Total depreciation */
  totalDepreciation: number;
  /** I182 — COST APPROACH TOTAL */
  total: number;
}

// ──────────────────────────────────────────────────────────────────────
// SALES COMPARISON APPROACH — Excel rows 189-217
// ──────────────────────────────────────────────────────────────────────

export interface Comparable {
  /** Address of the comparable property */
  address: string;
  /** Source of information (e.g. "sales agent") */
  source: string;
  /** Proximity to subject (e.g. "same compound") */
  proximity?: string;
  /** Floor description */
  floor?: string;
  /** When the sale occurred */
  saleTiming: SaleTiming;
  /** Occupancy status */
  tenancy: Tenancy;
  /** Age in years */
  ageYears?: number;
  /** Orientation (e.g. "western") */
  orientation?: string;
  /** Payment terms */
  paymentTerms: PaymentTerms;
  /** Finishing level description */
  finishingLevel?: string;
  /** Property condition */
  condition?: string;
  /** Location quality assessment */
  locationQuality?: string;
  /** Garage share value (optional) */
  garageShare?: number;
  /** Building area in m² */
  buildingAreaSqm: number;
  /** Land area in m² */
  landAreaSqm: number;
  /** Has swimming pool */
  hasPool: boolean;
  /** Building price per m² */
  buildingPricePerSqm: number;
  /** Total sale price */
  salePrice: number;
  /** Weight for averaging (default 1) */
  weight?: number;
}

export interface EnrichedComparable extends Comparable {
  /** Computed: salePrice - (buildingPricePerSqm × buildingAreaSqm) */
  derivedLandValue: number;
}

export interface SalesComparisonInput {
  /** J37 — Subject property's building area */
  subjectBuildingArea: number;
  /** J38 — Subject property's land area */
  subjectLandArea: number;
  /** List of comparable properties (1-5 typically) */
  comparables: Comparable[];
  /** B216 — Appraiser's final reconciled value */
  finalValue: number;
  /** B215 — Narrative explaining the comparison */
  narrative?: string;
}

export interface SalesComparisonResult {
  /** Enriched comparables with derived values */
  comparables: EnrichedComparable[];
  /** Weighted average implied value (sanity check) */
  weightedImpliedValue: number;
  /** B216 — The appraiser's chosen final value */
  appraiserReconciled: number;
}

// ──────────────────────────────────────────────────────────────────────
// INCOME CAPITALIZATION APPROACH — Excel rows 218-228
// ──────────────────────────────────────────────────────────────────────

export interface IncomeApproachInput {
  /** L219 — Monthly rent estimate */
  monthlyRent: number;
  /** Vacancy & expenses rate (default 0.10 = 10%) */
  vacancyAndExpensesRate: number;
  /** C222 — Remaining life = economic_life - effective_age */
  remainingLife: number;
  /** L223 — Interest rate (e.g. 10 for 10%) */
  interestRate: number;
  /** K222 = G169 — Unit's share of land value */
  unitLandShareValue: number;
}

export interface IncomeApproachResult {
  /** J220 — Annual income (monthlyRent × 12) */
  annualIncome: number;
  /** C220 — Vacancy & expenses amount */
  vacancyAndExpenses: number;
  /** A221 — Net effective income */
  netEffectiveIncome: number;
  /** C223 — Capital recovery rate (100 / remainingLife) */
  capitalRecoveryRate: number;
  /** C224 — Cap rate (capitalRecoveryRate + interestRate) */
  capRate: number;
  /** C225 — Land yield */
  landYield: number;
  /** C226 — Building yield */
  buildingYield: number;
  /** C227 — Building price */
  buildingPrice: number;
  /** C228 — INCOME APPROACH TOTAL */
  total: number;
}

// ──────────────────────────────────────────────────────────────────────
// GROSS RENT MULTIPLIER — Excel rows 230-235
// ──────────────────────────────────────────────────────────────────────

export interface GRMInput {
  /** A231 — Income multiplier (typically 12-14) */
  incomeMultiplier: number;
  /** L231 — Monthly rent for GRM (often lower than income approach) */
  monthlyRent: number;
  /** L233 — Vacancy & expenses (absolute amount, often reused from income approach) */
  vacancyAndExpenses: number;
}

export interface GRMResult {
  /** C232 — Annual income (monthlyRent × 12) */
  annualIncome: number;
  /** A234 — Net effective income */
  netEffectiveIncome: number;
  /** A235 — GRM TOTAL */
  total: number;
}

// ──────────────────────────────────────────────────────────────────────
// RECONCILIATION — Excel rows 246-263
// ──────────────────────────────────────────────────────────────────────

export interface Reconciliation {
  /** I182 — Cost approach total */
  costApproachValue: number;
  /** B216 — Sales comparison final value */
  salesComparisonValue: number;
  /** C228 — Income approach total */
  incomeApproachValue: number;
  /** A235 — GRM total */
  grmValue: number;
  /** The method chosen by the appraiser */
  chosenMethod: ChosenMethod;
  /** Rationale for choosing this method */
  rationale: string;
  /** J261 — Final value (from chosen method) */
  finalValue: number;
  /** J262 — Land value portion */
  landValue: number;
  /** J263 — Building value portion (finalValue - landValue) */
  buildingValue: number;
  /** J264 — Reconciled monthly rent */
  monthlyRentReconciled: number;
}

// ──────────────────────────────────────────────────────────────────────
// FULL REPORT STRUCTURE
// ──────────────────────────────────────────────────────────────────────

export interface AppraisalReport {
  costApproach: CostApproachInput;
  salesComparison: SalesComparisonInput;
  incomeApproach: IncomeApproachInput;
  grm: GRMInput;
  reconciliation: {
    chosenMethod: ChosenMethod;
    rationale: string;
    monthlyRentReconciled: number;
  };
}

// ──────────────────────────────────────────────────────────────────────
// MARKET STUDY
// ──────────────────────────────────────────────────────────────────────

export interface MarketStudy {
  /** Building price range for half-finished properties */
  buildingHalfFinishLow: number;
  buildingHalfFinishHigh: number;
  /** Building price range for full-finished properties */
  buildingFullFinishLow: number;
  buildingFullFinishHigh: number;
  /** Land price range */
  landPriceLow: number;
  landPriceHigh: number;
  /** Services & utilities range */
  servicesLow: number;
  servicesHigh: number;
  /** Market notes / trends description */
  notes: string;
}

// ──────────────────────────────────────────────────────────────────────
// PROPERTY IDENTIFICATION
// ──────────────────────────────────────────────────────────────────────

export interface PropertyIdentification {
  propertyType: PropertyType;
  reportKind: ReportKind;
  tenancy: Tenancy;
  clientName: string;
  ownerName: string;
  appraisalDate: string; // ISO date
  validUntil: string; // ISO date
  governorateId: string;
  cityId: string;
  districtId: string;
  compoundName?: string;
  buildingNumber?: string;
  unitNumber?: string;
  floor?: string;
  addressDescription: string;
  plotNumber?: string;
}

// ──────────────────────────────────────────────────────────────────────
// PHYSICAL CHARACTERISTICS
// ──────────────────────────────────────────────────────────────────────

export interface PhysicalCharacteristics {
  /** G7 — Project land area */
  projectLandArea: number;
  /** M7 — Unit gross area (includes services share) */
  unitGrossArea: number;
  /** J37 — Unit net area (without services) */
  unitNetArea: number;
  /** J39 — Unit land share */
  unitLandShare: number;
  /** A40 — Current age in years */
  currentAge: number;
  /** A41 — Economic life in years (default 60) */
  economicLife: number;
  /** J41 — Effective age in years */
  effectiveAge: number;
  /** Number of bedrooms */
  bedrooms: number;
  /** Number of bathrooms */
  bathrooms: number;
  /** Total rooms */
  totalRooms: number;
  /** Finishing level */
  finishingLevel: FinishingLevel;
  /** Has swimming pool */
  hasPool: boolean;
  /** Orientation (e.g. "western", "northeast") */
  orientation?: string;
}
