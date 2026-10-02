-- Delivery MDW — shop side: manage own shop, products and orders
-- Run after 0001_profiles.sql and 0002_customer.sql. Safe to run more than once.

-- 1. Helper: the signed-in user's role -----------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

-- 2. Customer name on orders (snapshot, so shops never need to read profiles) ---
alter table public.orders add column if not exists customer_name text;

update public.orders o
set customer_name = p.name
from public.profiles p
where p.id = o.user_id and o.customer_name is null;

-- place_order(): same behaviour as before, now also stores the customer's name.
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

  select name into v_customer_name from public.profiles where id = v_user and role = 'user';
  if not found then
    raise exception 'Only customer accounts can place orders.' using errcode = '42501';
  end if;

  select * into v_shop from public.shops where id = p_shop_id;
  if not found or not v_shop.is_active then
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

    if not found then
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

-- 3. Shops: owners create and edit their own shop -------------------------------
-- Shop accounts only see their own shop (not competitors'). Customers and admins
-- still see all active shops.
drop policy if exists "Signed-in users can read active shops" on public.shops;
create policy "Signed-in users can read active shops"
  on public.shops for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or (is_active and public.current_app_role() = 'user')
  );

drop policy if exists "Shop accounts can create their shop" on public.shops;
create policy "Shop accounts can create their shop"
  on public.shops for insert to authenticated
  with check (owner_id = auth.uid() and public.current_app_role() = 'shop');

drop policy if exists "Owners can update their shop" on public.shops;
create policy "Owners can update their shop"
  on public.shops for update to authenticated
  using (owner_id = auth.uid() and public.current_app_role() = 'shop')
  with check (owner_id = auth.uid());

-- Owners may change these columns only (not is_active, owner_id or id).
grant insert (owner_id, name, description, image_url, location, phone, delivery_fee, is_open)
  on public.shops to authenticated;
grant update (name, description, image_url, location, phone, delivery_fee, is_open)
  on public.shops to authenticated;

-- 4. Products: owners manage products in their own shop --------------------------
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
          or (s.is_active and public.current_app_role() = 'user')
        )
    )
  );

drop policy if exists "Owners can add products" on public.products;
create policy "Owners can add products"
  on public.products for insert to authenticated
  with check (
    exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid())
    and public.current_app_role() = 'shop'
  );

drop policy if exists "Owners can update products" on public.products;
create policy "Owners can update products"
  on public.products for update to authenticated
  using (
    exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid())
    and public.current_app_role() = 'shop'
  )
  with check (
    exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid())
  );

drop policy if exists "Owners can delete products" on public.products;
create policy "Owners can delete products"
  on public.products for delete to authenticated
  using (
    exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = auth.uid())
    and public.current_app_role() = 'shop'
  );

grant insert (shop_id, category_id, name, description, price, image_url, is_available)
  on public.products to authenticated;
grant update (category_id, name, description, price, image_url, is_available)
  on public.products to authenticated;
grant delete on public.products to authenticated;

alter table public.products drop constraint if exists products_name_length;
alter table public.products add constraint products_name_length check (length(name) <= 80);
alter table public.products drop constraint if exists products_price_max;
alter table public.products add constraint products_price_max check (price <= 1000000);

-- 5. Orders: shops read orders placed with them ---------------------------------
drop policy if exists "Shops can read their orders" on public.orders;
create policy "Shops can read their orders"
  on public.orders for select to authenticated
  using (exists (select 1 from public.shops s where s.id = orders.shop_id and s.owner_id = auth.uid()));

drop policy if exists "Shops can read items of their orders" on public.order_items;
create policy "Shops can read items of their orders"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.shops s on s.id = o.shop_id
      where o.id = order_items.order_id and s.owner_id = auth.uid()
    )
  );

-- Status changes go through this function, which only allows the shop's own
-- orders and only these steps:
--   pending  -> accepted | cancelled (rejected)
--   accepted -> preparing | cancelled
--   preparing -> ready
-- After "ready", the order waits for a delivery boy.
create or replace function public.shop_update_order_status(p_order_id uuid, p_status public.order_status)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if public.current_app_role() is distinct from 'shop' then
    raise exception 'Only shop accounts can update orders.' using errcode = '42501';
  end if;

  select o.* into v_order
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where o.id = p_order_id and s.owner_id = auth.uid()
  for update of o;

  if not found then
    raise exception 'Order not found.' using errcode = '42501';
  end if;

  if not (
    (v_order.status = 'pending'   and p_status in ('accepted', 'cancelled')) or
    (v_order.status = 'accepted'  and p_status in ('preparing', 'cancelled')) or
    (v_order.status = 'preparing' and p_status = 'ready')
  ) then
    raise exception 'Can''t change an order from "%" to "%".', v_order.status, p_status;
  end if;

  update public.orders set status = p_status where id = p_order_id;
  return p_status;
end;
$$;

revoke all on function public.shop_update_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.shop_update_order_status(uuid, public.order_status) to authenticated;

-- 6. Dashboard numbers (runs with the caller's permissions, so RLS applies) -------
create or replace function public.shop_dashboard_stats()
returns table (
  total_orders bigint,
  pending_orders bigint,
  completed_orders bigint,
  total_sales numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*),
    count(*) filter (where o.status = 'pending'),
    count(*) filter (where o.status in ('ready', 'out_for_delivery', 'delivered')),
    coalesce(sum(o.total) filter (where o.status in ('ready', 'out_for_delivery', 'delivered')), 0)
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where s.owner_id = auth.uid();
$$;

revoke all on function public.shop_dashboard_stats() from public, anon;
grant execute on function public.shop_dashboard_stats() to authenticated;

-- 7. Popular products: customers (and admins) only --------------------------------
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
  join public.shops s on s.id = p.shop_id and s.is_active
  left join (
    select oi.product_id, sum(oi.quantity) as units
    from public.order_items oi
    join public.orders o on o.id = oi.order_id and o.status <> 'cancelled'
    group by oi.product_id
  ) sold on sold.product_id = p.id
  where p.is_available
    and public.current_app_role() in ('user', 'admin')
  order by units_sold desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;

-- 8. Image storage ------------------------------------------------------------------
-- Public bucket (anyone can view images by URL). Shop accounts can only upload,
-- replace or delete files inside their own folder: <their user id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-images', 'shop-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Shops can read their own images" on storage.objects;
create policy "Shops can read their own images"
  on storage.objects for select to authenticated
  using (bucket_id = 'shop-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Shops can upload their own images" on storage.objects;
create policy "Shops can upload their own images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_app_role() = 'shop'
  );

drop policy if exists "Shops can replace their own images" on storage.objects;
create policy "Shops can replace their own images"
  on storage.objects for update to authenticated
  using (bucket_id = 'shop-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'shop-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Shops can delete their own images" on storage.objects;
create policy "Shops can delete their own images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'shop-images' and (storage.foldername(name))[1] = auth.uid()::text);
