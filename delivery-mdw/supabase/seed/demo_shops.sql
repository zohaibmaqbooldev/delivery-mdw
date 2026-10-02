-- OPTIONAL demo data for trying the customer side before the Shop dashboard exists.
-- It creates NO orders — orders only come from customers placing them in the app.
-- Run it after all migrations (it marks the demo shops as approved).
--
-- How to use:
--   1. In the app, sign up one or more accounts with the "Shop" account type.
--   2. Run this file in the Supabase SQL Editor.
-- Each shop account that doesn't have a shop yet gets one demo shop with products
-- (up to 4 shops). Delete them any time with:
--   delete from public.shops where description like '[demo]%';

with demo_shops(n, name, description, location, phone, delivery_fee, is_open) as (
  values
    (1, 'Fresh Mart',        '[demo] Everyday groceries, fruit and vegetables.', 'Gulberg, Lahore',        '0300-1110001', 150, true),
    (2, 'Karachi Bites',     '[demo] Burgers, rolls and quick meals.',           'Clifton, Karachi',       '0300-1110002', 120, true),
    (3, 'Golden Crust Bakery','[demo] Fresh bread, cakes and pastries daily.',   'F-7 Markaz, Islamabad',  '0300-1110003', 100, false),
    (4, 'City Pharmacy',     '[demo] Medicines and personal care.',              'Saddar, Rawalpindi',     '0300-1110004', 80,  true)
),
free_owners as (
  select p.id, row_number() over (order by p.created_at) as n
  from public.profiles p
  where p.role = 'shop'
    and not exists (select 1 from public.shops s where s.owner_id = p.id)
),
new_shops as (
  insert into public.shops (owner_id, name, description, location, phone, delivery_fee, is_open, is_approved)
  select o.id, d.name, d.description, d.location, d.phone, d.delivery_fee, d.is_open, true
  from free_owners o
  join demo_shops d on d.n = o.n
  returning id, name
)
insert into public.products (shop_id, category_id, name, description, price)
select s.id, c.id, p.name, p.description, p.price
from new_shops s
join (
  values
    ('Fresh Mart', 'groceries', 'Basmati Rice 5kg',     'Long-grain premium rice.',      1850),
    ('Fresh Mart', 'groceries', 'Cooking Oil 1L',       'Refined sunflower oil.',         640),
    ('Fresh Mart', 'groceries', 'Fresh Eggs (12)',      'Farm eggs, one dozen.',          420),
    ('Fresh Mart', 'drinks',    'Mineral Water 1.5L',   'Pack of 1 bottle.',               90),
    ('Fresh Mart', 'household', 'Dishwashing Liquid',   '500ml lemon scent.',             310),
    ('Karachi Bites', 'food',   'Zinger Burger',        'Crispy chicken fillet burger.',  550),
    ('Karachi Bites', 'food',   'Chicken Paratha Roll', 'Grilled chicken in paratha.',    380),
    ('Karachi Bites', 'food',   'Loaded Fries',         'Fries with cheese and sauce.',   450),
    ('Karachi Bites', 'drinks', 'Mint Margarita',       'Fresh mint and lemon.',          280),
    ('Golden Crust Bakery', 'bakery', 'Chocolate Cake 1lb', 'Rich chocolate sponge.',     1200),
    ('Golden Crust Bakery', 'bakery', 'Chicken Patties (4)', 'Flaky puff pastry.',          360),
    ('Golden Crust Bakery', 'bakery', 'Milk Bread',          'Soft sliced loaf.',           180),
    ('City Pharmacy', 'pharmacy', 'Panadol (20 tablets)', 'Paracetamol 500mg.',            95),
    ('City Pharmacy', 'pharmacy', 'Hand Sanitizer 250ml', '70% alcohol gel.',              350),
    ('City Pharmacy', 'household', 'Face Masks (50)',     '3-ply disposable masks.',        600)
) as p(shop_name, category_slug, name, description, price) on p.shop_name = s.name
left join public.categories c on c.slug = p.category_slug;
