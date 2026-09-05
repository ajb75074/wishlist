-- First version of the app-level user profile data model.
-- Scope is deliberately narrow: the profiles table itself, its RLS
-- policies, the on-signup trigger, and a one-time backfill for
-- existing users. This is the first migration file for this project
-- (prior schema/RLS work was done via the dashboard), so it does not
-- attempt to reconstruct any existing schema.

-- 1. TABLE ------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. ROW LEVEL SECURITY -------------------------------------------------
-- Owner-only in every direction - no public read, no service_role
-- usage from the frontend. auth.uid() is null for anon/unauthenticated
-- requests, so all four policies already deny those by construction.

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3. AUTO-CREATE PROFILE ON SIGNUP ---------------------------------------
-- SECURITY DEFINER is required here: this trigger fires as part of the
-- internal insert into auth.users during signup, not as a request from
-- an authenticated user, so there is no auth.uid() for the "insert
-- their own profile" policy above to match against. Running as the
-- function owner (via SECURITY DEFINER) is what lets this insert
-- succeed despite RLS being enabled on profiles. search_path is set to
-- '' (empty) rather than any named schema - the strongest form of this
-- protection, since it removes implicit schema resolution entirely
-- rather than just pointing it somewhere specific. Every object the
-- function touches is therefore fully schema-qualified (public.profiles)
-- so it still resolves correctly with no search_path at all.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. BACKFILL FOR EXISTING USERS -----------------------------------------
-- Safe to re-run: user_id is the primary key, so ON CONFLICT DO NOTHING
-- guarantees no duplicates regardless of how many times this migration
-- (or a copy of this statement) ever runs.

insert into public.profiles (user_id, display_name)
select id, raw_user_meta_data ->> 'name'
from auth.users
on conflict (user_id) do nothing;
