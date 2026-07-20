begin;

select plan(8);

select ok(
  coalesce(
    (select 'security_invoker=true' = any(c.reloptions)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'current_meal_nutrition_verifications'),
    false
  ),
  'current verification view uses invoker security'
);

select ok(
  coalesce(
    (select 'security_barrier=true' = any(c.reloptions)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'current_meal_nutrition_verifications'),
    false
  ),
  'current verification view remains a security barrier'
);

select ok(
  not has_table_privilege('anon', 'public.current_meal_nutrition_verifications', 'SELECT'),
  'anonymous clients cannot query the internal verification view'
);

select ok(
  not has_table_privilege('authenticated', 'public.current_meal_nutrition_verifications', 'SELECT'),
  'authenticated clients cannot query the internal verification view'
);

select ok(
  has_table_privilege('service_role', 'public.current_meal_nutrition_verifications', 'SELECT'),
  'service role can query the internal verification view'
);

select ok(
  not has_table_privilege('anon', 'public.current_meal_nutrition_verifications', 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'anonymous clients have no mutation-like view privileges'
);

select ok(
  not has_table_privilege('authenticated', 'public.current_meal_nutrition_verifications', 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'authenticated clients have no mutation-like view privileges'
);

select ok(
  has_function_privilege('anon', 'public.get_current_meal_nutrition_verification(uuid)', 'EXECUTE'),
  'anonymous clients retain the scoped public verification RPC'
);

select * from finish();

rollback;
