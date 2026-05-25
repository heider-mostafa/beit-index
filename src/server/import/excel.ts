/**
 * Excel Parser
 *
 * Extracts appraisal report data from Excel files.
 * Uses template-specific cell mappings when a known template is detected,
 * falls back to heuristic label-based extraction otherwise.
 */

import ExcelJS from 'exceljs';
import { fingerprintWorkbook, type FingerprintResult } from './fingerprint';
import { getTemplate, type CellMapping } from './templates';
import { heuristicExcelExtraction } from './heuristic';
import { extractImagesFromWorkbook, type ExtractedImage, summarizeImages } from './images';
import { extractWithAI, isAIExtractionAvailable } from './ai-extraction';

export interface ParseWarning {
  field: string;
  cell: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ParseResult {
  success: boolean;
  templateId: string | null;
  fingerprint: FingerprintResult;
  data: Record<string, unknown> | null;
  warnings: ParseWarning[];
  missingRequired: string[];
  images: ExtractedImage[];
}

export type { ExtractedImage } from './images';

/**
 * Parse an Excel workbook and extract report data
 */
export async function parseExcelWorkbook(
  workbook: ExcelJS.Workbook
): Promise<ParseResult> {
  // First, fingerprint the workbook to identify the template
  const fingerprint = await fingerprintWorkbook(workbook);

  // Extract images from all worksheets
  const images = extractImagesFromWorkbook(workbook);

  // If no template matched, try AI extraction first, then fall back to heuristic
  if (!fingerprint.matched || !fingerprint.templateId) {
    // Try AI extraction first if available
    if (isAIExtractionAvailable()) {
      try {
        console.log('[Excel Parser] No template matched, trying AI extraction...');

        // Get workbook buffer for AI extraction
        const buffer = await workbook.xlsx.writeBuffer();
        const aiResult = await extractWithAI(Buffer.from(buffer));

        if (aiResult.confidence > 0.3) {
          console.log(`[Excel Parser] AI extraction succeeded with ${(aiResult.confidence * 100).toFixed(1)}% confidence`);

          return {
            success: true,
            templateId: 'ai-extraction',
            fingerprint: {
              ...fingerprint,
              confidence: aiResult.confidence,
              templateId: 'ai-extraction',
              templateName: 'AI Extraction (Gemini Flash)',
            },
            data: aiResult.data,
            warnings: aiResult.warnings.map(w => ({
              field: 'ai',
              cell: '',
              message: w.message,
              severity: w.severity,
            })),
            missingRequired: [],
            images,
          };
        } else {
          console.log('[Excel Parser] AI extraction confidence too low, falling back to heuristic');
        }
      } catch (error) {
        console.error('[Excel Parser] AI extraction failed:', error);
      }
    }

    // Fall back to heuristic extraction
    const worksheetName = (fingerprint as { worksheetName?: string }).worksheetName;
    const worksheet = worksheetName
      ? workbook.getWorksheet(worksheetName) || workbook.worksheets[0]
      : workbook.worksheets[0];

    const { data: heuristicData, confidence } = heuristicExcelExtraction(worksheet);

    // Check if we have any extracted data (including generic raw extractions)
    const hasRawData = heuristicData.rawExtracted &&
      Object.keys(heuristicData.rawExtracted as Record<string, unknown>).length > 0;

    return {
      // Success if we have pattern matches OR generic extractions
      // This ensures files go to review instead of failing
      success: confidence > 0.05 || hasRawData, // Lowered threshold, allow any extracted data
      templateId: 'heuristic',
      fingerprint: {
        ...fingerprint,
        confidence,
        templateId: 'heuristic',
        templateName: 'Heuristic Extraction',
      },
      data: heuristicData,
      warnings: [
        {
          field: 'template',
          cell: '',
          message: `No known template matched. Using heuristic extraction (${Math.round(confidence * 100)}% confidence). Manual review required.`,
          severity: 'warning',
        },
      ],
      missingRequired: [],
      images,
    };
  }

  // Get the template definition
  const template = getTemplate(fingerprint.templateId);
  if (!template) {
    return {
      success: false,
      templateId: fingerprint.templateId,
      fingerprint,
      data: null,
      warnings: [
        {
          field: 'template',
          cell: '',
          message: `Template ${fingerprint.templateId} not found in registry.`,
          severity: 'error',
        },
      ],
      missingRequired: [],
      images,
    };
  }

  // Extract data using cell mappings from the matched worksheet
  const worksheetName = (fingerprint as { worksheetName?: string }).worksheetName;
  const worksheet = worksheetName
    ? workbook.getWorksheet(worksheetName) || workbook.worksheets[0]
    : workbook.worksheets[0];
  const { data, warnings, missingRequired } = extractData(worksheet, template.cells);

  // Clean up comparables array (remove empty entries)
  if (data.salesComparison && typeof data.salesComparison === 'object') {
    const sc = data.salesComparison as Record<string, unknown>;
    if (Array.isArray(sc.comparables)) {
      sc.comparables = sc.comparables.filter((comp: Record<string, unknown>) => {
        // Keep comparables that have at least address or salePrice
        return comp && (comp.address || comp.salePrice);
      });
    }
  }

  return {
    success: missingRequired.length === 0,
    templateId: fingerprint.templateId,
    fingerprint,
    data,
    warnings,
    missingRequired,
    images,
  };
}

/**
 * Extract data from worksheet using cell mappings
 */
function extractData(
  worksheet: ExcelJS.Worksheet,
  cells: CellMapping[]
): {
  data: Record<string, unknown>;
  warnings: ParseWarning[];
  missingRequired: string[];
} {
  const data: Record<string, unknown> = {};
  const warnings: ParseWarning[] = [];
  const missingRequired: string[] = [];

  for (const mapping of cells) {
    const cell = worksheet.getCell(mapping.cell);
    let value: string | number | boolean | Date | null = getCellValue(cell, mapping.type);

    // Apply transform if defined
    if (value !== null && value !== undefined && mapping.transform) {
      try {
        const transformed = mapping.transform(value);
        value = transformed as string | number | boolean | Date | null;
      } catch (e) {
        warnings.push({
          field: mapping.path,
          cell: mapping.cell,
          message: `Transform failed: ${(e as Error).message}`,
          severity: 'warning',
        });
      }
    }

    // Check for required fields
    if (mapping.required && (value === null || value === undefined || value === '')) {
      missingRequired.push(mapping.path);
      warnings.push({
        field: mapping.path,
        cell: mapping.cell,
        message: `Required field is empty`,
        severity: 'error',
      });
    }

    // Set value at path
    if (value !== null && value !== undefined && value !== '') {
      setNestedValue(data, mapping.path, value);
    }
  }

  return { data, warnings, missingRequired };
}

/**
 * Get typed value from a cell
 */
function getCellValue(
  cell: ExcelJS.Cell,
  type: CellMapping['type']
): string | number | boolean | Date | null {
  const rawValue = cell.value;

  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  // Handle formula results
  let value: string | number | boolean | Date | null | undefined = rawValue as string | number | boolean | Date | null | undefined;
  if (typeof rawValue === 'object' && rawValue !== null && 'result' in rawValue) {
    value = (rawValue as { result: string | number | boolean | Date | null }).result;
  }

  // Handle rich text
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    value = (value as { richText: Array<{ text: string }> }).richText
      .map((rt) => rt.text)
      .join('');
  }

  // Convert based on expected type
  switch (type) {
    case 'number': {
      const num = Number(value);
      return isNaN(num) ? null : num;
    }
    case 'string': {
      return String(value).trim();
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return lower === 'yes' || lower === 'نعم' || lower === 'true' || lower === '1';
      }
      if (typeof value === 'number') return value !== 0;
      return false;
    }
    case 'date': {
      if (value instanceof Date) return value;
      if (typeof value === 'number') {
        // Excel serial date
        return excelDateToJSDate(value);
      }
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Convert Excel serial date to JS Date
 */
function excelDateToJSDate(serial: number): Date {
  // Excel dates are days since 1900-01-01 (with a leap year bug)
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  return new Date(utcValue);
}

/**
 * Set a nested value using dot notation path
 * Supports array notation like "comparables[0].address"
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);

    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);

      if (!Array.isArray(current[arrayName])) {
        current[arrayName] = [];
      }
      const arr = current[arrayName] as Record<string, unknown>[];

      // Ensure array has enough elements
      while (arr.length <= index) {
        arr.push({});
      }

      current = arr[index];
    } else {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
  }

  // Handle final part (might be array access)
  const finalPart = parts[parts.length - 1];
  const arrayMatch = finalPart.match(/^(\w+)\[(\d+)\]$/);

  if (arrayMatch) {
    const [, arrayName, indexStr] = arrayMatch;
    const index = parseInt(indexStr, 10);

    if (!Array.isArray(current[arrayName])) {
      current[arrayName] = [];
    }
    (current[arrayName] as unknown[])[index] = value;
  } else {
    current[finalPart] = value;
  }
}

/**
 * Parse an Excel file from a buffer
 */
export async function parseExcelBuffer(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return parseExcelWorkbook(workbook);
}

/**
 * Parse an Excel file from a path
 */
export async function parseExcelFile(filePath: string): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return parseExcelWorkbook(workbook);
}
