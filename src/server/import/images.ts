/**
 * Image Extraction Module
 *
 * Extracts and labels images from Excel workbooks.
 * Uses Gemini Vision for intelligent image classification.
 * Falls back to row-based heuristics if AI unavailable.
 */

import ExcelJS from 'exceljs';
import { GoogleGenAI } from '@google/genai';

export interface ExtractedImage {
  id: string;
  buffer: Buffer;
  extension: string;
  mimeType: string;
  label: ImageLabel;
  row: number;
  col: number;
  width: number;
  height: number;
  sizeBytes: number;
}

export type ImageLabel =
  | 'exterior_photos'      // Property exterior, compound views
  | 'interior_photos'      // Rooms, finishes, fixtures
  | 'location_map'         // Google Maps, satellite view
  | 'floor_plan'           // Architectural floor plans
  | 'site_sketch'          // Hand-drawn or CAD site sketch
  | 'aerial_view'          // Drone or aerial photography
  | 'street_view'          // Street-level context photos
  | 'document_scan'        // Scanned documents, deeds
  | 'appraiser_signature'  // Signature block
  | 'company_logo'         // Appraiser company logo
  | 'unknown';             // Cannot determine

/**
 * Row-based labeling rules for FRA residential template
 * Based on Villa Solia / Amlak format analysis
 */
const ROW_LABEL_RULES: Array<{ minRow: number; maxRow: number; label: ImageLabel }> = [
  // Header area (rows 1-20): Usually logos
  { minRow: 0, maxRow: 20, label: 'company_logo' },

  // Property overview section (rows 21-100): Exterior photos, context
  { minRow: 21, maxRow: 100, label: 'exterior_photos' },

  // Market study / comparables (rows 100-160): May have comp photos
  { minRow: 100, maxRow: 160, label: 'exterior_photos' },

  // Cost approach section (rows 160-190): Usually no images

  // Sales comparison section (rows 190-220): May have comp photos
  { minRow: 190, maxRow: 220, label: 'exterior_photos' },

  // Income/GRM section (rows 220-250): Usually no images

  // Reconciliation section (rows 250-280): Location maps
  { minRow: 250, maxRow: 280, label: 'location_map' },

  // Appendix area (rows 280+): Interior photos, floor plans, signatures
  { minRow: 280, maxRow: 330, label: 'interior_photos' },
  { minRow: 330, maxRow: 400, label: 'floor_plan' },
  { minRow: 400, maxRow: 500, label: 'document_scan' },
];

/**
 * Determine image label based on row position
 */
function labelFromRow(row: number): ImageLabel {
  for (const rule of ROW_LABEL_RULES) {
    if (row >= rule.minRow && row < rule.maxRow) {
      return rule.label;
    }
  }
  return 'unknown';
}

/**
 * Detect if image is likely a Google Maps screenshot
 */
function isLikelyMap(buffer: Buffer): boolean {
  // Check for Google Maps markers in PNG/JPEG
  // This is a heuristic - maps often have specific color patterns
  // For now, we rely on row position which is more reliable
  return false;
}

/**
 * Get MIME type from extension
 */
function getMimeType(extension: string): string {
  const map: Record<string, string> = {
    'png': 'image/png',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
  };
  return map[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Extract all images from a workbook
 * Deduplicates images that appear in multiple sheets (same imageId)
 */
export function extractImagesFromWorkbook(workbook: ExcelJS.Workbook): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seenImageIds = new Set<string>();
  let totalRefs = 0;
  let skippedNoBuffer = 0;

  console.log(`[Image Extraction] Processing ${workbook.worksheets.length} worksheets`);

  for (const worksheet of workbook.worksheets) {
    const worksheetImages = worksheet.getImages();
    totalRefs += worksheetImages.length;
    console.log(`[Image Extraction] Sheet "${worksheet.name}": ${worksheetImages.length} image refs`);

    for (const img of worksheetImages) {
      // Skip duplicates - same image embedded in multiple sheets
      const imageIdStr = String(img.imageId);
      if (seenImageIds.has(imageIdStr)) {
        console.log(`[Image Extraction] Skipping duplicate imageId ${imageIdStr}`);
        continue;
      }
      seenImageIds.add(imageIdStr);

      const imageData = workbook.getImage(Number(img.imageId));
      if (!imageData?.buffer) {
        console.log(`[Image Extraction] Skipping imageId ${imageIdStr} - no buffer data`);
        skippedNoBuffer++;
        continue;
      }

      const range = img.range as {
        tl?: { nativeRow?: number; nativeCol?: number };
        br?: { nativeRow?: number; nativeCol?: number };
      };

      const startRow = range?.tl?.nativeRow ?? 0;
      const startCol = range?.tl?.nativeCol ?? 0;
      const endRow = range?.br?.nativeRow ?? startRow;
      const endCol = range?.br?.nativeCol ?? startCol;

      const extension = imageData.extension || 'png';
      const buffer = Buffer.from(imageData.buffer);

      // Determine label based on position
      let label = labelFromRow(startRow);

      // Override if we detect it's a map
      if (isLikelyMap(buffer)) {
        label = 'location_map';
      }

      images.push({
        id: `img_${worksheet.name}_${img.imageId}`,
        buffer,
        extension,
        mimeType: getMimeType(extension),
        label,
        row: startRow,
        col: startCol,
        width: endCol - startCol,
        height: endRow - startRow,
        sizeBytes: buffer.byteLength,
      });
    }
  }

  // Sort by row position
  images.sort((a, b) => a.row - b.row);

  const skippedDupes = totalRefs - images.length - skippedNoBuffer;
  console.log(`[Image Extraction] Found ${images.length} unique images (${totalRefs} refs, ${skippedDupes} duplicates, ${skippedNoBuffer} missing buffer)`);

  // Log image details for debugging
  for (const img of images) {
    console.log(`[Image Extraction] Image: ${img.id}, row=${img.row}, label=${img.label}, size=${(img.sizeBytes / 1024).toFixed(1)}KB`);
  }

  return images;
}

/**
 * Extract images from an Excel buffer
 */
export async function extractImagesFromBuffer(buffer: Buffer): Promise<ExtractedImage[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return extractImagesFromWorkbook(workbook);
}

/**
 * Group images by label for easier organization
 */
export function groupImagesByLabel(
  images: ExtractedImage[]
): Record<ImageLabel, ExtractedImage[]> {
  const groups: Record<ImageLabel, ExtractedImage[]> = {
    exterior_photos: [],
    interior_photos: [],
    location_map: [],
    floor_plan: [],
    site_sketch: [],
    aerial_view: [],
    street_view: [],
    document_scan: [],
    appraiser_signature: [],
    company_logo: [],
    unknown: [],
  };

  for (const img of images) {
    groups[img.label].push(img);
  }

  return groups;
}

/**
 * Generate storage path for an image
 */
export function generateImageStoragePath(
  jobId: string,
  image: ExtractedImage,
  index: number
): string {
  return `imports/${jobId}/images/${image.label}_${index + 1}.${image.extension}`;
}

/**
 * Summary of extracted images for logging/display
 */
export function summarizeImages(images: ExtractedImage[]): string {
  if (images.length === 0) {
    return 'No images found';
  }

  const groups = groupImagesByLabel(images);
  const parts: string[] = [];

  for (const [label, imgs] of Object.entries(groups)) {
    if (imgs.length > 0) {
      const totalSize = imgs.reduce((sum, img) => sum + img.sizeBytes, 0);
      const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
      parts.push(`${label}: ${imgs.length} (${sizeMB}MB)`);
    }
  }

  return parts.join(', ');
}

// ============================================================================
// AI-BASED IMAGE CLASSIFICATION (Gemini Vision)
// ============================================================================

// Lazy-initialized Gemini client
let genaiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (genaiClient) return genaiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  genaiClient = new GoogleGenAI({ apiKey });
  return genaiClient;
}

/**
 * Check if AI-based image classification is available
 */
export function isVisionClassificationAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Valid image labels for classification
 * Maps to report_photos.category enum in database
 */
const VALID_LABELS: ImageLabel[] = [
  'exterior_photos',
  'interior_photos',
  'location_map',
  'floor_plan',
  'site_sketch',
  'aerial_view',
  'street_view',
  'document_scan',
  'appraiser_signature',
  'company_logo',
  'unknown',
];

// More specific room types for interior classification
type RoomType = 'living_room' | 'bedroom' | 'bathroom' | 'kitchen' | 'balcony' | 'entrance' | 'garden' | 'pool' | 'garage' | 'roof';

export interface ClassifiedImage extends ExtractedImage {
  aiLabel?: ImageLabel;
  roomType?: RoomType;
  confidence?: number;
  aiDescription?: string;
}

/**
 * Classification prompt for Gemini Vision
 */
const VISION_CLASSIFICATION_PROMPT = `You are an expert at classifying real estate appraisal images.

For each image, determine:
1. The main category (one of: exterior_photos, interior_photos, location_map, floor_plan, site_sketch, aerial_view, street_view, document_scan, appraiser_signature, company_logo, unknown)
2. If interior_photos, also identify the room type (one of: living_room, bedroom, bathroom, kitchen, balcony, entrance, garden, pool, garage, roof)
3. A confidence score (0-100)
4. A brief description in Arabic (10 words max)

Classification guidelines:
- exterior_photos: Building facade, compound entrance, street-facing views of the property
- interior_photos: Any indoor room (living room, bedroom, bathroom, kitchen, etc.)
- location_map: Google Maps screenshot, satellite imagery, area maps
- floor_plan: Architectural drawings, blueprints, layout diagrams
- site_sketch: Hand-drawn plans, simple diagrams
- aerial_view: Drone photos, bird's eye views (not satellite maps)
- street_view: Photos showing the street/neighborhood context
- document_scan: Scanned papers, contracts, deeds, certificates
- appraiser_signature: Signature blocks, stamps, seals
- company_logo: Company branding, logos, letterheads
- unknown: Cannot determine or doesn't fit other categories

Return a JSON array with one object per image in order:
[
  {
    "index": 0,
    "label": "interior_photos",
    "roomType": "kitchen",
    "confidence": 95,
    "description": "مطبخ حديث مع خزائن خشبية"
  },
  ...
]

Only return the JSON array, no other text.`;

/**
 * Classify images using Gemini Vision
 * Processes in batches of 10 to stay within context limits
 */
export async function classifyImagesWithAI(
  images: ExtractedImage[]
): Promise<ClassifiedImage[]> {
  const genai = getGenAI();
  if (!genai || images.length === 0) {
    console.log('[Image Classification] AI not available, using row-based labels');
    return images;
  }

  console.log(`[Image Classification] Classifying ${images.length} images with Gemini Vision`);

  const classifiedImages: ClassifiedImage[] = [...images];
  const BATCH_SIZE = 10;

  try {
    // Process in batches
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      const batchStartIndex = i;

      // Build multimodal content with images
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: VISION_CLASSIFICATION_PROMPT },
        { text: `\n\nClassify these ${batch.length} images (indices ${batchStartIndex} to ${batchStartIndex + batch.length - 1}):\n` },
      ];

      // Add each image as base64
      for (let j = 0; j < batch.length; j++) {
        const img = batch[j];
        parts.push({ text: `\nImage ${batchStartIndex + j}:` });
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.buffer.toString('base64'),
          },
        });
      }

      // Call Gemini Vision - contents should be the parts array directly for multimodal
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: parts,
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const responseText = response.text ?? '';

      if (!responseText) {
        console.warn(`[Image Classification] Empty response for batch ${i / BATCH_SIZE}`);
        continue;
      }

      // Parse JSON response
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.warn(`[Image Classification] No JSON array found in response: ${responseText.slice(0, 200)}`);
          continue;
        }
        if (jsonMatch) {
          const classifications = JSON.parse(jsonMatch[0]) as Array<{
            index: number;
            label: string;
            roomType?: string;
            confidence: number;
            description: string;
          }>;

          // Apply classifications to images
          for (const classification of classifications) {
            const imgIndex = classification.index;
            if (imgIndex >= 0 && imgIndex < classifiedImages.length) {
              const label = VALID_LABELS.includes(classification.label as ImageLabel)
                ? (classification.label as ImageLabel)
                : classifiedImages[imgIndex].label;

              classifiedImages[imgIndex] = {
                ...classifiedImages[imgIndex],
                aiLabel: label,
                label: label, // Override row-based label with AI label
                roomType: classification.roomType as RoomType | undefined,
                confidence: classification.confidence,
                aiDescription: classification.description,
              };
            }
          }
        }
      } catch (parseError) {
        console.warn(`[Image Classification] Failed to parse AI response for batch ${i / BATCH_SIZE}:`, parseError);
        // Keep row-based labels for this batch
      }
    }

    const aiLabeled = classifiedImages.filter(img => img.aiLabel).length;
    console.log(`[Image Classification] Successfully classified ${aiLabeled}/${images.length} images with AI`);

    return classifiedImages;
  } catch (error) {
    console.error('[Image Classification] AI classification failed:', error);
    // Return original images with row-based labels
    return images;
  }
}

/**
 * Extract and classify images from a workbook
 * Uses AI classification if available, falls back to row-based heuristics
 */
export async function extractAndClassifyImages(
  workbook: ExcelJS.Workbook
): Promise<ClassifiedImage[]> {
  // First extract with row-based labels
  const images = extractImagesFromWorkbook(workbook);

  // Then enhance with AI classification if available
  if (isVisionClassificationAvailable() && images.length > 0) {
    return classifyImagesWithAI(images);
  }

  return images;
}

// ============================================================================
// PHOTO SELECTION & PDF CATEGORY MAPPING (single source of truth)
//
// Both the auto-approve path (inngest/functions.ts) and the manual-approve
// path (server/api.ts) MUST go through selectDisplayablePhotos so that what
// gets uploaded to storage, inserted into report_photos, and rendered in the
// PDF are always the same set. Keep this logic here, not duplicated.
// ============================================================================

/**
 * report_photos.category values the generated PDF actually renders. Photos that
 * map outside this set get category 'other': they are still extracted, stored,
 * and shown in review (so a human can relabel them) — they just have no
 * dedicated slot in the auto-generated PDF until categorised.
 */
export const RENDERABLE_PHOTO_CATEGORIES = [
  'facade',
  'location_map',
  'street_view',
  'living_room',
  'bedroom',
  'bathroom',
  'kitchen',
  'balcony',
  'entrance',
  'garden',
  'pool',
  'garage',
  'roof',
] as const;

/**
 * Objective junk gate (bytes). Real property photos in the sample appraisals are
 * ≥18 KB; embedded UI artifacts (checkbox squares ~33px wide, bullet icons,
 * spacers) are ≤0.5 KB. A 4 KB floor drops the artifacts with a >4x margin below
 * the smallest real photo, WITHOUT relying on AI labels or confidence — so a real
 * photo is never discarded just because the model was unsure how to label it.
 */
export const MIN_PHOTO_BYTES = 4096;

/**
 * Only exclude logos/signatures from report photos when the AI is confident
 * about that label. They are genuine images but not property photos (the PDF
 * feeds the stamp/signature from appraiser.stamp_url / signature_url separately).
 * If the model is unsure, we keep the image rather than risk dropping a real one.
 */
export const LOGO_SIGNATURE_MIN_CONFIDENCE = 70;

/** Interior categories cycled through when an interior photo has no roomType. */
const INTERIOR_FALLBACK_CATEGORIES = [
  'living_room',
  'bedroom',
  'bathroom',
  'kitchen',
  'entrance',
  'balcony',
] as const;

/** Non-interior label → report_photos.category. 'other' means "do not render". */
const LABEL_TO_CATEGORY: Record<ImageLabel, string> = {
  exterior_photos: 'facade',
  location_map: 'location_map',
  aerial_view: 'street_view', // show aerial as street_view for better visibility
  street_view: 'street_view',
  interior_photos: 'other', // handled specially via roomType below
  floor_plan: 'other',
  site_sketch: 'other',
  document_scan: 'other',
  appraiser_signature: 'other',
  company_logo: 'other',
  unknown: 'other',
};

/**
 * Build a stateful label→category mapper. Stateful because interior photos
 * without a roomType are assigned by cycling through INTERIOR_FALLBACK_CATEGORIES,
 * so create one mapper per report.
 */
export function createCategoryMapper(): (img: Pick<ClassifiedImage, 'label' | 'roomType'>) => string {
  let interiorFallbackIndex = 0;
  return (img) => {
    if (img.label === 'interior_photos') {
      if (img.roomType) return img.roomType;
      const category =
        INTERIOR_FALLBACK_CATEGORIES[interiorFallbackIndex % INTERIOR_FALLBACK_CATEGORIES.length];
      interiorFallbackIndex++;
      return category;
    }
    return LABEL_TO_CATEGORY[img.label] ?? 'other';
  };
}

export interface DisplayablePhoto {
  image: ClassifiedImage;
  /** Final report_photos.category — always one of RENDERABLE_PHOTO_CATEGORIES. */
  category: string;
  caption: string | null;
}

/**
 * Reduce extracted images to the report photos we keep, assigning each a
 * category. The goal is COMPLETENESS: every real photo is kept even when the
 * label is uncertain (those become category 'other' for human review). Only two
 * things are dropped, both on objective grounds:
 *   1. Images below MIN_PHOTO_BYTES — embedded UI artifacts (checkboxes, icons,
 *      spacers), never real photographs.
 *   2. Images the AI confidently identifies as a logo or signature — real
 *      images, but not property photos (handled by separate PDF slots).
 *
 * Crucially, low AI confidence and an 'unknown' label do NOT cause a drop: an
 * uncertain real photo is kept and surfaced in review rather than discarded.
 */
export function selectDisplayablePhotos(
  images: Array<ClassifiedImage | ExtractedImage>
): DisplayablePhoto[] {
  const mapCategory = createCategoryMapper();
  const photos: DisplayablePhoto[] = [];

  for (const img of images) {
    // 1. Objective junk gate — tiny embedded artifacts, independent of any label.
    if (img.sizeBytes < MIN_PHOTO_BYTES) {
      continue;
    }

    // 2. Confident logos/signatures are not property photos. Only drop when the
    //    model is sure; if unsure, keep the image (it may be a real photo).
    const confidence = (img as ClassifiedImage).confidence ?? 0;
    const isLogoOrSig = img.label === 'company_logo' || img.label === 'appraiser_signature';
    if (isLogoOrSig && confidence >= LOGO_SIGNATURE_MIN_CONFIDENCE) {
      continue;
    }

    // 3. Keep everything else. Uncertain/unknown labels map to 'other' and are
    //    preserved for human relabelling — never silently dropped.
    photos.push({
      image: img as ClassifiedImage,
      category: mapCategory(img as ClassifiedImage),
      caption: (img as ClassifiedImage).aiDescription ?? null,
    });
  }

  return photos;
}
