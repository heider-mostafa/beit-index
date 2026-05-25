/**
 * Zod schemas for the FRA-aligned appraisal report form.
 *
 * Two validation modes:
 *   1. Draft mode (partial) — most fields optional, for auto-save
 *   2. Finalization mode (strict) — all required fields validated
 *
 * Field names match database columns (snake_case) for direct mapping.
 */

import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────
// ENUMS (must match database and types.ts)
// ──────────────────────────────────────────────────────────────────────

export const PropertyTypeEnum = z.enum([
  "apartment",
  "villa",
  "duplex",
  "compound_unit",
  "roof",
  "commercial_shop",
  "office",
  "building",
]);

export const ReportKindEnum = z.enum([
  "brief",
  "narrative_limited",
  "narrative_full",
]);

export const TenancyEnum = z.enum(["owner_occupied", "vacant", "rented"]);

export const FinishingLevelEnum = z.enum([
  "luxury",
  "super_lux",
  "full",
  "half",
  "shell",
]);

export const SaleTimingEnum = z.enum([
  "current_offer",
  "recent_sale",
  "historical",
]);

export const PaymentTermsEnum = z.enum(["cash", "installments", "mortgage"]);

export const ChosenMethodEnum = z.enum([
  "cost",
  "sales_comparison",
  "income",
  "grm",
]);

export const PhotoCategoryEnum = z.enum([
  "facade",
  "entrance",
  "living_room",
  "bedroom",
  "bathroom",
  "kitchen",
  "balcony",
  "garden",
  "pool",
  "garage",
  "roof",
  "street_view",
  "location_map",
  "other",
]);

// ──────────────────────────────────────────────────────────────────────
// SECTION 1: PROPERTY IDENTIFICATION
// ──────────────────────────────────────────────────────────────────────

export const PropertyIdentificationSchema = z.object({
  property_type: PropertyTypeEnum.optional(),
  report_kind: ReportKindEnum.optional(),
  report_number: z.string().optional(), // External report number for imports
  tenancy: TenancyEnum.optional(),
  client_name: z.string().optional(),
  owner_name: z.string().optional(),
  appraisal_date: z.string().optional(), // ISO date string
  valid_until: z.string().optional(),
  governorate_id: z.string().uuid().optional(),
  city_id: z.string().uuid().optional(),
  district_id: z.string().uuid().optional(),
  compound_id: z.string().uuid().optional().nullable(),
  compound_name: z.string().optional(),
  building_number: z.string().optional(),
  unit_number: z.string().optional(),
  floor: z.string().optional(),
  address_description: z.string().optional(),
  plot_number: z.string().optional(),
  project_name: z.string().optional(),
});

export const PropertyIdentificationStrictSchema =
  PropertyIdentificationSchema.extend({
    property_type: PropertyTypeEnum,
    report_kind: ReportKindEnum,
    tenancy: TenancyEnum,
    client_name: z.string().min(1, "Client name is required"),
    owner_name: z.string().min(1, "Owner name is required"),
    appraisal_date: z.string().min(1, "Appraisal date is required"),
    valid_until: z.string().min(1, "Validity date is required"),
    governorate_id: z.string().uuid("Governorate is required"),
    city_id: z.string().uuid("City is required"),
    district_id: z.string().uuid("District is required"),
    address_description: z.string().min(1, "Address description is required"),
  });

// ──────────────────────────────────────────────────────────────────────
// SECTION 2: PHYSICAL CHARACTERISTICS
// ──────────────────────────────────────────────────────────────────────

export const PhysicalCharacteristicsSchema = z.object({
  project_land_area: z.number().positive().optional(),
  unit_gross_area: z.number().positive().optional(),
  unit_net_area: z.number().positive().optional(),
  unit_land_share: z.number().positive().optional(),
  services_share_percent: z.number().min(0).max(100).optional(),
  current_age: z.number().int().min(0).optional(),
  economic_life: z.number().int().positive().optional(),
  effective_age: z.number().int().min(0).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  total_rooms: z.number().int().min(0).optional(),
  finishing_level: FinishingLevelEnum.optional(),
  has_pool: z.boolean().optional(),
  orientation: z.string().optional(),
  finishings: z.record(z.string(), z.any()).optional(), // JSONB matrix
});

export const PhysicalCharacteristicsStrictSchema =
  PhysicalCharacteristicsSchema.extend({
    project_land_area: z.number().positive("Project land area is required"),
    unit_gross_area: z.number().positive("Unit gross area is required"),
    unit_net_area: z.number().positive("Unit net area is required"),
    unit_land_share: z.number().positive("Unit land share is required"),
    current_age: z.number().int().min(0, "Current age must be 0 or positive"),
    economic_life: z.number().int().positive("Economic life is required"),
    effective_age: z.number().int().min(0, "Effective age must be 0 or positive"),
    bedrooms: z.number().int().min(0),
    bathrooms: z.number().int().min(0),
    total_rooms: z.number().int().min(0),
    finishing_level: FinishingLevelEnum,
  });

// ──────────────────────────────────────────────────────────────────────
// SECTION 3: MARKET STUDY
// ──────────────────────────────────────────────────────────────────────

export const MarketStudySchema = z.object({
  market_bldg_halffinish_low: z.number().min(0).optional(),
  market_bldg_halffinish_high: z.number().min(0).optional(),
  market_bldg_fullfinish_low: z.number().min(0).optional(),
  market_bldg_fullfinish_high: z.number().min(0).optional(),
  market_land_low: z.number().min(0).optional(),
  market_land_high: z.number().min(0).optional(),
  market_services_low: z.number().min(0).optional(),
  market_services_high: z.number().min(0).optional(),
  market_notes: z.string().optional(),
});

// Market study is optional for finalization but if provided, ranges should make sense
export const MarketStudyStrictSchema = MarketStudySchema.refine(
  (data) => {
    if (
      data.market_bldg_halffinish_low !== undefined &&
      data.market_bldg_halffinish_high !== undefined
    ) {
      return data.market_bldg_halffinish_low <= data.market_bldg_halffinish_high;
    }
    return true;
  },
  { message: "Half-finish low must be <= high", path: ["market_bldg_halffinish_low"] }
).refine(
  (data) => {
    if (
      data.market_land_low !== undefined &&
      data.market_land_high !== undefined
    ) {
      return data.market_land_low <= data.market_land_high;
    }
    return true;
  },
  { message: "Land price low must be <= high", path: ["market_land_low"] }
);

// ──────────────────────────────────────────────────────────────────────
// SECTION 4: COST APPROACH
// ──────────────────────────────────────────────────────────────────────

export const CostApproachSchema = z.object({
  cost_land_price_per_sqm: z.number().min(0).optional(),
  cost_allowed_floors: z.number().int().positive().optional(),
  cost_current_floors: z.number().int().positive().optional(),
  cost_total_built_area: z.number().min(0).optional(),
  cost_unit_area_to_value: z.number().positive().optional(),
  cost_construction_per_sqm: z.number().min(0).optional(),
  cost_repairable_depreciation: z.number().min(0).optional(),
  cost_garden_value: z.number().min(0).optional(),
  cost_garage_value: z.number().min(0).optional(),
  cost_storage_value: z.number().min(0).optional(),
  // Computed field (stored for query speed)
  cost_total: z.number().optional(),
});

export const CostApproachStrictSchema = CostApproachSchema.extend({
  cost_land_price_per_sqm: z.number().min(0, "Land price per sqm is required"),
  cost_construction_per_sqm: z.number().min(0, "Construction cost is required"),
  cost_unit_area_to_value: z.number().positive("Unit area to value is required"),
});

// ──────────────────────────────────────────────────────────────────────
// SECTION 5: SALES COMPARISON
// ──────────────────────────────────────────────────────────────────────

export const ComparableSchema = z.object({
  id: z.string().uuid().optional(), // For existing comparables
  ord: z.number().int().positive(),
  address: z.string().min(1),
  source: z.string().min(1),
  proximity: z.string().optional(),
  floor: z.string().optional(),
  sale_timing: SaleTimingEnum,
  tenancy: TenancyEnum,
  age_years: z.number().int().min(0).optional(),
  orientation: z.string().optional(),
  payment_terms: PaymentTermsEnum,
  finishing_level: z.string().optional(),
  condition: z.string().optional(),
  location_quality: z.string().optional(),
  garage_share: z.number().min(0).optional(),
  building_area_sqm: z.number().positive(),
  land_area_sqm: z.number().positive(),
  has_pool: z.boolean(),
  building_price_per_sqm: z.number().positive(),
  sale_price: z.number().positive(),
  weight: z.number().min(0).max(1).optional(),
});

export const SalesComparisonSchema = z.object({
  sales_subject_building_area: z.number().positive().optional(),
  sales_subject_land_area: z.number().positive().optional(),
  sales_final_value: z.number().positive().optional(),
  sales_narrative: z.string().optional(),
  comparables: z.array(ComparableSchema).optional(),
});

export const SalesComparisonStrictSchema = SalesComparisonSchema.extend({
  sales_subject_building_area: z.number().positive("Subject building area required"),
  sales_final_value: z.number().positive("Final value is required"),
  comparables: z.array(ComparableSchema).min(1, "At least one comparable required"),
});

// ──────────────────────────────────────────────────────────────────────
// SECTION 6: INCOME CAPITALIZATION
// ──────────────────────────────────────────────────────────────────────

export const IncomeApproachSchema = z.object({
  income_monthly_rent: z.number().min(0).optional(),
  income_vacancy_rate: z.number().min(0).max(1).optional(), // 0-1 decimal
  income_remaining_life: z.number().int().positive().optional(),
  income_interest_rate: z.number().min(0).max(100).optional(), // percentage
  // Computed field
  income_total: z.number().optional(),
});

export const IncomeApproachStrictSchema = IncomeApproachSchema.extend({
  income_monthly_rent: z.number().min(0, "Monthly rent is required"),
  income_remaining_life: z.number().int().positive("Remaining life is required"),
  income_interest_rate: z.number().min(0).max(100, "Interest rate is required"),
});

// ──────────────────────────────────────────────────────────────────────
// SECTION 7: GROSS RENT MULTIPLIER
// ──────────────────────────────────────────────────────────────────────

export const GRMSchema = z.object({
  grm_monthly_rent: z.number().min(0).optional(),
  grm_multiplier: z.number().positive().optional(),
  grm_vacancy_amount: z.number().min(0).optional(),
  // Computed field
  grm_total: z.number().optional(),
});

export const GRMStrictSchema = GRMSchema.extend({
  grm_monthly_rent: z.number().min(0, "GRM monthly rent is required"),
  grm_multiplier: z.number().positive("GRM multiplier is required"),
});

// ──────────────────────────────────────────────────────────────────────
// SECTION 8: RECONCILIATION
// ──────────────────────────────────────────────────────────────────────

export const ReconciliationSchema = z.object({
  chosen_method: ChosenMethodEnum.optional(),
  reconciliation_rationale: z.string().optional(),
  final_value: z.number().positive().optional(),
  land_value: z.number().min(0).optional(),
  building_value: z.number().optional(), // Can be computed
  monthly_rent_reconciled: z.number().min(0).optional(),
});

export const ReconciliationStrictSchema = ReconciliationSchema.extend({
  chosen_method: ChosenMethodEnum,
  reconciliation_rationale: z.string().min(10, "Rationale must be at least 10 characters"),
  final_value: z.number().positive("Final value is required"),
  land_value: z.number().min(0, "Land value is required"),
});

// ──────────────────────────────────────────────────────────────────────
// SECTION 9: PHOTOS
// ──────────────────────────────────────────────────────────────────────

export const PhotoSchema = z.object({
  id: z.string().uuid().optional(),
  storage_path: z.string().min(1),
  category: PhotoCategoryEnum,
  caption: z.string().optional(),
  ord: z.number().int().min(0),
});

export const PhotosSchema = z.object({
  photos: z.array(PhotoSchema).optional(),
});

// Photos are optional for finalization
export const PhotosStrictSchema = PhotosSchema;

// ──────────────────────────────────────────────────────────────────────
// SECTION 10: DECLARATIONS
// ──────────────────────────────────────────────────────────────────────

export const DeclarationsSchema = z.object({
  // These are typically booleans confirming appraiser declarations
  declaration_independence: z.boolean().optional(),
  declaration_no_conflict: z.boolean().optional(),
  declaration_site_visit: z.boolean().optional(),
  declaration_fra_compliance: z.boolean().optional(),
});

export const DeclarationsStrictSchema = z.object({
  declaration_independence: z.literal(true, { message: "Must confirm independence" }),
  declaration_no_conflict: z.literal(true, { message: "Must confirm no conflict of interest" }),
  declaration_site_visit: z.literal(true, { message: "Must confirm site visit" }),
  declaration_fra_compliance: z.literal(true, { message: "Must confirm FRA compliance" }),
});

// ──────────────────────────────────────────────────────────────────────
// COMPLETE REPORT SCHEMA
// ──────────────────────────────────────────────────────────────────────

/**
 * Draft schema - for auto-save, most fields optional
 */
export const ReportDraftSchema = z.object({
  // Meta
  id: z.string().uuid().optional(),
  template_id: z.string().optional(),
  version: z.number().int().optional(),

  // Sections
  ...PropertyIdentificationSchema.shape,
  ...PhysicalCharacteristicsSchema.shape,
  ...MarketStudySchema.shape,
  ...CostApproachSchema.shape,
  ...SalesComparisonSchema.shape,
  ...IncomeApproachSchema.shape,
  ...GRMSchema.shape,
  ...ReconciliationSchema.shape,
  ...DeclarationsSchema.shape,

  // Photos handled separately via report_photos table
});

/**
 * Finalization schema - strict validation before generating PDF
 */
export const ReportFinalizeSchema = z.object({
  // Meta
  id: z.string().uuid(),
  template_id: z.string().min(1),
  version: z.number().int().positive(),

  // Sections - using strict schemas
  ...PropertyIdentificationStrictSchema.shape,
  ...PhysicalCharacteristicsStrictSchema.shape,
  ...MarketStudySchema.shape, // Market study optional
  ...CostApproachStrictSchema.shape,
  ...SalesComparisonStrictSchema.shape,
  ...IncomeApproachStrictSchema.shape,
  ...GRMSchema.shape, // GRM optional (not always used)
  ...ReconciliationStrictSchema.shape,
  ...DeclarationsStrictSchema.shape,
});

// ──────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ──────────────────────────────────────────────────────────────────────

export type PropertyIdentification = z.infer<typeof PropertyIdentificationSchema>;
export type PhysicalCharacteristics = z.infer<typeof PhysicalCharacteristicsSchema>;
export type MarketStudy = z.infer<typeof MarketStudySchema>;
export type CostApproach = z.infer<typeof CostApproachSchema>;
export type Comparable = z.infer<typeof ComparableSchema>;
export type SalesComparison = z.infer<typeof SalesComparisonSchema>;
export type IncomeApproach = z.infer<typeof IncomeApproachSchema>;
export type GRM = z.infer<typeof GRMSchema>;
export type Reconciliation = z.infer<typeof ReconciliationSchema>;
export type Photo = z.infer<typeof PhotoSchema>;
export type Declarations = z.infer<typeof DeclarationsSchema>;
export type ReportDraft = z.infer<typeof ReportDraftSchema>;
export type ReportFinalize = z.infer<typeof ReportFinalizeSchema>;

// ──────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ──────────────────────────────────────────────────────────────────────

/**
 * Validates report data for auto-save (lenient)
 */
export function validateDraft(data: unknown) {
  return ReportDraftSchema.safeParse(data);
}

/**
 * Validates report data for finalization (strict)
 */
export function validateForFinalization(data: unknown) {
  return ReportFinalizeSchema.safeParse(data);
}

/**
 * Get section-specific validation errors
 */
export function getSectionErrors(errors: z.ZodError) {
  const sections: Record<string, string[]> = {
    identification: [],
    physical: [],
    market: [],
    cost: [],
    sales: [],
    income: [],
    grm: [],
    reconciliation: [],
    photos: [],
    declarations: [],
  };

  for (const issue of errors.issues) {
    const path = issue.path[0]?.toString() || "";

    if (path.startsWith("property_") || path.startsWith("client_") || path.startsWith("owner_") ||
        path.startsWith("appraisal_") || path.startsWith("valid_") || path.includes("_id") ||
        path.startsWith("address") || path.startsWith("project_name") || path.startsWith("report_kind") ||
        path.startsWith("tenancy") || path.startsWith("building_number") || path.startsWith("unit_number") ||
        path.startsWith("floor") || path.startsWith("plot_")) {
      sections.identification.push(issue.message);
    } else if (path.startsWith("unit_") || path.startsWith("project_land") || path.startsWith("services_") ||
               path.startsWith("current_age") || path.startsWith("economic_") || path.startsWith("effective_") ||
               path.startsWith("bedrooms") || path.startsWith("bathrooms") || path.startsWith("total_rooms") ||
               path.startsWith("finishing") || path.startsWith("has_pool") || path.startsWith("orientation")) {
      sections.physical.push(issue.message);
    } else if (path.startsWith("market_")) {
      sections.market.push(issue.message);
    } else if (path.startsWith("cost_")) {
      sections.cost.push(issue.message);
    } else if (path.startsWith("sales_") || path.startsWith("comparables")) {
      sections.sales.push(issue.message);
    } else if (path.startsWith("income_")) {
      sections.income.push(issue.message);
    } else if (path.startsWith("grm_")) {
      sections.grm.push(issue.message);
    } else if (path.startsWith("chosen_") || path.startsWith("reconciliation_") ||
               path.startsWith("final_") || path.startsWith("land_value") || path.startsWith("building_value") ||
               path.startsWith("monthly_rent_reconciled")) {
      sections.reconciliation.push(issue.message);
    } else if (path.startsWith("declaration_")) {
      sections.declarations.push(issue.message);
    } else if (path.startsWith("photos")) {
      sections.photos.push(issue.message);
    }
  }

  return sections;
}

// ──────────────────────────────────────────────────────────────────────
// DATABASE MAPPING HELPERS
// ──────────────────────────────────────────────────────────────────────

/**
 * Maps form data to database columns for the reports table
 */
export function mapFormToDatabase(form: ReportDraft) {
  return {
    // Property identification (stored on reports + properties)
    project_name: form.project_name,
    report_kind: form.report_kind,
    tenancy: form.tenancy,
    owner_name: form.owner_name,
    client_name: form.client_name,
    appraisal_date: form.appraisal_date,
    valid_until: form.valid_until,

    // Physical characteristics
    project_land_area: form.project_land_area,
    unit_gross_area: form.unit_gross_area,
    unit_net_area: form.unit_net_area,
    unit_land_share: form.unit_land_share,
    services_share_percent: form.services_share_percent,
    current_age: form.current_age,
    economic_life: form.economic_life,
    effective_age: form.effective_age,
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    total_rooms: form.total_rooms,
    has_pool: form.has_pool,
    orientation: form.orientation,
    finishing_level: form.finishing_level,
    finishings: form.finishings,

    // Market study
    market_bldg_halffinish_low: form.market_bldg_halffinish_low,
    market_bldg_halffinish_high: form.market_bldg_halffinish_high,
    market_bldg_fullfinish_low: form.market_bldg_fullfinish_low,
    market_bldg_fullfinish_high: form.market_bldg_fullfinish_high,
    market_land_low: form.market_land_low,
    market_land_high: form.market_land_high,
    market_services_low: form.market_services_low,
    market_services_high: form.market_services_high,
    market_notes: form.market_notes,

    // Cost approach
    cost_land_price_per_sqm: form.cost_land_price_per_sqm,
    cost_allowed_floors: form.cost_allowed_floors,
    cost_current_floors: form.cost_current_floors,
    cost_total_built_area: form.cost_total_built_area,
    cost_unit_area_to_value: form.cost_unit_area_to_value,
    cost_construction_per_sqm: form.cost_construction_per_sqm,
    cost_repairable_depreciation: form.cost_repairable_depreciation,
    cost_garden_value: form.cost_garden_value,
    cost_garage_value: form.cost_garage_value,
    cost_storage_value: form.cost_storage_value,
    cost_total: form.cost_total,

    // Sales comparison
    sales_subject_building_area: form.sales_subject_building_area,
    sales_subject_land_area: form.sales_subject_land_area,
    sales_final_value: form.sales_final_value,
    sales_narrative: form.sales_narrative,

    // Income approach
    income_monthly_rent: form.income_monthly_rent,
    income_vacancy_rate: form.income_vacancy_rate,
    income_remaining_life: form.income_remaining_life,
    income_interest_rate: form.income_interest_rate,
    income_total: form.income_total,

    // GRM
    grm_monthly_rent: form.grm_monthly_rent,
    grm_multiplier: form.grm_multiplier,
    grm_vacancy_amount: form.grm_vacancy_amount,
    grm_total: form.grm_total,

    // Reconciliation
    chosen_method: form.chosen_method,
    reconciliation_rationale: form.reconciliation_rationale,
    final_value: form.final_value,
    land_value: form.land_value,
    building_value: form.building_value,
    monthly_rent_reconciled: form.monthly_rent_reconciled,
  };
}

/**
 * Maps database row to form data
 */
export function mapDatabaseToForm(row: Record<string, unknown>): ReportDraft {
  return {
    id: row.id as string,
    template_id: row.template_id as string,
    version: row.version as number,

    // Property identification
    property_type: row.property_type as ReportDraft["property_type"],
    report_kind: row.report_kind as ReportDraft["report_kind"],
    tenancy: row.tenancy as ReportDraft["tenancy"],
    client_name: row.client_name as string,
    owner_name: row.owner_name as string,
    appraisal_date: row.appraisal_date as string,
    valid_until: row.valid_until as string,
    governorate_id: row.governorate_id as string,
    city_id: row.city_id as string,
    district_id: row.district_id as string,
    compound_id: row.compound_id as string | null,
    building_number: row.building_number as string,
    unit_number: row.unit_number as string,
    floor: row.floor as string,
    address_description: row.address_description as string,
    plot_number: row.plot_number as string,
    project_name: row.project_name as string,

    // Physical characteristics
    project_land_area: row.project_land_area as number,
    unit_gross_area: row.unit_gross_area as number,
    unit_net_area: row.unit_net_area as number,
    unit_land_share: row.unit_land_share as number,
    services_share_percent: row.services_share_percent as number,
    current_age: row.current_age as number,
    economic_life: row.economic_life as number,
    effective_age: row.effective_age as number,
    bedrooms: row.bedrooms as number,
    bathrooms: row.bathrooms as number,
    total_rooms: row.total_rooms as number,
    has_pool: row.has_pool as boolean,
    orientation: row.orientation as string,
    finishing_level: row.finishing_level as ReportDraft["finishing_level"],
    finishings: row.finishings as Record<string, unknown>,

    // Market study
    market_bldg_halffinish_low: row.market_bldg_halffinish_low as number,
    market_bldg_halffinish_high: row.market_bldg_halffinish_high as number,
    market_bldg_fullfinish_low: row.market_bldg_fullfinish_low as number,
    market_bldg_fullfinish_high: row.market_bldg_fullfinish_high as number,
    market_land_low: row.market_land_low as number,
    market_land_high: row.market_land_high as number,
    market_services_low: row.market_services_low as number,
    market_services_high: row.market_services_high as number,
    market_notes: row.market_notes as string,

    // Cost approach
    cost_land_price_per_sqm: row.cost_land_price_per_sqm as number,
    cost_allowed_floors: row.cost_allowed_floors as number,
    cost_current_floors: row.cost_current_floors as number,
    cost_total_built_area: row.cost_total_built_area as number,
    cost_unit_area_to_value: row.cost_unit_area_to_value as number,
    cost_construction_per_sqm: row.cost_construction_per_sqm as number,
    cost_repairable_depreciation: row.cost_repairable_depreciation as number,
    cost_garden_value: row.cost_garden_value as number,
    cost_garage_value: row.cost_garage_value as number,
    cost_storage_value: row.cost_storage_value as number,
    cost_total: row.cost_total as number,

    // Sales comparison
    sales_subject_building_area: row.sales_subject_building_area as number,
    sales_subject_land_area: row.sales_subject_land_area as number,
    sales_final_value: row.sales_final_value as number,
    sales_narrative: row.sales_narrative as string,

    // Income approach
    income_monthly_rent: row.income_monthly_rent as number,
    income_vacancy_rate: row.income_vacancy_rate as number,
    income_remaining_life: row.income_remaining_life as number,
    income_interest_rate: row.income_interest_rate as number,
    income_total: row.income_total as number,

    // GRM
    grm_monthly_rent: row.grm_monthly_rent as number,
    grm_multiplier: row.grm_multiplier as number,
    grm_vacancy_amount: row.grm_vacancy_amount as number,
    grm_total: row.grm_total as number,

    // Reconciliation
    chosen_method: row.chosen_method as ReportDraft["chosen_method"],
    reconciliation_rationale: row.reconciliation_rationale as string,
    final_value: row.final_value as number,
    land_value: row.land_value as number,
    building_value: row.building_value as number,
    monthly_rent_reconciled: row.monthly_rent_reconciled as number,

    // Declarations (may be stored separately or in JSONB)
    declaration_independence: row.declaration_independence as boolean,
    declaration_no_conflict: row.declaration_no_conflict as boolean,
    declaration_site_visit: row.declaration_site_visit as boolean,
    declaration_fra_compliance: row.declaration_fra_compliance as boolean,
  };
}
