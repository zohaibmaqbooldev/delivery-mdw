-- Delivery MDW — customer side: categories, shops, products, orders
-- Run after 0001_profiles.sql. Safe to run more than once.

-- 1. Enums ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum
      ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type public.delivery_status as enum
      ('not_assigned', 'assigned', 'picked_up', 'delivered');
  end if;
end
$$;

-- 2. Categories (simple reference list) ------------------------------------
create table if not exists public.categories (
  id          smallint generated always as identity primary key,
  name        text not null unique,
  slug        text not null unique,
  sort_order  smallint not null default 0
);

insert into public.categories (name, slug, sort_order) values
  ('Groceries', 'groceries', 1),
  ('Food', 'food', 2),
  ('Bakery', 'bakery', 3),
  ('Drinks', 'drinks', 4),
  ('Pharmacy', 'pharmacy', 5),
  ('Household', 'household', 6)
on conflict (slug) do nothing;

-- 3. Shops (one per shop account) -----------------------------------------
create table if not exists public.shops (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references public.profiles (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  description   text,
  image_url     text,
  location      text not null default '',
  phone         text,
  delivery_fee  numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  is_open       boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 4. Products --------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  category_id   smallint references public.categories (id) on delete set null,
  name          text not null check (length(trim(name)) > 0),
  description   text,
  price         numeric(10, 2) not null check (price >= 0),
  image_url     text,
  is_available  boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists products_shop_idx on public.products (shop_id);
create index if not exists products_category_idx on public.products (category_id);

-- 5. Orders + items -------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      bigint generated always as identity (start with 1001) unique,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  shop_id           uuid not null references public.shops (id) on delete restrict,
  shop_name         text not null,          -- snapshot at time of order
  delivery_boy_id   uuid references public.profiles (id) on delete set null,
  status            public.order_status not null default 'pending',
  delivery_status   public.delivery_status not null default 'not_assigned',
  delivery_address  text not null check (length(trim(delivery_address)) > 0),
  contact_phone     text not null check (length(trim(contact_phone)) > 0),
  notes             text,
  subtotal          numeric(10, 2) not null check (subtotal >= 0),
  delivery_fee      numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  total             numeric(10, 2) not null check (total >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_shop_idx on public.orders (shop_id);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,          -- snapshot at time of order
  unit_price    numeric(10, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity between 1 and 99),
  line_total    numeric(10, 2) not null check (line_total >= 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- 6. Row Level Security ---------------------------------------------------
alter table public.categories  enable row level security;
alter table public.shops       enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Clients get read access only. Orders are created through place_order().
revoke all on public.categories, public.shops, public.products, public.orders, public.order_items
  from anon, authenticated;
grant select on public.categories, public.shops, public.products, public.orders, public.order_items
  to authenticated;

-- Categories: any signed-in user.
drop policy if exists "Signed-in users can read categories" on public.categories;
create policy "Signed-in users can read categories"
  on public.categories for select to authenticated
  using (true);

-- Shops: active shops are visible to signed-in users; owners and admins see their own / all.
drop policy if exists "Signed-in users can read active shops" on public.shops;
create policy "Signed-in users can read active shops"
  on public.shops for select to authenticated
  using (is_active or owner_id = auth.uid() or public.is_admin());

-- Products: visible when their shop is visible.
drop policy if exists "Signed-in users can read products of active shops" on public.products;
create policy "Signed-in users can read products of active shops"
  on public.products for select to authenticated
  using (
    exists (
      select 1 from public.shops s
      where s.id = products.shop_id
        and (s.is_active or s.owner_id = auth.uid() or public.is_admin())
    )
  );

-- Orders: customers see only their own orders.
drop policy if exists "Customers can read their own orders" on public.orders;
create policy "Customers can read their own orders"
  on public.orders for select to authenticated
  using (user_id = auth.uid());

-- Order items: visible when the parent order is the customer's own.
drop policy if exists "Customers can read items of their own orders" on public.order_items;
create policy "Customers can read items of their own orders"
  on public.order_items for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- 7. Place an order --------------------------------------------------------
-- Prices, delivery fee and totals are always calculated here from the database,
-- never trusted from the browser. The whole order is created atomically.
create or replace function public.place_order(
  p_shop_id uuid,
  p_items jsonb,               -- [{ "product_id": "...", "quantity": 2 }, ...]
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

  if not exists (select 1 from public.profiles where id = v_user and role = 'user') then
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
    (user_id, shop_id, shop_name, delivery_address, contact_phone, notes, subtotal, delivery_fee, total)
  values
    (v_user, v_shop.id, v_shop.name, trim(p_delivery_address), trim(p_contact_phone),
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

-- 8. Popular products -------------------------------------------------------
-- Ranks available products by how many units have been ordered (all customers),
-- newest first when there's a tie. Returns only public product/shop info.
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
  order by units_sold desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;

revoke all on function public.popular_products(integer) from public, anon;
grant execute on function public.popular_products(integer) to authenticated;

-- 9. Keep orders.updated_at current ----------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();
