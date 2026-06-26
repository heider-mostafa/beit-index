/**
 * Unit tests for image extraction and classification utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  createCategoryMapper,
  selectDisplayablePhotos,
  MIN_PHOTO_BYTES,
  LOGO_SIGNATURE_MIN_CONFIDENCE,
  type ImageLabel,
  type ClassifiedImage,
} from './images';

// Build a minimal ClassifiedImage for tests. selectDisplayablePhotos reads
// label/roomType/confidence/aiDescription/sizeBytes. Default to a real-photo
// size so size isn't the thing under test unless a case sets it explicitly.
function makeImage(partial: Partial<ClassifiedImage> & { label: ImageLabel }): ClassifiedImage {
  return {
    id: 'img',
    buffer: Buffer.alloc(0),
    extension: 'png',
    mimeType: 'image/png',
    row: 0,
    col: 0,
    width: 0,
    height: 0,
    sizeBytes: 50_000, // 50 KB — a real photo by default
    ...partial,
  };
}

describe('createCategoryMapper (real production mapper)', () => {
  it('maps exterior_photos to facade', () => {
    expect(createCategoryMapper()({ label: 'exterior_photos' })).toBe('facade');
  });

  it('maps interior_photos with roomType to the roomType', () => {
    expect(createCategoryMapper()({ label: 'interior_photos', roomType: 'kitchen' })).toBe('kitchen');
  });

  it('cycles interior_photos without roomType through fallback categories', () => {
    const map = createCategoryMapper();
    const results = Array.from({ length: 8 }, () => map({ label: 'interior_photos' }));
    expect(results).toEqual([
      'living_room', 'bedroom', 'bathroom', 'kitchen', 'entrance', 'balcony',
      'living_room', 'bedroom', // wraps around
    ]);
  });

  it('maps location_map, aerial_view and street_view', () => {
    const map = createCategoryMapper();
    expect(map({ label: 'location_map' })).toBe('location_map');
    expect(map({ label: 'aerial_view' })).toBe('street_view');
    expect(map({ label: 'street_view' })).toBe('street_view');
  });

  it('maps logos, signatures, scans and unknown to other', () => {
    const map = createCategoryMapper();
    for (const label of ['company_logo', 'appraiser_signature', 'document_scan', 'floor_plan', 'site_sketch', 'unknown'] as ImageLabel[]) {
      expect(map({ label })).toBe('other');
    }
  });
});

describe('selectDisplayablePhotos (completeness-first: keep real photos, drop only objective junk)', () => {
  it('drops tiny embedded UI artifacts (checkboxes / icons) by size', () => {
    const photos = selectDisplayablePhotos([
      makeImage({ label: 'unknown', sizeBytes: 300 }),               // checkbox
      makeImage({ label: 'exterior_photos', sizeBytes: 250 }),       // icon mislabeled
      makeImage({ label: 'interior_photos', roomType: 'kitchen', sizeBytes: 50_000 }), // real
    ]);
    expect(photos).toHaveLength(1);
    expect(photos[0].category).toBe('kitchen');
  });

  it('uses MIN_PHOTO_BYTES as the boundary', () => {
    const justUnder = selectDisplayablePhotos([makeImage({ label: 'exterior_photos', sizeBytes: MIN_PHOTO_BYTES - 1 })]);
    const atThreshold = selectDisplayablePhotos([makeImage({ label: 'exterior_photos', sizeBytes: MIN_PHOTO_BYTES })]);
    expect(justUnder).toHaveLength(0);
    expect(atThreshold).toHaveLength(1);
  });

  it('drops logos/signatures ONLY when the AI is confident', () => {
    const photos = selectDisplayablePhotos([
      makeImage({ label: 'company_logo', confidence: 95 }),         // confident logo → drop
      makeImage({ label: 'appraiser_signature', confidence: 90 }),  // confident sig → drop
      makeImage({ label: 'company_logo', confidence: LOGO_SIGNATURE_MIN_CONFIDENCE - 1 }), // unsure → KEEP
    ]);
    expect(photos).toHaveLength(1);
    expect(photos[0].category).toBe('other'); // kept for review
  });

  it('KEEPS real photos even when the label is unknown or low-confidence', () => {
    // The core requirement: an uncertain real photo must never be discarded.
    const photos = selectDisplayablePhotos([
      makeImage({ label: 'unknown', confidence: 5, sizeBytes: 60_000 }),
      makeImage({ label: 'interior_photos', roomType: 'bedroom', confidence: 8, sizeBytes: 60_000 }),
      makeImage({ label: 'floor_plan', sizeBytes: 60_000 }),
      makeImage({ label: 'document_scan', sizeBytes: 60_000 }),
    ]);
    expect(photos).toHaveLength(4); // all kept
    expect(photos.map((p) => p.category)).toEqual(['other', 'bedroom', 'other', 'other']);
  });

  it('keeps row-based images with no confidence score (AI unavailable)', () => {
    const photos = selectDisplayablePhotos([
      makeImage({ label: 'exterior_photos' }), // confidence undefined
      makeImage({ label: 'location_map' }),
      makeImage({ label: 'unknown' }),         // still kept → other
    ]);
    expect(photos.map((p) => p.category)).toEqual(['facade', 'location_map', 'other']);
  });

  it('carries the AI caption through', () => {
    const photos = selectDisplayablePhotos([
      makeImage({ label: 'interior_photos', roomType: 'pool', confidence: 95, aiDescription: 'حمام سباحة' }),
    ]);
    expect(photos[0].category).toBe('pool');
    expect(photos[0].caption).toBe('حمام سباحة');
  });
});

describe('Row Label Rules', () => {
  // Test the row-based labeling logic
  const ROW_LABEL_RULES = [
    { minRow: 0, maxRow: 20, label: 'company_logo' },
    { minRow: 21, maxRow: 100, label: 'exterior_photos' },
    { minRow: 100, maxRow: 160, label: 'exterior_photos' },
    { minRow: 190, maxRow: 220, label: 'exterior_photos' },
    { minRow: 250, maxRow: 280, label: 'location_map' },
    { minRow: 280, maxRow: 330, label: 'interior_photos' },
    { minRow: 330, maxRow: 400, label: 'floor_plan' },
    { minRow: 400, maxRow: 500, label: 'document_scan' },
  ];

  const labelFromRow = (row: number): string => {
    for (const rule of ROW_LABEL_RULES) {
      if (row >= rule.minRow && row < rule.maxRow) {
        return rule.label;
      }
    }
    return 'unknown';
  };

  it('labels rows 0-20 as company_logo', () => {
    expect(labelFromRow(0)).toBe('company_logo');
    expect(labelFromRow(10)).toBe('company_logo');
    expect(labelFromRow(19)).toBe('company_logo');
  });

  it('labels rows 21-100 as exterior_photos', () => {
    expect(labelFromRow(21)).toBe('exterior_photos');
    expect(labelFromRow(50)).toBe('exterior_photos');
    expect(labelFromRow(99)).toBe('exterior_photos');
  });

  it('labels rows 250-280 as location_map', () => {
    expect(labelFromRow(250)).toBe('location_map');
    expect(labelFromRow(270)).toBe('location_map');
    expect(labelFromRow(279)).toBe('location_map');
  });

  it('labels rows 280-330 as interior_photos', () => {
    expect(labelFromRow(280)).toBe('interior_photos');
    expect(labelFromRow(300)).toBe('interior_photos');
    expect(labelFromRow(329)).toBe('interior_photos');
  });

  it('labels rows 330-400 as floor_plan', () => {
    expect(labelFromRow(330)).toBe('floor_plan');
    expect(labelFromRow(380)).toBe('floor_plan');
  });

  it('labels unknown rows as unknown', () => {
    expect(labelFromRow(160)).toBe('unknown');
    expect(labelFromRow(185)).toBe('unknown');
    expect(labelFromRow(600)).toBe('unknown');
  });
});
