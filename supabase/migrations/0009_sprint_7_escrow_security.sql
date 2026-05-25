-- ============================================================================
-- SPRINT 7: ESCROW & SECURITY HARDENING
-- ============================================================================
-- Adds escrow mechanism for payments and security improvements
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ESCROW STATUS FOR PAYMENTS
-- ----------------------------------------------------------------------------
-- Payments are held in escrow until job is completed

-- Add escrow tracking columns to payments
alter table payments add column if not exists escrow_status text default 'held';
alter table payments add column if not exists escrow_released_at timestamptz;
alter table payments add column if not exists escrow_release_reason text;

-- Add check constraint for escrow status
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_escrow_status_check'
  ) then
    alter table payments add constraint payments_escrow_status_check
      check (escrow_status in ('held', 'released', 'refunded', 'disputed'));
  end if;
end $$;

-- Add cancelled_at to job_requests if not exists
alter table job_requests add column if not exists cancelled_at timestamptz;

-- ----------------------------------------------------------------------------
-- PAYOUTS TABLE ENHANCEMENT
-- ----------------------------------------------------------------------------
-- Track payouts to appraisers with retry logic

alter table payouts add column if not exists retry_count integer default 0;
alter table payouts add column if not exists last_retry_at timestamptz;
alter table payouts add column if not exists failure_reason text;
alter table payouts add column if not exists scheduled_at timestamptz;

-- ----------------------------------------------------------------------------
-- FUNCTION: RELEASE ESCROW ON JOB COMPLETION
-- ----------------------------------------------------------------------------

create or replace function release_escrow_on_completion()
returns trigger as $$
declare
  v_payment record;
  v_appraiser_id uuid;
  v_payout_id uuid;
begin
  -- Only trigger when status changes to 'completed'
  if NEW.status = 'completed' and OLD.status != 'completed' then
    -- Get the payment for this job
    select * into v_payment
    from payments
    where job_request_id = NEW.id
      and status = 'completed'
      and escrow_status = 'held';

    if found then
      -- Release escrow
      update payments
      set
        escrow_status = 'released',
        escrow_released_at = now(),
        escrow_release_reason = 'Job completed and confirmed by client'
      where id = v_payment.id;

      -- Get appraiser ID
      v_appraiser_id := NEW.assigned_appraiser_id;

      if v_appraiser_id is not null then
        -- Create payout record for appraiser
        insert into payouts (
          appraiser_id,
          payment_id,
          amount,
          status,
          scheduled_at
        ) values (
          v_appraiser_id,
          v_payment.id,
          v_payment.appraiser_amount,
          'pending',
          now() + interval '1 day'  -- Schedule payout for next business day
        ) returning id into v_payout_id;

        -- Notify appraiser about pending payout
        insert into notifications (user_id, type, title, message, job_id, metadata)
        values (
          v_appraiser_id,
          'payout_pending',
          'Payment Released',
          'Your payment has been released and will be processed within 1 business day.',
          NEW.id,
          jsonb_build_object('payout_id', v_payout_id, 'amount', v_payment.appraiser_amount)
        );
      end if;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger for escrow release
drop trigger if exists trg_release_escrow on job_requests;
create trigger trg_release_escrow
  after update on job_requests
  for each row
  execute function release_escrow_on_completion();

-- ----------------------------------------------------------------------------
-- FUNCTION: HOLD ESCROW ON DISPUTE
-- ----------------------------------------------------------------------------

create or replace function hold_escrow_on_dispute()
returns trigger as $$
begin
  -- Only trigger when status changes to 'disputed'
  if NEW.status = 'disputed' and OLD.status != 'disputed' then
    -- Mark escrow as disputed
    update payments
    set escrow_status = 'disputed'
    where job_request_id = NEW.id
      and status = 'completed'
      and escrow_status = 'held';

    -- Cancel any pending payouts
    update payouts
    set status = 'cancelled', failure_reason = 'Job disputed'
    where payment_id in (
      select id from payments where job_request_id = NEW.id
    )
    and status = 'pending';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger for dispute handling
drop trigger if exists trg_hold_escrow_dispute on job_requests;
create trigger trg_hold_escrow_dispute
  after update on job_requests
  for each row
  execute function hold_escrow_on_dispute();

-- ----------------------------------------------------------------------------
-- RATE LIMITING TABLE
-- ----------------------------------------------------------------------------

create table if not exists rate_limits (
  id uuid primary key default uuid_generate_v4(),
  key text not null,  -- e.g., 'ip:192.168.1.1' or 'user:uuid'
  endpoint text not null,
  request_count integer not null default 1,
  window_start timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_key_endpoint on rate_limits(key, endpoint);
create index if not exists idx_rate_limits_window on rate_limits(window_start);

-- Function to check and increment rate limit
create or replace function check_rate_limit(
  p_key text,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;

  -- Get current count in window
  select coalesce(sum(request_count), 0) into v_count
  from rate_limits
  where key = p_key
    and endpoint = p_endpoint
    and window_start > v_window_start;

  if v_count >= p_max_requests then
    return false;  -- Rate limited
  end if;

  -- Increment counter
  insert into rate_limits (key, endpoint, request_count, window_start)
  values (p_key, p_endpoint, 1, now())
  on conflict (id) do nothing;

  return true;  -- Allowed
end;
$$ language plpgsql security definer;

-- Cleanup old rate limit records (run periodically)
create or replace function cleanup_rate_limits() returns void as $$
begin
  delete from rate_limits
  where window_start < now() - interval '1 hour';
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- FILE UPLOAD TRACKING
-- ----------------------------------------------------------------------------

create table if not exists file_uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  file_name text not null,
  file_size integer not null,
  mime_type text not null,
  storage_path text not null,
  upload_type text not null,  -- 'document', 'photo', 'report'
  is_validated boolean default false,
  validation_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_file_uploads_user on file_uploads(user_id);
create index if not exists idx_file_uploads_type on file_uploads(upload_type);

-- RLS for file uploads
alter table file_uploads enable row level security;

drop policy if exists file_uploads_own on file_uploads;
create policy file_uploads_own on file_uploads
  for all using (user_id = current_user_id());

drop policy if exists file_uploads_admin on file_uploads;
create policy file_uploads_admin on file_uploads
  for all using (current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- SECURITY AUDIT LOG ENHANCEMENT
-- ----------------------------------------------------------------------------

-- Add more detail to audit log for security events
alter table audit_log add column if not exists ip_address text;
alter table audit_log add column if not exists user_agent text;
alter table audit_log add column if not exists request_id text;

-- Index for security analysis
create index if not exists idx_audit_log_ip on audit_log(ip_address);
create index if not exists idx_audit_log_action_time on audit_log(action, created_at desc);
