-- 0018: Professional credentials (CBE + syndicate/carnet) and expanded property types
--
-- 1. Adds optional CBE accreditation and professional-syndicate ("carnet")
--    fields to appraiser profiles. FRA stays required; these are optional and
--    surface as extra credibility badges when provided.
-- 2. Expands the property-type catalogue with the physical forms that actually
--    occur (penthouse, twinhouse, townhouse, chalet, studio, ...) and retires
--    "Compound Unit" as a *type* — being inside a gated compound is now an
--    orthogonal flag on the subject property, not a property type.

-- ---------------------------------------------------------------------------
-- 1) Optional professional credentials on appraiser_profiles
-- ---------------------------------------------------------------------------
alter table appraiser_profiles
  add column if not exists cbe_registration_number text,
  add column if not exists cbe_issue_date date,
  add column if not exists cbe_expiry_date date,
  add column if not exists syndicate_name text,
  add column if not exists syndicate_membership_number text,
  add column if not exists syndicate_expiry_date date;

comment on column appraiser_profiles.cbe_registration_number is
  'Central Bank of Egypt accredited-valuator register number (optional).';
comment on column appraiser_profiles.syndicate_name is
  'Professional syndicate that issued the membership card / carnet (e.g. Engineers, Commercial Professions). Optional.';
comment on column appraiser_profiles.syndicate_membership_number is
  'Membership / carnet number on the professional syndicate card. Optional.';

-- New verification-document kinds for the optional credential uploads.
alter type document_type add value if not exists 'cbe_license';
alter type document_type add value if not exists 'syndicate_card';

-- ---------------------------------------------------------------------------
-- 2) Expand the property_type_enum (subject properties / reports / jobs).
--    ADD VALUE is safe here because the new values are not USED in this file;
--    Postgres 12+ only forbids using a freshly added enum value in the same
--    transaction, not adding it.
-- ---------------------------------------------------------------------------
alter type property_type_enum add value if not exists 'studio';
alter type property_type_enum add value if not exists 'penthouse';
alter type property_type_enum add value if not exists 'twinhouse';
alter type property_type_enum add value if not exists 'townhouse';
alter type property_type_enum add value if not exists 'chalet';
alter type property_type_enum add value if not exists 'cabin';
alter type property_type_enum add value if not exists 'garden_ground_floor';
alter type property_type_enum add value if not exists 'administrative_unit';
alter type property_type_enum add value if not exists 'clinic';
alter type property_type_enum add value if not exists 'warehouse';
alter type property_type_enum add value if not exists 'land';

-- ---------------------------------------------------------------------------
-- 3) Property-types catalogue (appraiser specialties). Retire "Compound Unit"
--    without deleting it (would cascade-remove existing specialties), and add
--    the new forms. is_active lets the UI hide retired types.
-- ---------------------------------------------------------------------------
alter table property_types add column if not exists is_active boolean not null default true;

update property_types set is_active = false where name_en = 'Compound Unit';

insert into property_types (name_en, name_ar) values
  ('Studio', 'استوديو'),
  ('Penthouse', 'بنتهاوس'),
  ('Twinhouse', 'توين هاوس'),
  ('Townhouse', 'تاون هاوس'),
  ('Chalet', 'شاليه'),
  ('Cabin', 'كابين'),
  ('Ground Floor with Garden', 'دور أرضي بحديقة'),
  ('Administrative Unit', 'وحدة إدارية'),
  ('Clinic', 'عيادة'),
  ('Warehouse', 'مخزن'),
  ('Land / Plot', 'أرض / قطعة أرض')
on conflict (name_en) do nothing;

-- ---------------------------------------------------------------------------
-- 4) "Inside a gated compound?" flag — the orthogonal replacement for the old
--    Compound Unit type. Lives on the subject property and the job request.
-- ---------------------------------------------------------------------------
alter table properties   add column if not exists in_compound boolean not null default false;
alter table job_requests add column if not exists in_compound boolean not null default false;

comment on column properties.in_compound is
  'Whether the subject unit sits inside a gated compound. Independent of property_type.';
