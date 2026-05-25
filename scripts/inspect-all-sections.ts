/**
 * Comprehensive inspection of all sections in Villa Solia Excel
 */

import ExcelJS from 'exceljs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VILLA_SOLIA_PATH = path.join(__dirname, '../فيلارقم10 سوليا (1).xlsx');

function getCellValue(cell: ExcelJS.Cell): unknown {
  let value = cell.value;
  if (typeof value === 'object' && value !== null && 'result' in value) {
    value = (value as { result: unknown }).result;
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value).substring(0, 40);
}

async function inspect() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(VILLA_SOLIA_PATH);

  const ws = workbook.getWorksheet('تقرير (6)');
  if (!ws) {
    console.log('Worksheet not found!');
    return;
  }

  // === IDENTIFICATION (rows 1-20) ===
  console.log('=== IDENTIFICATION (rows 1-20) ===\n');
  for (let row = 1; row <= 20; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        rowData.push(`${colLetter}${row}="${formatValue(value)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // === PHYSICAL (rows 30-50) ===
  console.log('\n=== PHYSICAL (rows 30-50) ===\n');
  for (let row = 30; row <= 50; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        rowData.push(`${colLetter}${row}="${formatValue(value)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // === COST APPROACH (rows 160-185) ===
  console.log('\n=== COST APPROACH (rows 160-185) ===\n');
  for (let row = 160; row <= 185; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        rowData.push(`${colLetter}${row}="${formatValue(value)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // === SALES COMPARISON (rows 189-217) ===
  console.log('\n=== SALES COMPARISON (rows 189-217) ===\n');
  for (let row = 189; row <= 217; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        rowData.push(`${colLetter}${row}="${formatValue(value)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // === INCOME APPROACH (rows 218-230) ===
  console.log('\n=== INCOME APPROACH (rows 218-230) ===\n');
  for (let row = 218; row <= 230; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        rowData.push(`${colLetter}${row}="${formatValue(value)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // === GRM (rows 230-240) ===
  console.log('\n=== GRM (rows 230-240) ===\n');
  for (let row = 230; row <= 240; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        rowData.push(`${colLetter}${row}="${formatValue(value)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // === RECONCILIATION (rows 250-270) ===
  console.log('\n=== RECONCILIATION (rows 250-270) ===\n');
  for (let row = 250; row <= 270; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        rowData.push(`${colLetter}${row}="${formatValue(value)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // === SPECIFIC CELL CHECKS ===
  console.log('\n=== SPECIFIC CELL CHECKS (current mappings) ===\n');

  const cellsToCheck = [
    // Identification
    { cell: 'J3', label: 'clientName' },
    { cell: 'J4', label: 'ownerName' },
    { cell: 'L5', label: 'appraisalDate' },
    { cell: 'J7', label: 'addressDescription' },
    { cell: 'M13', label: 'finalValue' },
    { cell: 'M14', label: 'landValue' },
    { cell: 'D14', label: 'buildingValue' },
    // Physical
    { cell: 'G7', label: 'projectLandArea' },
    { cell: 'M7', label: 'unitGrossArea' },
    { cell: 'J37', label: 'unitNetArea' },
    // Cost approach
    { cell: 'J162', label: 'landPricePerSqm' },
    { cell: 'I171', label: 'constructionCostPerSqm' },
    { cell: 'B173', label: 'economicLife' },
    { cell: 'K173', label: 'effectiveAge' },
    { cell: 'I182', label: 'costTotal' },
    // Sales comparison
    { cell: 'B216', label: 'salesCompFinalValue' },
    // Income approach
    { cell: 'L219', label: 'monthlyRent' },
    { cell: 'J220', label: 'annualIncome' },
    { cell: 'C220', label: 'vacancyExpenseAmount' },
    { cell: 'C222', label: 'remainingLife' },
    { cell: 'L223', label: 'interestRate' },
    { cell: 'C228', label: 'incomeTotal' },
    // GRM
    { cell: 'A231', label: 'incomeMultiplier' },
    { cell: 'L231', label: 'grmMonthlyRent' },
    { cell: 'A235', label: 'grmTotal' },
  ];

  for (const { cell, label } of cellsToCheck) {
    const match = cell.match(/([A-Z]+)(\d+)/);
    if (!match) continue;
    const col = match[1].charCodeAt(0) - 64;
    const row = parseInt(match[2]);
    const cellObj = ws.getCell(row, col);
    const value = getCellValue(cellObj);
    console.log(`${cell} (${label}): ${formatValue(value)}`);
  }
}

inspect().catch(console.error);
