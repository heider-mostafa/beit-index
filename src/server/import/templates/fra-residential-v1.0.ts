/**
 * Cell map for FRA Residential Template v1.0 (Villa Solia / Amlak format)
 *
 * This maps Excel cell addresses to their semantic meaning in the appraisal report.
 * The structure matches src/lib/appraisal/types.ts
 */

export interface CellMapping {
  cell: string; // Excel cell address e.g. "J162"
  path: string; // Dot-notation path in extracted data e.g. "costApproach.landPricePerSqm"
  type: 'number' | 'string' | 'date' | 'boolean';
  required?: boolean;
  transform?: (value: unknown) => unknown;
}

export const FRA_RESIDENTIAL_V1_FINGERPRINT = {
  // Cells that identify this template version (based on Villa Solia / Amlak format)
  checks: [
    { cell: 'A1', contains: 'تقرير تقييم' }, // "Appraisal Report" header
    { cell: 'O13', contains: 'نتيجة التقييم' }, // "Result of appraisal" label
    { cell: 'E173', contains: 'العمر الاقتصادى' }, // "Economic life" in cost section
    { cell: 'A230', contains: 'مضاعف الدخل' }, // "Income multiplier" (GRM section)
    { cell: 'A260', contains: 'القيمة النهائية' }, // "Final value" label
  ],
  minMatches: 2, // At least 2 must match (more lenient for variations)
};

export const FRA_RESIDENTIAL_V1_CELLS: CellMapping[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // IDENTIFICATION (Sheet header area - RTL layout)
  // Based on Villa Solia inspection:
  // Row 1: A1=reg number (40), I1=appraiser name
  // Row 2: A2=appraisal date, I2=valid until date
  // Row 3: A3=governorate (Giza), E3=city (road), I3=compound name
  // Row 4: A4=property description (merged across)
  // Row 6: G6=floor
  // Row 8: K8=property type (villa/apartment)
  // Row 11: report kind indicators
  // Row 12: G12=tenancy (خالية=vacant)
  // Row 13: M13=final value
  // ═══════════════════════════════════════════════════════════════════════
  { cell: 'I1', path: 'identification.appraiserName', type: 'string', required: false },
  { cell: 'A2', path: 'identification.appraisalDate', type: 'date', required: false },
  { cell: 'I2', path: 'identification.validUntil', type: 'date' },
  { cell: 'A4', path: 'identification.addressDescription', type: 'string', required: false },
  { cell: 'A3', path: 'identification.governorate', type: 'string' },
  { cell: 'E3', path: 'identification.city', type: 'string' },
  { cell: 'I3', path: 'identification.compoundName', type: 'string' },
  { cell: 'G6', path: 'identification.floor', type: 'string' },

  // Property type (needs mapping from Arabic) - K8 contains villa/apartment type
  {
    cell: 'K8',
    path: 'identification.propertyType',
    type: 'string',
    transform: (v) => mapPropertyType(String(v)),
  },
  // Tenancy - G12 contains خالية (vacant) / مستأجر (rented) / مالك (owner)
  {
    cell: 'G12',
    path: 'identification.tenancy',
    type: 'string',
    transform: (v) => mapTenancy(String(v)),
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PHYSICAL CHARACTERISTICS (Excel rows ~36-50)
  // Based on Villa Solia inspection:
  // Row 7: G7="457" (land area), M7="420" (gross area)
  // Row 37: A37/J37="420" (net area)
  // Row 38: J38="457" (property land area)
  // Row 39: J39="457" (unit land share)
  // Row 40: A40="5" (current age), J40="59" (remaining life)
  // Row 41: A41="60" (economic life), J41="1" (effective age)
  // Row 42: A42 contains finishing level text (تشطيب كامل)
  // ═══════════════════════════════════════════════════════════════════════
  { cell: 'G7', path: 'physical.projectLandArea', type: 'number', required: false },
  { cell: 'M7', path: 'physical.unitGrossArea', type: 'number', required: false },
  { cell: 'A37', path: 'physical.unitNetArea', type: 'number', required: false },
  { cell: 'J39', path: 'physical.unitLandShare', type: 'number', required: false },
  { cell: 'A40', path: 'physical.currentAge', type: 'number', required: false },
  { cell: 'A41', path: 'physical.economicLife', type: 'number' },
  { cell: 'J41', path: 'physical.effectiveAge', type: 'number' },
  { cell: 'J40', path: 'physical.remainingLife', type: 'number' },
  // Finishing level is in A42 as text containing the level
  {
    cell: 'A42',
    path: 'physical.finishingLevel',
    type: 'string',
    transform: (v) => mapFinishingLevel(String(v)),
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MARKET STUDY (Excel rows ~100-130)
  // ═══════════════════════════════════════════════════════════════════════
  { cell: 'D105', path: 'marketStudy.buildingHalfFinishLow', type: 'number' },
  { cell: 'F105', path: 'marketStudy.buildingHalfFinishHigh', type: 'number' },
  { cell: 'D106', path: 'marketStudy.buildingFullFinishLow', type: 'number' },
  { cell: 'F106', path: 'marketStudy.buildingFullFinishHigh', type: 'number' },
  { cell: 'D107', path: 'marketStudy.landPriceLow', type: 'number' },
  { cell: 'F107', path: 'marketStudy.landPriceHigh', type: 'number' },
  { cell: 'D108', path: 'marketStudy.servicesLow', type: 'number' },
  { cell: 'F108', path: 'marketStudy.servicesHigh', type: 'number' },
  { cell: 'A120', path: 'marketStudy.notes', type: 'string' },

  // ═══════════════════════════════════════════════════════════════════════
  // COST APPROACH (Excel rows 160-182)
  // Based on Villa Solia inspection:
  // Row 162: J162="21,000" (land price per sqm)
  // Row 164: A164="3" (allowed floors), K164="3" (current floors)
  // Row 166: A166="6,000" (total built area), K166="457" (project land area)
  // Row 167: K167="420" (unit area to value)
  // Row 168: G168="457" (unit share of land)
  // Row 169: G169="9,597,000" (unit land value)
  // Row 171: I171="25,000" (construction cost per sqm)
  // Row 172: I172="10,500,000" (unit construction cost)
  // Row 173: B173="60" (economic life), K173="1" (effective age)
  // Row 174: K174="0" (repairable depreciation)
  // Row 182: I182="19,922,000" (cost total)
  // ═══════════════════════════════════════════════════════════════════════
  { cell: 'J162', path: 'costApproach.landPricePerSqm', type: 'number', required: false },
  { cell: 'A164', path: 'costApproach.allowedFloors', type: 'number', required: false },
  { cell: 'K164', path: 'costApproach.currentFloors', type: 'number', required: false },
  { cell: 'A166', path: 'costApproach.totalBuiltAreaInBuilding', type: 'number' },
  { cell: 'K166', path: 'costApproach.projectLandArea', type: 'number' },
  { cell: 'K167', path: 'costApproach.unitAreaToValue', type: 'number' },
  { cell: 'I171', path: 'costApproach.constructionCostPerSqm', type: 'number', required: false },
  { cell: 'B173', path: 'costApproach.economicLife', type: 'number', required: false },
  { cell: 'K173', path: 'costApproach.effectiveAge', type: 'number', required: false },
  { cell: 'K174', path: 'costApproach.repairableDepreciation', type: 'number' },

  // Cost approach computed cells (for verification)
  { cell: 'H165', path: 'costApproach._computed.landPriceForHighestBestUse', type: 'number' },
  { cell: 'G168', path: 'costApproach._computed.unitShareOfLandArea', type: 'number' },
  { cell: 'G169', path: 'costApproach._computed.unitShareOfLandValue', type: 'number' },
  { cell: 'I172', path: 'costApproach._computed.unitConstructionCost', type: 'number' },
  { cell: 'I182', path: 'costApproach._computed.total', type: 'number' },

  // ═══════════════════════════════════════════════════════════════════════
  // SALES COMPARISON (Excel rows 189-217)
  // ═══════════════════════════════════════════════════════════════════════
  // Subject property
  { cell: 'J37', path: 'salesComparison.subjectBuildingArea', type: 'number' }, // Same as unitNetArea
  { cell: 'J38', path: 'salesComparison.subjectLandArea', type: 'number' },
  { cell: 'B216', path: 'salesComparison.finalValue', type: 'number', required: false },
  { cell: 'B215', path: 'salesComparison.narrative', type: 'string' },

  // Comparable 1 (columns B-C)
  { cell: 'B192', path: 'salesComparison.comparables[0].address', type: 'string' },
  { cell: 'B193', path: 'salesComparison.comparables[0].source', type: 'string' },
  { cell: 'B194', path: 'salesComparison.comparables[0].proximity', type: 'string' },
  { cell: 'B195', path: 'salesComparison.comparables[0].floor', type: 'string' },
  { cell: 'B196', path: 'salesComparison.comparables[0].saleTiming', type: 'string', transform: (v) => mapSaleTiming(String(v)) },
  { cell: 'B197', path: 'salesComparison.comparables[0].tenancy', type: 'string', transform: (v) => mapTenancy(String(v)) },
  { cell: 'B198', path: 'salesComparison.comparables[0].ageYears', type: 'number' },
  { cell: 'B199', path: 'salesComparison.comparables[0].orientation', type: 'string' },
  { cell: 'B200', path: 'salesComparison.comparables[0].paymentTerms', type: 'string', transform: (v) => mapPaymentTerms(String(v)) },
  { cell: 'B201', path: 'salesComparison.comparables[0].finishingLevel', type: 'string' },
  { cell: 'B202', path: 'salesComparison.comparables[0].condition', type: 'string' },
  { cell: 'B203', path: 'salesComparison.comparables[0].locationQuality', type: 'string' },
  { cell: 'B204', path: 'salesComparison.comparables[0].garageShare', type: 'number' },
  { cell: 'B205', path: 'salesComparison.comparables[0].buildingAreaSqm', type: 'number' },
  { cell: 'B206', path: 'salesComparison.comparables[0].landAreaSqm', type: 'number' },
  { cell: 'B207', path: 'salesComparison.comparables[0].hasPool', type: 'boolean' },
  { cell: 'B208', path: 'salesComparison.comparables[0].buildingPricePerSqm', type: 'number' },
  { cell: 'B209', path: 'salesComparison.comparables[0].salePrice', type: 'number' },

  // Comparable 2 (columns D-E)
  { cell: 'D192', path: 'salesComparison.comparables[1].address', type: 'string' },
  { cell: 'D193', path: 'salesComparison.comparables[1].source', type: 'string' },
  { cell: 'D194', path: 'salesComparison.comparables[1].proximity', type: 'string' },
  { cell: 'D195', path: 'salesComparison.comparables[1].floor', type: 'string' },
  { cell: 'D196', path: 'salesComparison.comparables[1].saleTiming', type: 'string', transform: (v) => mapSaleTiming(String(v)) },
  { cell: 'D197', path: 'salesComparison.comparables[1].tenancy', type: 'string', transform: (v) => mapTenancy(String(v)) },
  { cell: 'D198', path: 'salesComparison.comparables[1].ageYears', type: 'number' },
  { cell: 'D199', path: 'salesComparison.comparables[1].orientation', type: 'string' },
  { cell: 'D200', path: 'salesComparison.comparables[1].paymentTerms', type: 'string', transform: (v) => mapPaymentTerms(String(v)) },
  { cell: 'D201', path: 'salesComparison.comparables[1].finishingLevel', type: 'string' },
  { cell: 'D202', path: 'salesComparison.comparables[1].condition', type: 'string' },
  { cell: 'D203', path: 'salesComparison.comparables[1].locationQuality', type: 'string' },
  { cell: 'D204', path: 'salesComparison.comparables[1].garageShare', type: 'number' },
  { cell: 'D205', path: 'salesComparison.comparables[1].buildingAreaSqm', type: 'number' },
  { cell: 'D206', path: 'salesComparison.comparables[1].landAreaSqm', type: 'number' },
  { cell: 'D207', path: 'salesComparison.comparables[1].hasPool', type: 'boolean' },
  { cell: 'D208', path: 'salesComparison.comparables[1].buildingPricePerSqm', type: 'number' },
  { cell: 'D209', path: 'salesComparison.comparables[1].salePrice', type: 'number' },

  // Comparable 3 (columns F-G)
  { cell: 'F192', path: 'salesComparison.comparables[2].address', type: 'string' },
  { cell: 'F193', path: 'salesComparison.comparables[2].source', type: 'string' },
  { cell: 'F194', path: 'salesComparison.comparables[2].proximity', type: 'string' },
  { cell: 'F195', path: 'salesComparison.comparables[2].floor', type: 'string' },
  { cell: 'F196', path: 'salesComparison.comparables[2].saleTiming', type: 'string', transform: (v) => mapSaleTiming(String(v)) },
  { cell: 'F197', path: 'salesComparison.comparables[2].tenancy', type: 'string', transform: (v) => mapTenancy(String(v)) },
  { cell: 'F198', path: 'salesComparison.comparables[2].ageYears', type: 'number' },
  { cell: 'F199', path: 'salesComparison.comparables[2].orientation', type: 'string' },
  { cell: 'F200', path: 'salesComparison.comparables[2].paymentTerms', type: 'string', transform: (v) => mapPaymentTerms(String(v)) },
  { cell: 'F201', path: 'salesComparison.comparables[2].finishingLevel', type: 'string' },
  { cell: 'F202', path: 'salesComparison.comparables[2].condition', type: 'string' },
  { cell: 'F203', path: 'salesComparison.comparables[2].locationQuality', type: 'string' },
  { cell: 'F204', path: 'salesComparison.comparables[2].garageShare', type: 'number' },
  { cell: 'F205', path: 'salesComparison.comparables[2].buildingAreaSqm', type: 'number' },
  { cell: 'F206', path: 'salesComparison.comparables[2].landAreaSqm', type: 'number' },
  { cell: 'F207', path: 'salesComparison.comparables[2].hasPool', type: 'boolean' },
  { cell: 'F208', path: 'salesComparison.comparables[2].buildingPricePerSqm', type: 'number' },
  { cell: 'F209', path: 'salesComparison.comparables[2].salePrice', type: 'number' },

  // ═══════════════════════════════════════════════════════════════════════
  // INCOME APPROACH (Excel rows 218-228)
  // Based on Villa Solia inspection:
  // - L219 = Monthly rent (110,000)
  // - J220 = Annual income (1,320,000)
  // - C220 = Vacancy expense AMOUNT (132,000) - NOT a rate!
  // - C222 = Remaining life (59 years)
  // - L223 = Interest rate (10%)
  // ═══════════════════════════════════════════════════════════════════════
  { cell: 'L219', path: 'incomeApproach.monthlyRent', type: 'number', required: false },
  { cell: 'J220', path: 'incomeApproach.annualIncome', type: 'number', required: false },
  { cell: 'C220', path: 'incomeApproach.vacancyAndExpensesAmount', type: 'number', required: false },
  { cell: 'C222', path: 'incomeApproach.remainingLife', type: 'number' },
  // Interest rate is stored as percentage (10 = 10%) - engine expects percentage, not decimal
  { cell: 'L223', path: 'incomeApproach.interestRate', type: 'number' },
  { cell: 'K222', path: 'incomeApproach.unitLandShareValue', type: 'number' },

  // Income approach computed cells (for verification)
  // The rate is computed: vacancyAndExpensesAmount / annualIncome = 0.1 (10%)
  { cell: 'A221', path: 'incomeApproach._computed.netEffectiveIncome', type: 'number' },
  { cell: 'C223', path: 'incomeApproach._computed.capitalRecoveryRate', type: 'number' },
  { cell: 'C224', path: 'incomeApproach._computed.capRate', type: 'number' },
  { cell: 'C225', path: 'incomeApproach._computed.landYield', type: 'number' },
  { cell: 'C226', path: 'incomeApproach._computed.buildingYield', type: 'number' },
  { cell: 'C227', path: 'incomeApproach._computed.buildingPrice', type: 'number' },
  { cell: 'C228', path: 'incomeApproach._computed.total', type: 'number' },

  // ═══════════════════════════════════════════════════════════════════════
  // GRM (Excel rows 230-237)
  // Based on Villa Solia inspection:
  // Row 231: A231="13" (income multiplier), L231="30,000" (monthly rent for GRM)
  // Row 232: annual income computed
  // Row 233: L233="132,000" (vacancy expenses)
  // Row 234: A234="228,000" (net effective income)
  // Row 235: A235="2,964,000" (GRM total)
  // Row 237: L237="110,000" (rental value - same as main monthly rent)
  // ═══════════════════════════════════════════════════════════════════════
  { cell: 'A231', path: 'grm.incomeMultiplier', type: 'number', required: false },
  { cell: 'L231', path: 'grm.monthlyRent', type: 'number', required: false },
  { cell: 'L233', path: 'grm.vacancyAndExpenses', type: 'number' },

  // GRM computed cells (for verification)
  { cell: 'A234', path: 'grm._computed.netEffectiveIncome', type: 'number' },
  { cell: 'A235', path: 'grm._computed.total', type: 'number' },

  // ═══════════════════════════════════════════════════════════════════════
  // RECONCILIATION (Excel rows 250-264)
  // Based on Villa Solia inspection:
  // Row 251: J251="26,000,000" (sales comparison value)
  // Row 254: J254="11,549,130" (income capitalization value)
  // Row 256: A256 contains rationale text
  // Row 261: J261="26,000,000" (final value)
  // Row 262: J262="9,597,000" (land value)
  // Row 263: J263="16,403,000" (building value)
  // Row 264: J264="110,000" (monthly rent)
  // Header area:
  // Row 13: M13="26,000,000" (final value)
  // Row 14: D14="16,403,000" (building), M14="9,597,000" (land)
  // ═══════════════════════════════════════════════════════════════════════
  { cell: 'A256', path: 'reconciliation.rationale', type: 'string' },
  // Primary locations for final values (header area - rows 13-14)
  { cell: 'M13', path: 'reconciliation.finalValue', type: 'number', required: false },
  { cell: 'M14', path: 'reconciliation.landValue', type: 'number' },
  { cell: 'D14', path: 'reconciliation.buildingValue', type: 'number' },
  // Alternative locations (footer reconciliation area)
  { cell: 'J261', path: 'reconciliation.finalValueFooter', type: 'number' },
  { cell: 'J262', path: 'reconciliation.landValueFooter', type: 'number' },
  { cell: 'J263', path: 'reconciliation.buildingValueFooter', type: 'number' },
  { cell: 'J264', path: 'reconciliation.monthlyRent', type: 'number' },
  // Method values from reconciliation section
  { cell: 'J251', path: 'reconciliation.salesComparisonValue', type: 'number' },
  { cell: 'J254', path: 'reconciliation.incomeCapitalizationValue', type: 'number' },
];

// ═══════════════════════════════════════════════════════════════════════
// VALUE MAPPING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function mapPropertyType(arabic: string): string {
  const map: Record<string, string> = {
    'شقة': 'apartment',
    'فيلا': 'villa',
    'دوبلكس': 'duplex',
    'وحدة كمبوند': 'compound_unit',
    'روف': 'roof',
  };
  return map[arabic.trim()] || arabic;
}

function mapReportKind(arabic: string): string {
  const map: Record<string, string> = {
    'موجز': 'brief',
    'سردي محدود': 'narrative_limited',
    'سردي كامل': 'narrative_full',
  };
  return map[arabic.trim()] || arabic;
}

function mapTenancy(arabic: string): string {
  const map: Record<string, string> = {
    'شاغر': 'vacant',
    'خالية': 'vacant',  // Alternative word for vacant
    'مالك': 'owner_occupied',
    'مؤجر': 'rented',
    'مستأجر': 'rented',  // Alternative word for rented
  };
  return map[arabic.trim()] || arabic;
}

function mapFinishingLevel(arabic: string): string {
  const text = arabic.trim();
  const map: Record<string, string> = {
    'لوكس': 'luxury',
    'سوبر لوكس': 'super_lux',
    'تشطيب كامل': 'full',
    'نصف تشطيب': 'half',
    'على الطوب': 'shell',
  };

  // Direct match
  if (map[text]) return map[text];

  // Extract from parentheses: "مستوى التشطيبات  (  تشطيب كامل   )"
  const match = text.match(/\(([^)]+)\)/);
  if (match) {
    const inner = match[1].trim();
    if (map[inner]) return map[inner];
    // Check if any key is contained in inner text
    for (const [key, value] of Object.entries(map)) {
      if (inner.includes(key)) return value;
    }
  }

  // Check if any key is contained in the full text
  for (const [key, value] of Object.entries(map)) {
    if (text.includes(key)) return value;
  }

  return text;
}

function mapSaleTiming(arabic: string): string {
  const map: Record<string, string> = {
    'عرض حالي': 'current_offer',
    'بيع حديث': 'recent_sale',
    'بيع تاريخي': 'historical',
  };
  return map[arabic.trim()] || arabic;
}

function mapPaymentTerms(arabic: string): string {
  const map: Record<string, string> = {
    'نقدي': 'cash',
    'كاش': 'cash',
    'تقسيط': 'installments',
    'تمويل عقاري': 'mortgage',
  };
  return map[arabic.trim()] || arabic;
}

function mapChosenMethod(arabic: string): string {
  const map: Record<string, string> = {
    'أسلوب التكلفة': 'cost',
    'التكلفة': 'cost',
    'أسلوب المقارنة': 'sales_comparison',
    'المقارنة': 'sales_comparison',
    'أسلوب الدخل': 'income',
    'الدخل': 'income',
    'مضاعف إجمالي الإيجار': 'grm',
  };
  return map[arabic.trim()] || arabic;
}

export default {
  fingerprint: FRA_RESIDENTIAL_V1_FINGERPRINT,
  cells: FRA_RESIDENTIAL_V1_CELLS,
};
