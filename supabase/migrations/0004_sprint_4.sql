-- Sprint 4: Backlog Ingestion
-- Adds import_jobs table for Excel/PDF backlog imports with engine verification

-- ============================================================================
-- IMPORT STATUS ENUM
-- ============================================================================

create type import_status as enum (
  'queued',          -- waiting in the job queue
  'parsing',         -- being processed
  'auto_approved',   -- engine verified >99% match, became a finalized report (Excel only)
  'pending_review',  -- needs human review (all PDFs, flagged Excels)
  'approved',        -- human approved, became a finalized report
  'rejected',        -- human rejected, source file kept but no report row
  'parse_failed'     -- couldn't extract enough fields
);

create type import_source_type as enum ('excel', 'pdf');

-- ============================================================================
-- IMPORT JOBS TABLE
-- ============================================================================

-- One row per uploaded file. Lifecycle: queued → parsing → (auto_approved | pending_review | parse_failed)
-- → (if pending_review) → approved or rejected
create table import_jobs (
  id uuid primary key default uuid_generate_v4(),
  appraiser_id uuid not null references users(id) on delete cascade,
  batch_id uuid,                                       -- groups files uploaded together
  source_type import_source_type not null,
  source_storage_path text not null,                   -- original file in private bucket
  original_filename text not null,
  status import_status not null default 'queued',

  -- Detection
  template_fingerprint text,                           -- which template version we matched
  parser_warnings jsonb default '[]'::jsonb,           -- non-fatal extraction warnings

  -- Extraction output (the parsed structured data, before engine verification)
  extracted_data jsonb,                                -- full report shape per src/lib/appraisal/types.ts

  -- Engine verification
  engine_computed jsonb,                               -- what the engine output for the extracted inputs
  engine_match_percent numeric(5,2),                   -- 0-100, comparison of typed vs computed values
  engine_discrepancies jsonb default '[]'::jsonb,      -- per-field deltas where typed != computed

  -- Outcome
  resulting_report_id uuid references reports(id),     -- set when approved/auto_approved
  rejected_reason text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,

  -- Timestamps
  created_at timestamptz not null default now(),
  parsed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index import_jobs_appraiser_status_idx
  on import_jobs(appraiser_id, status, created_at desc);
create index import_jobs_batch_idx on import_jobs(batch_id);

alter table import_jobs enable row level security;

-- Appraisers see only their own imports
create policy import_jobs_self_select on import_jobs for select
  using (appraiser_id = (select id from users where auth_id = current_user_id()) or current_user_role() = 'admin');

create policy import_jobs_self_insert on import_jobs for insert
  with check (appraiser_id = (select id from users where auth_id = current_user_id()));

create policy import_jobs_self_update on import_jobs for update
  using (appraiser_id = (select id from users where auth_id = current_user_id()) or current_user_role() = 'admin');

create trigger import_jobs_updated_at before update on import_jobs
  for each row execute function set_updated_at();

-- ============================================================================
-- REPORTS TABLE ADDITIONS
-- ============================================================================

-- Track that a report was created from an import (provenance for audit)
alter table reports add column if not exists import_job_id uuid references import_jobs(id);

-- ============================================================================
-- VALUATION RECORDS ADDITIONS
-- ============================================================================

-- Add is_provisional column for filtering imports out of headline analytics if needed
alter table valuation_records add column if not exists is_provisional boolean not null default false;

-- ============================================================================
-- UPDATE REPORT FINALIZATION TRIGGER
-- ============================================================================

-- Update on_report_finalized() to handle backlog imports and set is_provisional
create or replace function on_report_finalized() returns trigger as $$
declare
  v_is_provisional boolean := false;
  v_import_job record;
begin
  if new.status = 'finalized' and (old.status is distinct from 'finalized') then
    -- Require all final values to be set
    if new.final_value is null or new.land_value is null or new.building_value is null then
      raise exception 'Cannot finalize report without final values';
    end if;

    -- Determine if this is a provisional import (PDF-sourced)
    if new.import_job_id is not null then
      select * into v_import_job from import_jobs where id = new.import_job_id;
      if v_import_job.source_type = 'pdf' then
        v_is_provisional := true;
      end if;
    end if;

    -- Write anonymized record to valuation_records
    insert into valuation_records (
      district_id, compound_id, property_type, unit_net_area, unit_land_share,
      final_value, value_per_sqm, current_age, finishing_level,
      chosen_method, appraisal_date, source, is_provisional
    )
    select
      p.district_id, p.compound_id, p.property_type, new.unit_net_area, new.unit_land_share,
      new.final_value, new.final_value / nullif(new.unit_net_area, 0), new.current_age,
      new.finishing_level, new.chosen_method, new.appraisal_date, new.source, v_is_provisional
    from properties p
    where p.id = new.property_id;

    new.finalized_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Drop and recreate the trigger to use the updated function
drop trigger if exists reports_finalize on reports;
create trigger reports_finalize before update on reports
  for each row execute function on_report_finalized();

-- ============================================================================
-- AUDIT LOG ADDITIONS
-- ============================================================================

-- Add import-related audit actions
-- Note: Using DO block to safely add enum values
do $$
begin
  -- Check if the enum values exist before adding
  if not exists (select 1 from pg_enum where enumlabel = 'import_uploaded' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'import_uploaded';
  end if;
exception
  when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'import_approved' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'import_approved';
  end if;
exception
  when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'import_rejected' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'import_rejected';
  end if;
exception
  when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'import_source_viewed' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'import_source_viewed';
  end if;
exception
  when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'import_auto_approved' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'import_auto_approved';
  end if;
exception
  when others then null;
end $$;
