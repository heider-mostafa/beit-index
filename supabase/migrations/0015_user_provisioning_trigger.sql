-- Sprint 8: Reliable user provisioning
-- ============================================================================
-- Previously the public.users row (and appraiser onboarding draft) were created
-- by a best-effort client fetch to /api/auth/create-profile right after signup.
-- If that call never completed (network blip, closed tab, server error) the
-- auth.users row existed but had no app-side profile, leaving the user orphaned
-- with no recovery path and invisible to the admin verification queue.
--
-- This migration makes provisioning a database guarantee: a trigger on
-- auth.users creates the public.users row atomically at signup. It also
-- backfills any auth users that were already orphaned.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger function: create the app-side profile when an auth user is created
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_full_name text;
begin
  v_full_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email);

  -- Only self-serve roles may be granted from client-supplied metadata.
  -- 'admin' is intentionally excluded: it is granted exclusively by the
  -- invite-consuming server path (/api/auth/create-profile), so that setting
  -- role='admin' in signup metadata cannot escalate privileges.
  v_role := case
    when new.raw_user_meta_data->>'role' in ('owner', 'appraiser', 'bank')
      then (new.raw_user_meta_data->>'role')::user_role
    else 'owner'
  end;

  insert into public.users (auth_id, email, full_name, role)
  values (new.id, new.email, v_full_name, v_role)
  on conflict (auth_id) do nothing;

  if v_role = 'appraiser' then
    insert into public.appraiser_onboarding_drafts (user_id, draft_data)
    select u.id, jsonb_build_object('fullNameEn', u.full_name)
    from public.users u
    where u.auth_id = new.id
    on conflict (user_id) do nothing;
  end if;

  return new;
exception
  -- Provisioning must never block the auth signup itself. If anything fails
  -- here, log it and let the signup proceed; the self-heal path on login and
  -- the idempotent /api/auth/create-profile endpoint will recover the row.
  when others then
    raise warning 'handle_new_user failed for auth user %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- One-time backfill: rescue auth users that were orphaned before this trigger
-- ----------------------------------------------------------------------------
insert into public.users (auth_id, email, full_name, role)
select
  au.id,
  au.email,
  coalesce(nullif(au.raw_user_meta_data->>'full_name', ''), au.email),
  case
    when au.raw_user_meta_data->>'role' in ('owner', 'appraiser', 'bank')
      then (au.raw_user_meta_data->>'role')::user_role
    else 'owner'
  end
from auth.users au
left join public.users pu on pu.auth_id = au.id
where pu.id is null
on conflict (auth_id) do nothing;

-- Give every appraiser an onboarding draft to resume from
insert into public.appraiser_onboarding_drafts (user_id, draft_data)
select u.id, jsonb_build_object('fullNameEn', u.full_name)
from public.users u
left join public.appraiser_onboarding_drafts d on d.user_id = u.id
where u.role = 'appraiser' and d.user_id is null
on conflict (user_id) do nothing;
