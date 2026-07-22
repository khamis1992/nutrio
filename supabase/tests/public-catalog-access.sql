begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(8);

select ok(
  coalesce(
    (
      select not ('security_invoker=true' = any(c.reloptions))
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'public_restaurant_catalog'
    ),
    false
  ),
  'public restaurant catalog runs with view-owner privileges'
);

select ok(
  coalesce(
    (
      select not ('security_invoker=true' = any(c.reloptions))
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'public_meal_catalog'
    ),
    false
  ),
  'public meal catalog runs with view-owner privileges'
);

select ok(
  has_table_privilege('anon', 'public.public_restaurant_catalog', 'select'),
  'anonymous clients can read the public restaurant catalog'
);

select ok(
  has_table_privilege('authenticated', 'public.public_restaurant_catalog', 'select'),
  'authenticated clients can read the public restaurant catalog'
);

select ok(
  has_table_privilege('anon', 'public.public_meal_catalog', 'select'),
  'anonymous clients can read the public meal catalog'
);

select ok(
  has_table_privilege('authenticated', 'public.public_meal_catalog', 'select'),
  'authenticated clients can read the public meal catalog'
);

select ok(
  not has_table_privilege('anon', 'public.restaurants', 'select'),
  'anonymous clients cannot read the restaurant base table'
);

select ok(
  not has_table_privilege('anon', 'public.meals', 'select'),
  'anonymous clients cannot read the meal base table'
);

select * from finish();

rollback;
