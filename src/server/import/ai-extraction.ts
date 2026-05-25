/**
 * AI-Powered Extraction Module
 *
 * Uses Google Gemini Flash 2.5 for intelligent extraction of appraisal data
 * from Excel files. Much more accurate than heuristic pattern matching.
 */

import { GoogleGenAI } from '@google/genai';
import ExcelJS from 'exceljs';
import { resolveLocationIds } from './location-lookup';

// Gemini client will be initialized lazily to ensure env vars are loaded
let genaiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

// Map AI finishing level values to database enum values
const FINISHING_LEVEL_MAP: Record<string, string> = {
  'none': 'shell',
  'shell': 'shell',
  'partial': 'half',
  'half': 'half',
  'full': 'full',
  'luxury': 'luxury',
  'super_luxury': 'super_lux',
  'super_lux': 'super_lux',
};

function mapFinishingLevel(level: string | null | undefined): string {
  if (!level) return 'full';
  const normalized = level.toLowerCase().trim();
  return FINISHING_LEVEL_MAP[normalized] || 'full';
}

// Extraction prompt for Gemini - comprehensive extraction including all valuation methods
const EXTRACTION_PROMPT = `أنت خبير في استخراج البيانات من تقارير التقييم العقاري المصرية.

قم بتحليل محتوى ملف Excel التالي واستخراج جميع البيانات المتاحة بدقة.

**تعليمات مهمة:**
1. استخرج القيم الرقمية بدون فواصل أو رموز العملة
2. حول التواريخ إلى صيغة YYYY-MM-DD
3. إذا لم تجد قيمة، اتركها كـ null
4. ابحث عن القيم في أي مكان في الملف (قد تكون في جداول، خلايا منفصلة، أو نصوص)
5. القيم المالية غالباً تكون بالجنيه المصري
6. المساحات غالباً بالمتر المربع
7. ابحث عن جداول المقارنة (comparables) - عادة تحتوي على عقارات مشابهة تم بيعها
8. ابحث عن بيانات الإيجار والدخل إن وجدت

**البيانات المطلوبة:**

1. معلومات التعريف:
- رقم التقرير، نوع التقرير، اسم العميل، اسم المالك
- تاريخ التقييم، تاريخ انتهاء الصلاحية
- نوع العقار، حالة الإشغال
- العنوان الكامل (المحافظة، المدينة، الحي، اسم المشروع)
- رقم المبنى، رقم الوحدة، الدور

2. المواصفات الفنية:
- المساحة الصافية والإجمالية ونصيب الأرض
- عمر العقار (الحالي، الاقتصادي، الفعال)
- عدد الغرف والحمامات
- مستوى التشطيب (shell/half/full/luxury/super_lux)
- الواجهة، حمام السباحة

3. طريقة التكلفة (Cost Approach):
- سعر متر الأرض، عدد الأدوار المسموح والحالي
- تكلفة البناء للمتر، المساحة المبنية
- الإهلاك القابل للإصلاح، قيمة الحديقة/الجراج/المخزن

4. طريقة المقارنة (Sales Comparison) - ابحث عن جدول المقارنات:
- العقارات المقارنة (3-5 عقارات عادة)
- لكل عقار: العنوان، المصدر، الدور، تاريخ البيع، مساحة البناء، مساحة الأرض، سعر المتر، سعر البيع

5. طريقة الدخل (Income Approach):
- الإيجار الشهري، نسبة الشغور، العمر المتبقي، معدل الفائدة

6. دراسة السوق (Market Study):
- أسعار المتر للأرض (أدنى - أعلى)
- أسعار المتر للبناء نصف تشطيب (أدنى - أعلى)
- أسعار المتر للبناء كامل التشطيب (أدنى - أعلى)

7. نتائج التقييم النهائية:
- القيمة النهائية، قيمة الأرض، قيمة المباني
- طريقة التقييم المختارة

**محتوى الملف:**
{CONTENT}

**أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي:**
{
  "identification": {
    "reportNumber": string | null,
    "reportKind": "brief" | "narrative_full" | null,
    "clientName": string | null,
    "ownerName": string | null,
    "appraisalDate": string | null,
    "validUntil": string | null,
    "propertyType": "apartment" | "villa" | "duplex" | "commercial_shop" | "office" | "building" | "compound_unit" | "roof" | null,
    "tenancy": "vacant" | "owner_occupied" | "rented" | null,
    "addressDescription": string | null,
    "governorate": string | null,
    "city": string | null,
    "district": string | null,
    "compoundName": string | null,
    "buildingNumber": string | null,
    "unitNumber": string | null,
    "floor": number | null,
    "plotNumber": string | null
  },
  "physical": {
    "unitNetArea": number | null,
    "unitGrossArea": number | null,
    "unitLandShare": number | null,
    "projectLandArea": number | null,
    "currentAge": number | null,
    "economicLife": number | null,
    "effectiveAge": number | null,
    "bedrooms": number | null,
    "bathrooms": number | null,
    "totalRooms": number | null,
    "finishingLevel": "shell" | "half" | "full" | "luxury" | "super_lux" | null,
    "hasPool": boolean | null,
    "orientation": "north" | "south" | "east" | "west" | "corner" | null
  },
  "costApproach": {
    "landPricePerSqm": number | null,
    "allowedFloors": number | null,
    "currentFloors": number | null,
    "constructionPerSqm": number | null,
    "totalBuiltArea": number | null,
    "unitAreaToValue": number | null,
    "repairableDepreciation": number | null,
    "gardenValue": number | null,
    "garageValue": number | null,
    "storageValue": number | null
  },
  "salesComparison": {
    "subjectBuildingArea": number | null,
    "subjectLandArea": number | null,
    "comparables": [
      {
        "address": string | null,
        "source": string | null,
        "floor": number | null,
        "saleTiming": string | null,
        "tenancy": "vacant" | "owner_occupied" | "rented" | null,
        "ageYears": number | null,
        "orientation": string | null,
        "finishingLevel": "shell" | "half" | "full" | "luxury" | "super_lux" | null,
        "hasPool": boolean | null,
        "buildingAreaSqm": number | null,
        "landAreaSqm": number | null,
        "buildingPricePerSqm": number | null,
        "salePrice": number | null
      }
    ]
  },
  "incomeApproach": {
    "monthlyRent": number | null,
    "vacancyRate": number | null,
    "remainingLife": number | null,
    "interestRate": number | null
  },
  "marketStudy": {
    "landPriceLow": number | null,
    "landPriceHigh": number | null,
    "buildingHalfFinishLow": number | null,
    "buildingHalfFinishHigh": number | null,
    "buildingFullFinishLow": number | null,
    "buildingFullFinishHigh": number | null
  },
  "valuation": {
    "finalValue": number | null,
    "landValue": number | null,
    "buildingValue": number | null,
    "pricePerMeterLand": number | null,
    "pricePerMeterBuilding": number | null,
    "depreciationRate": number | null,
    "chosenMethod": "cost" | "sales_comparison" | "income" | null
  }
}`;

/**
 * Extract text content from Excel workbook for AI processing
 */
export async function extractExcelContent(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const content: string[] = [];

  workbook.eachSheet((worksheet, sheetId) => {
    content.push(`\n=== ورقة ${sheetId}: ${worksheet.name} ===\n`);

    const rows: string[][] = [];
    let maxCol = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let value = '';

        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object') {
            if ('result' in cell.value) {
              // Formula with result
              value = String(cell.value.result ?? '');
            } else if ('richText' in cell.value) {
              // Rich text
              value = (cell.value.richText as Array<{ text: string }>)
                .map(rt => rt.text)
                .join('');
            } else if ('text' in cell.value) {
              // Hyperlink or similar
              value = String((cell.value as { text: string }).text);
            } else {
              value = String(cell.value);
            }
          } else {
            value = String(cell.value);
          }
        }

        // Clean up the value
        value = value.trim();
        if (value) {
          rowData[colNumber - 1] = value;
          maxCol = Math.max(maxCol, colNumber);
        }
      });

      if (rowData.some(v => v)) {
        rows[rowNumber - 1] = rowData;
      }
    });

    // Format as readable text with row/column context
    rows.forEach((row, rowIdx) => {
      if (row && row.some(v => v)) {
        const cells = row
          .map((v, colIdx) => v ? `[${colIdx + 1}]${v}` : '')
          .filter(v => v)
          .join(' | ');
        content.push(`صف ${rowIdx + 1}: ${cells}`);
      }
    });
  });

  return content.join('\n');
}

/**
 * Extract appraisal data using Gemini AI
 */
export async function extractWithAI(buffer: Buffer): Promise<{
  data: Record<string, unknown>;
  confidence: number;
  method: 'ai';
  warnings: Array<{ message: string; severity: 'info' | 'warning' | 'error' }>;
}> {
  const warnings: Array<{ message: string; severity: 'info' | 'warning' | 'error' }> = [];

  try {
    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Extract content from Excel
    console.log('[AI Extraction] Extracting content from Excel...');
    const content = await extractExcelContent(buffer);
    console.log(`[AI Extraction] Extracted ${content.length} characters of content`);

    // Gemini 2.5 Flash has 1M token context - we can use more content
    // 50k chars ~ 12.5k tokens, well within limits
    const truncatedContent = content.length > 50000
      ? content.slice(0, 50000) + '\n\n[... محتوى إضافي تم اختصاره ...]'
      : content;

    console.log(`[AI Extraction] Using ${truncatedContent.length} characters of content`);

    // Prepare prompt
    const prompt = EXTRACTION_PROMPT.replace('{CONTENT}', truncatedContent);

    // Call Gemini Flash
    console.log('[AI Extraction] Calling Gemini Flash 2.5...');
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1, // Low temperature for consistent extraction
        maxOutputTokens: 16384, // Large enough for comprehensive JSON output
        responseMimeType: 'application/json', // Request JSON directly
      },
    });

    const text = response.text ?? '';

    console.log('[AI Extraction] Received response, parsing JSON...');
    console.log('[AI Extraction] Raw response length:', text.length);
    console.log('[AI Extraction] Raw response preview:', text.slice(0, 500));

    // Extract JSON from response - handle markdown code blocks
    let jsonStr = text.trim();

    // Remove markdown code block markers (handle various formats)
    jsonStr = jsonStr.replace(/^```json\s*/im, '');
    jsonStr = jsonStr.replace(/^```\s*/im, '');
    jsonStr = jsonStr.replace(/\s*```\s*$/im, '');

    // Find the JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    console.log('[AI Extraction] Cleaned JSON length:', jsonStr.length);

    // Parse JSON response
    const extracted = JSON.parse(jsonStr);

    // Calculate confidence based on extracted fields
    let extractedCount = 0;
    let totalCount = 0;

    const countFields = (obj: Record<string, unknown>) => {
      for (const value of Object.values(obj)) {
        totalCount++;
        if (value !== null && value !== undefined && value !== '') {
          extractedCount++;
        }
      }
    };

    if (extracted.identification) countFields(extracted.identification);
    if (extracted.physical) countFields(extracted.physical);
    if (extracted.costApproach) countFields(extracted.costApproach);
    if (extracted.incomeApproach) countFields(extracted.incomeApproach);
    if (extracted.marketStudy) countFields(extracted.marketStudy);
    if (extracted.valuation) countFields(extracted.valuation);
    // Count comparables separately
    const comparablesCount = (extracted.salesComparison?.comparables || []).length;
    if (comparablesCount > 0) {
      extractedCount += 1; // Count having comparables as one extracted field
      totalCount += 1;
    }

    const confidence = totalCount > 0 ? extractedCount / totalCount : 0;

    console.log(`[AI Extraction] Extracted ${extractedCount}/${totalCount} fields (${(confidence * 100).toFixed(1)}%)`);

    // Map comparables with proper finishing level mapping
    const comparables = (extracted.salesComparison?.comparables || [])
      .filter((c: Record<string, unknown>) => c && (c.address || c.salePrice))
      .map((c: Record<string, unknown>) => ({
        address: c.address || null,
        source: c.source || null,
        floor: c.floor || null,
        saleTiming: c.saleTiming || null,
        tenancy: c.tenancy || 'vacant',
        ageYears: c.ageYears || null,
        orientation: c.orientation || null,
        finishingLevel: mapFinishingLevel(c.finishingLevel as string),
        hasPool: c.hasPool || false,
        buildingAreaSqm: c.buildingAreaSqm || null,
        landAreaSqm: c.landAreaSqm || null,
        buildingPricePerSqm: c.buildingPricePerSqm || null,
        salePrice: c.salePrice || null,
      }));

    // Map to our expected format - comprehensive with all valuation methods
    const data = {
      identification: {
        reportNumber: extracted.identification?.reportNumber,
        reportKind: extracted.identification?.reportKind || 'narrative_full',
        clientName: extracted.identification?.clientName,
        ownerName: extracted.identification?.ownerName,
        appraisalDate: extracted.identification?.appraisalDate,
        validUntil: extracted.identification?.validUntil,
        propertyType: extracted.identification?.propertyType || 'apartment',
        tenancy: extracted.identification?.tenancy || 'vacant',
        addressDescription: extracted.identification?.addressDescription,
        governorate: extracted.identification?.governorate,
        city: extracted.identification?.city,
        district: extracted.identification?.district,
        compoundName: extracted.identification?.compoundName,
        buildingNumber: extracted.identification?.buildingNumber,
        unitNumber: extracted.identification?.unitNumber,
        floor: extracted.identification?.floor,
        plotNumber: extracted.identification?.plotNumber,
      },
      physical: {
        unitNetArea: extracted.physical?.unitNetArea,
        unitGrossArea: extracted.physical?.unitGrossArea,
        unitLandShare: extracted.physical?.unitLandShare,
        projectLandArea: extracted.physical?.projectLandArea,
        currentAge: extracted.physical?.currentAge,
        economicLife: extracted.physical?.economicLife || 60,
        effectiveAge: extracted.physical?.effectiveAge,
        bedrooms: extracted.physical?.bedrooms,
        bathrooms: extracted.physical?.bathrooms,
        totalRooms: extracted.physical?.totalRooms,
        finishingLevel: mapFinishingLevel(extracted.physical?.finishingLevel),
        hasPool: extracted.physical?.hasPool || false,
        orientation: extracted.physical?.orientation,
      },
      costApproach: {
        landPricePerSqm: extracted.costApproach?.landPricePerSqm,
        allowedFloors: extracted.costApproach?.allowedFloors,
        currentFloors: extracted.costApproach?.currentFloors,
        constructionPerSqm: extracted.costApproach?.constructionPerSqm,
        totalBuiltArea: extracted.costApproach?.totalBuiltArea,
        unitAreaToValue: extracted.costApproach?.unitAreaToValue,
        repairableDepreciation: extracted.costApproach?.repairableDepreciation || 0,
        gardenValue: extracted.costApproach?.gardenValue || 0,
        garageValue: extracted.costApproach?.garageValue || 0,
        storageValue: extracted.costApproach?.storageValue || 0,
      },
      salesComparison: {
        subjectBuildingArea: extracted.salesComparison?.subjectBuildingArea,
        subjectLandArea: extracted.salesComparison?.subjectLandArea,
        comparables,
      },
      incomeApproach: {
        monthlyRent: extracted.incomeApproach?.monthlyRent,
        vacancyRate: extracted.incomeApproach?.vacancyRate,
        remainingLife: extracted.incomeApproach?.remainingLife,
        interestRate: extracted.incomeApproach?.interestRate,
      },
      marketStudy: {
        landPriceLow: extracted.marketStudy?.landPriceLow,
        landPriceHigh: extracted.marketStudy?.landPriceHigh,
        buildingHalfFinishLow: extracted.marketStudy?.buildingHalfFinishLow,
        buildingHalfFinishHigh: extracted.marketStudy?.buildingHalfFinishHigh,
        buildingFullFinishLow: extracted.marketStudy?.buildingFullFinishLow,
        buildingFullFinishHigh: extracted.marketStudy?.buildingFullFinishHigh,
      },
      reconciliation: {
        finalValue: extracted.valuation?.finalValue,
        landValue: extracted.valuation?.landValue,
        buildingValue: extracted.valuation?.buildingValue,
        pricePerMeterLand: extracted.valuation?.pricePerMeterLand,
        pricePerMeterBuilding: extracted.valuation?.pricePerMeterBuilding,
        depreciationRate: extracted.valuation?.depreciationRate,
        chosenMethod: extracted.valuation?.chosenMethod || 'cost',
      },
    };

    // Resolve location names to IDs
    console.log('[AI Extraction] Resolving location IDs...');
    try {
      const locationIds = await resolveLocationIds({
        governorate: extracted.identification?.governorate,
        city: extracted.identification?.city,
        district: extracted.identification?.district,
      });

      // Add resolved IDs to the data
      (data.identification as Record<string, unknown>).governorate_id = locationIds.governorate_id;
      (data.identification as Record<string, unknown>).city_id = locationIds.city_id;
      (data.identification as Record<string, unknown>).district_id = locationIds.district_id;

      if (locationIds.governorate_id || locationIds.city_id || locationIds.district_id) {
        warnings.push({
          message: `Location IDs resolved: gov=${locationIds.governorate_id ? 'yes' : 'no'}, city=${locationIds.city_id ? 'yes' : 'no'}, district=${locationIds.district_id ? 'yes' : 'no'}`,
          severity: 'info',
        });
      }
    } catch (locationError) {
      console.error('[AI Extraction] Location lookup error:', locationError);
      warnings.push({
        message: 'Location ID resolution failed - manual selection required',
        severity: 'warning',
      });
    }

    warnings.push({
      message: `AI extraction completed: ${extractedCount}/${totalCount} fields (${(confidence * 100).toFixed(1)}% confidence)`,
      severity: confidence > 0.7 ? 'info' : confidence > 0.5 ? 'warning' : 'error',
    });

    return {
      data,
      confidence,
      method: 'ai',
      warnings,
    };

  } catch (error) {
    console.error('[AI Extraction] Error:', error);

    warnings.push({
      message: `AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
    });

    // Return empty data with low confidence
    return {
      data: {
        identification: {},
        physical: {},
        reconciliation: {},
      },
      confidence: 0,
      method: 'ai',
      warnings,
    };
  }
}

/**
 * Check if AI extraction is available
 */
export function isAIExtractionAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
