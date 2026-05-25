/**
 * PDF Parser
 *
 * Extracts appraisal report data from scanned PDF files using OCR.
 * Uses Tesseract.js for offline OCR processing with Arabic language support.
 * Uses heuristic pattern matching for flexible data extraction.
 */

import Tesseract from 'tesseract.js';
// Use legacy build for Node.js compatibility
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import { createRequire } from 'module';
import { extractFromOCRText } from './heuristic';

// Configure PDF.js worker for Node.js
const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

export interface PDFParseWarning {
  page: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface PDFParseResult {
  success: boolean;
  pageCount: number;
  ocrText: string;
  extractedData: Record<string, unknown> | null;
  warnings: PDFParseWarning[];
  confidence: number; // Average OCR confidence 0-100
}

/**
 * Parse a PDF file and extract text using OCR
 */
export async function parsePDFBuffer(
  buffer: Buffer,
  onProgress?: (progress: number, status: string) => void
): Promise<PDFParseResult> {
  const warnings: PDFParseWarning[] = [];
  let totalConfidence = 0;
  let pageTexts: string[] = [];

  try {
    // Load PDF document
    const uint8Array = new Uint8Array(buffer);
    const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    const pageCount = pdfDoc.numPages;

    onProgress?.(5, `Loaded PDF with ${pageCount} pages`);

    // Create Tesseract worker with Arabic + English
    const worker = await Tesseract.createWorker('ara+eng', 1, {
      // Tesseract options
    });

    try {
      // Process each page
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const progressPercent = 5 + Math.floor((pageNum / pageCount) * 85);
        onProgress?.(progressPercent, `Processing page ${pageNum} of ${pageCount}`);

        try {
          // Get page
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

          // Render page to canvas (Node.js canvas library)
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');

          await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            viewport,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).promise;

          // Convert to PNG buffer
          const imageBuffer = canvas.toBuffer('image/png');

          // Run OCR on the page image
          const result = await worker.recognize(imageBuffer);
          pageTexts.push(result.data.text);
          totalConfidence += result.data.confidence;

          // Add warnings for low confidence
          if (result.data.confidence < 70) {
            warnings.push({
              page: pageNum,
              message: `Low OCR confidence (${Math.round(result.data.confidence)}%)`,
              severity: 'warning',
            });
          }
        } catch (pageError) {
          warnings.push({
            page: pageNum,
            message: `Failed to process page: ${(pageError as Error).message}`,
            severity: 'error',
          });
        }
      }

      await worker.terminate();
    } catch (ocrError) {
      await worker.terminate();
      throw ocrError;
    }

    const ocrText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
    const avgConfidence = pageCount > 0 ? totalConfidence / pageCount : 0;

    onProgress?.(95, 'Extracting structured data...');

    // Extract structured data from OCR text
    const extractedData = extractDataFromText(ocrText, warnings);

    onProgress?.(100, 'Complete');

    return {
      success: warnings.filter(w => w.severity === 'error').length === 0,
      pageCount,
      ocrText,
      extractedData,
      warnings,
      confidence: avgConfidence,
    };
  } catch (error) {
    return {
      success: false,
      pageCount: 0,
      ocrText: '',
      extractedData: null,
      warnings: [
        {
          page: 0,
          message: `PDF parsing failed: ${(error as Error).message}`,
          severity: 'error',
        },
      ],
      confidence: 0,
    };
  }
}

/**
 * Extract structured data from OCR text using heuristic pattern matching
 *
 * This is a best-effort extraction - PDF imports always require human review.
 * Uses the shared heuristic module for consistent extraction logic.
 */
function extractDataFromText(
  text: string,
  warnings: PDFParseWarning[]
): Record<string, unknown> {
  try {
    const data = extractFromOCRText(text);

    // Validate extraction - check if we got key values
    const reconciliation = data.reconciliation as Record<string, unknown>;
    if (!reconciliation?.finalValue && !reconciliation?.landValue && !reconciliation?.buildingValue) {
      warnings.push({
        page: 0,
        message: 'Could not extract value fields from OCR text. Manual review required.',
        severity: 'warning',
      });
    }

    return data;
  } catch (error) {
    warnings.push({
      page: 0,
      message: `Data extraction error: ${(error as Error).message}`,
      severity: 'error',
    });
    return {};
  }
}

/**
 * Alternative PDF parsing using text extraction (for non-scanned PDFs)
 * Falls back to OCR if text extraction yields minimal content
 */
export async function parsePDFWithFallback(
  buffer: Buffer,
  onProgress?: (progress: number, status: string) => void
): Promise<PDFParseResult> {
  try {
    // First try text extraction (much faster)
    const uint8Array = new Uint8Array(buffer);
    const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    const pageCount = pdfDoc.numPages;
    let extractedText = '';

    onProgress?.(10, 'Attempting text extraction...');

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      extractedText += pageText + '\n\n';
    }

    // If we got meaningful text, use it
    const wordCount = extractedText.split(/\s+/).length;
    if (wordCount > 100) {
      onProgress?.(80, 'Extracting structured data from text...');
      const warnings: PDFParseWarning[] = [];
      const extractedData = extractDataFromText(extractedText, warnings);

      return {
        success: true,
        pageCount,
        ocrText: extractedText,
        extractedData,
        warnings,
        confidence: 95, // Text extraction is high confidence
      };
    }

    // Otherwise fall back to OCR
    onProgress?.(20, 'Text extraction insufficient, switching to OCR...');
    return parsePDFBuffer(buffer, (p, s) => {
      onProgress?.(20 + p * 0.8, s);
    });

  } catch (error) {
    // Fall back to OCR on any error
    return parsePDFBuffer(buffer, onProgress);
  }
}
