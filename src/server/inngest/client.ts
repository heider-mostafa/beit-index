/**
 * Inngest Client Configuration
 *
 * Inngest is used for reliable background job processing.
 * Jobs are processed server-side without external API dependencies.
 */

import { Inngest } from 'inngest';

// Create the Inngest client with explicit dev mode
export const inngest = new Inngest({
  id: 'beit-index',
  // Explicitly set dev mode based on environment
  isDev: process.env.INNGEST_DEV === '1' || process.env.NODE_ENV !== 'production',
});

// Event types for type safety
export interface ImportJobStartedEvent {
  name: 'import/job.started';
  data: {
    jobId: string;
    appraiserId: string;
    sourceType: 'excel' | 'pdf';
    storagePath: string;
    originalFilename: string;
  };
}

export interface ImportJobProgressEvent {
  name: 'import/job.progress';
  data: {
    jobId: string;
    progress: number;
    status: string;
  };
}

// Type for all events
export type ImportEvents = ImportJobStartedEvent | ImportJobProgressEvent;
