-- Sprint 0: Initial Schema for Beit Index
-- Egypt's FRA-licensed property appraisal platform

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Updated at trigger function
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- USERS (created first so functions can reference it)
-- ============================================================================

create type user_role as enum ('owner', 'appraiser', 'bank', 'admin');

create table users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique not null,
  email text unique not null,
  full_name text not null,
  role user_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_auth_id_idx on users(auth_id);
create index users_email_idx on users(email);
create index users_role_idx on users(role);

create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS (created after users table exists)
-- ============================================================================

-- Helper function to get current user ID from JWT
create or replace function current_user_id()
returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$ language sql stable security definer;

-- Helper function to get current user role
create or replace function current_user_role()
returns text as $$
  select role::text from users where auth_id = current_user_id();
$$ language sql stable security definer;

-- ============================================================================
-- USERS RLS POLICIES (after functions are created)
-- ============================================================================

alter table users enable row level security;

-- Users can read their own data
create policy users_self_read on users for select
  using (auth_id = current_user_id());

-- Users can update their own data
create policy users_self_update on users for update
  using (auth_id = current_user_id())
  with check (auth_id = current_user_id());

-- Admins can read all users
create policy users_admin_read on users for select
  using (current_user_role() = 'admin');

-- Allow insert for new user creation (service role)
create policy users_insert on users for insert
  with check (true);

-- ============================================================================
-- GAZETTEER (Governorates, Cities, Districts)
-- ============================================================================

create table governorates (
  id uuid primary key default uuid_generate_v4(),
  name_en text not null unique,
  name_ar text not null,
  created_at timestamptz not null default now()
);

create table cities (
  id uuid primary key default uuid_generate_v4(),
  governorate_id uuid not null references governorates(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  created_at timestamptz not null default now(),
  unique(governorate_id, name_en)
);

create index cities_governorate_idx on cities(governorate_id);

create table districts (
  id uuid primary key default uuid_generate_v4(),
  city_id uuid not null references cities(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  created_at timestamptz not null default now(),
  unique(city_id, name_en)
);

create index districts_city_idx on districts(city_id);

-- Gazetteer tables are publicly readable
alter table governorates enable row level security;
alter table cities enable row level security;
alter table districts enable row level security;

create policy governorates_public_read on governorates for select using (true);
create policy cities_public_read on cities for select using (true);
create policy districts_public_read on districts for select using (true);

-- ============================================================================
-- APPRAISER PROFILES
-- ============================================================================

create type profile_status as enum ('pending', 'under_review', 'verified', 'rejected', 'suspended');
create type availability_status as enum ('this_week', 'next_week', 'two_weeks', 'unavailable');

create table appraiser_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references users(id) on delete cascade,

  -- Personal info
  full_name_en text not null,
  full_name_ar text,
  phone text,
  years_experience integer,
  professional_title_en text,
  professional_title_ar text,
  photo_url text,

  -- FRA License
  fra_license_number text unique,
  fra_license_issue_date date,
  fra_license_expiry_date date,

  -- National ID
  national_id_number text,

  -- Bio and terms
  bio_en text,
  bio_ar text,
  starting_price_egp integer,
  typical_turnaround_days integer,
  availability availability_status default 'this_week',

  -- Signature and stamp
  signature_url text,
  stamp_url text,

  -- Verification
  status profile_status not null default 'pending',
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references users(id),
  rejection_reason text,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appraiser_profiles_user_idx on appraiser_profiles(user_id);
create index appraiser_profiles_status_idx on appraiser_profiles(status);
create index appraiser_profiles_fra_idx on appraiser_profiles(fra_license_number);

alter table appraiser_profiles enable row level security;

-- Appraisers can read/update their own profile
create policy profiles_self_read on appraiser_profiles for select
  using (user_id = (select id from users where auth_id = current_user_id()));

create policy profiles_self_update on appraiser_profiles for update
  using (user_id = (select id from users where auth_id = current_user_id()))
  with check (user_id = (select id from users where auth_id = current_user_id()));

create policy profiles_self_insert on appraiser_profiles for insert
  with check (user_id = (select id from users where auth_id = current_user_id()));

-- Anyone can read verified profiles
create policy profiles_public_read on appraiser_profiles for select
  using (status = 'verified');

-- Admins can read and update all profiles
create policy profiles_admin_all on appraiser_profiles for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

create trigger appraiser_profiles_updated_at before update on appraiser_profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- VERIFICATION DOCUMENTS
-- ============================================================================

create type document_type as enum (
  'fra_license',
  'national_id_front',
  'national_id_back',
  'signature',
  'stamp',
  'other'
);

create table verification_documents (
  id uuid primary key default uuid_generate_v4(),
  appraiser_id uuid not null references appraiser_profiles(id) on delete cascade,
  document_type document_type not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size integer,
  uploaded_at timestamptz not null default now()
);

create index verification_docs_appraiser_idx on verification_documents(appraiser_id);

alter table verification_documents enable row level security;

-- Appraisers can manage their own documents
create policy docs_self_all on verification_documents for all
  using (appraiser_id in (
    select ap.id from appraiser_profiles ap
    join users u on u.id = ap.user_id
    where u.auth_id = current_user_id()
  ))
  with check (appraiser_id in (
    select ap.id from appraiser_profiles ap
    join users u on u.id = ap.user_id
    where u.auth_id = current_user_id()
  ));

-- Admins can read all documents
create policy docs_admin_read on verification_documents for select
  using (current_user_role() = 'admin');

-- ============================================================================
-- APPRAISER SERVICE AREAS
-- ============================================================================

create table appraiser_service_areas (
  id uuid primary key default uuid_generate_v4(),
  appraiser_id uuid not null references appraiser_profiles(id) on delete cascade,
  district_id uuid not null references districts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(appraiser_id, district_id)
);

create index service_areas_appraiser_idx on appraiser_service_areas(appraiser_id);
create index service_areas_district_idx on appraiser_service_areas(district_id);

alter table appraiser_service_areas enable row level security;

-- Appraisers can manage their own service areas
create policy service_areas_self_all on appraiser_service_areas for all
  using (appraiser_id in (
    select ap.id from appraiser_profiles ap
    join users u on u.id = ap.user_id
    where u.auth_id = current_user_id()
  ))
  with check (appraiser_id in (
    select ap.id from appraiser_profiles ap
    join users u on u.id = ap.user_id
    where u.auth_id = current_user_id()
  ));

-- Public read for verified appraisers
create policy service_areas_public_read on appraiser_service_areas for select
  using (appraiser_id in (
    select id from appraiser_profiles where status = 'verified'
  ));

-- Admins can read all
create policy service_areas_admin_read on appraiser_service_areas for select
  using (current_user_role() = 'admin');

-- ============================================================================
-- PROPERTY TYPES AND SPECIALTIES
-- ============================================================================

create table property_types (
  id uuid primary key default uuid_generate_v4(),
  name_en text not null unique,
  name_ar text not null,
  created_at timestamptz not null default now()
);

alter table property_types enable row level security;
create policy property_types_public_read on property_types for select using (true);

create table appraiser_specialties (
  id uuid primary key default uuid_generate_v4(),
  appraiser_id uuid not null references appraiser_profiles(id) on delete cascade,
  property_type_id uuid not null references property_types(id) on delete cascade,
  years_experience integer not null default 0,
  created_at timestamptz not null default now(),
  unique(appraiser_id, property_type_id)
);

create index specialties_appraiser_idx on appraiser_specialties(appraiser_id);

alter table appraiser_specialties enable row level security;

-- Appraisers can manage their own specialties
create policy specialties_self_all on appraiser_specialties for all
  using (appraiser_id in (
    select ap.id from appraiser_profiles ap
    join users u on u.id = ap.user_id
    where u.auth_id = current_user_id()
  ))
  with check (appraiser_id in (
    select ap.id from appraiser_profiles ap
    join users u on u.id = ap.user_id
    where u.auth_id = current_user_id()
  ));

-- Public read for verified appraisers
create policy specialties_public_read on appraiser_specialties for select
  using (appraiser_id in (
    select id from appraiser_profiles where status = 'verified'
  ));

-- Admins can read all
create policy specialties_admin_read on appraiser_specialties for select
  using (current_user_role() = 'admin');

-- ============================================================================
-- REVIEWS
-- ============================================================================

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  appraiser_id uuid not null references appraiser_profiles(id) on delete cascade,
  reviewer_user_id uuid references users(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  reviewer_first_name text,
  reviewer_last_initial text,
  created_at timestamptz not null default now()
);

create index reviews_appraiser_idx on reviews(appraiser_id);

alter table reviews enable row level security;

-- Public read for reviews of verified appraisers
create policy reviews_public_read on reviews for select
  using (appraiser_id in (
    select id from appraiser_profiles where status = 'verified'
  ));

-- Users can create reviews
create policy reviews_user_create on reviews for insert
  with check (reviewer_user_id = (select id from users where auth_id = current_user_id()));

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

create type audit_action as enum (
  'admin_override',
  'verification_doc_viewed',
  'profile_approved',
  'profile_rejected',
  'changes_requested',
  'admin_invited',
  'admin_invite_consumed'
);

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  action audit_action not null,
  target_table text,
  target_id uuid,
  metadata jsonb default '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_log_user_idx on audit_log(user_id);
create index audit_log_action_idx on audit_log(action);
create index audit_log_created_idx on audit_log(created_at desc);

alter table audit_log enable row level security;

-- Only admins can read audit logs
create policy audit_log_admin_read on audit_log for select
  using (current_user_role() = 'admin');

-- Service role can insert (we'll use service role for logging)
create policy audit_log_service_insert on audit_log for insert
  with check (true);
