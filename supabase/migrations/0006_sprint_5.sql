-- Sprint 5: Bank Analytics Dashboard + Job Request Marketplace
--
-- Part A: Bank analytics layer for reading valuation_records
-- Part B: Job request flow with Paymob payment integration
--
-- This is the revenue sprint - banks pay for market data, clients pay for appraisals

-- ============================================================================
-- PART A: BANK ANALYTICS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BANK ACCOUNTS
-- ----------------------------------------------------------------------------

-- Bank subscription tiers
create type bank_subscription_tier as enum (
  'trial',      -- 14-day free trial, limited queries
  'basic',      -- Single governorate access
  'pro',        -- Multi-governorate access
  'enterprise'  -- Full national access + API
);

-- Bank company accounts (distinct from individual users)
create table bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                              -- e.g. "National Bank of Egypt"
  name_ar text,                                    -- Arabic name
  subscription_tier bank_subscription_tier not null default 'trial',
  subscription_started_at timestamptz not null default now(),
  subscription_expires_at timestamptz,             -- null = never expires (enterprise)

  -- Access limits
  allowed_governorate_ids uuid[] default array[]::uuid[],  -- empty = all (enterprise)
  monthly_query_limit integer not null default 100,
  queries_this_month integer not null default 0,
  query_month_reset_at timestamptz not null default date_trunc('month', now()) + interval '1 month',

  -- API access (enterprise tier)
  api_enabled boolean not null default false,

  -- Contact info
  contact_email text not null,
  contact_phone text,
  address text,

  -- Billing
  tax_id text,                                     -- Egyptian tax ID for invoicing

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_accounts_tier_idx on bank_accounts(subscription_tier);
alter table bank_accounts enable row level security;

-- Admins can see all, bank users see their own account
create policy bank_accounts_admin on bank_accounts for all
  using (current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- BANK USERS (link users table to bank accounts)
-- ----------------------------------------------------------------------------

create table bank_users (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  role text not null default 'viewer',             -- viewer | analyst | admin
  created_at timestamptz not null default now(),

  unique(user_id, bank_account_id)
);

create index bank_users_account_idx on bank_users(bank_account_id);
create index bank_users_user_idx on bank_users(user_id);
alter table bank_users enable row level security;

-- Bank users can see their own membership
create policy bank_users_self on bank_users for select
  using (user_id = (select id from users where auth_id = current_user_id()));

create policy bank_users_admin on bank_users for all
  using (current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- BANK API KEYS (for programmatic access)
-- ----------------------------------------------------------------------------

create table bank_api_keys (
  id uuid primary key default uuid_generate_v4(),
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  key_hash text not null,                          -- bcrypt hash of the API key
  key_prefix text not null,                        -- first 8 chars for identification
  name text not null,                              -- "Production Key", "Test Key"
  scopes text[] not null default array['read:analytics'],

  last_used_at timestamptz,
  expires_at timestamptz,                          -- null = never expires
  revoked_at timestamptz,

  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index bank_api_keys_account_idx on bank_api_keys(bank_account_id);
create index bank_api_keys_prefix_idx on bank_api_keys(key_prefix);
alter table bank_api_keys enable row level security;

create policy bank_api_keys_admin on bank_api_keys for all
  using (current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- ANALYTICS QUERY LOG (for billing and rate limiting)
-- ----------------------------------------------------------------------------

create table analytics_queries (
  id uuid primary key default uuid_generate_v4(),
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  user_id uuid references users(id),               -- null if API key access
  api_key_id uuid references bank_api_keys(id),

  query_type text not null,                        -- 'price_trends', 'zone_breakdown', 'comparable_search'
  query_params jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,

  -- Performance tracking
  execution_ms integer,

  created_at timestamptz not null default now()
);

create index analytics_queries_account_month_idx
  on analytics_queries(bank_account_id, created_at desc);
alter table analytics_queries enable row level security;

create policy analytics_queries_admin on analytics_queries for all
  using (current_user_role() = 'admin');

-- ============================================================================
-- PART B: JOB REQUEST MARKETPLACE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- JOB REQUEST STATUS
-- ----------------------------------------------------------------------------

create type job_request_status as enum (
  'draft',           -- client started but not submitted
  'pending_payment', -- awaiting payment
  'paid',            -- payment received, waiting for appraiser assignment
  'assigned',        -- appraiser accepted
  'in_progress',     -- appraiser working on it
  'delivered',       -- appraiser submitted report
  'completed',       -- client accepted, job closed
  'disputed',        -- client raised issue
  'cancelled',       -- cancelled before assignment
  'refunded'         -- money returned to client
);

create type job_urgency as enum (
  'standard',        -- 7 business days
  'priority',        -- 3 business days (+50% fee)
  'express'          -- 24 hours (+100% fee)
);

-- ----------------------------------------------------------------------------
-- JOB REQUESTS
-- ----------------------------------------------------------------------------

-- A client requests an appraisal for a property
create table job_requests (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references users(id) on delete cascade,

  -- Property details (enough for appraisers to quote)
  property_type property_type_enum not null,
  governorate_id uuid not null references governorates(id),
  city_id uuid references cities(id),
  district_id uuid references districts(id),
  compound_id uuid references compounds(id),
  address_description text not null,

  -- Property specs for pricing
  approximate_area integer,                        -- sqm estimate
  floor text,
  bedrooms integer,

  -- Job requirements
  report_kind text not null default 'brief',       -- brief | detailed | full
  purpose text,                                    -- mortgage, sale, insurance, legal
  urgency job_urgency not null default 'standard',
  special_instructions text,

  -- Attached files (photos, docs the client provides)
  attachments jsonb default '[]'::jsonb,           -- [{path, name, type}]

  -- Pricing (set after appraiser assignment or from fixed pricing)
  base_price integer,                              -- in piasters (EGP * 100)
  urgency_fee integer default 0,
  platform_fee integer,                            -- 15% commission
  total_price integer,

  -- Status tracking
  status job_request_status not null default 'draft',

  -- Assignment
  assigned_appraiser_id uuid references users(id),
  assigned_at timestamptz,

  -- Delivery
  delivered_report_id uuid references reports(id),
  delivered_at timestamptz,

  -- Completion
  completed_at timestamptz,
  client_rating integer check (client_rating between 1 and 5),
  client_feedback text,

  -- Deadlines
  due_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_requests_client_idx on job_requests(client_id, status, created_at desc);
create index job_requests_appraiser_idx on job_requests(assigned_appraiser_id, status);
create index job_requests_location_idx on job_requests(governorate_id, city_id, district_id);
create index job_requests_status_idx on job_requests(status, created_at desc);

alter table job_requests enable row level security;

-- Clients see their own requests
create policy job_requests_client on job_requests for all
  using (client_id = (select id from users where auth_id = current_user_id()));

-- Appraisers see requests assigned to them or available in their areas
create policy job_requests_appraiser on job_requests for select
  using (
    assigned_appraiser_id = (select id from users where auth_id = current_user_id())
    or (
      status = 'paid'
      and exists (
        select 1 from appraiser_service_areas asa
        where asa.appraiser_id = (select id from users where auth_id = current_user_id())
        and asa.district_id = job_requests.district_id
      )
    )
  );

create policy job_requests_admin on job_requests for all
  using (current_user_role() = 'admin');

create trigger job_requests_updated_at before update on job_requests
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- JOB BIDS (optional - for marketplace model where appraisers bid)
-- ----------------------------------------------------------------------------

create table job_bids (
  id uuid primary key default uuid_generate_v4(),
  job_request_id uuid not null references job_requests(id) on delete cascade,
  appraiser_id uuid not null references users(id) on delete cascade,

  -- Bid details
  proposed_price integer not null,                 -- in piasters
  proposed_days integer not null,                  -- delivery time
  message text,                                    -- appraiser's pitch

  -- Status
  status text not null default 'pending',          -- pending | accepted | rejected | withdrawn

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(job_request_id, appraiser_id)
);

create index job_bids_job_idx on job_bids(job_request_id, status);
create index job_bids_appraiser_idx on job_bids(appraiser_id, status);

alter table job_bids enable row level security;

-- Appraisers see their own bids
create policy job_bids_appraiser on job_bids for all
  using (appraiser_id = (select id from users where auth_id = current_user_id()));

-- Job owners see bids on their jobs
create policy job_bids_client on job_bids for select
  using (
    job_request_id in (
      select id from job_requests
      where client_id = (select id from users where auth_id = current_user_id())
    )
  );

create policy job_bids_admin on job_bids for all
  using (current_user_role() = 'admin');

create trigger job_bids_updated_at before update on job_bids
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- PAYMENTS (Paymob transactions)
-- ----------------------------------------------------------------------------

create type payment_status as enum (
  'pending',         -- payment initiated
  'processing',      -- sent to Paymob
  'completed',       -- successfully paid
  'failed',          -- payment failed
  'refunded',        -- money returned
  'partially_refunded'
);

create type payment_method as enum (
  'card',            -- credit/debit card
  'wallet',          -- mobile wallet (Vodafone Cash, etc.)
  'kiosk',           -- Aman, Masary, etc.
  'bank_installments'
);

create table payments (
  id uuid primary key default uuid_generate_v4(),
  job_request_id uuid not null references job_requests(id) on delete cascade,
  payer_id uuid not null references users(id),

  -- Amounts (all in piasters)
  amount integer not null,
  platform_fee integer not null,                   -- our commission
  appraiser_amount integer not null,               -- amount to pay appraiser

  -- Paymob integration
  paymob_order_id text,                            -- from order registration
  paymob_transaction_id text,                      -- from payment callback
  paymob_payment_key text,                         -- for iframe
  payment_method payment_method,

  -- Status
  status payment_status not null default 'pending',

  -- Paymob callback data
  callback_data jsonb,

  -- Refund tracking
  refunded_amount integer default 0,
  refund_reason text,
  refunded_at timestamptz,

  -- Timestamps
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_job_idx on payments(job_request_id);
create index payments_paymob_order_idx on payments(paymob_order_id);
create index payments_paymob_tx_idx on payments(paymob_transaction_id);
create index payments_status_idx on payments(status, created_at desc);

alter table payments enable row level security;

-- Payers see their own payments
create policy payments_payer on payments for select
  using (payer_id = (select id from users where auth_id = current_user_id()));

create policy payments_admin on payments for all
  using (current_user_role() = 'admin');

create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- PAYOUTS (paying appraisers)
-- ----------------------------------------------------------------------------

create type payout_status as enum (
  'pending',         -- job completed, payout scheduled
  'processing',      -- being sent
  'completed',       -- money transferred
  'failed'           -- transfer failed
);

create table payouts (
  id uuid primary key default uuid_generate_v4(),
  appraiser_id uuid not null references users(id),
  job_request_id uuid not null references job_requests(id),
  payment_id uuid not null references payments(id),

  -- Amount
  amount integer not null,                         -- in piasters

  -- Bank account details (from appraiser profile)
  bank_name text,
  account_number text,                             -- masked after creation
  iban text,

  -- Status
  status payout_status not null default 'pending',

  -- Processing
  processed_at timestamptz,
  transaction_reference text,                      -- bank reference
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payouts_appraiser_idx on payouts(appraiser_id, status, created_at desc);
create index payouts_status_idx on payouts(status, created_at);

alter table payouts enable row level security;

-- Appraisers see their own payouts
create policy payouts_appraiser on payouts for select
  using (appraiser_id = (select id from users where auth_id = current_user_id()));

create policy payouts_admin on payouts for all
  using (current_user_role() = 'admin');

create trigger payouts_updated_at before update on payouts
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- PLATFORM FEES LEDGER (for accounting)
-- ----------------------------------------------------------------------------

create table platform_fees (
  id uuid primary key default uuid_generate_v4(),
  payment_id uuid not null references payments(id),
  job_request_id uuid not null references job_requests(id),

  -- Fee breakdown
  gross_amount integer not null,                   -- total payment
  platform_fee integer not null,                   -- our cut (15%)
  payment_processor_fee integer not null default 0, -- Paymob's cut (~2.5%)
  net_revenue integer not null,                    -- platform_fee - processor_fee

  -- Accounting
  settled boolean not null default false,
  settled_at timestamptz,

  created_at timestamptz not null default now()
);

create index platform_fees_settled_idx on platform_fees(settled, created_at);
alter table platform_fees enable row level security;

create policy platform_fees_admin on platform_fees for all
  using (current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- APPRAISER BANK DETAILS (for payouts)
-- ----------------------------------------------------------------------------

alter table appraiser_profiles
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_iban text,
  add column if not exists bank_swift text,
  add column if not exists bank_account_holder_name text;

-- ----------------------------------------------------------------------------
-- PRICING CONFIGURATION
-- ----------------------------------------------------------------------------

create table pricing_config (
  id uuid primary key default uuid_generate_v4(),
  property_type property_type_enum not null,
  report_kind text not null,                       -- brief | detailed | full

  -- Base price range (in piasters)
  min_price integer not null,
  max_price integer not null,
  price_per_sqm integer,                           -- for area-based pricing

  -- Urgency multipliers
  priority_multiplier numeric(3,2) not null default 1.50,
  express_multiplier numeric(3,2) not null default 2.00,

  -- Platform commission
  platform_fee_percent numeric(4,2) not null default 15.00,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(property_type, report_kind)
);

-- No hardcoded pricing - admins configure via /admin/pricing API
-- The pricing_config table is empty by default and must be configured before accepting jobs

alter table pricing_config enable row level security;

-- Anyone can read pricing
create policy pricing_config_read on pricing_config for select using (true);
create policy pricing_config_admin on pricing_config for all
  using (current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- AUDIT LOG ADDITIONS
-- ----------------------------------------------------------------------------

do $$
begin
  -- Job marketplace actions
  if not exists (select 1 from pg_enum where enumlabel = 'job_created' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'job_created';
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'job_paid' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'job_paid';
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'job_assigned' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'job_assigned';
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'job_delivered' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'job_delivered';
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'job_completed' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'job_completed';
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'payment_completed' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'payment_completed';
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'payout_sent' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'payout_sent';
  end if;
exception when others then null;
end $$;

-- Bank analytics actions
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'bank_account_created' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'bank_account_created';
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'bank_subscription_changed' and enumtypid = 'audit_action'::regtype) then
    alter type audit_action add value 'bank_subscription_changed';
  end if;
exception when others then null;
end $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate job price based on property type, area, report kind, and urgency
create or replace function calculate_job_price(
  p_property_type property_type_enum,
  p_report_kind text,
  p_area integer,
  p_urgency job_urgency
) returns table (
  base_price integer,
  urgency_fee integer,
  platform_fee integer,
  total_price integer
) as $$
declare
  v_config pricing_config%rowtype;
  v_base integer;
  v_urgency_mult numeric;
  v_urgency_fee integer;
  v_platform_fee integer;
  v_total integer;
begin
  -- Get pricing config
  select * into v_config
  from pricing_config
  where property_type = p_property_type
    and report_kind = p_report_kind
    and is_active = true;

  if not found then
    -- Default pricing
    v_base := 200000; -- 2000 EGP
    v_config.platform_fee_percent := 15.00;
    v_config.priority_multiplier := 1.50;
    v_config.express_multiplier := 2.00;
  else
    -- Calculate base price (area-based or minimum)
    if p_area is not null and v_config.price_per_sqm is not null then
      v_base := greatest(v_config.min_price, least(p_area * v_config.price_per_sqm, v_config.max_price));
    else
      v_base := v_config.min_price;
    end if;
  end if;

  -- Calculate urgency fee
  case p_urgency
    when 'priority' then v_urgency_mult := v_config.priority_multiplier - 1;
    when 'express' then v_urgency_mult := v_config.express_multiplier - 1;
    else v_urgency_mult := 0;
  end case;
  v_urgency_fee := (v_base * v_urgency_mult)::integer;

  -- Calculate platform fee (on base + urgency)
  v_platform_fee := ((v_base + v_urgency_fee) * v_config.platform_fee_percent / 100)::integer;

  -- Total
  v_total := v_base + v_urgency_fee;

  return query select v_base, v_urgency_fee, v_platform_fee, v_total;
end;
$$ language plpgsql stable;

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table bank_accounts is 'B2B customers (banks, real estate companies) who pay for analytics access';
comment on table job_requests is 'C2B marketplace - property owners request appraisals';
comment on table payments is 'Paymob payment records for job requests';
comment on table payouts is 'Payments to appraisers for completed jobs';
comment on table platform_fees is 'Commission tracking for accounting/reporting';
