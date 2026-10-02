-- Delivery MDW — delivery boy side
-- Run after 0004_delivery_statuses.sql (in a separate run). Safe to run more than once.
--
-- Delivery flow (orders.delivery_status):
--   not_assigned -> assigned -> accepted -> picked_up -> out_for_delivery -> delivered
--
-- Assignment: when a shop marks an order "ready", it is automatically assigned to an
-- ONLINE delivery boy with the fewest active deliveries (max 3 at a time). If nobody is
-- online, the order waits and is assigned as soon as a delivery boy goes online or
-- frees up. A delivery boy who goes offline hands back orders they haven't accepted yet.

-- 1. Timestamps on orders ---------------------------------------------------------
alter table public.orders add column if not exists assigned_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;

create index if not exists orders_delivery_boy_idx on public.orders (delivery_boy_id, delivery_status);
create index if not exists orders_waiting_idx on public.orders (status) where delivery_boy_id is null;

-- 2. Delivery boy details (one row per delivery account) ---------------------------
create table if not exists public.delivery_riders (
  id                uuid primary key references public.profiles (id) on delete cascade,
  avatar_url        text,
  vehicle_type      text check (vehicle_type in ('bicycle', 'motorbike', 'rickshaw', 'car', 'van')),
  vehicle_number    text check (length(vehicle_number) <= 20),
  is_online         boolean not null default false,
  last_assigned_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists delivery_riders_touch_updated_at on public.delivery_riders;
create trigger delivery_riders_touch_updated_at
  before update on public.delivery_riders
  for each row execute function public.touch_updated_at();

alter table public.delivery_riders enable row level security;

revoke all on public.delivery_riders from anon, authenticated;
grant select on public.delivery_riders to authenticated;
grant insert (id, avatar_url, vehicle_type, vehicle_number, is_online) on public.delivery_riders to authenticated;
grant update (avatar_url, vehicle_type, vehicle_number, is_online) on public.delivery_riders to authenticated;

drop policy if exists "Delivery boys can read their own details" on public.delivery_riders;
create policy "Delivery boys can read their own details"
  on public.delivery_riders for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Delivery boys can create their own details" on public.delivery_riders;
create policy "Delivery boys can create their own details"
  on public.delivery_riders for insert to authenticated
  with check (id = auth.uid() and public.current_app_role() = 'delivery');

drop policy if exists "Delivery boys can update their own details" on public.delivery_riders;
create policy "Delivery boys can update their own details"
  on public.delivery_riders for update to authenticated
  using (id = auth.uid() and public.current_app_role() = 'delivery')
  with check (id = auth.uid());

-- 3. Automatic assignment ------------------------------------------------------------
create or replace function public.assign_waiting_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_rider uuid;
  v_count integer := 0;
begin
  loop
    select o.id into v_order
    from public.orders o
    where o.status = 'ready' and o.delivery_boy_id is null
    order by o.updated_at, o.created_at
    limit 1
    for update skip locked;
    exit when not found;

    select r.id into v_rider
    from public.delivery_riders r
    join public.profiles p on p.id = r.id and p.role = 'delivery'
    left join lateral (
      select count(*) as active
      from public.orders x
      where x.delivery_boy_id = r.id
        and x.delivery_status in ('assigned', 'accepted', 'picked_up', 'out_for_delivery')
    ) a on true
    where r.is_online and a.active < 3
    order by a.active, r.last_assigned_at nulls first, r.created_at
    limit 1
    for update of r skip locked;
    exit when not found;

    update public.orders
    set delivery_boy_id = v_rider, delivery_status = 'assigned', assigned_at = now()
    where id = v_order;

    update public.delivery_riders set last_assigned_at = now() where id = v_rider;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.assign_waiting_orders() from public, anon, authenticated;

-- When a shop marks an order ready, try to assign it.
create or replace function public.on_order_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assign_waiting_orders();
  return null;
end;
$$;

drop trigger if exists orders_assign_when_ready on public.orders;
create trigger orders_assign_when_ready
  after update of status on public.orders
  for each row
  when (new.status = 'ready' and old.status is distinct from 'ready' and new.delivery_boy_id is null)
  execute function public.on_order_ready();

-- When a delivery boy goes online, give them waiting orders. When they go offline,
-- hand back orders they haven't accepted yet so someone else can take them.
create or replace function public.on_rider_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.is_online and not new.is_online then
    update public.orders
    set delivery_boy_id = null, delivery_status = 'not_assigned', assigned_at = null
    where delivery_boy_id = new.id and delivery_status = 'assigned';
  end if;
  perform public.assign_waiting_orders();
  return null;
end;
$$;

drop trigger if exists delivery_riders_availability on public.delivery_riders;
create trigger delivery_riders_availability
  after insert or update of is_online on public.delivery_riders
  for each row execute function public.on_rider_availability();

-- 4. Delivery boy updates the delivery status ----------------------------------------
--   assigned -> accepted -> picked_up -> out_for_delivery -> delivered
-- "Out for delivery" and "delivered" also update the order's main status.
create or replace function public.delivery_update_status(p_order_id uuid, p_status public.delivery_status)
returns public.delivery_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if public.current_app_role() is distinct from 'delivery' then
    raise exception 'Only delivery accounts can update deliveries.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and delivery_boy_id = auth.uid()
  for update;

  if not found then
    raise exception 'Delivery not found.' using errcode = '42501';
  end if;

  if v_order.delivery_status = 'assigned' and p_status = 'accepted' then
    update public.orders set delivery_status = 'accepted' where id = p_order_id;

  elsif v_order.delivery_status = 'accepted' and p_status = 'picked_up' then
    if v_order.status <> 'ready' then
      raise exception 'The shop hasn''t marked this order as ready yet.';
    end if;
    update public.orders set delivery_status = 'picked_up' where id = p_order_id;

  elsif v_order.delivery_status = 'picked_up' and p_status = 'out_for_delivery' then
    update public.orders
    set delivery_status = 'out_for_delivery', status = 'out_for_delivery'
    where id = p_order_id;

  elsif v_order.delivery_status = 'out_for_delivery' and p_status = 'delivered' then
    update public.orders
    set delivery_status = 'delivered', status = 'delivered', delivered_at = now()
    where id = p_order_id;
    perform public.assign_waiting_orders(); -- this delivery boy may have room for another order

  else
    raise exception 'Can''t change a delivery from "%" to "%".', v_order.delivery_status, p_status;
  end if;

  return p_status;
end;
$$;

revoke all on function public.delivery_update_status(uuid, public.delivery_status) from public, anon;
grant execute on function public.delivery_update_status(uuid, public.delivery_status) to authenticated;

-- 5. Dashboard numbers (runs with the caller's permissions) -------------------------
-- p_tz: the delivery boy's time zone (e.g. 'Asia/Karachi'), used for "today".
-- Earnings = delivery fees of orders they delivered.
create or replace function public.delivery_dashboard_stats(p_tz text default 'UTC')
returns table (
  assigned_orders bigint,
  pending_deliveries bigint,
  completed_deliveries bigint,
  today_deliveries bigint,
  today_earnings numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with tz as (
    select coalesce((select name from pg_timezone_names where name = p_tz limit 1), 'UTC') as name
  ),
  day as (
    select (date_trunc('day', now() at time zone tz.name)) at time zone tz.name as start from tz
  )
  select
    count(*) filter (where o.delivery_status = 'assigned'),
    count(*) filter (where o.delivery_status in ('accepted', 'picked_up', 'out_for_delivery')),
    count(*) filter (where o.delivery_status = 'delivered'),
    count(*) filter (where o.delivery_status = 'delivered' and o.delivered_at >= day.start),
    coalesce(sum(o.delivery_fee) filter (where o.delivery_status = 'delivered' and o.delivered_at >= day.start), 0)
  from day
  left join public.orders o on o.delivery_boy_id = auth.uid()
  group by day.start;
$$;

revoke all on function public.delivery_dashboard_stats(text) from public, anon;
grant execute on function public.delivery_dashboard_stats(text) to authenticated;

-- 6. Row Level Security: delivery boys see only their own deliveries ----------------
drop policy if exists "Delivery boys can read their assigned orders" on public.orders;
create policy "Delivery boys can read their assigned orders"
  on public.orders for select to authenticated
  using (delivery_boy_id = auth.uid());

drop policy if exists "Delivery boys can read items of their orders" on public.order_items;
create policy "Delivery boys can read items of their orders"
  on public.order_items for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.delivery_boy_id = auth.uid())
  );

-- Shops: a delivery boy can read a shop only while they have an order from it.
-- (SECURITY DEFINER helper avoids policy recursion between shops and orders.)
create or replace function public.rider_has_order_from(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders
    where shop_id = p_shop_id and delivery_boy_id = auth.uid()
  );
$$;

revoke all on function public.rider_has_order_from(uuid) from public;
grant execute on function public.rider_has_order_from(uuid) to authenticated;

drop policy if exists "Delivery boys can read shops of their orders" on public.shops;
create policy "Delivery boys can read shops of their orders"
  on public.shops for select to authenticated
  using (public.current_app_role() = 'delivery' and public.rider_has_order_from(id));

-- 7. Profile images for delivery boys -----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Delivery boys can read their own avatar files" on storage.objects;
create policy "Delivery boys can read their own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Delivery boys can upload their own avatar" on storage.objects;
create policy "Delivery boys can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_app_role() = 'delivery'
  );

drop policy if exists "Delivery boys can replace their own avatar" on storage.objects;
create policy "Delivery boys can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Delivery boys can delete their own avatar" on storage.objects;
create policy "Delivery boys can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 8. Assign anything already waiting -------------------------------------------------
select public.assign_waiting_orders();
