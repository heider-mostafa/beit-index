/**
 * AI-Powered Extraction Module v2
 *
 * Processes Excel files sheet-by-sheet for maximum extraction accuracy.
 * Extracts photos with their labels and maps everything to form fields.
 */

import { GoogleGenAI } from '@google/genai';
import ExcelJS from 'exceljs';
import { resolveLocationIds } from './location-lookup';

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

// Map finishing level values to database enum
const FINISHING_LEVEL_MAP: Record<string, string> = {
  'none': 'shell', 'shell': 'shell', 'بدون': 'shell', 'على الطوب': 'shell',
  'partial': 'half', 'half': 'half', 'نصف': 'half', 'نصف تشطيب': 'half',
  'full': 'full', 'تشطيب كامل': 'full', 'كامل': 'full',
  'luxury': 'luxury', 'فاخر': 'luxury', 'تشطيب فاخر': 'luxury',
  'super_luxury': 'super_lux', 'super_lux': 'super_lux', 'سوبر لوكس': 'super_lux',
};

function mapFinishingLevel(level: string | null | undefined): string {
  if (!level) return 'full';
  const normalized = level.toLowerCase().trim();
  return FINISHING_LEVEL_MAP[normalized] || 'full';
}

export interface ExtractedPhoto {
  sheetName: string;
  position: { row: number; col: number };
  extension: string;
  buffer: Buffer;
  label: string | null;
  category: 'facade' | 'aerial' | 'interior' | 'kitchen' | 'bathroom' | 'bedroom' | 'reception' | 'other';
}

interface SheetContent {
  name: string;
  content: string;
  rowCount: number;
  hasImages: boolean;
  imageCount: number;
}

/**
 * Extract content from each sheet separately
 */
async function extractSheetContents(workbook: ExcelJS.Workbook): Promise<SheetContent[]> {
  const sheets: SheetContent[] = [];

  for (const worksheet of workbook.worksheets) {
    const rows: string[] = [];
    let rowCount = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let value = '';
        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object') {
            if ('result' in cell.value) {
              value = String(cell.value.result ?? '');
            } else if ('richText' in cell.value) {
              value = (cell.value.richText as Array<{ text: string }>)
                .map(rt => rt.text).join('');
            } else if ('text' in cell.value) {
              value = String((cell.value as { text: string }).text);
            } else if (cell.value instanceof Date) {
              value = cell.value.toISOString().split('T')[0];
            } else {
              value = String(cell.value);
            }
          } else {
            value = String(cell.value);
          }
        }
        value = value.trim();
        if (value && value !== '[object Object]' && value !== 'Invalid Date') {
          cells.push(`[${colNumber}]${value}`);
        }
      });
      if (cells.length > 0) {
        rows.push(`R${rowNumber}: ${cells.join(' | ')}`);
        rowCount++;
      }
    });

    const images = worksheet.getImages();

    sheets.push({
      name: worksheet.name,
      content: rows.join('\n'),
      rowCount,
      hasImages: images.length > 0,
      imageCount: images.length,
    });
  }

  return sheets;
}

/**
 * Extract photos with their nearby labels
 */
export async function extractPhotosWithLabels(workbook: ExcelJS.Workbook): Promise<ExtractedPhoto[]> {
  const photos: ExtractedPhoto[] = [];

  // Label patterns for categorization
  const categoryPatterns: Record<string, RegExp[]> = {
    facade: [/واجه/i, /امامي/i, /facade/i, /front/i],
    aerial: [/جوي/i, /aerial/i, /مسقط/i],
    interior: [/داخل/i, /interior/i],
    kitchen: [/مطبخ/i, /kitchen/i],
    bathroom: [/حمام/i, /bathroom/i, /toilet/i],
    bedroom: [/نوم/i, /bedroom/i, /غرف/i],
    reception: [/رسبشن/i, /استقبال/i, /معيشة/i, /reception/i, /living/i],
  };

  for (const worksheet of workbook.worksheets) {
    const images = worksheet.getImages();

    for (const image of images) {
      const imageData = workbook.getImage(Number(image.imageId));
      if (!imageData?.buffer) continue;

      // Get image position
      const row = Math.floor(image.range?.tl?.row || 0);
      const col = Math.floor(image.range?.tl?.col || 0);

      // Find nearby label (check cells around the image)
      let label: string | null = null;
      const searchOffsets = [
        { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 },
        { r: -2, c: 0 }, { r: 2, c: 0 }, { r: 0, c: -2 }, { r: 0, c: 2 },
      ];

      for (const offset of searchOffsets) {
        try {
          const targetRow = row + 1 + offset.r;
          const targetCol = col + 1 + offset.c;
          if (targetRow < 1 || targetCol < 1) continue;

          const cell = worksheet.getCell(targetRow, targetCol);
          let cellValue: string | null = null;

          if (cell.value) {
            if (typeof cell.value === 'string') {
              cellValue = cell.value;
            } else if (typeof cell.value === 'object' && 'richText' in cell.value) {
              cellValue = (cell.value.richText as Array<{ text: string }>)
                .map(rt => rt.text).join('');
            } else if (typeof cell.value === 'object' && 'text' in cell.value) {
              cellValue = String((cell.value as { text: string }).text);
            }
          }

          if (cellValue && /[\u0600-\u06FF]/.test(cellValue)) {
            label = cellValue.trim();
            break;
          }
        } catch {
          // Skip cells that can't be accessed
          continue;
        }
      }

      // Determine category from label or sheet name
      let category: ExtractedPhoto['category'] = 'other';
      const searchText = `${label || ''} ${worksheet.name}`.toLowerCase();

      for (const [cat, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(p => p.test(searchText))) {
          category = cat as ExtractedPhoto['category'];
          break;
        }
      }

      photos.push({
        sheetName: worksheet.name,
        position: { row, col },
        extension: imageData.extension || 'png',
        buffer: Buffer.from(imageData.buffer as ArrayBuffer),
        label,
        category,
      });
    }
  }

  return photos;
}

/**
 * Main extraction function - processes all sheets
 */
export async function extractWithAIv2(buffer: Buffer): Promise<{
  data: Record<string, unknown>;
  photos: ExtractedPhoto[];
  confidence: number;
  method: 'ai-v2';
  warnings: Array<{ message: string; severity: 'info' | 'warning' | 'error' }>;
  sheetsSummary: Array<{ name: string; extracted: boolean; fields: number }>;
}> {
  const warnings: Array<{ message: string; severity: 'info' | 'warning' | 'error' }> = [];
  const sheetsSummary: Array<{ name: string; extracted: boolean; fields: number }> = [];

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    console.log('[AI v2] Processing workbook with', workbook.worksheets.length, 'sheets');

    // Extract sheet contents
    const sheets = await extractSheetContents(workbook);

    // Extract photos
    console.log('[AI v2] Extracting photos with labels...');
    const photos = await extractPhotosWithLabels(workbook);
    console.log(`[AI v2] Found ${photos.length} photos`);

    // Build comprehensive content for AI
    let fullContent = '';
    for (const sheet of sheets) {
      if (sheet.content.length > 0) {
        fullContent += `\n\n=== ورقة: ${sheet.name} (${sheet.rowCount} صف${sheet.hasImages ? `, ${sheet.imageCount} صورة` : ''}) ===\n`;
        fullContent += sheet.content;
      }
    }

    // Truncate if needed but try to include all sheets
    const maxChars = 50000; // Increased for multi-sheet
    if (fullContent.length > maxChars) {
      fullContent = fullContent.slice(0, maxChars) + '\n\n[... محتوى إضافي ...]';
    }

    console.log(`[AI v2] Total content: ${fullContent.length} chars`);

    // Call Gemini with comprehensive prompt
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildComprehensivePrompt(fullContent),
      config: {
        temperature: 0.1,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ?? '';
    console.log('[AI v2] Response length:', text.length);

    // Parse response
    let extracted: Record<string, unknown>;
    try {
      let jsonStr = text.trim();
      jsonStr = jsonStr.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '');
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      extracted = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[AI v2] JSON parse error:', e);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Calculate field count
    let extractedCount = 0;
    let totalCount = 0;
    const countFields = (obj: Record<string, unknown>, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          countFields(value as Record<string, unknown>, `${prefix}${key}.`);
        } else {
          totalCount++;
          if (value !== null && value !== undefined && value !== '') {
            extractedCount++;
          }
        }
      }
    };
    countFields(extracted);

    // Map comparables
    const comparables = (extracted.salesComparison as Record<string, unknown>)?.comparables || [];
    const mappedComparables = Array.isArray(comparables) ? comparables.filter(
      (c: Record<string, unknown>) => c && (c.address || c.salePrice)
    ).map((c: Record<string, unknown>) => ({
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
    })) : [];

    // Build final data structure mapped to form fields
    const identification = extracted.identification as Record<string, unknown> || {};
    const physical = extracted.physical as Record<string, unknown> || {};
    const costApproach = extracted.costApproach as Record<string, unknown> || {};
    const salesComparison = extracted.salesComparison as Record<string, unknown> || {};
    const incomeApproach = extracted.incomeApproach as Record<string, unknown> || {};
    const marketStudy = extracted.marketStudy as Record<string, unknown> || {};
    const valuation = extracted.valuation as Record<string, unknown> || {};

    const data = {
      identification: {
        reportNumber: identification.reportNumber,
        reportKind: identification.reportKind || 'narrative_full',
        clientName: identification.clientName,
        ownerName: identification.ownerName,
        appraisalDate: identification.appraisalDate,
        validUntil: identification.validUntil,
        propertyType: identification.propertyType || 'apartment',
        tenancy: identification.tenancy || 'vacant',
        addressDescription: identification.addressDescription,
        governorate: identification.governorate,
        city: identification.city,
        district: identification.district,
        compoundName: identification.compoundName,
        buildingNumber: identification.buildingNumber,
        unitNumber: identification.unitNumber,
        floor: identification.floor,
        plotNumber: identification.plotNumber,
      },
      physical: {
        unitNetArea: physical.unitNetArea,
        unitGrossArea: physical.unitGrossArea,
        unitLandShare: physical.unitLandShare,
        projectLandArea: physical.projectLandArea,
        currentAge: physical.currentAge,
        economicLife: physical.economicLife || 60,
        effectiveAge: physical.effectiveAge,
        bedrooms: physical.bedrooms,
        bathrooms: physical.bathrooms,
        totalRooms: physical.totalRooms,
        finishingLevel: mapFinishingLevel(physical.finishingLevel as string),
        hasPool: physical.hasPool || false,
        orientation: physical.orientation,
      },
      costApproach: {
        landPricePerSqm: costApproach.landPricePerSqm,
        allowedFloors: costApproach.allowedFloors,
        currentFloors: costApproach.currentFloors,
        constructionPerSqm: costApproach.constructionPerSqm,
        totalBuiltArea: costApproach.totalBuiltArea,
        unitAreaToValue: costApproach.unitAreaToValue,
        repairableDepreciation: costApproach.repairableDepreciation || 0,
        gardenValue: costApproach.gardenValue || 0,
        garageValue: costApproach.garageValue || 0,
        storageValue: costApproach.storageValue || 0,
      },
      salesComparison: {
        subjectBuildingArea: salesComparison.subjectBuildingArea,
        subjectLandArea: salesComparison.subjectLandArea,
        comparables: mappedComparables,
        salesFinalValue: salesComparison.salesFinalValue,
        salesNarrative: salesComparison.salesNarrative,
      },
      incomeApproach: {
        monthlyRent: incomeApproach.monthlyRent,
        vacancyRate: incomeApproach.vacancyRate,
        remainingLife: incomeApproach.remainingLife,
        interestRate: incomeApproach.interestRate,
      },
      marketStudy: {
        landPriceLow: marketStudy.landPriceLow,
        landPriceHigh: marketStudy.landPriceHigh,
        buildingHalfFinishLow: marketStudy.buildingHalfFinishLow,
        buildingHalfFinishHigh: marketStudy.buildingHalfFinishHigh,
        buildingFullFinishLow: marketStudy.buildingFullFinishLow,
        buildingFullFinishHigh: marketStudy.buildingFullFinishHigh,
        marketNotes: marketStudy.marketNotes,
      },
      reconciliation: {
        finalValue: valuation.finalValue,
        landValue: valuation.landValue,
        buildingValue: valuation.buildingValue,
        pricePerMeterLand: valuation.pricePerMeterLand,
        pricePerMeterBuilding: valuation.pricePerMeterBuilding,
        depreciationRate: valuation.depreciationRate,
        chosenMethod: valuation.chosenMethod || 'cost',
        reconciliationRationale: valuation.reconciliationRationale,
        monthlyRentReconciled: valuation.monthlyRentReconciled,
      },
    };

    // Resolve location IDs
    console.log('[AI v2] Resolving location IDs...');
    try {
      const locationIds = await resolveLocationIds({
        governorate: identification.governorate as string,
        city: identification.city as string,
        district: identification.district as string,
      });
      (data.identification as Record<string, unknown>).governorate_id = locationIds.governorate_id;
      (data.identification as Record<string, unknown>).city_id = locationIds.city_id;
      (data.identification as Record<string, unknown>).district_id = locationIds.district_id;
    } catch (e) {
      console.error('[AI v2] Location lookup failed:', e);
    }

    const confidence = totalCount > 0 ? extractedCount / totalCount : 0;
    console.log(`[AI v2] Extracted ${extractedCount}/${totalCount} fields (${(confidence * 100).toFixed(1)}%)`);
    console.log(`[AI v2] Comparables found: ${mappedComparables.length}`);

    warnings.push({
      message: `AI v2 extraction: ${extractedCount}/${totalCount} fields (${(confidence * 100).toFixed(1)}%), ${photos.length} photos, ${mappedComparables.length} comparables`,
      severity: confidence > 0.7 ? 'info' : confidence > 0.5 ? 'warning' : 'error',
    });

    return {
      data,
      photos,
      confidence,
      method: 'ai-v2',
      warnings,
      sheetsSummary,
    };

  } catch (error) {
    console.error('[AI v2] Error:', error);
    warnings.push({
      message: `AI v2 extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
    });

    return {
      data: { identification: {}, physical: {}, reconciliation: {} },
      photos: [],
      confidence: 0,
      method: 'ai-v2',
      warnings,
      sheetsSummary,
    };
  }
}

/**
 * Build comprehensive prompt for all data extraction
 */
function buildComprehensivePrompt(content: string): string {
  return `أنت خبير في استخراج البيانات من تقارير التقييم العقاري المصرية.

قم بتحليل جميع أوراق ملف Excel واستخراج كل البيانات المتاحة بدقة.

**تعليمات مهمة:**
1. استخرج القيم الرقمية بدون فواصل أو رموز
2. حول التواريخ إلى YYYY-MM-DD
3. ابحث في كل الأوراق - البيانات موزعة على أوراق مختلفة
4. ابحث عن جدول المقارنات (comparables) - عادة 3-5 عقارات مشابهة
5. استخرج أسعار السوق (أدنى - أعلى) للأرض والبناء
6. استخرج بيانات الإيجار إن وجدت

**محتوى الملف:**
${content}

**أرجع JSON فقط:**
{
  "identification": {
    "reportNumber": string | null,
    "reportKind": "brief" | "narrative_full",
    "clientName": string | null,
    "ownerName": string | null,
    "appraisalDate": "YYYY-MM-DD" | null,
    "validUntil": "YYYY-MM-DD" | null,
    "propertyType": "apartment" | "villa" | "duplex" | "commercial_shop" | "office" | "building",
    "tenancy": "vacant" | "owner_occupied" | "rented",
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
    "finishingLevel": "shell" | "half" | "full" | "luxury" | "super_lux",
    "hasPool": boolean,
    "orientation": string | null
  },
  "costApproach": {
    "landPricePerSqm": number | null,
    "allowedFloors": number | null,
    "currentFloors": number | null,
    "constructionPerSqm": number | null,
    "totalBuiltArea": number | null,
    "unitAreaToValue": number | null
  },
  "salesComparison": {
    "subjectBuildingArea": number | null,
    "subjectLandArea": number | null,
    "salesFinalValue": number | null,
    "comparables": [
      {
        "address": string,
        "source": string | null,
        "floor": number | null,
        "saleTiming": string | null,
        "tenancy": "vacant" | "owner_occupied" | "rented",
        "ageYears": number | null,
        "orientation": string | null,
        "finishingLevel": "shell" | "half" | "full" | "luxury" | "super_lux",
        "hasPool": boolean,
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
    "chosenMethod": "cost" | "sales_comparison" | "income",
    "monthlyRentReconciled": number | null
  }
}`;
}
