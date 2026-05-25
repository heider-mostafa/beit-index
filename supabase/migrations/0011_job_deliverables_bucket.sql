-- Create job-deliverables storage bucket for appraiser report uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-deliverables',
  'job-deliverables',
  true,  -- Public so clients can download
  52428800,  -- 50MB limit
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- Policy: Appraisers can upload files to their job folders
drop policy if exists "Appraisers can upload deliverables" on storage.objects;
create policy "Appraisers can upload deliverables"
  on storage.objects for insert
  with check (
    bucket_id = 'job-deliverables'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from job_requests j
      join users u on u.id = j.assigned_appraiser_id
      where u.auth_id = auth.uid()
        and j.id::text = (storage.foldername(name))[1]
        and j.status in ('assigned', 'in_progress')
    )
  );

-- Policy: Anyone can read deliverables (public bucket)
drop policy if exists "Public read access for deliverables" on storage.objects;
create policy "Public read access for deliverables"
  on storage.objects for select
  using (bucket_id = 'job-deliverables');

-- Policy: Appraisers can delete their own uploads
drop policy if exists "Appraisers can delete deliverables" on storage.objects;
create policy "Appraisers can delete deliverables"
  on storage.objects for delete
  using (
    bucket_id = 'job-deliverables'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from job_requests j
      join users u on u.id = j.assigned_appraiser_id
      where u.auth_id = auth.uid()
        and j.id::text = (storage.foldername(name))[1]
    )
  );
