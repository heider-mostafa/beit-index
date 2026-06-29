-- Sprint 9: Bank user provisioning (admin-invited)
-- ============================================================================
-- Banks are vetted B2B clients: an admin creates a bank_account and invites
-- users to it. This table holds those invites (mirrors admin_invites but links
-- the invited user to a specific bank account + in-bank role).
-- ============================================================================

create table bank_invites (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  token text not null unique,                       -- hashed (raw token only in the URL)
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  bank_role text not null default 'viewer',         -- viewer | analyst | admin
  invited_by uuid not null references users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index bank_invites_email_idx on bank_invites(email);
create index bank_invites_token_idx on bank_invites(token);
create index bank_invites_account_idx on bank_invites(bank_account_id);

alter table bank_invites enable row level security;

-- Admins manage invites; validation/consumption happens via the service client.
create policy bank_invites_admin on bank_invites for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');
