-- Sprint 8: Job Messages / Client-Appraiser Communication
--
-- Enables direct messaging between clients and appraisers within job context.
-- Messages are scoped to specific jobs for security and organization.

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

create table job_messages (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references job_requests(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,

  -- Message content
  content text not null,

  -- Optional file attachment
  attachment_path text,           -- Storage path if file attached
  attachment_name text,           -- Original filename
  attachment_size integer,        -- File size in bytes
  attachment_type text,           -- MIME type

  -- Read status (recipient has seen it)
  is_read boolean not null default false,
  read_at timestamptz,

  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for efficient queries
create index job_messages_job_idx on job_messages(job_id, created_at desc);
create index job_messages_sender_idx on job_messages(sender_id, created_at desc);
create index job_messages_unread_idx on job_messages(job_id, is_read) where not is_read;

-- Enable RLS
alter table job_messages enable row level security;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Policy: Users can see messages for jobs they're involved in (client or appraiser)
create policy job_messages_select on job_messages for select
  using (
    exists (
      select 1 from job_requests j
      where j.id = job_messages.job_id
      and (
        j.client_id = (select id from users where auth_id = current_user_id())
        or j.assigned_appraiser_id = (select id from users where auth_id = current_user_id())
      )
    )
  );

-- Policy: Users can insert messages for jobs they're involved in
create policy job_messages_insert on job_messages for insert
  with check (
    -- Sender must be the current user
    sender_id = (select id from users where auth_id = current_user_id())
    and exists (
      select 1 from job_requests j
      where j.id = job_messages.job_id
      and (
        j.client_id = (select id from users where auth_id = current_user_id())
        or j.assigned_appraiser_id = (select id from users where auth_id = current_user_id())
      )
      -- Only allow messaging for active jobs
      and j.status in ('paid', 'assigned', 'in_progress', 'delivered')
    )
  );

-- Policy: Users can update their own messages (for read status, etc.)
create policy job_messages_update on job_messages for update
  using (
    -- Can only mark messages as read if you're the recipient
    exists (
      select 1 from job_requests j
      where j.id = job_messages.job_id
      and (
        -- Client can mark appraiser's messages as read
        (j.client_id = (select id from users where auth_id = current_user_id())
          and job_messages.sender_id = j.assigned_appraiser_id)
        or
        -- Appraiser can mark client's messages as read
        (j.assigned_appraiser_id = (select id from users where auth_id = current_user_id())
          and job_messages.sender_id = j.client_id)
      )
    )
  );

-- Admins have full access
create policy job_messages_admin on job_messages for all
  using (current_user_role() = 'admin');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
create trigger job_messages_updated_at before update on job_messages
  for each row execute function set_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get unread message count for a job
create or replace function get_job_unread_count(p_job_id uuid)
returns integer as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  select id into v_user_id from users where auth_id = current_user_id();

  select count(*) into v_count
  from job_messages
  where job_id = p_job_id
    and sender_id != v_user_id
    and is_read = false;

  return v_count;
end;
$$ language plpgsql stable security definer;

-- Mark all messages in a job as read (for the current user)
create or replace function mark_job_messages_read(p_job_id uuid)
returns integer as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  select id into v_user_id from users where auth_id = current_user_id();

  update job_messages
  set is_read = true, read_at = now()
  where job_id = p_job_id
    and sender_id != v_user_id
    and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- NOTIFICATION TRIGGER
-- ============================================================================

-- Create notification when a new message is sent
create or replace function notify_new_message()
returns trigger as $$
declare
  v_job job_requests%rowtype;
  v_sender_name text;
  v_recipient_id uuid;
begin
  -- Get job details
  select * into v_job from job_requests where id = new.job_id;

  -- Get sender name
  select full_name into v_sender_name from users where id = new.sender_id;

  -- Determine recipient (the other party)
  if new.sender_id = v_job.client_id then
    v_recipient_id := v_job.assigned_appraiser_id;
  else
    v_recipient_id := v_job.client_id;
  end if;

  -- Only notify if recipient exists
  if v_recipient_id is not null then
    insert into notifications (user_id, type, title, message, job_id, metadata)
    values (
      v_recipient_id,
      'new_message',
      'New Message',
      'You have a new message from ' || v_sender_name,
      new.job_id,
      jsonb_build_object(
        'message_id', new.id,
        'sender_id', new.sender_id,
        'sender_name', v_sender_name,
        'preview', left(new.content, 100)
      )
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger job_messages_notify after insert on job_messages
  for each row execute function notify_new_message();

-- ============================================================================
-- ADD NEW NOTIFICATION TYPE
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'new_message' and enumtypid = 'notification_type'::regtype) then
    alter type notification_type add value 'new_message';
  end if;
exception when others then null;
end $$;

-- ============================================================================
-- STORAGE BUCKET FOR MESSAGE ATTACHMENTS
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-attachments',
  'job-attachments',
  false,  -- Private - requires auth
  10485760,  -- 10MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- Policy: Users can upload attachments for jobs they're involved in
drop policy if exists "Users can upload job attachments" on storage.objects;
create policy "Users can upload job attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'job-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from job_requests j
      join users u on u.auth_id = auth.uid()
      where (storage.foldername(name))[1] = j.id::text
        and (u.id = j.client_id or u.id = j.assigned_appraiser_id)
    )
  );

-- Policy: Users can read attachments for jobs they're involved in
drop policy if exists "Users can read job attachments" on storage.objects;
create policy "Users can read job attachments"
  on storage.objects for select
  using (
    bucket_id = 'job-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from job_requests j
      join users u on u.auth_id = auth.uid()
      where (storage.foldername(name))[1] = j.id::text
        and (u.id = j.client_id or u.id = j.assigned_appraiser_id)
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table job_messages is 'Direct messages between clients and appraisers within job context';
comment on column job_messages.content is 'Message text content';
comment on column job_messages.attachment_path is 'Storage path for optional file attachment';
comment on column job_messages.is_read is 'Whether the recipient has seen this message';
