-- ============================================================================
-- SPRINT 6B: NOTIFICATIONS + REPORT DELIVERY
-- ============================================================================
-- In-app notifications for all status changes
-- Report delivery workflow with file attachments
-- ============================================================================

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,

  -- Notification type and content
  type text not null,  -- job_request, job_accepted, job_declined, payment_received, job_started, report_delivered, job_completed
  title text not null,
  message text not null,

  -- Related entities
  job_id uuid,  -- FK added conditionally below

  -- Metadata for rich notifications
  metadata jsonb default '{}',

  -- Status
  is_read boolean not null default false,
  read_at timestamptz,

  -- Timestamps
  created_at timestamptz not null default now()
);

-- Add foreign key only if job_requests table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'job_requests') then
    begin
      alter table notifications
        add constraint notifications_job_fk
        foreign key (job_id) references job_requests(id) on delete set null;
    exception when duplicate_object then
      null; -- constraint already exists
    end;
  end if;
end $$;

create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_user_unread on notifications(user_id) where is_read = false;
create index if not exists idx_notifications_created on notifications(created_at desc);

alter table notifications enable row level security;

-- Users can only see their own notifications
drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications
  for all using (user_id = current_user_id());

-- ----------------------------------------------------------------------------
-- REPORT DELIVERABLES TABLE
-- ----------------------------------------------------------------------------
-- Stores delivered report files and metadata

create table if not exists report_deliverables (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null,  -- FK added conditionally below

  -- File information
  file_name text not null,
  file_path text not null,  -- Storage path in Supabase Storage
  file_size integer,        -- Size in bytes
  file_type text not null default 'application/pdf',

  -- Report metadata
  report_type text not null default 'valuation_report',  -- valuation_report, supporting_docs, photos
  notes text,

  -- Delivery tracking
  delivered_at timestamptz not null default now(),
  downloaded_at timestamptz,
  download_count integer not null default 0,

  -- Who delivered
  delivered_by uuid not null references users(id),

  created_at timestamptz not null default now()
);

-- Add foreign key only if job_requests table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'job_requests') then
    begin
      alter table report_deliverables
        add constraint report_deliverables_job_fk
        foreign key (job_id) references job_requests(id) on delete cascade;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

create index if not exists idx_report_deliverables_job on report_deliverables(job_id);

alter table report_deliverables enable row level security;

-- Appraisers can manage deliverables for their jobs
drop policy if exists report_deliverables_appraiser on report_deliverables;
create policy report_deliverables_appraiser on report_deliverables
  for all using (
    delivered_by = current_user_id() or
    exists (
      select 1 from job_requests j
      where j.id = report_deliverables.job_id
        and j.assigned_appraiser_id = current_user_id()
    )
  );

-- Clients can view deliverables for their jobs
drop policy if exists report_deliverables_client_read on report_deliverables;
create policy report_deliverables_client_read on report_deliverables
  for select using (
    exists (
      select 1 from job_requests j
      where j.id = report_deliverables.job_id
        and j.client_id = current_user_id()
    )
  );

-- ----------------------------------------------------------------------------
-- UPDATE JOB_REQUESTS FOR DELIVERY TRACKING
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'job_requests') then
    alter table job_requests add column if not exists delivered_at timestamptz;
    alter table job_requests add column if not exists completed_at timestamptz;
    alter table job_requests add column if not exists client_notes text;
    alter table job_requests add column if not exists appraiser_notes text;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- FUNCTION: CREATE NOTIFICATION
-- ----------------------------------------------------------------------------

create or replace function create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_job_id uuid default null,
  p_metadata jsonb default '{}'
) returns uuid as $$
declare
  v_notification_id uuid;
begin
  insert into notifications (user_id, type, title, message, job_id, metadata)
  values (p_user_id, p_type, p_title, p_message, p_job_id, p_metadata)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- FUNCTION: DELIVER REPORT
-- ----------------------------------------------------------------------------

create or replace function deliver_report(
  p_job_id uuid,
  p_appraiser_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size integer default null,
  p_file_type text default 'application/pdf',
  p_report_type text default 'valuation_report',
  p_notes text default null
) returns jsonb as $$
declare
  v_job record;
  v_deliverable_id uuid;
begin
  -- Verify job belongs to appraiser and is in correct status
  select * into v_job
  from job_requests
  where id = p_job_id
    and assigned_appraiser_id = p_appraiser_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job not found or not assigned to you');
  end if;

  if v_job.status not in ('in_progress', 'delivered') then
    return jsonb_build_object('success', false, 'error', 'Job must be in progress to deliver report');
  end if;

  -- Create deliverable record
  insert into report_deliverables (
    job_id, file_name, file_path, file_size, file_type, report_type, notes, delivered_by
  ) values (
    p_job_id, p_file_name, p_file_path, p_file_size, p_file_type, p_report_type, p_notes, p_appraiser_id
  ) returning id into v_deliverable_id;

  -- Update job status to delivered
  update job_requests
  set
    status = 'delivered',
    delivered_at = now(),
    updated_at = now()
  where id = p_job_id;

  -- Notify client
  perform create_notification(
    v_job.client_id,
    'report_delivered',
    'Report Delivered',
    'Your valuation report is ready for download.',
    p_job_id,
    jsonb_build_object('file_name', p_file_name, 'deliverable_id', v_deliverable_id)
  );

  return jsonb_build_object(
    'success', true,
    'deliverable_id', v_deliverable_id,
    'message', 'Report delivered successfully'
  );
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- FUNCTION: COMPLETE JOB (Client confirms receipt)
-- ----------------------------------------------------------------------------

create or replace function complete_job(
  p_job_id uuid,
  p_client_id uuid
) returns jsonb as $$
declare
  v_job record;
begin
  select * into v_job
  from job_requests
  where id = p_job_id
    and client_id = p_client_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Job not found');
  end if;

  if v_job.status != 'delivered' then
    return jsonb_build_object('success', false, 'error', 'Job must be delivered before completion');
  end if;

  -- Mark as completed
  update job_requests
  set
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  where id = p_job_id;

  -- Notify appraiser
  perform create_notification(
    v_job.assigned_appraiser_id,
    'job_completed',
    'Job Completed',
    'The client has confirmed receipt of the report. Payment will be released.',
    p_job_id,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'message', 'Job completed successfully'
  );
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- TRIGGER: NOTIFY ON JOB STATUS CHANGE
-- ----------------------------------------------------------------------------

create or replace function notify_job_status_change() returns trigger as $$
begin
  -- Only fire on status change
  if OLD.status = NEW.status then
    return NEW;
  end if;

  case NEW.status
    when 'pending_acceptance' then
      -- Notify appraiser of new request
      perform create_notification(
        NEW.assigned_appraiser_id,
        'job_request',
        'New Job Request',
        'You have a new appraisal request.',
        NEW.id,
        jsonb_build_object('property_type', NEW.property_type)
      );

    when 'accepted' then
      -- Notify client that appraiser accepted
      perform create_notification(
        NEW.client_id,
        'job_accepted',
        'Request Accepted',
        'The appraiser has accepted your request. Please proceed with payment.',
        NEW.id,
        '{}'::jsonb
      );

    when 'declined' then
      -- Notify client that appraiser declined
      perform create_notification(
        NEW.client_id,
        'job_declined',
        'Request Declined',
        'The appraiser has declined your request.',
        NEW.id,
        jsonb_build_object('reason', NEW.decline_reason)
      );

    when 'paid' then
      -- Notify appraiser that payment received
      perform create_notification(
        NEW.assigned_appraiser_id,
        'payment_received',
        'Payment Received',
        'Payment has been received. You can start working on the appraisal.',
        NEW.id,
        '{}'::jsonb
      );

    when 'in_progress' then
      -- Notify client that work has started
      perform create_notification(
        NEW.client_id,
        'job_started',
        'Work Started',
        'The appraiser has started working on your appraisal.',
        NEW.id,
        '{}'::jsonb
      );

    else
      -- Other statuses handled by specific functions
      null;
  end case;

  return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger only if job_requests exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'job_requests') then
    drop trigger if exists trg_notify_job_status on job_requests;
    create trigger trg_notify_job_status
      after update on job_requests
      for each row
      execute function notify_job_status_change();
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- FUNCTION: MARK NOTIFICATION AS READ
-- ----------------------------------------------------------------------------

create or replace function mark_notification_read(p_notification_id uuid)
returns boolean as $$
begin
  update notifications
  set is_read = true, read_at = now()
  where id = p_notification_id
    and user_id = current_user_id();

  return found;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- FUNCTION: MARK ALL NOTIFICATIONS AS READ
-- ----------------------------------------------------------------------------

create or replace function mark_all_notifications_read()
returns integer as $$
declare
  v_count integer;
begin
  update notifications
  set is_read = true, read_at = now()
  where user_id = current_user_id()
    and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- VIEW: UNREAD NOTIFICATION COUNT
-- ----------------------------------------------------------------------------

create or replace view my_unread_notifications as
select count(*) as unread_count
from notifications
where user_id = current_user_id()
  and is_read = false;
