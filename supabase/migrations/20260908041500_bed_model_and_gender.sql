-- Adds two Look Studio "model" preferences to the existing profile:
-- (1) a gender presentation used to steer Illustrate Look's Gemini
-- prompt, and (2) an optional user-uploaded photo to use as the bed's
-- avatar (and, in turn, as the illustration's identity reference)
-- instead of the app's one fixed avatar.png. Both are optional -
-- leaving them unset preserves today's behavior exactly (fixed avatar,
-- no gender directive in the prompt).

-- 1. PROFILES SCHEMA ------------------------------------------------------

-- Free-text-shaped but constrained to a small, deliberately open set of
-- gender presentations (not a strict male/female binary) - "unset"
-- (null) is itself a valid, respected choice, distinct from any of the
-- three, and is what every existing row already has.
alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('feminine', 'masculine', 'androgynous'));

-- Same "private bucket, bare object path, no extension" shape as
-- profile_image_path - see 20260905082612_profile_images_storage.sql.
alter table public.profiles
  add column if not exists bed_model_image_path text;

-- 2. PRIVATE STORAGE FOR THE UPLOADED BED MODEL PHOTO ----------------------
-- Separate bucket from profile-images: this photo isn't the account
-- avatar, it's a Look Studio-specific reference image also read
-- server-side by the illustrate-look Edge Function (using the SAME
-- caller-scoped client/JWT pattern it already uses for item-images -
-- see fetchPrivateItemImageAsInlineData in that function), so it gets
-- its own bucket with its own narrowly-scoped policies rather than
-- overloading profile-images' policies with a second purpose.

insert into storage.buckets (id, name, public)
values ('bed-models', 'bed-models', false)
on conflict (id) do nothing;

-- Ownership model matches profile-images/item-images exactly: the
-- first path segment is the uploader's own auth user id (app always
-- uploads to `${user.id}/bed-model`, no extension).

drop policy if exists "Users can view their own bed model image" on storage.objects;
create policy "Users can view their own bed model image"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bed-models'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- upload(..., { upsert: true }) goes through the INSERT path for a
-- brand-new object and the UPDATE path when overwriting an existing
-- one - both policies are required for "change photo" to work at all.

drop policy if exists "Users can upload their own bed model image" on storage.objects;
create policy "Users can upload their own bed model image"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bed-models'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own bed model image" on storage.objects;
create policy "Users can update their own bed model image"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'bed-models'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'bed-models'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own bed model image" on storage.objects;
create policy "Users can delete their own bed model image"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'bed-models'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
