/**
 * Inspect income approach section in Villa Solia Excel
 */

import ExcelJS from 'exceljs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VILLA_SOLIA_PATH = path.join(__dirname, '../فيلارقم10 سوليا (1).xlsx');

async function inspect() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(VILLA_SOLIA_PATH);

  const ws = workbook.getWorksheet('تقرير (6)');
  if (!ws) {
    console.log('Worksheet not found!');
    return;
  }

  console.log('=== INCOME APPROACH SECTION (rows 218-240) ===\n');

  for (let row = 218; row <= 240; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      let value = cell.value;

      // Extract formula result
      if (typeof value === 'object' && value !== null && 'result' in value) {
        value = (value as { result: unknown }).result;
      }

      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        const displayValue = typeof value === 'number'
          ? value.toLocaleString()
          : String(value).substring(0, 25);
        rowData.push(`${colLetter}${row}="${displayValue}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  console.log('\n=== GRM SECTION (rows 230-240) ===\n');

  for (let row = 230; row <= 240; row++) {
    const rowData: string[] = [];
    for (let col = 1; col <= 15; col++) {
      const cell = ws.getCell(row, col);
      let value = cell.value;

      if (typeof value === 'object' && value !== null && 'result' in value) {
        value = (value as { result: unknown }).result;
      }

      if (value !== null && value !== undefined && String(value).trim()) {
        const colLetter = String.fromCharCode(64 + col);
        const displayValue = typeof value === 'number'
          ? value.toLocaleString()
          : String(value).substring(0, 25);
        rowData.push(`${colLetter}${row}="${displayValue}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(rowData.join(' | '));
    }
  }

  // Look for specific values
  console.log('\n=== SEARCHING FOR KEY VALUES ===\n');

  const searchValues = [110000, 30000, 10, 59, 0.1, 13, 132000];

  for (let row = 1; row <= 280; row++) {
    for (let col = 1; col <= 20; col++) {
      const cell = ws.getCell(row, col);
      let value = cell.value;

      if (typeof value === 'object' && value !== null && 'result' in value) {
        value = (value as { result: unknown }).result;
      }

      if (typeof value === 'number' && searchValues.includes(value)) {
        const colLetter = String.fromCharCode(64 + col);
        // Get label from nearby cells
        const labelCell = ws.getCell(row, col + 1);
        const labelCellLeft = ws.getCell(row, col - 1);
        const label = String(labelCell.value || labelCellLeft.value || '').substring(0, 30);
        console.log(`${colLetter}${row} = ${value} (label: "${label}")`);
      }
    }
  }
}

inspect().catch(console.error);
