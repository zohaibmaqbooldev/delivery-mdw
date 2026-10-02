-- Delivery MDW — production hardening
-- Run after 0007_integrity.sql. Safe to run more than once. No duplicate tables.
--
--  1. Private delivery locations: the customer's address + GPS coordinates move out of
--     `orders` into `order_locations`, readable only by the customer, the delivery boy
--     while he is delivering the order, and admins. Shops no longer see addresses.
--  2. place_order() now requires a validated location and limits order spam.
--  3. Delivery boys need admin approval before they can go online or be assigned.
--  4. Length / format checks on user-entered text, and image URLs must point to the
--     uploader's own storage folder.

-- ============================================================================
-- 1. Private delivery locations
-- ============================================================================
create table if not exists public.order_locations (
  order_id            uuid primary key references public.orders (id) on delete cascade,
  address             text not null check (length(trim(address)) between 5 and 300),
  latitude            numeric(9, 6),
  longitude           numeric(9, 6),
  accuracy_m          integer check (accuracy_m is null or accuracy_m between 0 and 100000),
  location_source     text check (location_source is null or location_source in ('gps', 'map')),
  instructions        text check (instructions is null or length(instructions) <= 300),
  created_at          timestamptz not null default now(),
  constraint order_locations_coords_pair check ((latitude is null) = (longitude is null)),
  constraint order_locations_lat_range check (latitude is null or latitude between -90 and 90),
  constraint order_locations_lng_range check (longitude is null or longitude between -180 and 180),
  constraint order_locations_not_null_island check (latitude is null or not (latitude = 0 and longitude = 0))
);

-- Move existing addresses (older orders have no coordinates).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'orders' and column_name = 'delivery_address') then
    insert into public.order_locations (order_id, address)
    select id, delivery_address from public.orders
    where delivery_address is not null and length(trim(delivery_address)) >= 5
    on conflict (order_id) do nothing;
    alter table public.orders drop column delivery_address;
  end if;
end
$$;

alter table public.order_locations enable row level security;
revoke all on public.order_locations from anon, authenticated;
grant select on public.order_locations to authenticated;
-- No insert/update/delete for clients: rows are written only by place_order().

drop policy if exists "Customers read their own delivery locations" on public.order_locations;
create policy "Customers read their own delivery locations"
  on public.order_locations for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_locations.order_id and o.user_id = auth.uid()));

drop policy if exists "Assigned delivery boy reads the location while delivering" on public.order_locations;
create policy "Assigned delivery boy reads the location while delivering"
  on public.order_locations for select to authenticated
  using (
    public.current_app_role() = 'delivery'
    and exists (
      select 1 from public.orders o
      where o.id = order_locations.order_id
        and o.delivery_boy_id = auth.uid()
        and o.delivery_status in ('assigned', 'accepted', 'picked_up', 'out_for_delivery')
    )
  );

drop policy if exists "Admins read all delivery locations" on public.order_locations;
create policy "Admins read all delivery locations"
  on public.order_locations for select to authenticated
  using (public.is_admin());

-- ============================================================================
-- 2. Delivery boys need approval
-- ============================================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'delivery_riders' and column_name = 'is_approved') then
    alter table public.delivery_riders add column is_approved boolean not null default false;
    update public.delivery_riders set is_approved = true;  -- riders that already exist stay approved
  end if;
end
$$;

-- A delivery boy can't switch himself online until approved (is_approved is not grantable).
create or replace function public.rider_online_requires_approval()
returns trigger
language plpgsql
as $$
begin
  if new.is_online and not new.is_approved then
    raise exception 'Your account is waiting for admin approval. You can go online once approved.';
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_riders_online_requires_approval on public.delivery_riders;
create trigger delivery_riders_online_requires_approval
  before insert or update of is_online, is_approved on public.delivery_riders
  for each row execute function public.rider_online_requires_approval();

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
    join public.profiles p on p.id = r.id and p.role = 'delivery' and p.is_active
    left join lateral (
      select count(*) as active
      from public.orders x
      where x.delivery_boy_id = r.id
        and x.delivery_status in ('assigned', 'accepted', 'picked_up', 'out_for_delivery')
    ) a on true
    where r.is_online and r.is_approved and a.active < 3
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

create or replace function public.admin_set_rider_approved(p_rider_id uuid, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_rider_id and role = 'delivery') then
    raise exception 'Delivery boy not found.';
  end if;
  insert into public.delivery_riders (id) values (p_rider_id) on conflict (id) do nothing;
  if p_approved then
    update public.delivery_riders set is_approved = true where id = p_rider_id;
  else
    -- An unapproved delivery boy can't see any order, so he must not be holding one.
    if exists (select 1 from public.orders where delivery_boy_id = p_rider_id
               and delivery_status in ('picked_up', 'out_for_delivery')) then
      raise exception 'He is carrying an order right now. Revoke approval after it is delivered.';
    end if;
    update public.delivery_riders set is_online = false where id = p_rider_id and is_online;
    update public.delivery_riders set is_approved = false where id = p_rider_id;
    -- hand back everything he hasn't picked up yet (accepted ones too) and re-assign it
    update public.orders
    set delivery_boy_id = null, delivery_status = 'not_assigned', assigned_at = null
    where delivery_boy_id = p_rider_id and delivery_status in ('assigned', 'accepted');
    perform public.assign_waiting_orders();
  end if;
end;
$$;
revoke all on function public.admin_set_rider_approved(uuid, boolean) from public, anon;
grant execute on function public.admin_set_rider_approved(uuid, boolean) to authenticated;

create or replace function public.admin_assign_delivery(p_order_id uuid, p_rider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles p join public.delivery_riders r on r.id = p.id
    where p.id = p_rider_id and p.role = 'delivery' and p.is_active and r.is_approved
  ) then
    raise exception 'Choose an active, approved delivery boy.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.status <> 'ready' then
    raise exception 'Only orders marked Ready by the shop can be assigned.';
  end if;
  if v_order.delivery_status not in ('not_assigned', 'assigned', 'accepted') then
    raise exception 'This order has already been picked up.';
  end if;

  update public.orders
  set delivery_boy_id = p_rider_id, delivery_status = 'assigned', assigned_at = now()
  where id = p_order_id;

  update public.delivery_riders set last_assigned_at = now() where id = p_rider_id;
end;
$$;
revoke all on function public.admin_assign_delivery(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_delivery(uuid, uuid) to authenticated;

-- Delivery actions need an approved, active delivery account.
create or replace function public.delivery_update_status(p_order_id uuid, p_status public.delivery_status)
returns public.delivery_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if public.current_app_role() is distinct from 'delivery'
     or not exists (select 1 from public.delivery_riders where id = auth.uid() and is_approved) then
    raise exception 'Only approved delivery accounts can update deliveries.' using errcode = '42501';
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
    perform public.assign_waiting_orders();

  else
    raise exception 'Can''t change a delivery from "%" to "%".', v_order.delivery_status, p_status;
  end if;

  return p_status;
end;
$$;
revoke all on function public.delivery_update_status(uuid, public.delivery_status) from public, anon;
grant execute on function public.delivery_update_status(uuid, public.delivery_status) to authenticated;

-- Unapproved delivery boys can't READ any order data either (enforced by RLS, not the UI).
create or replace function public.is_approved_rider()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.delivery_riders r
    join public.profiles p on p.id = r.id
    where r.id = auth.uid() and r.is_approved and p.role = 'delivery' and p.is_active
  );
$$;
revoke all on function public.is_approved_rider() from public, anon;
grant execute on function public.is_approved_rider() to authenticated;

drop policy if exists "Delivery boys can read their assigned orders" on public.orders;
create policy "Delivery boys can read their assigned orders"
  on public.orders for select to authenticated
  using (delivery_boy_id = auth.uid() and public.is_approved_rider());

drop policy if exists "Delivery boys can read items of their orders" on public.order_items;
create policy "Delivery boys can read items of their orders"
  on public.order_items for select to authenticated
  using (
    public.is_approved_rider()
    and exists (select 1 from public.orders o where o.id = order_items.order_id and o.delivery_boy_id = auth.uid())
  );

drop policy if exists "Delivery boys can read shops of their orders" on public.shops;
create policy "Delivery boys can read shops of their orders"
  on public.shops for select to authenticated
  using (public.current_app_role() = 'delivery' and public.is_approved_rider() and public.rider_has_order_from(id));

drop policy if exists "Assigned delivery boy reads the location while delivering" on public.order_locations;
create policy "Assigned delivery boy reads the location while delivering"
  on public.order_locations for select to authenticated
  using (
    public.is_approved_rider()
    and exists (
      select 1 from public.orders o
      where o.id = order_locations.order_id
        and o.delivery_boy_id = auth.uid()
        and o.delivery_status in ('assigned', 'accepted', 'picked_up', 'out_for_delivery')
    )
  );

-- ============================================================================
-- 3. place_order() with a validated delivery location and spam limits
-- ============================================================================
drop function if exists public.place_order(uuid, jsonb, text, text, text);

create or replace function public.place_order(
  p_shop_id uuid,
  p_items jsonb,                         -- [{ "product_id": "...", "quantity": 2 }, ...]
  p_delivery_address text,
  p_contact_phone text,
  p_latitude numeric,
  p_longitude numeric,
  p_location_accuracy numeric default null,
  p_location_source text default 'gps',
  p_delivery_instructions text default null,
  p_notes text default null              -- note for the shop
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_customer_name text;
  v_shop public.shops%rowtype;
  v_order_id uuid;
  v_subtotal numeric(10, 2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_seen uuid[] := '{}';
  v_pid uuid;
begin
  if v_user is null then
    raise exception 'You must be logged in to place an order.' using errcode = '42501';
  end if;

  select name into v_customer_name from public.profiles where id = v_user and role = 'user' and is_active;
  if not found then
    raise exception 'Only active customer accounts can place orders.' using errcode = '42501';
  end if;

  -- Abuse limits: at most 5 orders in 10 minutes, and 5 orders waiting for shops at once.
  if (select count(*) from public.orders where user_id = v_user and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'You''ve placed several orders in a short time. Please wait a few minutes and try again.';
  end if;
  if (select count(*) from public.orders where user_id = v_user and status = 'pending') >= 5 then
    raise exception 'You already have 5 orders waiting for shops to accept. Please wait for them first.';
  end if;

  select * into v_shop from public.shops where id = p_shop_id;
  if not found or not v_shop.is_active or not v_shop.is_approved then
    raise exception 'This shop is not available.';
  end if;
  if not v_shop.is_open then
    raise exception '% is closed right now.', v_shop.name;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many different items in one order.';
  end if;

  -- Delivery details
  if coalesce(length(trim(p_delivery_address)), 0) < 5 or length(p_delivery_address) > 300 then
    raise exception 'Please enter your full delivery address (5–300 characters).';
  end if;
  if p_contact_phone is null or trim(p_contact_phone) !~ '^[+0-9][0-9 -]{6,19}$' then
    raise exception 'Please enter a valid contact phone number.';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or (p_latitude = 0 and p_longitude = 0) then
    raise exception 'Please confirm a valid delivery location on the map.';
  end if;
  if p_location_source is not null and p_location_source not in ('gps', 'map') then
    raise exception 'Invalid location source.';
  end if;
  if p_location_accuracy is not null and (p_location_accuracy < 0 or p_location_accuracy > 100000) then
    p_location_accuracy := null;
  end if;
  if length(coalesce(p_delivery_instructions, '')) > 300 or length(coalesce(p_notes, '')) > 300 then
    raise exception 'Notes can be at most 300 characters.';
  end if;

  insert into public.orders
    (user_id, customer_name, shop_id, shop_name, contact_phone, notes, subtotal, delivery_fee, total)
  values
    (v_user, v_customer_name, v_shop.id, v_shop.name, trim(p_contact_phone),
     nullif(trim(coalesce(p_notes, '')), ''), 0, v_shop.delivery_fee, 0)
  returning id into v_order_id;

  insert into public.order_locations
    (order_id, address, latitude, longitude, accuracy_m, location_source, instructions)
  values
    (v_order_id, trim(p_delivery_address), round(p_latitude, 6), round(p_longitude, 6),
     round(p_location_accuracy)::integer, coalesce(p_location_source, 'gps'),
     nullif(trim(coalesce(p_delivery_instructions, '')), ''));

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_pid := (v_item ->> 'product_id')::uuid;
      v_qty := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Your cart has an invalid item. Please refresh and try again.';
    end;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Quantities must be between 1 and 99.';
    end if;
    if v_pid = any (v_seen) then
      raise exception 'Your cart lists the same product twice. Please refresh and try again.';
    end if;
    v_seen := v_seen || v_pid;

    select * into v_product from public.products where id = v_pid and shop_id = v_shop.id;
    if not found or v_product.is_disabled then
      raise exception 'A product in your cart is no longer sold by this shop.';
    end if;
    if not v_product.is_available then
      raise exception '% is currently unavailable.', v_product.name;
    end if;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_qty, v_product.price * v_qty);

    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  update public.orders
  set subtotal = v_subtotal, total = v_subtotal + v_shop.delivery_fee
  where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, jsonb, text, text, numeric, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, text, text, numeric, numeric, numeric, text, text, text) to authenticated;

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

-- ============================================================================
-- 4. Input checks on user-entered text + image URLs
-- ============================================================================
-- Signup trigger: never fails signup because of a badly formatted phone or long name
-- (the checks below would otherwise reject the profile row).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'user');
  safe_role public.app_role;
  v_phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
begin
  -- Self-signup may only choose user / shop / delivery. Never admin.
  if requested in ('user', 'shop', 'delivery') then
    safe_role := requested::public.app_role;
  else
    safe_role := 'user';
  end if;
  if v_phone is not null and v_phone !~ '^[+0-9][0-9 -]{6,19}$' then
    v_phone := null;
  end if;

  insert into public.profiles (id, name, email, phone, role)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 80),
    new.email,
    v_phone,
    safe_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================================
-- Added NOT VALID (always enforced for new/changed rows), then validated for old rows
-- where possible; if old rows break a rule you get a NOTICE instead of an error.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('profiles', 'profiles_name_length', 'check (length(name) <= 80)'),
      ('profiles', 'profiles_phone_format', 'check (phone is null or phone ~ ''^[+0-9][0-9 -]{6,19}$'')'),
      ('profiles', 'profiles_avatar_own_folder',
        'check (avatar_url is null or avatar_url ~ (''^https?://[^/?#]+/storage/v1/object/public/avatars/'' || id::text || ''/[A-Za-z0-9._-]+$''))'),
      ('shops', 'shops_text_lengths',
        'check (length(name) <= 60 and length(location) <= 300 and length(coalesce(description, '''')) <= 500)'),
      ('shops', 'shops_phone_format', 'check (phone is null or phone ~ ''^[+0-9][0-9 -]{6,19}$'')'),
      ('shops', 'shops_fee_max', 'check (delivery_fee <= 10000)'),
      ('shops', 'shops_image_own_folder',
        'check (image_url is null or image_url ~ (''^https?://[^/?#]+/storage/v1/object/public/shop-images/'' || owner_id::text || ''/[A-Za-z0-9._-]+$''))'),
      ('products', 'products_description_length', 'check (length(coalesce(description, '''')) <= 500)'),
      ('orders', 'orders_notes_length', 'check (length(coalesce(notes, '''')) <= 300)'),
      ('delivery_riders', 'delivery_riders_avatar_own_folder',
        'check (avatar_url is null or avatar_url ~ (''^https?://[^/?#]+/storage/v1/object/public/avatars/'' || id::text || ''/[A-Za-z0-9._-]+$''))')
    ) as t(tbl, name, def)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table public.%I add constraint %I %s not valid', c.tbl, c.name, c.def);
    end if;
    begin
      execute format('alter table public.%I validate constraint %I', c.tbl, c.name);
    exception when check_violation then
      raise notice 'Some existing % rows break %; new changes are still checked.', c.tbl, c.name;
    end;
  end loop;
end
$$;

-- Product images must live in the shop owner's own folder.
create or replace function public.products_check_image_url()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if new.image_url is null then
    return new;
  end if;
  select owner_id into v_owner from public.shops where id = new.shop_id;
  if new.image_url !~ ('^https?://[^/?#]+/storage/v1/object/public/shop-images/' || v_owner::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Product images must be uploaded through the app.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.products_check_image_url() from public, anon, authenticated;
revoke all on function public.rider_online_requires_approval() from public, anon, authenticated;

drop trigger if exists products_image_url_check on public.products;
create trigger products_image_url_check
  before insert or update of image_url on public.products
  for each row execute function public.products_check_image_url();

-- Stats for the admin include delivery boys waiting for approval.
-- (The return columns change, so the old version is dropped first.)
drop function if exists public.admin_dashboard_stats();
create function public.admin_dashboard_stats()
returns table (
  total_users bigint,
  total_shops bigint,
  shops_awaiting_approval bigint,
  total_delivery_boys bigint,
  delivery_boys_awaiting_approval bigint,
  total_orders bigint,
  pending_orders bigint,
  completed_orders bigint,
  total_sales numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.profiles where role = 'user'),
    (select count(*) from public.shops),
    (select count(*) from public.shops where not is_approved),
    (select count(*) from public.profiles where role = 'delivery'),
    (select count(*) from public.profiles p where p.role = 'delivery'
       and not exists (select 1 from public.delivery_riders r where r.id = p.id and r.is_approved)),
    (select count(*) from public.orders),
    (select count(*) from public.orders where status = 'pending'),
    (select count(*) from public.orders where status = 'delivered'),
    (select coalesce(sum(total), 0) from public.orders where status = 'delivered');
end;
$$;
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
