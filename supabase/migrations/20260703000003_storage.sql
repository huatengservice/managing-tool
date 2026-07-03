-- ============================================================
-- Storage: private buckets only, signed URLs, never public (spec §15.6).
-- Object paths are namespaced by company: <company_id>/<job_id>/<file>
-- so storage RLS can key on the tenant from the path.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('signatures', 'signatures', false, 1048576,  array['image/png'])
on conflict (id) do nothing;

-- Members of the owning company can read originals; customers get photos
-- through server-generated signed URLs after an app-level access check,
-- and Share recipients only ever get metadata-stripped copies.
create policy "job photos read" on storage.objects for select to authenticated
  using (
    bucket_id = 'job-photos'
    and app.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "job photos upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and app.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "job photos delete (bo)" on storage.objects for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and app.is_bo(((storage.foldername(name))[1])::uuid)
  );

create policy "signature images read" on storage.objects for select to authenticated
  using (
    bucket_id = 'signatures'
    and app.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "signature images upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and app.is_member(((storage.foldername(name))[1])::uuid)
  );
-- signatures bucket: no update/delete policies — images back an append-only log
