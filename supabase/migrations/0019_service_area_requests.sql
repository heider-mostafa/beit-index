-- 0019: Service-area requests
--
-- During onboarding an appraiser can flag a coverage area that's missing from
-- the gazetteer. These land here as pending suggestions for an admin to review
-- and add to districts/cities — they never enter the matching data directly.
create table if not exists service_area_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  area_text text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now()
);

create index if not exists service_area_requests_status_idx on service_area_requests(status);

alter table service_area_requests enable row level security;

-- Requesters can read their own; admins can read/manage all. Inserts are done
-- server-side with the service role, so no insert policy is needed here.
drop policy if exists service_area_requests_own on service_area_requests;
create policy service_area_requests_own on service_area_requests
  for select using (user_id = (select id from users where auth_id = current_user_id()));

drop policy if exists service_area_requests_admin on service_area_requests;
create policy service_area_requests_admin on service_area_requests
  for all using (current_user_role() = 'admin');
