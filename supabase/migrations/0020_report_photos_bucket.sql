-- 0020: Ensure the report-photos storage bucket + policies exist
--
-- Report photos are read/deleted from a `report-photos` bucket, but the
-- interactive upload path to it was never wired (the editor posted multipart to
-- an endpoint expecting a storage_path, and the bucket wasn't in the upload
-- allow-list). This makes the bucket + RLS deterministic so signed-URL uploads
-- from the report editor work. Idempotent: safe if the bucket already exists.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  false, -- private; served via signed URLs
  15728640, -- 15 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Uploaded paths are `<users.id>/<file>` (see /upload/get-url), so scope access
-- to the owning user by mapping auth.uid() -> users.id.
drop policy if exists "report_photos_insert_own" on storage.objects;
create policy "report_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select id::text from public.users where auth_id = auth.uid())
  );

drop policy if exists "report_photos_read_own" on storage.objects;
create policy "report_photos_read_own"
  on storage.objects for select
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select id::text from public.users where auth_id = auth.uid())
  );

drop policy if exists "report_photos_delete_own" on storage.objects;
create policy "report_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select id::text from public.users where auth_id = auth.uid())
  );
