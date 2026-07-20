begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(18);

select has_table(
  'public', 'meal_schedule_substitution_events',
  'safe substitutions retain an immutable audit trail'
);
select has_trigger(
  'public', 'meal_schedules', 'guard_direct_meal_schedule_substitution_trigger',
  'direct scheduled-meal changes are guarded'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_safe_meal_substitutes(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated customers can request safe candidates'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.perform_safe_meal_substitution(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute a substitution'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a3000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'safe-swap-owner@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a3000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'safe-swap-other@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into public.profiles (user_id, allergies)
values
  ('a3000000-0000-4000-8000-000000000001', array['peanut']::text[]),
  ('a3000000-0000-4000-8000-000000000002', array[]::text[])
on conflict (user_id) do update set allergies = excluded.allergies;

insert into public.restaurants (
  id, name, is_partner, is_active, approval_status
) values (
  'a3100000-0000-4000-8000-000000000001',
  'Safe Swap Kitchen', true, true, 'approved'::public.approval_status
);

insert into public.meals (
  id, restaurant_id, name, meal_type, calories, protein_g, carbs_g, fat_g,
  fiber_g, sugar_g, sodium_mg, price, is_available, approval_status
) values
  (
    'a3200000-0000-4000-8000-000000000001',
    'a3100000-0000-4000-8000-000000000001',
    'Original balanced lunch', 'lunch', 500, 40, 50, 16,
    8, 5, 450, 35, true, 'approved'
  ),
  (
    'a3200000-0000-4000-8000-000000000002',
    'a3100000-0000-4000-8000-000000000001',
    'Eligible balanced lunch', 'lunch', 510, 42, 48, 17,
    9, 4, 430, 37, true, 'approved'
  ),
  (
    'a3200000-0000-4000-8000-000000000003',
    'a3100000-0000-4000-8000-000000000001',
    'Unavailable balanced lunch', 'lunch', 505, 41, 49, 16,
    8, 5, 440, 36, false, 'approved'
  );

insert into public.meal_schedules (
  id, user_id, meal_id, restaurant_id, scheduled_date, meal_type,
  order_status, schedule_source, customization_data, routing_metadata,
  request_batch_id, request_item_index
) values (
  'a3300000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a3200000-0000-4000-8000-000000000001',
  'a3100000-0000-4000-8000-000000000001',
  current_date + 1, 'lunch', 'pending', 'customer', '{}'::jsonb, '{}'::jsonb,
  'a3400000-0000-4000-8000-000000000001', 0
);

select throws_ok(
  $$
    update public.meal_schedules
    set meal_id = 'a3200000-0000-4000-8000-000000000002'
    where id = 'a3300000-0000-4000-8000-000000000001'
  $$,
  'P0001', 'USE_SAFE_MEAL_SUBSTITUTION',
  'even a privileged direct meal-id update is rejected'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.get_safe_meal_substitutes(
    'a3300000-0000-4000-8000-000000000001', 3
  )$$,
  'P0001', 'SCHEDULE_NOT_FOUND',
  'another customer cannot inspect safe substitutes for the schedule'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  jsonb_array_length(
    public.get_safe_meal_substitutes(
      'a3300000-0000-4000-8000-000000000001', 3
    ) -> 'candidates'
  ),
  1,
  'only the available, safe, nutritionally similar lunch is returned'
);
select is(
  public.get_safe_meal_substitutes(
    'a3300000-0000-4000-8000-000000000001', 3
  ) -> 'candidates' -> 0 ->> 'meal_id',
  'a3200000-0000-4000-8000-000000000002',
  'the eligible candidate is identified by the server'
);
select is(
  public.get_safe_meal_substitutes(
    'a3300000-0000-4000-8000-000000000001', 3
  ) -> 'candidates' -> 0 -> 'routing' ->> 'status',
  'single_kitchen',
  'delivery routing is checked before the candidate is offered'
);
select throws_ok(
  $$select public.perform_safe_meal_substitution(
    'a3300000-0000-4000-8000-000000000001',
    'a3200000-0000-4000-8000-000000000003',
    'a3500000-0000-4000-8000-000000000001'
  )$$,
  'P0001', 'SUBSTITUTE_NOT_ELIGIBLE',
  'an unavailable candidate is rejected during the atomic recheck'
);
select is(
  public.perform_safe_meal_substitution(
    'a3300000-0000-4000-8000-000000000001',
    'a3200000-0000-4000-8000-000000000002',
    'a3500000-0000-4000-8000-000000000002'
  ) ->> 'success',
  'true',
  'the server performs an eligible substitution atomically'
);
select is(
  public.perform_safe_meal_substitution(
    'a3300000-0000-4000-8000-000000000001',
    'a3200000-0000-4000-8000-000000000002',
    'a3500000-0000-4000-8000-000000000002'
  ) ->> 'already_processed',
  'true',
  'retrying the same request is idempotent'
);
reset role;

select is(
  (
    select meal_id
    from public.meal_schedules
    where id = 'a3300000-0000-4000-8000-000000000001'
  ),
  'a3200000-0000-4000-8000-000000000002'::uuid,
  'the schedule now references the approved substitute'
);
select is(
  (
    select request_batch_id
    from public.meal_schedules
    where id = 'a3300000-0000-4000-8000-000000000001'
  ),
  'a3400000-0000-4000-8000-000000000001'::uuid,
  'the original order request identity is preserved'
);
select is(
  (
    select count(*)
    from public.meal_schedule_substitution_events
    where schedule_id = 'a3300000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'one immutable audit event records the successful substitution'
);
select is(
  (
    select previous_meal_id
    from public.meal_schedule_substitution_events
    where schedule_id = 'a3300000-0000-4000-8000-000000000001'
  ),
  'a3200000-0000-4000-8000-000000000001'::uuid,
  'the audit event retains the previous meal'
);
select is(
  (
    select substitute_meal_id
    from public.meal_schedule_substitution_events
    where schedule_id = 'a3300000-0000-4000-8000-000000000001'
  ),
  'a3200000-0000-4000-8000-000000000002'::uuid,
  'the audit event retains the resulting meal'
);
select is(
  (
    select reason_codes @> array[
      'safety_checked', 'diet_checked', 'delivery_checked', 'nutrition_match'
    ]::text[]
    from public.meal_schedule_substitution_events
    where schedule_id = 'a3300000-0000-4000-8000-000000000001'
  ),
  true,
  'the audit event records every server validation family'
);

select * from finish();
rollback;
