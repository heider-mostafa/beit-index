-- Sprint 3: Report Editor & PDF Generation
-- Adds reports table structure, photos, templates, and related tables

-- ============================================================================
-- REQUIRED TYPES
-- ============================================================================

create type report_status as enum ('draft', 'submitted', 'finalized', 'rejected', 'archived');
create type report_source as enum ('platform', 'backlog_import');
create type chosen_method as enum ('cost', 'sales_comparison', 'income', 'grm');
create type finishing_level as enum ('luxury', 'super_lux', 'full', 'half', 'shell');
create type tenancy as enum ('owner_occupied', 'vacant', 'rented');
create type report_kind as enum ('brief', 'narrative_limited', 'narrative_full');
create type sale_timing as enum ('current_offer', 'recent_sale', 'historical');
create type payment_terms as enum ('cash', 'installments', 'mortgage');
create type property_type_enum as enum (
  'apartment', 'villa', 'duplex', 'commercial_shop', 'office',
  'building', 'compound_unit', 'roof'
);
create type photo_category as enum (
  'facade', 'entrance', 'living_room', 'bedroom', 'bathroom',
  'kitchen', 'balcony', 'garden', 'pool', 'garage',
  'roof', 'street_view', 'location_map', 'other'
);

-- ============================================================================
-- COMPOUNDS (extends gazetteer)
-- ============================================================================

create table compounds (
  id uuid primary key default uuid_generate_v4(),
  district_id uuid references districts(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  developer text,
  created_at timestamptz not null default now()
);

create index compounds_district_idx on compounds(district_id);

alter table compounds enable row level security;
create policy compounds_public_read on compounds for select using (true);

-- ============================================================================
-- REPORT TEMPLATES (versioned)
-- ============================================================================

create table report_templates (
  id text primary key,
  name text not null,
  property_types text[] not null,
  schema_version integer not null default 1,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now()
);

alter table report_templates enable row level security;
create policy templates_public_read on report_templates for select using (true);

-- ============================================================================
-- PROPERTIES (separate from reports - same property can be re-appraised)
-- Create table first, RLS policies added AFTER reports table exists
-- ============================================================================

create table properties (
  id uuid primary key default uuid_generate_v4(),
  property_type property_type_enum not null,
  governorate_id uuid references governorates(id),
  city_id uuid references cities(id),
  district_id uuid references districts(id),
  compound_id uuid references compounds(id),
  building_number text,
  unit_number text,
  plot_number text,
  floor text,
  address_description text not null,
  created_at timestamptz not null default now()
);

create index properties_district_idx on properties(district_id);
create index properties_compound_idx on properties(compound_id);

alter table properties enable row level security;

-- Simple insert policy (doesn't reference reports)
create policy properties_appraiser_insert on properties for insert
  with check (current_user_role() = 'appraiser');

-- ============================================================================
-- REPORTS - the master table
-- ============================================================================

create table reports (
  id uuid primary key default uuid_generate_v4(),
  template_id text not null references report_templates(id),
  property_id uuid not null references properties(id) on delete restrict,
  appraiser_id uuid not null references users(id),
  client_id uuid references users(id),
  source report_source not null default 'platform',

  -- Optimistic locking version
  version integer not null default 1,

  -- Identification
  project_name text,
  report_kind report_kind not null default 'narrative_full',
  tenancy tenancy not null default 'owner_occupied',
  owner_name text,
  client_name text,
  appraisal_date date,
  valid_until date,

  -- Physical
  project_land_area numeric(10,2),
  unit_gross_area numeric(10,2),
  unit_net_area numeric(10,2),
  unit_land_share numeric(10,2),
  services_share_percent numeric(5,2),
  current_age integer,
  economic_life integer not null default 60,
  effective_age integer,
  bedrooms integer,
  bathrooms integer,
  total_rooms integer,
  has_pool boolean not null default false,
  orientation text,
  finishing_level finishing_level,
  finishings jsonb,

  -- Market study
  market_bldg_halffinish_low numeric(12,2),
  market_bldg_halffinish_high numeric(12,2),
  market_bldg_fullfinish_low numeric(12,2),
  market_bldg_fullfinish_high numeric(12,2),
  market_land_low numeric(12,2),
  market_land_high numeric(12,2),
  market_services_low numeric(12,2),
  market_services_high numeric(12,2),
  market_notes text,

  -- Cost approach inputs
  cost_land_price_per_sqm numeric(12,2),
  cost_allowed_floors integer,
  cost_current_floors integer,
  cost_total_built_area numeric(12,2),
  cost_unit_area_to_value numeric(10,2),
  cost_construction_per_sqm numeric(12,2),
  cost_repairable_depreciation numeric(14,2) default 0,
  cost_garden_value numeric(14,2) default 0,
  cost_garage_value numeric(14,2) default 0,
  cost_storage_value numeric(14,2) default 0,
  cost_total numeric(14,2),

  -- Sales comparison
  sales_subject_building_area numeric(10,2),
  sales_subject_land_area numeric(10,2),
  sales_final_value numeric(14,2),
  sales_narrative text,

  -- Income capitalization
  income_monthly_rent numeric(12,2),
  income_vacancy_rate numeric(5,4) default 0.10,
  income_remaining_life integer,
  income_interest_rate numeric(5,2),
  income_total numeric(14,2),

  -- GRM
  grm_monthly_rent numeric(12,2),
  grm_multiplier numeric(5,2),
  grm_vacancy_amount numeric(14,2),
  grm_total numeric(14,2),

  -- Reconciliation
  chosen_method chosen_method,
  reconciliation_rationale text,
  final_value numeric(14,2),
  land_value numeric(14,2),
  building_value numeric(14,2),
  monthly_rent_reconciled numeric(12,2),

  -- Output
  pdf_storage_path text,
  pdf_generated_at timestamptz,
  pdf_hash text,

  -- Status & timestamps
  status report_status not null default 'draft',
  submitted_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_dashboard_idx on reports(appraiser_id, status, updated_at desc);
create index reports_property_idx on reports(property_id);
create index reports_status_idx on reports(status);
create index reports_appraisal_date_idx on reports(appraisal_date);

create trigger reports_updated_at before update on reports
  for each row execute function set_updated_at();

alter table reports enable row level security;

create policy reports_appraiser_read on reports for select
  using (
    appraiser_id = (select id from users where auth_id = current_user_id())
    or current_user_role() = 'admin'
  );

create policy reports_appraiser_insert on reports for insert
  with check (
    appraiser_id = (select id from users where auth_id = current_user_id())
    and current_user_role() = 'appraiser'
  );

create policy reports_appraiser_update on reports for update
  using (
    appraiser_id = (select id from users where auth_id = current_user_id())
    and status in ('draft', 'submitted')
  )
  with check (
    appraiser_id = (select id from users where auth_id = current_user_id())
  );

create policy reports_admin_update on reports for update
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ============================================================================
-- NOW add properties_read policy (reports table exists now)
-- ============================================================================

create policy properties_read on properties for select
  using (
    exists (
      select 1 from reports r
      where r.property_id = properties.id
      and r.appraiser_id = (select id from users where auth_id = current_user_id())
    )
    or current_user_role() = 'admin'
  );

-- ============================================================================
-- REPORT COMPARABLES
-- ============================================================================

create table report_comparables (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references reports(id) on delete cascade,
  ord integer not null,
  address text not null,
  source text not null,
  proximity text,
  floor text,
  sale_timing sale_timing not null default 'current_offer',
  tenancy tenancy not null default 'owner_occupied',
  age_years integer,
  orientation text,
  payment_terms payment_terms not null default 'cash',
  finishing_level text,
  condition text,
  location_quality text,
  garage_share numeric(14,2),
  building_area_sqm numeric(10,2) not null,
  land_area_sqm numeric(10,2) not null,
  has_pool boolean not null default false,
  building_price_per_sqm numeric(12,2) not null,
  sale_price numeric(14,2) not null,
  derived_land_value numeric(14,2),
  weight numeric(5,4) default 1,
  created_at timestamptz not null default now(),
  unique (report_id, ord)
);

create index comparables_report_idx on report_comparables(report_id);

alter table report_comparables enable row level security;

create policy comparables_read on report_comparables for select
  using (
    exists (
      select 1 from reports r
      where r.id = report_comparables.report_id
      and (
        r.appraiser_id = (select id from users where auth_id = current_user_id())
        or current_user_role() = 'admin'
      )
    )
  );

create policy comparables_insert on report_comparables for insert
  with check (
    exists (
      select 1 from reports r
      where r.id = report_comparables.report_id
      and r.appraiser_id = (select id from users where auth_id = current_user_id())
      and r.status = 'draft'
    )
  );

create policy comparables_update on report_comparables for update
  using (
    exists (
      select 1 from reports r
      where r.id = report_comparables.report_id
      and r.appraiser_id = (select id from users where auth_id = current_user_id())
      and r.status = 'draft'
    )
  );

create policy comparables_delete on report_comparables for delete
  using (
    exists (
      select 1 from reports r
      where r.id = report_comparables.report_id
      and r.appraiser_id = (select id from users where auth_id = current_user_id())
      and r.status = 'draft'
    )
  );

-- ============================================================================
-- REPORT PHOTOS
-- ============================================================================

create table report_photos (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  category photo_category not null default 'other',
  caption text,
  ord integer not null default 0,
  uploaded_at timestamptz not null default now()
);

create index report_photos_report_idx on report_photos(report_id);

alter table report_photos enable row level security;

create policy photos_read on report_photos for select
  using (
    exists (
      select 1 from reports r
      where r.id = report_photos.report_id
      and (
        r.appraiser_id = (select id from users where auth_id = current_user_id())
        or current_user_role() = 'admin'
      )
    )
  );

create policy photos_insert on report_photos for insert
  with check (
    exists (
      select 1 from reports r
      where r.id = report_photos.report_id
      and r.appraiser_id = (select id from users where auth_id = current_user_id())
      and r.status = 'draft'
    )
  );

create policy photos_delete on report_photos for delete
  using (
    exists (
      select 1 from reports r
      where r.id = report_photos.report_id
      and r.appraiser_id = (select id from users where auth_id = current_user_id())
      and r.status = 'draft'
    )
  );

-- ============================================================================
-- VALUATION RECORDS (anonymized analytics layer)
-- ============================================================================

create table valuation_records (
  id uuid primary key default uuid_generate_v4(),
  district_id uuid not null references districts(id),
  compound_id uuid references compounds(id),
  property_type property_type_enum not null,
  unit_net_area numeric(10,2) not null,
  unit_land_share numeric(10,2),
  final_value numeric(14,2) not null,
  value_per_sqm numeric(12,2) not null,
  current_age integer,
  finishing_level finishing_level,
  chosen_method chosen_method not null,
  appraisal_date date not null,
  source report_source not null,
  created_at timestamptz not null default now()
);

create index valuation_records_district_date_idx on valuation_records(district_id, appraisal_date desc);
create index valuation_records_compound_idx on valuation_records(compound_id);
create index valuation_records_per_sqm_idx on valuation_records(value_per_sqm);

alter table valuation_records enable row level security;

create policy valuation_records_admin_read on valuation_records for select
  using (current_user_role() = 'admin');

-- Allow insert from trigger (runs as definer)
create policy valuation_records_insert on valuation_records for insert
  with check (true);

-- ============================================================================
-- REPORT ACCESS GRANTS
-- ============================================================================

create table report_access_grants (
  report_id uuid not null references reports(id) on delete cascade,
  user_id uuid not null references users(id),
  granted_at timestamptz not null default now(),
  granted_by uuid references users(id),
  expires_at timestamptz,
  primary key (report_id, user_id)
);

alter table report_access_grants enable row level security;

create policy grants_read on report_access_grants for select
  using (
    user_id = (select id from users where auth_id = current_user_id())
    or granted_by = (select id from users where auth_id = current_user_id())
    or current_user_role() = 'admin'
  );

create policy grants_insert on report_access_grants for insert
  with check (
    exists (
      select 1 from reports r
      where r.id = report_access_grants.report_id
      and r.appraiser_id = (select id from users where auth_id = current_user_id())
    )
    or current_user_role() = 'admin'
  );

-- ============================================================================
-- REPORT FINALIZATION TRIGGER
-- ============================================================================

create or replace function on_report_finalized() returns trigger as $$
begin
  if new.status = 'finalized' and (old.status is distinct from 'finalized') then
    -- Require all final values to be set
    if new.final_value is null or new.land_value is null or new.building_value is null then
      raise exception 'Cannot finalize report without final values';
    end if;

    -- Write anonymized record to valuation_records
    insert into valuation_records (
      district_id, compound_id, property_type, unit_net_area, unit_land_share,
      final_value, value_per_sqm, current_age, finishing_level,
      chosen_method, appraisal_date, source
    )
    select
      p.district_id, p.compound_id, p.property_type, new.unit_net_area, new.unit_land_share,
      new.final_value, new.final_value / nullif(new.unit_net_area, 0), new.current_age,
      new.finishing_level, new.chosen_method, new.appraisal_date, new.source
    from properties p
    where p.id = new.property_id;

    new.finalized_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger reports_finalize before update on reports
  for each row execute function on_report_finalized();

-- ============================================================================
-- VERSION INCREMENT TRIGGER (for optimistic locking)
-- ============================================================================

create or replace function increment_report_version() returns trigger as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$ language plpgsql;

create trigger reports_version_increment before update on reports
  for each row execute function increment_report_version();

-- ============================================================================
-- SEED DATA
-- ============================================================================

insert into report_templates (id, name, property_types, schema_version, is_active, description)
values (
  'fra-residential-v1.0',
  'FRA Residential Appraisal',
  array['apartment', 'villa', 'duplex', 'compound_unit', 'roof'],
  1,
  true,
  'Standard FRA-compliant residential property appraisal template (Villa Solia / Amlak format, 2015 FRA standard)'
)
on conflict (id) do nothing;
