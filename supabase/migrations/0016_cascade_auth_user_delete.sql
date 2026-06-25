-- Sprint 8: Cascade auth.users deletions into public.users
-- ============================================================================
-- public.users.auth_id had no foreign key to auth.users, so deleting a user
-- from Supabase Auth left an orphaned public.users row. That zombie row:
--   - kept the appraiser visible in the admin verification queue, and
--   - blocked re-signup with the same email (unique-email collision), so the
--     new auth account never got a profile and could never reach onboarding.
--
-- This migration removes existing orphans and enforces the relationship so
-- future auth deletions cascade automatically (incl. drafts and profiles,
-- which already cascade from public.users).
-- ============================================================================

-- 1. Remove orphaned profiles whose auth user has already been deleted.
--    Cascades to appraiser_onboarding_drafts and appraiser_profiles.
delete from public.users u
where not exists (
  select 1 from auth.users au where au.id = u.auth_id
);

-- 2. Enforce auth_id -> auth.users(id) with ON DELETE CASCADE.
alter table public.users
  drop constraint if exists users_auth_id_fkey;

alter table public.users
  add constraint users_auth_id_fkey
  foreign key (auth_id) references auth.users(id) on delete cascade;
