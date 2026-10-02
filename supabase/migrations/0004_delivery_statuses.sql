-- Delivery MDW — extra delivery statuses for the Delivery Boy flow:
--   not_assigned -> assigned -> accepted -> picked_up -> out_for_delivery -> delivered
--
-- Run this file ON ITS OWN, before 0005_delivery.sql. Postgres can't use new enum
-- values in the same transaction that adds them.

alter type public.delivery_status add value if not exists 'accepted' after 'assigned';
alter type public.delivery_status add value if not exists 'out_for_delivery' after 'picked_up';
