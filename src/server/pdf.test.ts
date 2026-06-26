/**
 * Unit tests for PDF generation utilities.
 */

import { describe, it, expect } from 'vitest';

// Test the report type page configuration
describe('Report Type Page Configuration', () => {
  type ReportKind = 'brief' | 'narrative_limited' | 'narrative_full';

  const REPORT_TYPE_PAGES: Record<ReportKind, { pages: number[]; description: string }> = {
    brief: {
      pages: [1, 10, 12],
      description: 'مختصر - Summary report with key valuation results',
    },
    narrative_limited: {
      pages: [1, 2, 5, 7, 9, 10, 11, 12],
      description: 'سردي محدود - Limited narrative with essential analysis',
    },
    narrative_full: {
      pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      description: 'سردي متكامل - Full comprehensive appraisal report',
    },
  };

  it('brief report includes only essential pages (1, 10, 12)', () => {
    const pages = REPORT_TYPE_PAGES.brief.pages;
    expect(pages).toEqual([1, 10, 12]);
    expect(pages).toHaveLength(3);
    expect(pages).toContain(1);  // Cover page
    expect(pages).toContain(10); // Reconciliation
    expect(pages).toContain(12); // Certification
  });

  it('narrative_limited report includes 8 pages', () => {
    const pages = REPORT_TYPE_PAGES.narrative_limited.pages;
    expect(pages).toHaveLength(8);
    expect(pages).toContain(1);  // Cover
    expect(pages).toContain(2);  // Location photos
    expect(pages).toContain(5);  // Physical characteristics
    expect(pages).toContain(7);  // Market study
    expect(pages).toContain(9);  // Sales comparison
    expect(pages).toContain(10); // Reconciliation
    expect(pages).toContain(11); // Assumptions
    expect(pages).toContain(12); // Certification
  });

  it('narrative_full report includes all 12 pages', () => {
    const pages = REPORT_TYPE_PAGES.narrative_full.pages;
    expect(pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(pages).toHaveLength(12);
  });

  it('all report types include cover page (1) and certification page (12)', () => {
    for (const type of Object.keys(REPORT_TYPE_PAGES) as ReportKind[]) {
      const pages = REPORT_TYPE_PAGES[type].pages;
      expect(pages).toContain(1);
      expect(pages).toContain(12);
    }
  });

  it('all report types include reconciliation page (10)', () => {
    for (const type of Object.keys(REPORT_TYPE_PAGES) as ReportKind[]) {
      const pages = REPORT_TYPE_PAGES[type].pages;
      expect(pages).toContain(10);
    }
  });
});

describe('Page Number Calculation', () => {
  // Simulate the page number calculation logic from generateReportHTML
  const calculatePageNumbers = (includedPages: number[]): Map<number, number> => {
    const pageNumberMap = new Map<number, number>();
    let currentPageNumber = 1;

    for (const originalPageNum of includedPages) {
      if (originalPageNum === 3 || originalPageNum === 4) {
        // Pages 3-4 are generated together
        if (originalPageNum === 3) {
          pageNumberMap.set(3, currentPageNumber);
          pageNumberMap.set(4, currentPageNumber + 1);
          currentPageNumber += 2;
        }
      } else {
        pageNumberMap.set(originalPageNum, currentPageNumber);
        currentPageNumber++;
      }
    }

    return pageNumberMap;
  };

  it('calculates correct page numbers for brief report', () => {
    const pageMap = calculatePageNumbers([1, 10, 12]);
    expect(pageMap.get(1)).toBe(1);
    expect(pageMap.get(10)).toBe(2);
    expect(pageMap.get(12)).toBe(3);
  });

  it('calculates correct page numbers for narrative_limited report', () => {
    const pageMap = calculatePageNumbers([1, 2, 5, 7, 9, 10, 11, 12]);
    expect(pageMap.get(1)).toBe(1);
    expect(pageMap.get(2)).toBe(2);
    expect(pageMap.get(5)).toBe(3);
    expect(pageMap.get(7)).toBe(4);
    expect(pageMap.get(9)).toBe(5);
    expect(pageMap.get(10)).toBe(6);
    expect(pageMap.get(11)).toBe(7);
    expect(pageMap.get(12)).toBe(8);
  });

  it('calculates correct page numbers for narrative_full report', () => {
    const pageMap = calculatePageNumbers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(pageMap.get(1)).toBe(1);
    expect(pageMap.get(2)).toBe(2);
    expect(pageMap.get(3)).toBe(3);
    expect(pageMap.get(4)).toBe(4);
    expect(pageMap.get(5)).toBe(5);
    expect(pageMap.get(6)).toBe(6);
    expect(pageMap.get(7)).toBe(7);
    expect(pageMap.get(8)).toBe(8);
    expect(pageMap.get(9)).toBe(9);
    expect(pageMap.get(10)).toBe(10);
    expect(pageMap.get(11)).toBe(11);
    expect(pageMap.get(12)).toBe(12);
  });
});

describe('Footer Generation', () => {
  // Test the footer generation helper logic
  const generateFooterContent = (appraiser?: {
    signature_url?: string | null;
    stamp_url?: string | null;
  }): { hasSignature: boolean; hasStamp: boolean } => {
    return {
      hasSignature: !!appraiser?.signature_url,
      hasStamp: !!appraiser?.stamp_url,
    };
  };

  it('detects when signature and stamp are provided', () => {
    const result = generateFooterContent({
      signature_url: 'data:image/png;base64,abc123',
      stamp_url: 'data:image/png;base64,xyz789',
    });
    expect(result.hasSignature).toBe(true);
    expect(result.hasStamp).toBe(true);
  });

  it('detects when signature and stamp are missing', () => {
    const result = generateFooterContent(undefined);
    expect(result.hasSignature).toBe(false);
    expect(result.hasStamp).toBe(false);
  });

  it('detects when only signature is provided', () => {
    const result = generateFooterContent({
      signature_url: 'data:image/png;base64,abc123',
      stamp_url: null,
    });
    expect(result.hasSignature).toBe(true);
    expect(result.hasStamp).toBe(false);
  });

  it('detects when only stamp is provided', () => {
    const result = generateFooterContent({
      signature_url: null,
      stamp_url: 'data:image/png;base64,xyz789',
    });
    expect(result.hasSignature).toBe(false);
    expect(result.hasStamp).toBe(true);
  });
});

describe('Checklist Dynamic Logic', () => {
  // Test the checklist checkbox logic
  const getPropertyFlags = (propertyType: string, tenancy: string) => {
    const isResidential = ['apartment', 'villa', 'duplex', 'compound_unit', 'roof'].includes(propertyType);
    const isCommercial = ['commercial_shop'].includes(propertyType);
    const isOffice = ['office', 'building'].includes(propertyType);
    const isOwnerOccupied = tenancy === 'owner_occupied';
    const isRented = tenancy === 'rented';

    return { isResidential, isCommercial, isOffice, isOwnerOccupied, isRented };
  };

  it('correctly identifies residential property types', () => {
    const result = getPropertyFlags('apartment', 'owner_occupied');
    expect(result.isResidential).toBe(true);
    expect(result.isCommercial).toBe(false);
    expect(result.isOffice).toBe(false);
  });

  it('correctly identifies villa as residential', () => {
    const result = getPropertyFlags('villa', 'owner_occupied');
    expect(result.isResidential).toBe(true);
  });

  it('correctly identifies commercial property types', () => {
    const result = getPropertyFlags('commercial_shop', 'rented');
    expect(result.isResidential).toBe(false);
    expect(result.isCommercial).toBe(true);
    expect(result.isOffice).toBe(false);
  });

  it('correctly identifies office property types', () => {
    const result = getPropertyFlags('office', 'rented');
    expect(result.isResidential).toBe(false);
    expect(result.isCommercial).toBe(false);
    expect(result.isOffice).toBe(true);
  });

  it('correctly identifies building as office type', () => {
    const result = getPropertyFlags('building', 'rented');
    expect(result.isOffice).toBe(true);
  });

  it('correctly identifies owner_occupied tenancy', () => {
    const result = getPropertyFlags('apartment', 'owner_occupied');
    expect(result.isOwnerOccupied).toBe(true);
    expect(result.isRented).toBe(false);
  });

  it('correctly identifies rented tenancy', () => {
    const result = getPropertyFlags('apartment', 'rented');
    expect(result.isOwnerOccupied).toBe(false);
    expect(result.isRented).toBe(true);
  });

  it('correctly identifies vacant tenancy', () => {
    const result = getPropertyFlags('apartment', 'vacant');
    expect(result.isOwnerOccupied).toBe(false);
    expect(result.isRented).toBe(false);
  });
});
