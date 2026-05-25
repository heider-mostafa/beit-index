/**
 * Test multi-method engine verification on Villa Solia Excel
 *
 * Expected values from Excel:
 * - Cost approach total: 19,922,000
 * - Sales comparison: 26,000,000 (final value)
 * - Income approach total: 11,549,130.43
 * - GRM total: 2,964,000
 */

import { parseExcelBuffer } from '../src/server/import/excel';
import { verifyExtractedData, canVerify } from '../src/server/import/verify';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VILLA_SOLIA_PATH = path.join(__dirname, '../فيلارقم10 سوليا (1).xlsx');

// Expected values from the Excel file (golden test)
const EXPECTED_VALUES = {
  costApproach: {
    total: 19_922_000,
    unitShareOfLandValue: 9_597_000,
    unitConstructionCost: 10_500_000,
  },
  incomeApproach: {
    total: 11_549_130.435,
    netEffectiveIncome: 1_188_000,
    annualIncome: 1_320_000,
  },
  grm: {
    total: 2_964_000,
    netEffectiveIncome: 228_000,
  },
  salesComparison: {
    finalValue: 26_000_000,
  },
  reconciliation: {
    finalValue: 26_000_000,
    landValue: 9_597_000,
    buildingValue: 16_403_000,
  },
};

async function test() {
  console.log('=== MULTI-METHOD ENGINE VERIFICATION TEST ===\n');
  console.log('Reading file:', VILLA_SOLIA_PATH);

  const buffer = fs.readFileSync(VILLA_SOLIA_PATH);
  const parseResult = await parseExcelBuffer(buffer);

  console.log('\n--- PARSE RESULT ---');
  console.log('Success:', parseResult.success);
  console.log('Template ID:', parseResult.templateId);
  console.log('Template Matched:', parseResult.templateId !== 'heuristic');

  if (!parseResult.success || !parseResult.data) {
    console.log('\n❌ PARSE FAILED');
    return;
  }

  // Check if verification can run
  console.log('\n--- VERIFICATION ---');
  console.log('Can verify:', canVerify(parseResult.data));

  if (!canVerify(parseResult.data)) {
    console.log('\n❌ CANNOT VERIFY - Missing required inputs');
    return;
  }

  const verification = verifyExtractedData(parseResult.data);

  console.log('\nMatch Percent:', verification.matchPercent.toFixed(2) + '%');
  console.log('Auto-Approvable:', verification.isAutoApprovable);
  console.log('Fields Compared:', verification.fieldCount);
  console.log('Fields Matched:', verification.matchedFields);
  console.log('Discrepancies:', verification.discrepancies.length);

  // Show discrepancies if any
  if (verification.discrepancies.length > 0) {
    console.log('\n--- DISCREPANCIES ---');
    verification.discrepancies.forEach(d => {
      console.log(`  ${d.label}:`);
      console.log(`    Typed (Excel):   ${d.typed.toLocaleString()}`);
      console.log(`    Computed (Engine): ${d.computed.toLocaleString()}`);
      console.log(`    Delta: ${d.deltaPercent.toFixed(4)}%`);
    });
  }

  // Compare against expected values
  console.log('\n--- GOLDEN TEST COMPARISON ---');

  // Cost approach
  console.log('\n[COST APPROACH]');
  const costComputed = verification.engineComputed.costApproach;
  if (costComputed) {
    compareValue('Total', costComputed.total, EXPECTED_VALUES.costApproach.total);
    compareValue('Unit Land Value', costComputed.unitShareOfLandValue, EXPECTED_VALUES.costApproach.unitShareOfLandValue);
    compareValue('Unit Construction Cost', costComputed.unitConstructionCost, EXPECTED_VALUES.costApproach.unitConstructionCost);
  } else {
    console.log('  ❌ Cost approach not computed');
  }

  // Income approach
  console.log('\n[INCOME APPROACH]');
  const incomeComputed = verification.engineComputed.incomeApproach;
  if (incomeComputed) {
    compareValue('Total', incomeComputed.total, EXPECTED_VALUES.incomeApproach.total);
    compareValue('Net Effective Income', incomeComputed.netEffectiveIncome, EXPECTED_VALUES.incomeApproach.netEffectiveIncome);
    compareValue('Annual Income', incomeComputed.annualIncome, EXPECTED_VALUES.incomeApproach.annualIncome);
  } else {
    console.log('  ❌ Income approach not computed');
  }

  // GRM
  console.log('\n[GRM]');
  const grmComputed = verification.engineComputed.grm;
  if (grmComputed) {
    compareValue('Total', grmComputed.total, EXPECTED_VALUES.grm.total);
    compareValue('Net Effective Income', grmComputed.netEffectiveIncome, EXPECTED_VALUES.grm.netEffectiveIncome);
  } else {
    console.log('  ❌ GRM not computed');
  }

  // Reconciliation (from extracted data)
  console.log('\n[RECONCILIATION]');
  const recon = parseResult.data.reconciliation as Record<string, unknown> || {};
  compareValue('Final Value', recon.finalValue as number, EXPECTED_VALUES.reconciliation.finalValue);
  compareValue('Land Value', recon.landValue as number, EXPECTED_VALUES.reconciliation.landValue);
  compareValue('Building Value', recon.buildingValue as number, EXPECTED_VALUES.reconciliation.buildingValue);

  // Final verdict
  console.log('\n--- FINAL VERDICT ---');
  if (verification.isAutoApprovable && verification.matchPercent >= 99) {
    console.log('✅ PASSED: Multi-method verification at ' + verification.matchPercent.toFixed(2) + '%');
  } else if (verification.matchPercent >= 90) {
    console.log('⚠️ PARTIAL PASS: ' + verification.matchPercent.toFixed(2) + '% match (needs review)');
  } else {
    console.log('❌ FAILED: ' + verification.matchPercent.toFixed(2) + '% match');
  }
}

function compareValue(label: string, actual: number | undefined, expected: number) {
  if (actual === undefined || actual === null) {
    console.log(`  ❌ ${label}: NOT EXTRACTED (expected ${expected.toLocaleString()})`);
    return;
  }

  const delta = Math.abs(actual - expected);
  const deltaPercent = expected !== 0 ? (delta / expected) * 100 : 0;

  if (deltaPercent < 1) {
    console.log(`  ✅ ${label}: ${actual.toLocaleString()} (expected ${expected.toLocaleString()}, delta ${deltaPercent.toFixed(4)}%)`);
  } else {
    console.log(`  ❌ ${label}: ${actual.toLocaleString()} (expected ${expected.toLocaleString()}, delta ${deltaPercent.toFixed(2)}%)`);
  }
}

test().catch(console.error);
