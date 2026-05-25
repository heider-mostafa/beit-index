-- ============================================================================
-- SPRINT 6A: DIRECT BOOKING MODEL
-- ============================================================================
-- Clients select a specific appraiser and request their services directly.
-- Appraisers set their own pricing and accept/decline requests.
-- ============================================================================

-- Drop the pool-based objects if they exist
drop view if exists available_jobs;
drop function if exists claim_job(uuid, uuid);
drop function if exists release_job(uuid, uuid, text);

-- ----------------------------------------------------------------------------
-- APPRAISER PRICING
-- ----------------------------------------------------------------------------
-- Each appraiser sets their own prices per property type / report kind

create table if not exists appraiser_pricing (
  id uuid primary key default uuid_generate_v4(),
  appraiser_id uuid not null references users(id) on delete cascade,
  property_type property_type_enum not null,
  report_kind text not null,                       -- brief | detailed | full

  price integer not null,                          -- in piasters (EGP * 100)

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(appraiser_id, property_type, report_kind)
);

create index if not exists idx_appraiser_pricing_appraiser on appraiser_pricing(appraiser_id);

alter table appraiser_pricing enable row level security;

-- Appraisers can manage their own pricing
drop policy if exists appraiser_pricing_own on appraiser_pricing;
create policy appraiser_pricing_own on appraiser_pricing
  for all using (appraiser_id = current_user_id());

-- Anyone can view active pricing (for booking)
drop policy if exists appraiser_pricing_public_read on appraiser_pricing;
create policy appraiser_pricing_public_read on appraiser_pricing
  for select using (is_active = true);

-- ----------------------------------------------------------------------------
-- APPRAISER SERVICE AREAS
-- ----------------------------------------------------------------------------
-- Note: appraiser_service_areas already exists from 0001_initial.sql with district_id
-- We'll use the existing table structure which links to districts

-- ----------------------------------------------------------------------------
-- UPDATE JOB_REQUESTS FOR DIRECT BOOKING
-- ----------------------------------------------------------------------------

-- Add new status values to the job_request_status enum
do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from pg_enum
    where enumlabel = 'pending_acceptance'
    and enumtypid = 'job_request_status'::regtype
  ) into v_exists;

  if not v_exists then
    -- Create new enum type with all values
    create type job_request_status_new as enum (
      'draft',
      'pending_acceptance',
      'accepted',
      'declined',
      'pending_payment',
      'paid',
      'assigned',
      'in_progress',
      'delivered',
      'completed',
      'disputed',
      'cancelled',
      'refunded'
    );

    -- Drop policies that depend on the status column
    drop policy if exists job_requests_client on job_requests;
    drop policy if exists job_requests_appraiser on job_requests;
    drop policy if exists job_requests_admin on job_requests;

    -- Drop the default
    alter table job_requests alter column status drop default;

    -- Alter the column type
    alter table job_requests
      alter column status type job_request_status_new
      using status::text::job_request_status_new;

    -- Drop old type and rename new one
    drop type job_request_status;
    alter type job_request_status_new rename to job_request_status;

    -- Re-add the default
    alter table job_requests alter column status set default 'draft'::job_request_status;

    -- Recreate policies
    create policy job_requests_client on job_requests for all
      using (client_id = (select id from users where auth_id = current_user_id()));

    create policy job_requests_appraiser on job_requests for select
      using (
        assigned_appraiser_id = (select id from users where auth_id = current_user_id())
        or (
          status = 'paid'
          and assigned_appraiser_id is null
          and exists (
            select 1 from appraiser_service_areas asa
            where asa.appraiser_id = (select id from users where auth_id = current_user_id())
            and asa.district_id = job_requests.district_id
          )
        )
      );

    create policy job_requests_admin on job_requests for all
      using (current_user_role() = 'admin');
  end if;
end $$;

-- Add fields for accept/decline workflow
alter table job_requests add column if not exists accepted_at timestamptz;
alter table job_requests add column if not exists declined_at timestamptz;
alter table job_requests add column if not exists decline_reason text;
alter table job_requests add column if not exists started_at timestamptz;

-- Index for appraiser's incoming requests (simple index, no partial for compatibility)
create index if not exists idx_job_requests_appraiser_status
  on job_requests(assigned_appraiser_id, status);

-- ----------------------------------------------------------------------------
-- APPRAISER AVAILABILITY (add to users table)
-- ----------------------------------------------------------------------------

alter table users add column if not exists is_available_for_jobs boolean default true;
alter table users add column if not exists max_concurrent_jobs integer default 5;

-- ----------------------------------------------------------------------------
-- FUNCTION: ACCEPT JOB REQUEST
-- ----------------------------------------------------------------------------

create or replace function accept_job_request(
  p_job_id uuid,
  p_appraiser_id uuid
) returns jsonb as $$
declare
  v_job record;
begin
  select * into v_job
  from job_requests
  where id = p_job_id
    and assigned_appraiser_id = p_appraiser_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job not found or not assigned to you');
  end if;

  if v_job.status != 'pending_acceptance' then
    return jsonb_build_object('success', false, 'error', 'Job is not pending acceptance');
  end if;

  update job_requests
  set
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  where id = p_job_id;

  return jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'message', 'Job accepted. Awaiting client payment.'
  );
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- FUNCTION: DECLINE JOB REQUEST
-- ----------------------------------------------------------------------------

create or replace function decline_job_request(
  p_job_id uuid,
  p_appraiser_id uuid,
  p_reason text default null
) returns jsonb as $$
declare
  v_job record;
begin
  select * into v_job
  from job_requests
  where id = p_job_id
    and assigned_appraiser_id = p_appraiser_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job not found or not assigned to you');
  end if;

  if v_job.status != 'pending_acceptance' then
    return jsonb_build_object('success', false, 'error', 'Job is not pending acceptance');
  end if;

  update job_requests
  set
    status = 'declined',
    declined_at = now(),
    decline_reason = p_reason,
    updated_at = now()
  where id = p_job_id;

  return jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'message', 'Job declined.'
  );
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- FUNCTION: START JOB (after payment)
-- ----------------------------------------------------------------------------

create or replace function start_job(
  p_job_id uuid,
  p_appraiser_id uuid
) returns jsonb as $$
declare
  v_job record;
begin
  select * into v_job
  from job_requests
  where id = p_job_id
    and assigned_appraiser_id = p_appraiser_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job not found or not assigned to you');
  end if;

  if v_job.status != 'paid' then
    return jsonb_build_object('success', false, 'error', 'Job is not paid yet');
  end if;

  update job_requests
  set
    status = 'in_progress',
    started_at = now(),
    updated_at = now()
  where id = p_job_id;

  return jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'message', 'Job started'
  );
end;
$$ language plpgsql security definer;
