/**
 * Inspect images in Villa Solia Excel
 */

import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VILLA_SOLIA_PATH = path.join(__dirname, '../فيلارقم10 سوليا (1).xlsx');

async function inspect() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(VILLA_SOLIA_PATH);

  console.log('=== WORKBOOK INFO ===');
  console.log('Worksheets:', workbook.worksheets.map(ws => ws.name));

  for (const worksheet of workbook.worksheets) {
    console.log(`\n=== WORKSHEET: ${worksheet.name} ===`);

    // Check for images using getImages()
    const images = worksheet.getImages();
    console.log(`Images found: ${images.length}`);

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      console.log(`\nImage ${i + 1}:`);
      console.log('  imageId:', img.imageId);
      // Extract range info without circular references
      const range = img.range as { tl?: { nativeRow?: number; nativeCol?: number }; br?: { nativeRow?: number; nativeCol?: number } };
      console.log('  range: tl=', range?.tl?.nativeRow, ',', range?.tl?.nativeCol, ' br=', range?.br?.nativeRow, ',', range?.br?.nativeCol);

      // Get the image data from workbook
      const imageData = workbook.getImage(Number(img.imageId));
      if (imageData) {
        console.log('  extension:', imageData.extension);
        console.log('  buffer size:', imageData.buffer?.byteLength || 'N/A');

        // Determine image type based on position
        const startRow = img.range?.tl?.nativeRow || 0;
        const startCol = img.range?.tl?.nativeCol || 0;

        let imageType = 'unknown';
        if (startRow < 30) {
          imageType = 'header_logo';
        } else if (startRow >= 30 && startRow < 100) {
          imageType = 'property_photo';
        } else if (startRow >= 100 && startRow < 150) {
          imageType = 'location_map';
        } else if (startRow >= 150 && startRow < 200) {
          imageType = 'floor_plan';
        } else if (startRow >= 260) {
          imageType = 'site_map';
        }

        console.log('  row:', startRow, 'col:', startCol);
        console.log('  suggested type:', imageType);
      }
    }

    // Also check for drawings (some Excel files use drawings)
    // ExcelJS doesn't directly expose drawings, but images are the main concern
  }

  // Save first few images for inspection
  const outputDir = path.join(__dirname, '../temp-images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const mainSheet = workbook.getWorksheet('تقرير (6)');
  if (mainSheet) {
    const images = mainSheet.getImages();
    console.log(`\n=== SAVING ${Math.min(5, images.length)} IMAGES ===`);

    for (let i = 0; i < Math.min(5, images.length); i++) {
      const img = images[i];
      const imageData = workbook.getImage(Number(img.imageId));
      if (imageData?.buffer) {
        const ext = imageData.extension || 'png';
        const filename = `image_${i + 1}_row${img.range?.tl?.nativeRow || 0}.${ext}`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, Buffer.from(imageData.buffer));
        console.log(`Saved: ${filename} (${imageData.buffer.byteLength} bytes)`);
      }
    }
  }
}

inspect().catch(console.error);
