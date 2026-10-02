-- Delivery MDW — database integrity and privilege clean-up (from the full review)
-- Run after 0006_admin.sql. Safe to run more than once. No new tables.

-- 1. Missing index: order_items.product_id is used by product stats and joins -----
create index if not exists order_items_product_idx on public.order_items (product_id);

-- 2. Every order keeps the customer's name (place_order always sets it) ------------
update public.orders o set customer_name = p.name
from public.profiles p
where p.id = o.user_id and o.customer_name is null;
alter table public.orders alter column customer_name set not null;

-- 3. Order status and delivery status must agree ------------------------------------
--   * a delivery boy is set  <=> delivery_status is not "not_assigned"
--   * a delivery boy only once the shop has marked the order ready (or later)
--   * status "out_for_delivery" <=> delivery_status "out_for_delivery"
--   * status "delivered" <=> delivery_status "delivered", and delivered_at is set
-- Added as NOT VALID first (always enforced for new and changed rows), then validated
-- for existing rows; if old rows break a rule you get a NOTICE instead of an error.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('orders_rider_matches_delivery_status',
       'check ((delivery_boy_id is null) = (delivery_status = ''not_assigned''))'),
      ('orders_rider_only_when_ready',
       'check (delivery_boy_id is null or status in (''ready'', ''out_for_delivery'', ''delivered''))'),
      ('orders_out_for_delivery_matches',
       'check ((status = ''out_for_delivery'') = (delivery_status = ''out_for_delivery''))'),
      ('orders_delivered_matches',
       'check ((status = ''delivered'') = (delivery_status = ''delivered'') and (status <> ''delivered'' or delivered_at is not null))')
    ) as t(name, def)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name and conrelid = 'public.orders'::regclass) then
      execute format('alter table public.orders add constraint %I %s not valid', c.name, c.def);
    end if;
    begin
      execute format('alter table public.orders validate constraint %I', c.name);
    exception when check_violation then
      raise notice 'Some existing orders break %; new changes are still checked. Fix those rows, then run: alter table public.orders validate constraint %;', c.name, c.name;
    end;
  end loop;
end
$$;

-- 4. Keep profiles.email in sync if a user changes their email in Supabase Auth ----
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- 5. Function privileges: nothing callable by signed-out visitors unless needed ----
-- Trigger functions can't be called directly anyway; this is tidy-up.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.on_order_ready() from public, anon, authenticated;
revoke all on function public.on_rider_availability() from public, anon, authenticated;
revoke all on function public.sync_profile_email() from public, anon, authenticated;

-- Helpers used inside RLS policies: signed-in users only.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.rider_has_order_from(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.rider_has_order_from(uuid) to authenticated;
