-- Migration: Add report_number field
-- This allows tracking original report numbers from imported files

-- Add report_number column to reports table
alter table reports add column if not exists report_number text;

-- Add index for searching by report number
create index if not exists reports_report_number_idx on reports(report_number) where report_number is not null;

-- Comment for documentation
comment on column reports.report_number is 'External report number from imported files or client reference';
