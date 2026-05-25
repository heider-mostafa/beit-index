/**
 * Template Fingerprinting
 *
 * Identifies which Excel template version a file uses by checking
 * specific cells for expected content patterns.
 */

import ExcelJS from 'exceljs';
import { TEMPLATES, type Template } from './templates';

export interface FingerprintResult {
  matched: boolean;
  templateId: string | null;
  templateName: string | null;
  confidence: number; // 0-1, percentage of checks that matched
  matchedChecks: number;
  totalChecks: number;
}

/**
 * Attempt to identify the template used in an Excel workbook
 * Searches all worksheets to find the best match
 */
export async function fingerprintWorkbook(
  workbook: ExcelJS.Workbook
): Promise<FingerprintResult & { worksheetName?: string }> {
  if (workbook.worksheets.length === 0) {
    return {
      matched: false,
      templateId: null,
      templateName: null,
      confidence: 0,
      matchedChecks: 0,
      totalChecks: 0,
    };
  }

  let bestMatch: FingerprintResult & { worksheetName?: string } = {
    matched: false,
    templateId: null,
    templateName: null,
    confidence: 0,
    matchedChecks: 0,
    totalChecks: 0,
  };

  // Try each worksheet with each template to find the best match
  for (const worksheet of workbook.worksheets) {
    for (const template of TEMPLATES) {
      const result = checkTemplate(worksheet, template);
      if (result.confidence > bestMatch.confidence) {
        bestMatch = { ...result, worksheetName: worksheet.name };
      }
    }
  }

  return bestMatch;
}

/**
 * Check if a worksheet matches a specific template
 */
function checkTemplate(
  worksheet: ExcelJS.Worksheet,
  template: Template
): FingerprintResult {
  const checks = template.fingerprint.checks;
  let matchedChecks = 0;

  for (const check of checks) {
    const cell = worksheet.getCell(check.cell);
    const cellValue = getCellStringValue(cell);

    if (cellValue.includes(check.contains)) {
      matchedChecks++;
    }
  }

  const confidence = checks.length > 0 ? matchedChecks / checks.length : 0;
  const matched = matchedChecks >= template.fingerprint.minMatches;

  return {
    matched,
    templateId: matched ? template.id : null,
    templateName: matched ? template.name : null,
    confidence,
    matchedChecks,
    totalChecks: checks.length,
  };
}

/**
 * Get string value from a cell, handling various cell types
 */
function getCellStringValue(cell: ExcelJS.Cell): string {
  const value = cell.value;

  if (value === null || value === undefined) {
    return '';
  }

  // Handle rich text
  if (typeof value === 'object' && 'richText' in value) {
    return (value.richText as Array<{ text: string }>)
      .map((rt) => rt.text)
      .join('');
  }

  // Handle formula results
  if (typeof value === 'object' && 'result' in value) {
    return String((value as { result: unknown }).result || '');
  }

  // Handle hyperlinks
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: unknown }).text || '');
  }

  return String(value);
}

/**
 * Fingerprint a file from a buffer
 */
export async function fingerprintBuffer(
  buffer: Buffer
): Promise<FingerprintResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return fingerprintWorkbook(workbook);
}

/**
 * Fingerprint a file from a path
 */
export async function fingerprintFile(
  filePath: string
): Promise<FingerprintResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return fingerprintWorkbook(workbook);
}
