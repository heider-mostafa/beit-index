-- Sprint 2: Auth, Appraiser Onboarding, Admin Verification

-- ============================================================================
-- ONBOARDING DRAFTS
-- Separate from profiles to keep junk out of production tables
-- ============================================================================

create table appraiser_onboarding_drafts (
  user_id uuid primary key references users(id) on delete cascade,
  current_step integer not null default 1,
  draft_data jsonb not null default '{}',
  uploaded_files jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table appraiser_onboarding_drafts enable row level security;

create policy drafts_self_all on appraiser_onboarding_drafts for all
  using (user_id = (select id from users where auth_id = current_user_id()))
  with check (user_id = (select id from users where auth_id = current_user_id()));

create trigger drafts_updated_at before update on appraiser_onboarding_drafts
  for each row execute function set_updated_at();

-- ============================================================================
-- ADMIN INVITES
-- Token-based invite links that expire in 7 days
-- ============================================================================

create table admin_invites (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  token text not null unique,
  invited_by uuid not null references users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index admin_invites_email_idx on admin_invites(email);
create index admin_invites_token_idx on admin_invites(token);

alter table admin_invites enable row level security;

create policy admin_invites_admin_only on admin_invites for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- Allow public to read unexpired invites by token (for signup flow)
create policy admin_invites_token_lookup on admin_invites for select
  using (
    consumed_at is null
    and expires_at > now()
  );

-- ============================================================================
-- SEED PROPERTY TYPES
-- ============================================================================

insert into property_types (name_en, name_ar) values
  ('Apartment', 'شقة'),
  ('Villa', 'فيلا'),
  ('Duplex', 'دوبلكس'),
  ('Commercial Shop', 'محل تجاري'),
  ('Office', 'مكتب'),
  ('Building', 'عمارة'),
  ('Compound Unit', 'وحدة كمبوند'),
  ('Roof', 'روف')
on conflict (name_en) do nothing;
