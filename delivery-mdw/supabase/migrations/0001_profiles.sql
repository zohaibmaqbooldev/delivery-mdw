-- Delivery MDW — basic profile system with role-based access
-- Run this once in the Supabase SQL Editor (or with `supabase db push`).

-- 1. Roles --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'user', 'shop', 'delivery');
  end if;
end
$$;

-- 2. Profiles table -----------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null,
  phone       text,
  role        public.app_role not null default 'user',
  created_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- 3. Helper: is the current user an admin? --------------------------------
-- SECURITY DEFINER so it can read profiles without recursing into RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 4. Create a profile automatically when someone signs up ---------------
-- Self-signup may choose user / shop / delivery. "admin" can never be
-- self-assigned; anything unexpected falls back to "user".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'user');
  safe_role public.app_role;
begin
  if requested in ('user', 'shop', 'delivery') then
    safe_role := requested::public.app_role;
  else
    safe_role := 'user';
  end if;

  insert into public.profiles (id, name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    safe_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Row Level Security -------------------------------------------------
alter table public.profiles enable row level security;

-- Table privileges: signed-out visitors get nothing; signed-in users may
-- read, and may only ever change their own name and phone.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, phone) on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT or DELETE policies: profiles are created by the trigger above
-- and removed when the auth user is deleted.

-- 6. Making someone an admin ---------------------------------------------
-- Admins are promoted manually from the SQL Editor, e.g.:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
