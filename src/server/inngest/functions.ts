/**
 * Inngest Background Job Functions
 *
 * Handles the processing of import jobs:
 * 1. Excel parsing → template fingerprinting → data extraction → engine verification
 * 2. PDF OCR → text extraction → best-effort data extraction
 *
 * Optimized for speed - consolidates steps to minimize Inngest overhead.
 */

import { inngest, type ImportJobStartedEvent } from './client';
import { parseExcelBuffer } from '../import/excel';
// Note: parsePDFWithFallback is dynamically imported in processPDFFile()
// to avoid loading the 'canvas' package until actually needed (canvas has
// native bindings that can conflict with system libraries)
import { verifyExtractedData, canVerify } from '../import/verify';
import { getServiceClient } from '../supabase';
import {
  summarizeImages,
  classifyImagesWithAI,
  selectDisplayablePhotos,
  type DisplayablePhoto,
} from '../import/images';

/**
 * Main import job processor
 *
 * Triggered when a new file is uploaded. Handles both Excel and PDF files.
 * Optimized to complete in <30 seconds for typical files.
 */
export const processImportJob = inngest.createFunction(
  { id: 'process-import-job', triggers: [{ event: 'import/job.started' }] },
  async ({ event, step }: { event: { data: ImportJobStartedEvent['data'] }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { jobId, sourceType, storagePath } = event.data;
    const supabase = getServiceClient();

    // Single step to download and process - minimizes Inngest overhead
    const result = await step.run('process-file', async () => {
      // Update status to parsing
      await supabase
        .from('import_jobs')
        .update({ status: 'parsing' })
        .eq('id', jobId);

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('imports')
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
      }

      const fileBuffer = Buffer.from(await fileData.arrayBuffer());

      // Process based on type
      if (sourceType === 'excel') {
        return await processExcelFile(supabase, jobId, fileBuffer);
      } else {
        return await processPDFFile(supabase, jobId, fileBuffer);
      }
    });

    return result;
  }
);

/**
 * Process an Excel file - all in one step for speed
 */
async function processExcelFile(
  supabase: ReturnType<typeof getServiceClient>,
  jobId: string,
  fileBuffer: Buffer
) {
  // Parse Excel (includes image extraction)
  const parseResult = await parseExcelBuffer(fileBuffer);

  // Classify images with AI Vision (falls back to row-based if AI unavailable)
  const classifiedImages = await classifyImagesWithAI(parseResult.images);

  // Keep every real photo (even when the AI is unsure of the label) and assign
  // each a category in one place. Only objective junk is dropped: tiny embedded
  // UI artifacts (checkboxes/icons) and confidently-identified logos/signatures.
  // Uncertain photos are kept as category 'other' for human review.
  const displayablePhotos = selectDisplayablePhotos(classifiedImages);

  // Upload the kept photos to storage (category + caption travel with each
  // image, so no fragile index re-zip downstream).
  const uploadedImages = await uploadImages(supabase, jobId, displayablePhotos);

  // Run verification if we have data
  let verificationResult = null;
  if (parseResult.success && parseResult.data && canVerify(parseResult.data)) {
    verificationResult = verifyExtractedData(parseResult.data);
  }

  // Determine final status
  // IMPORTANT: Only template-fingerprinted Excel can auto-approve.
  // Heuristic-parsed files always require human review because
  // engine verification against heuristic extraction is tautological.
  const isTemplateMatched = parseResult.templateId !== 'heuristic' && parseResult.templateId !== null;

  let finalStatus: string;
  if (!parseResult.success || !parseResult.data) {
    finalStatus = 'parse_failed';
  } else if (isTemplateMatched && verificationResult?.isAutoApprovable) {
    // Only auto-approve if template was matched AND engine verification passed
    finalStatus = 'auto_approved';
  } else {
    finalStatus = 'pending_review';
  }

  // Add image metadata to extracted data. Each uploaded entry already carries
  // its final category, caption, and AI fields — aligned by construction, not
  // by positional index, so a skipped upload can never shift metadata onto the
  // wrong photo.
  const extractedDataWithImages = {
    ...parseResult.data,
    _images: uploadedImages,
    _imageSummary: summarizeImages(displayablePhotos.map((p) => p.image)),
  };

  // Update job with all results at once
  await supabase
    .from('import_jobs')
    .update({
      status: finalStatus,
      template_fingerprint: parseResult.templateId,
      parser_warnings: parseResult.warnings,
      extracted_data: extractedDataWithImages,
      parsed_at: new Date().toISOString(),
      engine_computed: verificationResult?.engineComputed || null,
      engine_match_percent: verificationResult?.matchPercent || null,
      engine_discrepancies: verificationResult?.discrepancies || null,
    })
    .eq('id', jobId);

  // If auto-approved, create the report
  if (finalStatus === 'auto_approved' && parseResult.data) {
    await createReportFromImport(supabase, jobId, extractedDataWithImages);
  }

  return {
    success: parseResult.success,
    status: finalStatus,
    matchPercent: verificationResult?.matchPercent,
    discrepancies: verificationResult?.discrepancies?.length || 0,
    imageCount: uploadedImages.length,
  };
}

/** A photo that has been uploaded to storage, with its render metadata intact. */
interface UploadedImage {
  category: string;
  label: string;
  path: string;
  url: string;
  caption: string | null;
  roomType?: string;
  confidence?: number;
}

/**
 * Upload selected report photos to Supabase storage.
 *
 * Each returned entry keeps the category/caption/roomType that travelled with
 * the photo, so callers must NOT re-associate metadata by array index — a
 * failed upload is simply absent from the result, with no knock-on shift.
 */
async function uploadImages(
  supabase: ReturnType<typeof getServiceClient>,
  jobId: string,
  photos: DisplayablePhoto[]
): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];

  // Number files per category so multiple photos of the same type don't collide
  const categoryCounts: Record<string, number> = {};

  for (const { image, category, caption } of photos) {
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    const index = categoryCounts[category];

    const storagePath = `${jobId}/images/${category}_${index}.${image.extension}`;

    try {
      const { error } = await supabase.storage
        .from('imports')
        .upload(storagePath, image.buffer, {
          contentType: image.mimeType,
          upsert: true,
        });

      if (error) {
        console.error(`Failed to upload image ${storagePath}:`, error);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('imports')
        .getPublicUrl(storagePath);

      uploaded.push({
        category,
        label: image.label,
        path: storagePath,
        url: urlData.publicUrl,
        caption,
        roomType: image.roomType,
        confidence: image.confidence,
      });
    } catch (err) {
      console.error(`Error uploading image ${storagePath}:`, err);
    }
  }

  return uploaded;
}

/**
 * Process a PDF file - all in one step for speed
 */
async function processPDFFile(
  supabase: ReturnType<typeof getServiceClient>,
  jobId: string,
  fileBuffer: Buffer
) {
  // Dynamic import to avoid loading canvas until needed
  // (canvas has native bindings that can conflict with system glib)
  const { parsePDFWithFallback } = await import('../import/pdf');

  // Parse PDF with OCR
  const parseResult = await parsePDFWithFallback(fileBuffer);

  // PDFs always require human review
  const finalStatus = parseResult.success ? 'pending_review' : 'parse_failed';

  // Update job with results
  await supabase
    .from('import_jobs')
    .update({
      status: finalStatus,
      template_fingerprint: 'pdf-ocr',
      parser_warnings: parseResult.warnings.map(w => ({
        field: `page_${w.page}`,
        cell: '',
        message: w.message,
        severity: w.severity,
      })),
      extracted_data: {
        ...parseResult.extractedData,
        _ocrText: parseResult.ocrText,
        _ocrConfidence: parseResult.confidence,
      },
      parsed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  return {
    success: parseResult.success,
    status: finalStatus,
    pageCount: parseResult.pageCount,
    confidence: parseResult.confidence,
  };
}

/**
 * Create a finalized report from an auto-approved import
 */
async function createReportFromImport(
  supabase: ReturnType<typeof getServiceClient>,
  jobId: string,
  extractedData: Record<string, unknown>
) {
  // Get the import job for appraiser_id
  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .select('appraiser_id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    console.error('Failed to get import job for report creation:', jobError);
    return;
  }

  const identification = (extractedData.identification || {}) as Record<string, unknown>;
  const physical = (extractedData.physical || {}) as Record<string, unknown>;
  const reconciliation = (extractedData.reconciliation || {}) as Record<string, unknown>;

  // Create property (appraiser ownership is tracked via reports table, not properties)
  const { data: property, error: propError } = await supabase
    .from('properties')
    .insert({
      property_type: identification.propertyType || 'apartment',
      address_description: identification.addressDescription || 'Imported property',
      governorate_id: null,
      city_id: null,
      district_id: null,
      building_number: identification.buildingNumber || null,
      unit_number: identification.unitNumber || null,
      floor: identification.floor || null,
    })
    .select()
    .single();

  if (propError || !property) {
    console.error('Failed to create property:', propError);
    return;
  }

  // Create report
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .insert({
      template_id: 'fra-residential-v1.0',
      property_id: property.id,
      appraiser_id: job.appraiser_id,
      report_kind: identification.reportKind || 'brief',
      report_number: identification.reportNumber || null,
      tenancy: identification.tenancy || 'vacant',
      client_name: identification.clientName || 'Imported',
      owner_name: identification.ownerName || 'Imported',
      appraisal_date: identification.appraisalDate || new Date().toISOString().split('T')[0],
      valid_until: identification.validUntil || null,
      status: 'finalized',
      source: 'backlog_import',
      import_job_id: jobId,
      unit_net_area: physical.unitNetArea || 0,
      unit_gross_area: physical.unitGrossArea || 0,
      unit_land_share: physical.unitLandShare || 0,
      current_age: physical.currentAge || 0,
      economic_life: physical.economicLife || 60,
      effective_age: physical.effectiveAge || 0,
      bedrooms: physical.bedrooms || 0,
      bathrooms: physical.bathrooms || 0,
      total_rooms: physical.totalRooms || 0,
      finishing_level: physical.finishingLevel || 'full',
      has_pool: physical.hasPool || false,
      orientation: physical.orientation || null,
      final_value: reconciliation.finalValue || 0,
      land_value: reconciliation.landValue || 0,
      building_value: reconciliation.buildingValue || 0,
      chosen_method: reconciliation.chosenMethod || 'cost',
      // Note: raw extracted data is stored in import_jobs.extracted_data, linked via import_job_id
    })
    .select()
    .single();

  if (reportError || !report) {
    console.error('Failed to create report:', reportError);
    return;
  }

  // Link the report to the import job
  await supabase
    .from('import_jobs')
    .update({ resulting_report_id: report.id })
    .eq('id', jobId);

  // Save comparables to report_comparables table
  const salesComparison = (extractedData.salesComparison || {}) as Record<string, unknown>;
  const comparables = salesComparison.comparables as Array<Record<string, unknown>> | undefined;

  if (comparables && Array.isArray(comparables) && comparables.length > 0) {
    const comparableInserts = comparables.map((comp, index) => ({
      report_id: report.id,
      ord: index + 1,
      address: String(comp.address || 'Unknown'),
      source: String(comp.source || 'imported'),
      floor: comp.floor ? String(comp.floor) : null,
      sale_timing: mapSaleTiming(comp.saleTiming as string),
      tenancy: mapTenancy(comp.tenancy as string),
      age_years: typeof comp.ageYears === 'number' ? comp.ageYears : null,
      orientation: comp.orientation ? String(comp.orientation) : null,
      payment_terms: 'cash' as const,
      finishing_level: comp.finishingLevel ? String(comp.finishingLevel) : null,
      has_pool: Boolean(comp.hasPool),
      building_area_sqm: typeof comp.buildingAreaSqm === 'number' ? comp.buildingAreaSqm : 0,
      land_area_sqm: typeof comp.landAreaSqm === 'number' ? comp.landAreaSqm : 0,
      building_price_per_sqm: typeof comp.buildingPricePerSqm === 'number' ? comp.buildingPricePerSqm : 0,
      sale_price: typeof comp.salePrice === 'number' ? comp.salePrice : 0,
    }));

    const { error: compError } = await supabase
      .from('report_comparables')
      .insert(comparableInserts);

    if (compError) {
      console.error('Failed to insert comparables:', compError);
    } else {
      console.log(`[Import] Inserted ${comparableInserts.length} comparables for report ${report.id}`);
    }
  }

  // Save images to report_photos table. _images is already filtered to real,
  // displayable photos with their final category + caption assigned upstream
  // (selectDisplayablePhotos), so we insert as-is — no re-mapping or filtering.
  const images = extractedData._images as Array<{
    url: string;
    category: string;
    caption: string | null;
  }> | undefined;

  if (images && Array.isArray(images) && images.length > 0) {
    const photoInserts = images.map((img, index) => ({
      report_id: report.id,
      storage_path: img.url, // Use public URL for display
      category: img.category,
      caption: img.caption || null,
      ord: index,
    }));

    const { error: photoError } = await supabase
      .from('report_photos')
      .insert(photoInserts);

    if (photoError) {
      console.error('Failed to insert report photos:', photoError);
    } else {
      console.log(`[Import] Inserted ${photoInserts.length} photos for report ${report.id}`);
    }
  }
}

/**
 * Map sale timing string to enum value
 */
function mapSaleTiming(value: string | undefined): 'current_offer' | 'recent_sale' | 'historical' {
  if (!value) return 'current_offer';
  const normalized = value.toLowerCase().replace(/[_\s-]/g, '');
  if (normalized.includes('recent')) return 'recent_sale';
  if (normalized.includes('historical') || normalized.includes('old')) return 'historical';
  return 'current_offer';
}

/**
 * Map tenancy string to enum value
 */
function mapTenancy(value: string | undefined): 'owner_occupied' | 'vacant' | 'rented' {
  if (!value) return 'owner_occupied';
  const normalized = value.toLowerCase().replace(/[_\s-]/g, '');
  if (normalized.includes('vacant') || normalized.includes('empty')) return 'vacant';
  if (normalized.includes('rent')) return 'rented';
  return 'owner_occupied';
}

// Export all functions for the Inngest serve handler
export const functions = [processImportJob];
