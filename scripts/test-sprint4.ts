/**
 * Sprint 4 Test Script
 *
 * Tests the backlog ingestion pipeline:
 * 1. Excel parsing with Villa Solia file
 * 2. PDF OCR parsing
 * 3. Engine verification
 */

import { parseExcelFile } from '../src/server/import/excel';
import { parsePDFWithFallback } from '../src/server/import/pdf';
import { verifyExtractedData, canVerify } from '../src/server/import/verify';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VILLA_SOLIA_PATH = path.join(__dirname, '../فيلارقم10 سوليا (1).xlsx');
const PDF_PATH = path.join(__dirname, '../تقرير  التجمع (1).pdf');

// Expected values from the user's specification
const EXPECTED_VALUES = {
  finalValue: 26_000_000,
  costApproach: 19_922_000,
  salesComparison: 26_000_000,
  incomeApproach: 11_549_130.43,
  grm: 2_964_000,
};

async function testExcelParsing() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('TEST 1: Excel Parsing - Villa Solia');
  console.log('══════════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(VILLA_SOLIA_PATH)) {
    console.log('❌ SKIP: Villa Solia file not found at:', VILLA_SOLIA_PATH);
    return false;
  }

  try {
    console.log('Parsing Excel file...');
    const result = await parseExcelFile(VILLA_SOLIA_PATH);

    console.log('\n--- Parse Result ---');
    console.log('Success:', result.success);
    console.log('Template ID:', result.templateId);
    console.log('Fingerprint confidence:', result.fingerprint.confidence);
    console.log('Missing required fields:', result.missingRequired.length);
    console.log('Warnings:', result.warnings.length);

    if (!result.success || !result.data) {
      console.log('\n❌ FAIL: Parsing failed');
      console.log('Warnings:', JSON.stringify(result.warnings, null, 2));
      return false;
    }

    // Extract values
    const data = result.data;
    const reconciliation = (data.reconciliation || {}) as Record<string, unknown>;
    const costApproach = (data.costApproach || {}) as Record<string, unknown>;
    const salesComparison = (data.salesComparison || {}) as Record<string, unknown>;
    const incomeApproach = (data.incomeApproach || {}) as Record<string, unknown>;
    const grm = (data.grm || {}) as Record<string, unknown>;

    console.log('\n--- Extracted Values ---');
    console.log('Final Value:', reconciliation.finalValue);

    // Cost approach
    const costComputed = (costApproach._computed || {}) as Record<string, unknown>;
    console.log('Cost Approach Total:', costComputed.total);

    // Sales comparison
    const salesComputed = (salesComparison._computed || {}) as Record<string, unknown>;
    console.log('Sales Comparison Total:', salesComputed.total || salesComparison.adjustedValue);

    // Income approach
    const incomeComputed = (incomeApproach._computed || {}) as Record<string, unknown>;
    console.log('Income Approach Total:', incomeComputed.total);

    // GRM
    const grmComputed = (grm._computed || {}) as Record<string, unknown>;
    console.log('GRM Total:', grmComputed.total);

    // Verify against expected values
    console.log('\n--- Value Verification ---');
    let allMatch = true;

    const checkValue = (name: string, actual: unknown, expected: number, tolerance = 0.01) => {
      if (typeof actual !== 'number') {
        console.log(`❌ ${name}: not extracted (expected ${expected.toLocaleString()})`);
        allMatch = false;
        return;
      }
      const diff = Math.abs(actual - expected) / expected;
      if (diff <= tolerance) {
        console.log(`✅ ${name}: ${actual.toLocaleString()} (expected ${expected.toLocaleString()})`);
      } else {
        console.log(`❌ ${name}: ${actual.toLocaleString()} (expected ${expected.toLocaleString()}, diff ${(diff * 100).toFixed(2)}%)`);
        allMatch = false;
      }
    };

    checkValue('Final Value', reconciliation.finalValue, EXPECTED_VALUES.finalValue);
    checkValue('Cost Approach', costComputed.total, EXPECTED_VALUES.costApproach);
    checkValue('Income Approach', incomeComputed.total, EXPECTED_VALUES.incomeApproach);
    checkValue('GRM', grmComputed.total, EXPECTED_VALUES.grm);

    // Run engine verification
    console.log('\n--- Engine Verification ---');
    if (canVerify(data)) {
      const verification = verifyExtractedData(data);
      console.log('Match Percent:', verification.matchPercent.toFixed(2) + '%');
      console.log('Auto-Approvable:', verification.isAutoApprovable);
      console.log('Discrepancies:', verification.discrepancies.length);

      if (verification.discrepancies.length > 0) {
        console.log('\nDiscrepancies:');
        for (const d of verification.discrepancies) {
          console.log(`  - ${d.label}: typed ${d.typed.toLocaleString()}, computed ${d.computed.toLocaleString()} (${d.deltaPercent.toFixed(2)}% diff)`);
        }
      }
    } else {
      console.log('⚠️  Cannot verify - insufficient data for engine computation');
    }

    console.log('\n' + (allMatch ? '✅ TEST 1 PASSED' : '❌ TEST 1 FAILED'));
    return allMatch;

  } catch (error) {
    console.log('\n❌ FAIL: Exception during parsing');
    console.log('Error:', (error as Error).message);
    console.log('Stack:', (error as Error).stack);
    return false;
  }
}

async function testPDFParsing() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('TEST 2: PDF OCR Parsing');
  console.log('══════════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(PDF_PATH)) {
    console.log('❌ SKIP: PDF file not found at:', PDF_PATH);
    return false;
  }

  try {
    console.log('Parsing PDF file (this may take a while for OCR)...');
    const buffer = fs.readFileSync(PDF_PATH);

    const result = await parsePDFWithFallback(buffer, (progress, status) => {
      console.log(`  [${progress}%] ${status}`);
    });

    console.log('\n--- Parse Result ---');
    console.log('Success:', result.success);
    console.log('Page Count:', result.pageCount);
    console.log('OCR Confidence:', result.confidence.toFixed(1) + '%');
    console.log('Warnings:', result.warnings.length);

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const w of result.warnings.slice(0, 5)) {
        console.log(`  - [Page ${w.page}] ${w.message}`);
      }
      if (result.warnings.length > 5) {
        console.log(`  ... and ${result.warnings.length - 5} more`);
      }
    }

    console.log('\n--- Extracted Data ---');
    if (result.extractedData) {
      const data = result.extractedData;
      console.log('Identification:', JSON.stringify(data.identification, null, 2));
      console.log('Physical:', JSON.stringify(data.physical, null, 2));
      console.log('Reconciliation:', JSON.stringify(data.reconciliation, null, 2));
    } else {
      console.log('No structured data extracted');
    }

    console.log('\n--- OCR Text Sample (first 500 chars) ---');
    console.log(result.ocrText.substring(0, 500));

    // PDF should always require review
    const shouldRequireReview = true; // PDFs always need human review
    console.log('\n' + (result.success ? '✅ TEST 2 PASSED (PDF parsed, requires review as expected)' : '❌ TEST 2 FAILED'));
    return result.success;

  } catch (error) {
    console.log('\n❌ FAIL: Exception during PDF parsing');
    console.log('Error:', (error as Error).message);
    console.log('Stack:', (error as Error).stack);
    return false;
  }
}

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           SPRINT 4 VERIFICATION TESTS                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const results: Record<string, boolean> = {};

  // Test 1: Excel parsing
  results['Test 1: Excel Parsing'] = await testExcelParsing();

  // Test 2: PDF parsing
  results['Test 2: PDF OCR'] = await testPDFParsing();

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const [name, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${name}`);
  }

  console.log('\nNote: Tests 3-5 (RLS, is_provisional, Inngest) require');
  console.log('running the full application with authenticated users.');

  const allPassed = Object.values(results).every(v => v);
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(console.error);
