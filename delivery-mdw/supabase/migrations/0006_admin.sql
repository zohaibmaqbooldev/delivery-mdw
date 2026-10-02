-- Delivery MDW — admin side
-- Run after 0005_delivery.sql. Safe to run more than once.
--
-- Adds (to existing tables only — no new tables):
--   profiles.is_active   admins can deactivate accounts
--   profiles.avatar_url  profile image (used by the admin profile)
--   shops.is_approved    new shops need admin approval before customers see them
--   products.is_disabled admins can disable a product (shops can't re-enable it)

-- 1. New columns ----------------------------------------------------------------------
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists avatar_url text;
alter table public.products add column if not exists is_disabled boolean not null default false;

-- Shops that already exist when this runs are approved; new shops start unapproved.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shops' and column_name = 'is_approved'
  ) then
    alter table public.shops add column is_approved boolean not null default false;
    update public.shops set is_approved = true;
  end if;
end
$$;

grant update (avatar_url) on public.profiles to authenticated;

-- 2. Deactivated accounts lose their role everywhere ---------------------------------
-- Every role check in the app goes through these two helpers, so a deactivated
-- account can't place orders, manage a shop, deliver, or use admin powers.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- 3. What customers can see: approved, active shops and non-disabled products ------
drop policy if exists "Signed-in users can read active shops" on public.shops;
create policy "Signed-in users can read active shops"
  on public.shops for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or (is_active and is_approved and public.current_app_role() = 'user')
  );

drop policy if exists "Signed-in users can read products of active shops" on public.products;
create policy "Signed-in users can read products of active shops"
  on public.products for select to authenticated
  using (
    exists (
      select 1 from public.shops s
      where s.id = products.shop_id
        and (
          s.owner_id = auth.uid()
          or public.is_admin()
          or (s.is_active and s.is_approved and not products.is_disabled
              and public.current_app_role() = 'user')
        )
    )
  );

-- Admins read every order and order item.
drop policy if exists "Admins can read all orders" on public.orders;
create policy "Admins can read all orders"
  on public.orders for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all order items" on public.order_items;
create policy "Admins can read all order items"
  on public.order_items for select to authenticated
  using (public.is_admin());

-- 4. Ordering respects approval, disabling and deactivation ---------------------------
create or replace function public.place_order(
  p_shop_id uuid,
  p_items jsonb,
  p_delivery_address text,
  p_contact_phone text,
  p_notes text default null
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
begin
  if v_user is null then
    raise exception 'You must be logged in to place an order.' using errcode = '42501';
  end if;

  select name into v_customer_name from public.profiles where id = v_user and role = 'user' and is_active;
  if not found then
    raise exception 'Only active customer accounts can place orders.' using errcode = '42501';
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

  if coalesce(length(trim(p_delivery_address)), 0) < 5 then
    raise exception 'Please enter a delivery address.';
  end if;
  if coalesce(length(trim(p_contact_phone)), 0) < 5 then
    raise exception 'Please enter a contact phone number.';
  end if;

  insert into public.orders
    (user_id, customer_name, shop_id, shop_name, delivery_address, contact_phone, notes,
     subtotal, delivery_fee, total)
  values
    (v_user, v_customer_name, v_shop.id, v_shop.name, trim(p_delivery_address), trim(p_contact_phone),
     nullif(trim(coalesce(p_notes, '')), ''), 0, v_shop.delivery_fee, 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Invalid quantity.';
    end;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Quantities must be between 1 and 99.';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid and shop_id = v_shop.id;

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

revoke all on function public.place_order(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, text, text, text) to authenticated;

create or replace function public.popular_products(p_limit integer default 8)
returns table (
  id uuid,
  name text,
  price numeric,
  image_url text,
  shop_id uuid,
  shop_name text,
  shop_is_open boolean,
  units_sold bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.price, p.image_url, s.id, s.name, s.is_open,
         coalesce(sold.units, 0)::bigint as units_sold
  from public.products p
  join public.shops s on s.id = p.shop_id and s.is_active and s.is_approved
  left join (
    select oi.product_id, sum(oi.quantity) as units
    from public.order_items oi
    join public.orders o on o.id = oi.order_id and o.status <> 'cancelled'
    group by oi.product_id
  ) sold on sold.product_id = p.id
  where p.is_available
    and not p.is_disabled
    and public.current_app_role() in ('user', 'admin')
  order by units_sold desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;

-- Auto-assignment skips deactivated delivery boys.
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

-- 5. Admin actions (each checks is_admin()) -------------------------------------------
create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You can''t deactivate your own account.';
  end if;

  update public.profiles set is_active = p_active where id = p_user_id returning role into v_role;
  if not found then
    raise exception 'Account not found.';
  end if;

  if not p_active then
    if v_role = 'delivery' then
      -- Going offline hands back orders they haven't accepted yet.
      update public.delivery_riders set is_online = false where id = p_user_id and is_online;
    elsif v_role = 'shop' then
      -- Stop new orders reaching a shop whose owner can't process them.
      update public.shops set is_open = false where owner_id = p_user_id;
    end if;
  end if;
  return p_active;
end;
$$;

create or replace function public.admin_update_shop(p_shop_id uuid, p_is_approved boolean default null, p_is_active boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  update public.shops
  set is_approved = coalesce(p_is_approved, is_approved),
      is_active = coalesce(p_is_active, is_active)
  where id = p_shop_id;
  if not found then
    raise exception 'Shop not found.';
  end if;
end;
$$;

create or replace function public.admin_set_product_disabled(p_product_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  update public.products set is_disabled = p_disabled where id = p_product_id;
  if not found then
    raise exception 'Product not found.';
  end if;
end;
$$;

-- Assign (or re-assign) a delivery boy. Allowed while the order is ready and the
-- delivery hasn't been picked up yet.
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

  if not exists (select 1 from public.profiles where id = p_rider_id and role = 'delivery' and is_active) then
    raise exception 'Choose an active delivery boy.';
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

  insert into public.delivery_riders (id) values (p_rider_id) on conflict (id) do nothing;

  update public.orders
  set delivery_boy_id = p_rider_id, delivery_status = 'assigned', assigned_at = now()
  where id = p_order_id;

  update public.delivery_riders set last_assigned_at = now() where id = p_rider_id;
end;
$$;

create or replace function public.admin_dashboard_stats()
returns table (
  total_users bigint,
  total_shops bigint,
  shops_awaiting_approval bigint,
  total_delivery_boys bigint,
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
    (select count(*) from public.orders),
    (select count(*) from public.orders where status = 'pending'),
    (select count(*) from public.orders where status = 'delivered'),
    (select coalesce(sum(total), 0) from public.orders where status = 'delivered');
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_set_user_active(uuid, boolean)',
    'public.admin_update_shop(uuid, boolean, boolean)',
    'public.admin_set_product_disabled(uuid, boolean)',
    'public.admin_assign_delivery(uuid, uuid)',
    'public.admin_dashboard_stats()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- 6. Categories: admins add, edit and delete ----------------------------------------
grant insert (name, slug, sort_order) on public.categories to authenticated;
grant update (name, slug, sort_order) on public.categories to authenticated;
grant delete on public.categories to authenticated;
grant usage on sequence public.categories_id_seq to authenticated;

drop policy if exists "Admins can add categories" on public.categories;
create policy "Admins can add categories"
  on public.categories for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can edit categories" on public.categories;
create policy "Admins can edit categories"
  on public.categories for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can delete categories"
  on public.categories for delete to authenticated
  using (public.is_admin());

alter table public.categories drop constraint if exists categories_name_length;
alter table public.categories add constraint categories_name_length check (length(trim(name)) between 2 and 40);
alter table public.categories drop constraint if exists categories_slug_format;
alter table public.categories add constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- 7. Admin profile images (same "avatars" bucket, own folder) ----------------------
drop policy if exists "Delivery boys can upload their own avatar" on storage.objects;
create policy "Delivery boys can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_app_role() in ('delivery', 'admin')
  );
