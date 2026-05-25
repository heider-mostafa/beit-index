/**
 * Template Registry
 *
 * Central registry for all known Excel template formats.
 * Each template has a fingerprint (for detection) and cell mappings (for extraction).
 */

import fraResidentialV1 from './fra-residential-v1.0';
import type { CellMapping } from './fra-residential-v1.0';

export interface TemplateFingerprint {
  checks: Array<{
    cell: string;
    contains: string;
  }>;
  minMatches: number;
}

export interface Template {
  id: string;
  name: string;
  version: string;
  fingerprint: TemplateFingerprint;
  cells: CellMapping[];
}

// All registered templates
export const TEMPLATES: Template[] = [
  {
    id: 'fra-residential-v1.0',
    name: 'FRA Residential',
    version: '1.0',
    fingerprint: fraResidentialV1.fingerprint,
    cells: fraResidentialV1.cells,
  },
  // Future templates can be added here:
  // {
  //   id: 'fra-commercial-v1.0',
  //   name: 'FRA Commercial',
  //   version: '1.0',
  //   fingerprint: fraCommercialV1.fingerprint,
  //   cells: fraCommercialV1.cells,
  // },
];

/**
 * Get a template by its ID
 */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Get all template IDs (for fingerprinting)
 */
export function getTemplateIds(): string[] {
  return TEMPLATES.map((t) => t.id);
}

export type { CellMapping };
