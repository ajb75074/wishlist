-- Storage for user profile pictures (the account-level image shown on
-- the Profile page - NOT the Look Studio dress-up avatar, a separate
-- concept). Private bucket: nothing else in the app reads these images
-- (no Edge Function, no other user), unlike product-cutouts/
-- look-illustrations, so there's no technical reason to trade away
-- privacy for public-read convenience here. Reading goes through a
-- signed URL generated via the authenticated client, which itself
-- requires passing the SELECT policy below.

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', false)
on conflict (id) do nothing;

-- profiles.profile_image_url has held no real data yet (no upload UI
-- existed before this task), so this is a zero-cost rename now rather
-- than a URL-named column silently holding a Storage object path
-- (private buckets can't store a permanent URL - signed URLs expire)
-- going forward.
alter table public.profiles
  rename column profile_image_url to profile_image_path;

-- Ownership model: the app always uploads to `${user.id}/profile` (see
-- web/src/features/profile/profile.js) - the first path segment is the
-- uploader's own auth user id. storage.foldername() is Supabase
-- Storage's own built-in helper for splitting an object's path into
-- its folder segments, so no bespoke SECURITY DEFINER helper function
-- is needed here - one would only add an extra privilege boundary for
-- something this direct, narrow comparison already covers safely.

drop policy if exists "Users can view their own profile image" on storage.objects;
create policy "Users can view their own profile image"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- upload(..., { upsert: true }) goes through the INSERT path for a
-- brand-new object and the UPDATE path when overwriting an existing
-- one - both policies are required for "change photo" to work at all.

drop policy if exists "Users can upload their own profile image" on storage.objects;
create policy "Users can upload their own profile image"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own profile image" on storage.objects;
create policy "Users can update their own profile image"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own profile image" on storage.objects;
create policy "Users can delete their own profile image"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
