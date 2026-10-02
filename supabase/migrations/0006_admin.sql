do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='shops' and column_name='is_approved'
  ) then
    alter table public.shops add column is_approved boolean not null default false;
    update public.shops set is_approved = true;
  end if;
end
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set is_active = p_active where id = p_user_id;
  return true;
end;
$$;

create or replace function public.admin_set_shop_approved(p_shop_id uuid, p_approved boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shops set is_approved = p_approved where id = p_shop_id;
  return true;
end;
$$;