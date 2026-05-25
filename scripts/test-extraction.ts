/**
 * Test extraction with updated cell mappings and image extraction
 */

import { parseExcelBuffer } from '../src/server/import/excel';
import { summarizeImages, groupImagesByLabel } from '../src/server/import/images';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VILLA_SOLIA_PATH = path.join(__dirname, '../فيلارقم10 سوليا (1).xlsx');

async function test() {
  console.log('Reading file:', VILLA_SOLIA_PATH);
  const buffer = fs.readFileSync(VILLA_SOLIA_PATH);

  console.log('\nParsing Excel...\n');
  const result = await parseExcelBuffer(buffer);

  console.log('=== PARSE RESULT ===');
  console.log('Success:', result.success);
  console.log('Template ID:', result.templateId);
  console.log('Warnings:', result.warnings?.length || 0);

  if (result.warnings && result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.slice(0, 5).forEach(w => {
      console.log(`  - ${w.field}: ${w.message}`);
    });
  }

  // Show extracted images
  if (result.images && result.images.length > 0) {
    console.log('\n=== EXTRACTED IMAGES ===');
    console.log('Total images:', result.images.length);
    console.log('Summary:', summarizeImages(result.images));
    console.log('\nImage details:');
    result.images.forEach((img, i) => {
      console.log(`  ${i + 1}. ${img.label} (row ${img.row})`);
      console.log(`     Size: ${(img.sizeBytes / 1024).toFixed(1)}KB, Format: ${img.extension}`);
    });

    // Group by label
    const groups = groupImagesByLabel(result.images);
    console.log('\nBy category:');
    Object.entries(groups).forEach(([label, imgs]) => {
      if (imgs.length > 0) {
        console.log(`  ${label}: ${imgs.length}`);
      }
    });
  } else {
    console.log('\n=== NO IMAGES FOUND ===');
  }

  if (result.data) {
    console.log('\n=== EXTRACTED DATA ===\n');

    // Identification
    console.log('--- IDENTIFICATION ---');
    const id = result.data.identification as Record<string, unknown> || {};
    Object.entries(id).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    });

    // Physical
    console.log('\n--- PHYSICAL ---');
    const phys = result.data.physical as Record<string, unknown> || {};
    Object.entries(phys).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        console.log(`  ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
      }
    });

    // Cost Approach
    console.log('\n--- COST APPROACH ---');
    const cost = result.data.costApproach as Record<string, unknown> || {};
    Object.entries(cost).forEach(([key, value]) => {
      if (key.startsWith('_')) return; // Skip computed
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        console.log(`  ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
      }
    });
    const costComputed = (cost._computed || {}) as Record<string, unknown>;
    if (Object.keys(costComputed).length > 0) {
      console.log('  _computed:');
      Object.entries(costComputed).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && value !== 0) {
          console.log(`    ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
        }
      });
    }

    // Income Approach
    console.log('\n--- INCOME APPROACH ---');
    const income = result.data.incomeApproach as Record<string, unknown> || {};
    Object.entries(income).forEach(([key, value]) => {
      if (key.startsWith('_')) return;
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        console.log(`  ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
      }
    });
    const incomeComputed = (income._computed || {}) as Record<string, unknown>;
    if (Object.keys(incomeComputed).length > 0) {
      console.log('  _computed:');
      Object.entries(incomeComputed).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && value !== 0) {
          console.log(`    ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
        }
      });
    }

    // GRM
    console.log('\n--- GRM ---');
    const grm = result.data.grm as Record<string, unknown> || {};
    Object.entries(grm).forEach(([key, value]) => {
      if (key.startsWith('_')) return;
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        console.log(`  ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
      }
    });
    const grmComputed = (grm._computed || {}) as Record<string, unknown>;
    if (Object.keys(grmComputed).length > 0) {
      console.log('  _computed:');
      Object.entries(grmComputed).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && value !== 0) {
          console.log(`    ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
        }
      });
    }

    // Reconciliation
    console.log('\n--- RECONCILIATION ---');
    const recon = result.data.reconciliation as Record<string, unknown> || {};
    Object.entries(recon).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        const displayValue = typeof value === 'number' ? value.toLocaleString() :
                            typeof value === 'string' ? value.substring(0, 60) : value;
        console.log(`  ${key}: ${displayValue}`);
      }
    });
  }
}

test().catch(console.error);
