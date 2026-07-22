-- Restore customer access to the reviewed public catalog projections.
--
-- The base tables intentionally remain private because they contain internal
-- ownership, moderation, cost, banking, and payout data. These two views expose
-- only the explicitly reviewed public columns and filter out inactive,
-- unavailable, rejected, and soft-deleted records.

begin;

alter view public.public_restaurant_catalog
  set (security_invoker = false);

alter view public.public_meal_catalog
  set (security_invoker = false);

-- Preserve least privilege: clients may read the projections, never the base
-- tables that contain sensitive operational fields.
revoke all on public.public_restaurant_catalog, public.public_meal_catalog
  from public, anon, authenticated;
grant select on public.public_restaurant_catalog, public.public_meal_catalog
  to anon, authenticated;

revoke select on public.restaurants, public.meals
  from public, anon;

comment on view public.public_restaurant_catalog is
  'Approved public restaurant projection. Runs with the view owner privileges so customers can read the reviewed projection without access to sensitive base-table columns.';

comment on view public.public_meal_catalog is
  'Approved public meal projection. Runs with the view owner privileges so customers can read approved and available meals without access to sensitive base-table columns.';

commit;
