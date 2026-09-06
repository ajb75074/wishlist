-- Phase 1 of manual wishitem creation: schema support on public.wishitems
-- plus a dedicated private Storage bucket for user-uploaded item photos.
-- Scope is deliberately narrow - this migration does not touch wishitems
-- RLS (already correct, unchanged) or any other bucket's policies.

-- 1. WISHITEMS SCHEMA ----------------------------------------------------

-- Independent of how a row was created (extension scrape vs. manual
-- entry) - a plain boolean is sufficient because there is exactly one
-- fact being tracked (does the user already own this) and the only
-- transition described so far is a single flip (saved -> owned later).
-- Existing rows and every future extension-created row (which never
-- mentions this column at all) both get `false` from the column
-- default - no backfill statement needed.
alter table public.wishitems
  add column if not exists is_owned boolean not null default false;

-- Deliberately a NEW, separate column rather than overloading image_url:
-- image_url keeps meaning exactly what it already means (an externally
-- hosted retailer/product image URL, populated by the extension
-- scraper), and item_image_path means only "a Storage object path for
-- a manually uploaded photo, private bucket, resolved to a signed URL
-- by the application at read time (Phase 2)". Never a public URL, never
-- a signed URL, never base64 - just the bare object path.
alter table public.wishitems
  add column if not exists item_image_path text;

-- Manual items may have no product link at all (something the user
-- already owns, with nothing to link to) - the column itself must
-- allow that. The existing wishitems_product_url_key UNIQUE constraint
-- is deliberately left in place, unchanged: Postgres's default UNIQUE
-- semantics treat every NULL as distinct from every other NULL, so any
-- number of manual items with product_url = null can coexist without
-- ever violating this constraint - only two rows sharing the same
-- *real* URL would still collide, which is exactly the extension's
-- existing duplicate-prevention behavior, completely undisturbed.
alter table public.wishitems
  alter column product_url drop not null;

-- Manual items may have no brand/store info yet (or ever) - same
-- reasoning as product_url above. No uniqueness constraint exists on
-- this column, so there is nothing else to reconsider here.
alter table public.wishitems
  alter column store drop not null;

-- 2. PRIVATE STORAGE FOR MANUALLY UPLOADED ITEM PHOTOS --------------------
-- Private, unlike product-cutouts/look-illustrations: those are
-- generated/derived images already treated as fine to be public
-- (obscure per-item path only); item-images are raw user-uploaded
-- photos, potentially of items someone personally owns, which deserves
-- the same private-by-default treatment as profile-images. Reading an
-- object requires a signed URL generated through the authenticated
-- client (Phase 2), which itself requires passing the SELECT policy
-- below - nothing here is fetchable by guessing a path.

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', false)
on conflict (id) do nothing;

-- Ownership model matches profile-images exactly: the first path
-- segment is the uploader's own auth user id (expected shape:
-- `${userId}/${wishitemId}/photo`, optionally with an extension - the
-- exact filename is a Phase 2 decision; these policies only care about
-- the first folder segment). storage.foldername() is Supabase
-- Storage's own built-in helper for splitting an object's path into
-- its folder segments, so no bespoke SECURITY DEFINER helper function
-- is needed here, same reasoning as profile-images' own migration.

drop policy if exists "Users can view their own item image" on storage.objects;
create policy "Users can view their own item image"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- upload(..., { upsert: true }) goes through the INSERT path for a
-- brand-new object and the UPDATE path when overwriting an existing
-- one - both policies are required for "change photo" to work at all
-- (same reasoning as profile-images' own migration).

drop policy if exists "Users can upload their own item image" on storage.objects;
create policy "Users can upload their own item image"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own item image" on storage.objects;
create policy "Users can update their own item image"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own item image" on storage.objects;
create policy "Users can delete their own item image"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
