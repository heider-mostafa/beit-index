/**
 * Heuristic Extraction Module
 *
 * Provides flexible data extraction when template matching fails.
 * Uses label-based scanning for both Excel and PDF sources.
 * Includes fuzzy matching for Arabic text with OCR variations.
 */

import ExcelJS from 'exceljs';

// ============================================================================
// FUZZY MATCHING FOR ARABIC TEXT
// ============================================================================

/**
 * Canonical Arabic labels for each field - used for fuzzy matching
 * COMPREHENSIVE list covering all variations found in Egyptian appraisal reports
 */
export const CANONICAL_LABELS: Record<string, string[]> = {
  // ============ FINAL VALUES ============
  finalValue: [
    'نتيجة التقييم', 'نتيجه التقييم', 'نتيجة التمييم', 'نتيجه التمييم',
    'القيمة النهائية', 'القيمه النهائيه', 'القيمة النهائيه',
    'قيمة العقار', 'قيمه العقار', 'ليمة العقار', 'ليمه العقار',
    'القيمة السوقية', 'القيمه السوقيه', 'القيمة السوقيه',
    'إجمالي القيمة', 'اجمالي القيمة', 'اجمالى القيمه', 'إجمالى القيمه',
    'المجموع الكلي', 'المجموع النهائي', 'الإجمالي', 'الاجمالى',
    'القيمة التقديرية', 'القيمه التقديريه', 'التقييم النهائي',
    'قيمة التقييم', 'قيمه التقييم', 'ليمة التقييم',
    'السعر المتوقع', 'السعر التقديري', 'القيمة المقدرة',
    'صافي القيمة', 'صافى القيمه', 'إجمالي المبلغ',
  ],
  landValue: [
    'قيمة الأرض', 'قيمة الارض', 'قيمه الأرض', 'قيمه الارض',
    'ليمة الأرض', 'ليمة الارض', 'ليمه الأرض', 'ليمه الارض',
    'ثمن الأرض', 'ثمن الارض', 'سعر الأرض', 'سعر الارض',
    'نصيب الأرض', 'نصيب الارض', 'حصة الأرض', 'حصة الارض',
    'قيمة نصيب الأرض', 'قيمة حصة الأرض',
    'تكلفة الأرض', 'تكلفه الأرض', 'تكلفة الارض',
  ],
  buildingValue: [
    'قيمة المباني', 'قيمة المبانى', 'قيمه المباني', 'قيمه المبانى',
    'ليمة المباني', 'ليمة المبانى', 'ليمه المباني', 'ليمه المبانى',
    'قيمة البناء', 'قيمه البناء', 'ليمة البناء', 'ليمه البناء',
    'قيمة المنشآت', 'قيمه المنشآت', 'قيمة المنشأت',
    'تكلفة المباني', 'تكلفه المباني', 'تكلفة البناء',
    'قيمة الإنشاءات', 'قيمة الانشاءات',
  ],

  // ============ AREAS ============
  unitNetArea: [
    'مساحة الوحدة', 'مساحه الوحده', 'مساحة الوحده', 'مساحه الوحدة',
    'مساحة الشقة', 'مساحه الشقه', 'مساحة الشمة', 'مساحه الشمه',
    'المساحة الصافية', 'المساحه الصافيه', 'صافي المساحة', 'صافى المساحه',
    'مساحة صافية', 'مساحه صافيه', 'المساحة', 'المساحه', 'مساحة', 'مساحه',
    'المسطح', 'مسطح الوحدة', 'مسطح الشقة',
    'صافي مسطح', 'صافى مسطح', 'المسطح الصافي',
  ],
  unitGrossArea: [
    'إجمالي المساحة', 'اجمالي المساحة', 'اجمالى المساحه',
    'المساحة الإجمالية', 'المساحه الاجماليه', 'المساحة الكلية',
    'المساحة شاملة', 'المساحه شامله', 'مساحة كلية',
    'إجمالي المسطح', 'اجمالى المسطح', 'المسطح الكلي',
  ],
  unitLandShare: [
    'نصيب الوحدة من الأرض', 'نصيب الوحده من الارض',
    'حصة الوحدة من الأرض', 'حصة الوحده من الارض',
    'نصيب الأرض', 'نصيب الارض', 'حصة الأرض', 'حصة الارض',
    'نصيب الوحدة', 'نصيب الوحده', 'حصة الوحدة',
  ],
  projectLandArea: [
    'مساحة الأرض', 'مساحة الارض', 'مساحه الأرض', 'مساحه الارض',
    'مسطح الأرض', 'مسطح الارض', 'مساحة أرض المشروع',
    'إجمالي مسطح الأرض', 'اجمالى مسطح الارض',
    'مساحة الأرض الكلية', 'المساحة الأرضية',
    'مساحة قطعة الأرض', 'مساحة القطعة',
  ],

  // ============ AGES ============
  currentAge: [
    'العمر الحالي', 'العمر الحالى', 'عمر المبنى', 'عمر المبني',
    'عمر العقار', 'السن الحالي', 'السن الحالى',
    'عمر البناء', 'العمر', 'السن', 'عمر المنشأ',
  ],
  economicLife: [
    'العمر الاقتصادي', 'العمر الاقتصادى', 'العمر االقتصادي',
    'العمر الافتراضي', 'العمر الافتراضى', 'العمر الانتاجي',
    'العمر الإنتاجي', 'العمر المتوقع', 'فترة الحياة الاقتصادية',
  ],
  effectiveAge: [
    'العمر الفعال', 'العمر الفعلي', 'العمر الفعلى',
    'السن الفعلي', 'السن الفعال', 'العمر الحقيقي',
  ],
  remainingLife: [
    'العمر المتبقي', 'العمر المتبقى', 'العمر الباقي', 'العمر الباقى',
    'المتبقي من العمر', 'الباقي من العمر', 'فترة العمر المتبقية',
  ],

  // ============ COST APPROACH ============
  landPricePerSqm: [
    'سعر المتر للأرض', 'سعر المتر للارض', 'سعر متر الأرض', 'سعر متر الارض',
    'سعر الأرض للمتر', 'سعر الارض للمتر', 'قيمة المتر للأرض',
    'سعر المتر المربع للأراضي', 'متوسط سعر المتر',
    'سعر الأرض', 'سعر الارض', 'قيمة المتر', 'ليمة المتر',
  ],
  constructionCostPerSqm: [
    'تكلفة إنشاء المتر', 'تكلفة انشاء المتر', 'تكلفه انشاء المتر',
    'تكلفة البناء للمتر', 'تكلفه البناء للمتر',
    'تكلفة المتر', 'تكلفه المتر', 'سعر متر البناء',
    'تكلفة الإنشاء', 'تكلفة الانشاء', 'تكلفه الانشاء',
    'متوسط تكلفة البناء', 'تكلفة البناء', 'تكلفه البناء',
  ],
  depreciation: [
    'الإهلاك', 'الاهلاك', 'نسبة الإهلاك', 'نسبة الاهلاك',
    'قيمة الإهلاك', 'قيمة الاهلاك', 'معدل الإهلاك',
    'الاستهلاك', 'نسبة الاستهلاك', 'قيمة الاستهلاك',
  ],

  // ============ INCOME APPROACH ============
  monthlyRent: [
    'الإيجار الشهري', 'الايجار الشهري', 'الايجار الشهرى',
    'القيمة الإيجارية الشهرية', 'القيمه الايجاريه الشهريه',
    'إيجار المثل', 'ايجار المثل', 'القيمة الإيجارية', 'القيمه الايجاريه',
    'الإيجار', 'الايجار', 'إيجار شهري', 'ايجار شهرى',
    'القيمة الايجارية للمتر', 'إيجار الوحدة',
  ],
  annualIncome: [
    'الدخل السنوي', 'الدخل السنوى', 'الإيجار السنوي', 'الايجار السنوى',
    'العائد السنوي', 'العائد السنوى', 'الدخل الإجمالي السنوي',
    'إجمالي الدخل السنوي', 'صافي الدخل السنوي',
  ],
  interestRate: [
    'سعر الفائدة', 'سعر الفائده', 'معدل الفائدة', 'معدل الفائده',
    'نسبة الفائدة', 'نسبه الفائده', 'معدل الرسملة', 'معدل الرسمله',
    'معدل العائد', 'نسبة العائد', 'معدل الخصم',
  ],
  incomeMultiplier: [
    'مضاعف الدخل', 'المضاعف', 'مضاعف الإيجار', 'مضاعف الايجار',
    'معامل الدخل', 'مضاعف القيمة', 'عامل الرسملة',
  ],

  // ============ IDENTIFICATION ============
  clientName: [
    'اسم العميل', 'العميل', 'السيد', 'السادة', 'الأستاذ', 'الاستاذ',
    'اسم الطالب', 'طالب التقييم', 'جهة التكليف', 'المكلف',
  ],
  ownerName: [
    'اسم المالك', 'المالك', 'مالك العقار', 'صاحب العقار',
    'ملاك العقار', 'أسماء الملاك', 'اسماء الملاك',
  ],
  governorate: [
    'المحافظة', 'المحافظه', 'محافظة', 'محافظه',
  ],
  city: [
    'المدينة', 'المدينه', 'مدينة', 'مدينه', 'المركز',
  ],
  district: [
    'الحي', 'الحى', 'اسم الحي', 'اسم الحى', 'المنطقة', 'المنطقه',
    'القسم', 'الشياخة', 'الشياخه', 'التجمع', 'الكمبوند',
  ],
  appraisalDate: [
    'تاريخ التقييم', 'تاريخ التقرير', 'تاريخ المعاينة', 'تاريخ المعاينه',
    'التاريخ', 'تاريخ الإعداد', 'تاريخ الاعداد',
  ],
  propertyType: [
    'نوع العقار', 'نوع الوحدة', 'نوع الوحده', 'النوع',
    'وصف العقار', 'طبيعة العقار', 'نوع الملكية',
    'شقة', 'شمة', 'فيلا', 'فيال', 'دوبلكس', 'روف', 'محل', 'مكتب',
  ],
  floor: [
    'الدور', 'الطابق', 'رقم الدور', 'رقم الطابق',
    'دور', 'طابق', 'الأدوار', 'عدد الأدوار',
  ],
  address: [
    'العنوان', 'الموقع', 'عنوان العقار', 'موقع العقار',
    'الوصف', 'وصف الموقع', 'العنوان التفصيلي',
  ],

  // ============ PHYSICAL DETAILS ============
  bedrooms: [
    'غرف النوم', 'عدد غرف النوم', 'الغرف', 'عدد الغرف',
    'غرفة', 'غرف', 'حجرات', 'حجرة',
  ],
  bathrooms: [
    'الحمامات', 'عدد الحمامات', 'حمام', 'حمامات', 'دورات المياه',
  ],
  finishingLevel: [
    'مستوى التشطيب', 'مستوي التشطيب', 'التشطيب', 'نوع التشطيب',
    'درجة التشطيب', 'حالة التشطيب', 'مرحلة التشطيب',
    'سوبر لوكس', 'لوكس', 'نصف تشطيب', 'تشطيب كامل',
  ],

  // ============ COMPARABLES ============
  comparable1: [
    'المقارن الأول', 'المقارن الاول', 'مقارن 1', 'المثيل الأول',
    'العقار المقارن الأول', 'البيانة الأولى', 'البيانه الاولى',
  ],
  comparable2: [
    'المقارن الثاني', 'المقارن الثانى', 'مقارن 2', 'المثيل الثاني',
    'العقار المقارن الثاني', 'البيانة الثانية', 'البيانه الثانيه',
  ],
  comparable3: [
    'المقارن الثالث', 'مقارن 3', 'المثيل الثالث',
    'العقار المقارن الثالث', 'البيانة الثالثة', 'البيانه الثالثه',
  ],
};

/**
 * Normalize Arabic text for comparison
 * - Removes diacritics (tashkeel)
 * - Normalizes similar characters (ى→ي, ة→ه, أإآ→ا)
 * - Removes extra whitespace
 */
export function normalizeArabic(text: string): string {
  return text
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variations
    .replace(/[أإآ]/g, 'ا')
    // Normalize ya variations
    .replace(/ى/g, 'ي')
    // Normalize ta marbuta to ha
    .replace(/ة/g, 'ه')
    // Remove tatweel (kashida)
    .replace(/ـ/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
export function stringSimilarity(a: string, b: string): number {
  const normalA = normalizeArabic(a);
  const normalB = normalizeArabic(b);

  if (normalA === normalB) return 1;
  if (normalA.length === 0 || normalB.length === 0) return 0;

  const distance = levenshteinDistance(normalA, normalB);
  const maxLength = Math.max(normalA.length, normalB.length);

  return 1 - distance / maxLength;
}

/**
 * Clean label text by removing common suffixes and units
 */
function cleanLabelForMatching(text: string): string {
  return text
    // Remove unit suffixes
    .replace(/\s*[مm]\s*[²2]?\s*$/i, '')  // م², m2, م 2
    .replace(/\s*متر\s*(مربع)?\s*$/i, '') // متر مربع
    .replace(/\s*جنيه\s*$/i, '')          // جنيه
    .replace(/\s*سنة\s*$/i, '')           // سنة
    .replace(/\s*سنوات\s*$/i, '')         // سنوات
    .replace(/\s*%\s*$/i, '')             // %
    // Remove common prefixes
    .replace(/^(إجمالي|اجمالى|صافي|صافى)\s*/i, '')
    .trim();
}

/**
 * Find the best matching field for a given label using fuzzy matching
 * Returns { field, similarity } or null if no good match
 */
export function fuzzyMatchLabel(
  label: string,
  minSimilarity: number = 0.55  // Lowered from 0.7 to catch more OCR variations
): { field: string; similarity: number; matchedCanonical: string } | null {
  // Clean and normalize the label
  const cleanedLabel = cleanLabelForMatching(label);
  const normalizedLabel = normalizeArabic(cleanedLabel);

  // Skip very short labels or labels that are mostly numbers
  if (normalizedLabel.length < 3 || /^[\d\s.,%]+$/.test(normalizedLabel)) {
    return null;
  }

  let bestMatch: { field: string; similarity: number; matchedCanonical: string } | null = null;

  for (const [field, canonicals] of Object.entries(CANONICAL_LABELS)) {
    for (const canonical of canonicals) {
      // Try matching against both original and cleaned label
      const similarity1 = stringSimilarity(cleanedLabel, canonical);
      const similarity2 = stringSimilarity(label, canonical);
      const similarity = Math.max(similarity1, similarity2);

      // Also check if label contains the canonical or vice versa
      const normalizedCanonical = normalizeArabic(canonical);
      const containsBonus = normalizedLabel.includes(normalizedCanonical) ||
                           normalizedCanonical.includes(normalizedLabel) ? 0.15 : 0;

      const adjustedSimilarity = Math.min(1, similarity + containsBonus);

      if (adjustedSimilarity >= minSimilarity) {
        if (!bestMatch || adjustedSimilarity > bestMatch.similarity) {
          bestMatch = { field, similarity: adjustedSimilarity, matchedCanonical: canonical };
        }
      }
    }
  }

  return bestMatch;
}

// Arabic labels that indicate specific data fields (with common OCR variations)
// Extended with more variations for different appraisal report formats
export const LABEL_PATTERNS: Record<string, RegExp[]> = {
  // Final values - extended patterns with OCR variations
  'finalValue': [
    /نتيجة\s*التقييم/i,
    /نتيجة\s*التمييم/i,  // OCR variation (ي vs ق)
    /نتيجه\s*التقييم/i,
    /نتيجه\s*التمييم/i,
    /القيمة\s*النهائية/i,
    /إجمالي\s*القيمة/i,
    /قيمة\s*العقار/i,
    /السعر\s*المتوقع/i,
    /القيمة\s*السوقية/i,
    /قيمة\s*التقييم/i,
    /قيمة\s*التمييم/i,  // OCR variation
    /التقييم\s*النهائي/i,
    /التمييم\s*النهائي/i,  // OCR variation
    /اجمالى\s*القيمة/i,
    /الاجمالي/i,
    /المجموع/i,
    /final\s*value/i,
    /total\s*value/i,
    /market\s*value/i,
  ],
  'landValue': [
    /قيمة\s*الأرض/i,
    /قيمة\s*االرض/i,
    /قيمة\s*الارض/i,
    /قيمه\s*الارض/i,
    /ليمة\s*الارض/i,  // OCR variation (ل vs ق)
    /ليمة\s*االرض/i,  // OCR variation
    /ليمه\s*الارض/i,  // OCR variation
    /ثمن\s*الأرض/i,
    /نصيب.*الأرض/i,
    /سعر\s*الأرض/i,
    /land\s*value/i,
  ],
  'buildingValue': [
    /قيمة\s*المباني/i,
    /قيمة\s*المبانى/i,
    /قيمه\s*المبانى/i,
    /ليمة\s*المباني/i,  // OCR variation (ل vs ق)
    /ليمة\s*المبانى/i,  // OCR variation
    /ليمه\s*المبانى/i,  // OCR variation
    /قيمة\s*البناء/i,
    /قيمة\s*المنشآت/i,
    /المباني/i,
    /المبانى/i,
    /building\s*value/i,
  ],

  // Physical - extended patterns with OCR variations
  'unitNetArea': [
    /مساحة\s*الوحدة/i,
    /مساحة\s*الشقة/i,
    /مساحة\s*الشمة/i,  // OCR variation (م vs ق)
    /مساحة\s*الشمه/i,  // OCR variation
    /المساحة\s*الصافية/i,
    /صافي\s*المساحة/i,
    /مساحة\s*صافية/i,
    /المساحة\s*م\s*[²2]/i,
    /المساحه/i,
    /مساحه/i,
    /مساحة/i,
    /net\s*area/i,
    /unit\s*area/i,
  ],
  'unitGrossArea': [
    /إجمالي\s*المساحة/i,
    /اجمالى\s*المساحة/i,
    /المساحة\s*شاملة/i,
    /المساحة\s*الكلية/i,
    /gross\s*area/i,
    /total\s*area/i,
  ],
  'unitLandShare': [
    /نصيب\s*الوحدة.*الأرض/i,
    /حصة.*الأرض/i,
    /نصيب\s*الارض/i,
    /land\s*share/i,
  ],
  'projectLandArea': [
    /مساحة\s*الارض/i,
    /مساحة\s*ارض/i,
    /مسطح\s*الارض/i,
    /إجمالي.*مسطح.*الأرض/i,
    /مساحة\s*الارض\s*الكلية/i,
    /plot\s*area/i,
    /land\s*area/i,
  ],

  // Ages - extended patterns
  'currentAge': [
    /العمر\s*الحالي/i,
    /العمر\s*الحالى/i,
    /عمر\s*المبنى/i,
    /عمر\s*العقار/i,
    /عمر\s*البناء/i,
    /السن\s*الحالي/i,
    /current\s*age/i,
    /age/i,
  ],
  'economicLife': [
    /العمر\s*الاقتصادي/i,
    /العمر\s*االقتصادى/i,
    /العمر\s*الافتراضي/i,
    /العمر\s*الانتاجي/i,
    /economic\s*life/i,
    /useful\s*life/i,
  ],
  'effectiveAge': [
    /العمر\s*الفعال/i,
    /العمر\s*الفعلي/i,
    /effective\s*age/i,
  ],
  'remainingLife': [
    /المتبقي.*عمر/i,
    /العمر\s*المتبقي/i,
    /العمر\s*الباقي/i,
    /remaining\s*life/i,
  ],

  // Cost approach - extended patterns
  'landPricePerSqm': [
    /سعر\s*المتر.*للأرض/i,
    /سعر\s*المتر\s*المربع\s*للأراضي/i,
    /سعر\s*الارض/i,
    /سعر\s*متر\s*الارض/i,
    /قيمة\s*المتر/i,
    /land\s*price/i,
    /price\s*per\s*sqm/i,
  ],
  'constructionCostPerSqm': [
    /تكلفة\s*انشاء\s*المتر/i,
    /تكلفة\s*البناء/i,
    /تكلفة\s*المتر/i,
    /تكلفة\s*الانشاء/i,
    /سعر\s*متر\s*البناء/i,
    /construction\s*cost/i,
    /building\s*cost/i,
  ],

  // Income approach - extended patterns
  'monthlyRent': [
    /الإيجار\s*الشهري/i,
    /الايجار\s*الشهرى/i,
    /القيمة\s*الايجارية\s*الشهرية/i,
    /ايجار\s*المثل/i,
    /القيمة\s*الايجارية/i,
    /الايجار/i,
    /monthly\s*rent/i,
    /rent/i,
  ],
  'annualIncome': [
    /الدخل\s*السنوي/i,
    /الإيجار\s*السنوي/i,
    /الايجار\s*السنوى/i,
    /العائد\s*السنوي/i,
    /annual\s*income/i,
    /annual\s*rent/i,
  ],
  'interestRate': [
    /سعر\s*الفائدة/i,
    /معدل\s*الفائدة/i,
    /نسبة\s*الفائدة/i,
    /معدل\s*الرسملة/i,
    /interest\s*rate/i,
    /cap\s*rate/i,
  ],
  'incomeMultiplier': [
    /مضاعف\s*الدخل/i,
    /المضاعف/i,
    /معامل\s*الدخل/i,
    /grm/i,
    /multiplier/i,
  ],

  // Identification - extended patterns
  'clientName': [
    /اسم\s*العميل/i,
    /العميل/i,
    /client\s*name/i,
    /client/i,
  ],
  'ownerName': [
    /اسم\s*المالك/i,
    /المالك/i,
    /owner\s*name/i,
    /owner/i,
  ],
  'governorate': [
    /المحافظة/i,
    /محافظة/i,
    /governorate/i,
  ],
  'city': [
    /المدينة/i,
    /مدينة/i,
    /city/i,
  ],
  'district': [
    /الحي/i,
    /الحى/i,
    /حي/i,
    /اسم\s*الحي/i,
    /اسم\s*الحى/i,
    /المنطقة/i,
    /district/i,
  ],
  'appraisalDate': [
    /تاريخ\s*التقييم/i,
    /تاريخ\s*التمييم/i,  // OCR variation
    /تاريخ\s*التقرير/i,
    /التاريخ/i,
    /appraisal\s*date/i,
    /date/i,
  ],
  // Additional fields
  'propertyType': [
    /نوع\s*العقار/i,
    /نوع\s*الوحدة/i,
    /النوع/i,
    /property\s*type/i,
    /type/i,
  ],
  'floor': [
    /الدور/i,
    /الطابق/i,
    /رقم\s*الدور/i,
    /floor/i,
  ],
  'address': [
    /العنوان/i,
    /الموقع/i,
    /address/i,
    /location/i,
  ],
};

/**
 * Extract a number from text following a label
 */
export function extractNumberAfterLabel(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Get the text after the match
      const afterMatch = text.substring(match.index! + match[0].length, match.index! + match[0].length + 100);
      // Look for a number
      const numberMatch = afterMatch.match(/[0-9٠-٩,٬.]+/);
      if (numberMatch) {
        const normalized = normalizeNumber(numberMatch[0]);
        if (normalized !== null && normalized > 0) {
          return normalized;
        }
      }
    }
  }
  return null;
}

/**
 * Extract a number that appears before a label
 */
export function extractNumberBeforeLabel(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      // Get the text before the match
      const beforeMatch = text.substring(Math.max(0, match.index - 50), match.index);
      // Look for a number (last number before the label)
      const numbers = beforeMatch.match(/[0-9٠-٩,٬.]+/g);
      if (numbers && numbers.length > 0) {
        const normalized = normalizeNumber(numbers[numbers.length - 1]);
        if (normalized !== null && normalized > 0) {
          return normalized;
        }
      }
    }
  }
  return null;
}

/**
 * Normalize an Arabic/Western number string to a JavaScript number
 */
export function normalizeNumber(text: string): number | null {
  if (!text) return null;

  // Replace Arabic-Indic numerals with Western
  let normalized = text
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٬,]/g, '')  // Remove thousand separators
    .replace(/\s/g, '');   // Remove spaces

  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Heuristic extraction from Excel worksheet
 * Scans for known labels and extracts nearby numeric values
 * Falls back to generic extraction if no known patterns match
 */
export function heuristicExcelExtraction(
  worksheet: ExcelJS.Worksheet
): { data: Record<string, unknown>; confidence: number } {
  const data: Record<string, unknown> = {
    identification: {} as Record<string, unknown>,
    physical: {} as Record<string, unknown>,
    costApproach: {} as Record<string, unknown>,
    incomeApproach: {} as Record<string, unknown>,
    grm: {} as Record<string, unknown>,
    reconciliation: {} as Record<string, unknown>,
    rawExtracted: {} as Record<string, unknown>, // Store all extracted label-value pairs
  };

  let foundFields = 0;
  const totalFields = Object.keys(LABEL_PATTERNS).length;

  // Build a text representation of the worksheet for searching
  const cellMap: Map<string, { row: number; col: number; value: unknown }> = new Map();
  const rawExtracted = data.rawExtracted as Record<string, unknown>;

  // Scan all cells in the worksheet
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const key = `${rowNumber}-${colNumber}`;
        cellMap.set(key, { row: rowNumber, col: colNumber, value });
      }
    });
  });

  // Track which fields have been found to avoid duplicates
  const foundFieldSet = new Set<string>();

  // PHASE 0: Table header extraction
  // Many Arabic Excel reports have headers in one row and values below
  // Scan first 10 rows for potential headers, then look for values in rows below
  for (let headerRow = 1; headerRow <= Math.min(10, worksheet.rowCount); headerRow++) {
    const row = worksheet.getRow(headerRow);
    const headerCells: { col: number; text: string }[] = [];

    row.eachCell((cell, colNumber) => {
      const text = String(getCellValue(cell) || '').trim();
      if (text && text.length >= 2 && !/^[\d٠-٩.,\s]+$/.test(text)) {
        headerCells.push({ col: colNumber, text });
      }
    });

    // For each potential header, check if there's a matching pattern and value below
    for (const header of headerCells) {
      for (const [field, patterns] of Object.entries(LABEL_PATTERNS)) {
        if (foundFieldSet.has(field)) continue;

        for (const pattern of patterns) {
          if (pattern.test(header.text)) {
            // Found a header! Look for numeric value in same column, rows below
            for (let valueRow = headerRow + 1; valueRow <= headerRow + 5; valueRow++) {
              const valueCell = worksheet.getCell(valueRow, header.col);
              const value = getCellValue(valueCell);

              let numValue: number | null = null;
              if (typeof value === 'number' && !isNaN(value) && value > 0) {
                numValue = value;
              } else if (typeof value === 'string') {
                numValue = normalizeNumber(value);
              }

              if (numValue !== null && numValue > 0) {
                setFieldValue(data, field, numValue);
                foundFieldSet.add(field);
                foundFields++;
                break;
              }
            }
            break;
          }
        }
      }
    }
  }

  // PHASE 1: Exact regex pattern matching (for label-value pairs in same/adjacent cells)
  for (const [field, patterns] of Object.entries(LABEL_PATTERNS)) {
    if (foundFieldSet.has(field)) continue;

    for (const [, cellData] of cellMap.entries()) {
      const cellText = String(cellData.value);

      for (const pattern of patterns) {
        if (pattern.test(cellText)) {
          // Found a label! Look for a number in nearby cells
          const numValue = findNearbyNumber(worksheet, cellData.row, cellData.col, cellMap);
          if (numValue !== null) {
            setFieldValue(data, field, numValue);
            foundFieldSet.add(field);
            foundFields++;
            break;
          }
        }
      }
      if (foundFieldSet.has(field)) break;
    }
  }

  // PHASE 2: Fuzzy matching for remaining unmatched fields
  // This catches OCR variations and typos that regex missed
  for (const [, cellData] of cellMap.entries()) {
    const cellText = String(cellData.value).trim();

    // Skip if already a number or too short
    if (!cellText || cellText.length < 3 || /^[\d٠-٩.,\s]+$/.test(cellText)) continue;

    // Try fuzzy matching
    const fuzzyMatch = fuzzyMatchLabel(cellText, 0.65); // 65% similarity threshold

    if (fuzzyMatch && !foundFieldSet.has(fuzzyMatch.field)) {
      const numValue = findNearbyNumber(worksheet, cellData.row, cellData.col, cellMap);
      if (numValue !== null) {
        setFieldValue(data, fuzzyMatch.field, numValue);
        foundFieldSet.add(fuzzyMatch.field);
        foundFields++;

        // Store fuzzy match info for debugging
        rawExtracted[`_fuzzy_${fuzzyMatch.field}`] = {
          label: cellText,
          matchedTo: fuzzyMatch.matchedCanonical,
          similarity: Math.round(fuzzyMatch.similarity * 100) + '%',
          value: numValue,
        };
      }
    }
  }

  // PHASE 3: Generic fallback - Extract all text-number pairs from the worksheet
  // This ensures we always get some data even if no known patterns match
  let genericExtractedCount = 0;

  for (const [, cellData] of cellMap.entries()) {
    const cellText = String(cellData.value).trim();

    // If this cell contains text (potential label), look for nearby numbers
    if (cellText && typeof cellData.value === 'string' && !/^[\d٠-٩.,\s]+$/.test(cellText)) {
      const numValue = findNearbyNumber(worksheet, cellData.row, cellData.col, cellMap);
      if (numValue !== null && numValue > 0) {
        // Store in rawExtracted with a sanitized key
        const sanitizedLabel = cellText.substring(0, 50).replace(/[^\w\u0600-\u06FF\s]/g, '').trim();
        if (sanitizedLabel && !rawExtracted[sanitizedLabel]) {
          rawExtracted[sanitizedLabel] = numValue;
          genericExtractedCount++;
        }
      }
    }
  }

  // Calculate confidence based on actual field extraction quality
  // Count core valuation fields (these are critical for a valid report)
  const coreFields = ['finalValue', 'landValue', 'buildingValue', 'unitNetArea'];
  const coreFieldsFound = coreFields.filter(f => {
    const section = getFieldSection(f);
    const sectionData = data[section] as Record<string, unknown>;
    return sectionData && sectionData[getFieldKey(f)] !== undefined;
  }).length;

  // Count supporting fields
  const supportingFields = ['currentAge', 'economicLife', 'landPricePerSqm', 'constructionCostPerSqm',
                           'monthlyRent', 'interestRate', 'governorate', 'district', 'propertyType'];
  const supportingFieldsFound = supportingFields.filter(f => {
    const section = getFieldSection(f);
    const sectionData = data[section] as Record<string, unknown>;
    return sectionData && sectionData[getFieldKey(f)] !== undefined;
  }).length;

  // Calculate weighted confidence:
  // - Core fields are worth 60% of confidence (15% each)
  // - Supporting fields are worth 40% (split among them)
  const coreConfidence = (coreFieldsFound / coreFields.length) * 0.6;
  const supportingConfidence = (supportingFieldsFound / supportingFields.length) * 0.4;
  let confidence = coreConfidence + supportingConfidence;

  // PHASE 4: Map generic extractions to structured fields using fuzzy matching
  // This catches labels we extracted but didn't recognize
  for (const [label, value] of Object.entries(rawExtracted)) {
    if (label.startsWith('_fuzzy_') || label.startsWith('_mapped_')) continue;
    if (typeof value !== 'number') continue;

    const fuzzyMatch = fuzzyMatchLabel(label, 0.50); // Lower threshold for generic mapping
    if (fuzzyMatch && !foundFieldSet.has(fuzzyMatch.field)) {
      setFieldValue(data, fuzzyMatch.field, value);
      foundFieldSet.add(fuzzyMatch.field);
      foundFields++;
      rawExtracted[`_mapped_${fuzzyMatch.field}`] = {
        originalLabel: label,
        matchedTo: fuzzyMatch.matchedCanonical,
        similarity: Math.round(fuzzyMatch.similarity * 100) + '%',
        value,
      };
    }
  }

  // Recalculate confidence after Phase 4
  const coreFieldsFoundFinal = coreFields.filter(f => {
    const section = getFieldSection(f);
    const sectionData = data[section] as Record<string, unknown>;
    return sectionData && sectionData[getFieldKey(f)] !== undefined;
  }).length;

  const supportingFieldsFoundFinal = supportingFields.filter(f => {
    const section = getFieldSection(f);
    const sectionData = data[section] as Record<string, unknown>;
    return sectionData && sectionData[getFieldKey(f)] !== undefined;
  }).length;

  const coreConfidenceFinal = (coreFieldsFoundFinal / coreFields.length) * 0.6;
  const supportingConfidenceFinal = (supportingFieldsFoundFinal / supportingFields.length) * 0.4;
  confidence = coreConfidenceFinal + supportingConfidenceFinal;

  // Log extraction summary for debugging
  console.log(`[Heuristic] ========== EXTRACTION SUMMARY ==========`);
  console.log(`[Heuristic] Core fields found: ${coreFieldsFoundFinal}/${coreFields.length} (${coreFields.filter(f => {
    const section = getFieldSection(f);
    const sectionData = data[section] as Record<string, unknown>;
    return sectionData && sectionData[getFieldKey(f)] !== undefined;
  }).join(', ') || 'none'})`);
  console.log(`[Heuristic] Supporting fields found: ${supportingFieldsFoundFinal}/${supportingFields.length}`);
  console.log(`[Heuristic] Pattern matches total: ${foundFields}/${totalFields}`);
  console.log(`[Heuristic] Generic extractions: ${genericExtractedCount}`);
  console.log(`[Heuristic] Fuzzy matches: ${Object.keys(rawExtracted).filter(k => k.startsWith('_fuzzy_')).length}`);
  console.log(`[Heuristic] Phase 4 mappings: ${Object.keys(rawExtracted).filter(k => k.startsWith('_mapped_')).length}`);
  console.log(`[Heuristic] Weighted confidence: ${Math.round(confidence * 100)}%`);

  // Log what was extracted to structured fields
  const reconciliation = data.reconciliation as Record<string, unknown>;
  const physical = data.physical as Record<string, unknown>;
  const identification = data.identification as Record<string, unknown>;
  const costApproach = data.costApproach as Record<string, unknown>;
  const incomeApproach = data.incomeApproach as Record<string, unknown>;

  console.log(`[Heuristic] --- Extracted Values ---`);
  if (reconciliation?.finalValue) console.log(`[Heuristic]   finalValue: ${reconciliation.finalValue}`);
  if (reconciliation?.landValue) console.log(`[Heuristic]   landValue: ${reconciliation.landValue}`);
  if (reconciliation?.buildingValue) console.log(`[Heuristic]   buildingValue: ${reconciliation.buildingValue}`);
  if (physical?.unitNetArea) console.log(`[Heuristic]   unitNetArea: ${physical.unitNetArea}`);
  if (physical?.unitGrossArea) console.log(`[Heuristic]   unitGrossArea: ${physical.unitGrossArea}`);
  if (physical?.currentAge) console.log(`[Heuristic]   currentAge: ${physical.currentAge}`);
  if (physical?.economicLife) console.log(`[Heuristic]   economicLife: ${physical.economicLife}`);
  if (physical?.bedrooms) console.log(`[Heuristic]   bedrooms: ${physical.bedrooms}`);
  if (costApproach?.landPricePerSqm) console.log(`[Heuristic]   landPricePerSqm: ${costApproach.landPricePerSqm}`);
  if (costApproach?.constructionCostPerSqm) console.log(`[Heuristic]   constructionCostPerSqm: ${costApproach.constructionCostPerSqm}`);
  if (incomeApproach?.monthlyRent) console.log(`[Heuristic]   monthlyRent: ${incomeApproach.monthlyRent}`);
  if (incomeApproach?.interestRate) console.log(`[Heuristic]   interestRate: ${incomeApproach.interestRate}`);
  if (identification?.governorate) console.log(`[Heuristic]   governorate: ${identification.governorate}`);
  if (identification?.district) console.log(`[Heuristic]   district: ${identification.district}`);
  if (identification?.propertyType) console.log(`[Heuristic]   propertyType: ${identification.propertyType}`);

  // Log ALL generic extractions so we can see what labels are in the file
  console.log(`[Heuristic] --- Raw Generic Extractions (first 20) ---`);
  const genericEntries = Object.entries(rawExtracted)
    .filter(([k]) => !k.startsWith('_'))
    .slice(0, 20);
  for (const [label, value] of genericEntries) {
    console.log(`[Heuristic]   "${label}": ${value}`);
  }

  console.log(`[Heuristic] ==========================================`);

  return { data, confidence };
}

// Helper functions for field mapping
function getFieldSection(field: string): string {
  const sectionMap: Record<string, string> = {
    finalValue: 'reconciliation', landValue: 'reconciliation', buildingValue: 'reconciliation',
    unitNetArea: 'physical', unitGrossArea: 'physical', unitLandShare: 'physical',
    projectLandArea: 'physical', currentAge: 'physical', economicLife: 'physical',
    effectiveAge: 'physical', remainingLife: 'physical', bedrooms: 'physical', bathrooms: 'physical',
    landPricePerSqm: 'costApproach', constructionCostPerSqm: 'costApproach', depreciation: 'costApproach',
    monthlyRent: 'incomeApproach', annualIncome: 'incomeApproach', interestRate: 'incomeApproach',
    incomeMultiplier: 'grm',
    clientName: 'identification', ownerName: 'identification', governorate: 'identification',
    city: 'identification', district: 'identification', appraisalDate: 'identification',
    propertyType: 'identification', floor: 'identification', address: 'identification',
    finishingLevel: 'identification',
  };
  return sectionMap[field] || 'rawExtracted';
}

function getFieldKey(field: string): string {
  // Most fields have same key, but some map differently
  return field;
}

/**
 * Find a numeric value in nearby cells (expanded search radius)
 * Handles merged cells and wider table structures common in Arabic Excel reports
 */
function findNearbyNumber(
  worksheet: ExcelJS.Worksheet,
  row: number,
  col: number,
  cellMap: Map<string, { row: number; col: number; value: unknown }>
): number | null {
  // First, scan the entire row for numeric values (common in Arabic RTL layouts)
  const rowData = worksheet.getRow(row);
  const numericCellsInRow: { col: number; value: number }[] = [];

  rowData.eachCell((cell, colNumber) => {
    if (colNumber !== col) {
      const value = getCellValue(cell);
      if (typeof value === 'number' && !isNaN(value) && value > 0) {
        numericCellsInRow.push({ col: colNumber, value });
      } else if (typeof value === 'string') {
        const num = normalizeNumber(value);
        if (num !== null && num > 0) {
          numericCellsInRow.push({ col: colNumber, value: num });
        }
      }
    }
  });

  // Return the closest numeric value in the same row (prefer left for RTL)
  if (numericCellsInRow.length > 0) {
    // Sort by distance, preferring left side (RTL)
    numericCellsInRow.sort((a, b) => {
      const distA = Math.abs(a.col - col);
      const distB = Math.abs(b.col - col);
      if (distA !== distB) return distA - distB;
      // Prefer left (lower column) for RTL Arabic
      return a.col - b.col;
    });
    return numericCellsInRow[0].value;
  }

  // Expanded search: check more positions around the cell
  const offsets = [
    // Same row - extended range
    { dr: 0, dc: -1 }, { dr: 0, dc: -2 }, { dr: 0, dc: -3 }, { dr: 0, dc: -4 }, { dr: 0, dc: -5 },
    { dr: 0, dc: 1 }, { dr: 0, dc: 2 }, { dr: 0, dc: 3 }, { dr: 0, dc: 4 }, { dr: 0, dc: 5 },
    // Below rows (for vertical layouts)
    { dr: 1, dc: 0 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
    { dr: 2, dc: 0 }, { dr: 2, dc: -1 }, { dr: 2, dc: 1 },
    // Above rows
    { dr: -1, dc: 0 }, { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
  ];

  for (const offset of offsets) {
    const checkRow = row + offset.dr;
    const checkCol = col + offset.dc;

    if (checkRow > 0 && checkCol > 0) {
      const cell = worksheet.getCell(checkRow, checkCol);
      const value = getCellValue(cell);

      if (typeof value === 'number' && !isNaN(value) && value > 0) {
        return value;
      }

      if (typeof value === 'string') {
        const num = normalizeNumber(value);
        if (num !== null && num > 0) {
          return num;
        }
      }
    }
  }

  return null;
}

/**
 * Get cell value, handling formulas, rich text, and hyperlinks
 */
function getCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;

  if (value === null || value === undefined) {
    return null;
  }

  // Handle rich text (common in Arabic Excel files)
  if (typeof value === 'object' && 'richText' in value) {
    const richText = (value as { richText: Array<{ text: string }> }).richText;
    return richText.map(rt => rt.text).join('');
  }

  // Handle formula results
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as { result: unknown }).result;
    // Result might also be rich text
    if (typeof result === 'object' && result !== null && 'richText' in result) {
      const richText = (result as { richText: Array<{ text: string }> }).richText;
      return richText.map(rt => rt.text).join('');
    }
    return result;
  }

  // Handle hyperlinks
  if (typeof value === 'object' && 'text' in value) {
    return (value as { text: string }).text;
  }

  return value;
}

/**
 * Set a field value in the data structure
 */
function setFieldValue(data: Record<string, unknown>, field: string, value: unknown): void {
  // Determine which section the field belongs to
  const sectionMap: Record<string, string> = {
    finalValue: 'reconciliation',
    landValue: 'reconciliation',
    buildingValue: 'reconciliation',
    unitNetArea: 'physical',
    unitGrossArea: 'physical',
    unitLandShare: 'physical',
    projectLandArea: 'physical',
    currentAge: 'physical',
    economicLife: 'physical',
    effectiveAge: 'physical',
    remainingLife: 'physical',
    landPricePerSqm: 'costApproach',
    constructionCostPerSqm: 'costApproach',
    monthlyRent: 'incomeApproach',
    annualIncome: 'incomeApproach',
    interestRate: 'incomeApproach',
    incomeMultiplier: 'grm',
    clientName: 'identification',
    ownerName: 'identification',
    governorate: 'identification',
    city: 'identification',
    district: 'identification',
    appraisalDate: 'identification',
  };

  const section = sectionMap[field] || 'identification';
  const sectionData = data[section] as Record<string, unknown>;
  sectionData[field] = value;
}

/**
 * Improved text extraction from PDF OCR results
 */
export function extractFromOCRText(text: string): Record<string, unknown> {
  const data: Record<string, unknown> = {
    identification: {} as Record<string, unknown>,
    physical: {} as Record<string, unknown>,
    costApproach: {} as Record<string, unknown>,
    incomeApproach: {} as Record<string, unknown>,
    grm: {} as Record<string, unknown>,
    reconciliation: {} as Record<string, unknown>,
  };

  // Try to extract each field using label patterns
  for (const [field, patterns] of Object.entries(LABEL_PATTERNS)) {
    // Try extracting number after the label
    let value = extractNumberAfterLabel(text, patterns);

    // If not found, try before the label (for RTL text)
    if (value === null) {
      value = extractNumberBeforeLabel(text, patterns);
    }

    if (value !== null) {
      setFieldValue(data, field, value);
    }
  }

  // Property type detection
  const textLower = text.toLowerCase();
  const identification = data.identification as Record<string, unknown>;
  if (textLower.includes('شقة') || textLower.includes('شمة') || textLower.includes('apartment')) {
    identification.propertyType = 'apartment';
  } else if (textLower.includes('فيلا') || textLower.includes('فيال') || textLower.includes('villa')) {
    identification.propertyType = 'villa';
  } else if (textLower.includes('دوبلكس') || textLower.includes('duplex')) {
    identification.propertyType = 'duplex';
  }

  // Finishing level detection
  const physical = data.physical as Record<string, unknown>;
  if (textLower.includes('سوبر لوكس') || textLower.includes('super lux')) {
    physical.finishingLevel = 'super_lux';
  } else if (textLower.includes('لوكس') || textLower.includes('luxury')) {
    physical.finishingLevel = 'luxury';
  } else if (textLower.includes('تشطيب كامل') || textLower.includes('تشطيب فاخر') || textLower.includes('full finish')) {
    physical.finishingLevel = 'full';
  } else if (textLower.includes('نصف تشطيب') || textLower.includes('half')) {
    physical.finishingLevel = 'half';
  } else if (textLower.includes('على الطوب') || textLower.includes('shell')) {
    physical.finishingLevel = 'shell';
  }

  // Tenancy detection
  if (textLower.includes('خالية') || textLower.includes('شاغر') || textLower.includes('vacant')) {
    identification.tenancy = 'vacant';
  } else if (textLower.includes('مستأجر') || textLower.includes('مؤجر') || textLower.includes('rented')) {
    identification.tenancy = 'rented';
  } else if (textLower.includes('مالك') || textLower.includes('owner')) {
    identification.tenancy = 'owner_occupied';
  }

  return data;
}
