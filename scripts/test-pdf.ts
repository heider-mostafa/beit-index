/**
 * Test PDF extraction
 */

import { parsePDFWithFallback } from '../src/server/import/pdf';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_PATH = path.join(__dirname, '../تقرير  التجمع (1).pdf');

async function test() {
  console.log('Reading PDF:', PDF_PATH);
  const buffer = fs.readFileSync(PDF_PATH);

  console.log('\nParsing PDF...\n');
  const result = await parsePDFWithFallback(buffer, (progress, status) => {
    console.log(`[${progress}%] ${status}`);
  });

  console.log('\n=== PARSE RESULT ===');
  console.log('Success:', result.success);
  console.log('Page count:', result.pageCount);
  console.log('Confidence:', result.confidence);
  console.log('Warnings:', result.warnings?.length || 0);

  if (result.warnings && result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => {
      console.log(`  - Page ${w.page}: ${w.message} (${w.severity})`);
    });
  }

  console.log('\n=== OCR TEXT (first 2000 chars) ===\n');
  console.log(result.ocrText.substring(0, 2000));

  if (result.extractedData) {
    console.log('\n=== EXTRACTED DATA ===\n');
    console.log(JSON.stringify(result.extractedData, null, 2));
  }
}

test().catch(console.error);
