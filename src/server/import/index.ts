/**
 * Import Module Index
 *
 * Exports all import-related functionality.
 *
 * NOTE: PDF parsing functions (parsePDFBuffer, parsePDFWithFallback) are NOT
 * exported here because they depend on the 'canvas' npm package which has
 * native bindings that can conflict with system libraries (e.g., glib).
 * Import them directly with dynamic import when needed:
 *   const { parsePDFWithFallback } = await import('./import/pdf');
 */

export { parseExcelBuffer, parseExcelFile, parseExcelWorkbook } from './excel';
// PDF functions removed - use dynamic import to avoid canvas conflicts
export { fingerprintBuffer, fingerprintFile, fingerprintWorkbook } from './fingerprint';
export { verifyExtractedData, canVerify, formatDiscrepancies } from './verify';
export { TEMPLATES, getTemplate, getTemplateIds } from './templates';
export { extractWithAI, isAIExtractionAvailable } from './ai-extraction';
export { lookupGovernorate, lookupCity, lookupDistrict, resolveLocationIds, clearLocationCache } from './location-lookup';
export type { CellMapping, Template, TemplateFingerprint } from './templates';
export type { ParseResult, ParseWarning } from './excel';
export type { PDFParseResult, PDFParseWarning } from './pdf';
export type { VerificationResult, FieldDiscrepancy } from './verify';
