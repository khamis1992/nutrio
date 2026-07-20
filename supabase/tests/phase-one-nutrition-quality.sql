begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(37);

select has_column('public', 'meals', 'potassium_mg', 'meals store normalized potassium');
select has_column('public', 'meals', 'calcium_mg', 'meals store normalized calcium');
select has_column('public', 'meals', 'iron_mg', 'meals store normalized iron');
select has_column('public', 'meals', 'vitamin_d_mcg', 'meals store vitamin D in micrograms');
select has_column('public', 'meals', 'vitamin_b12_mcg', 'meals store vitamin B12 in micrograms');
select has_column('public', 'meals', 'magnesium_mg', 'meals store normalized magnesium');
select has_table('public', 'meal_nutrition_revisions', 'nutrition revisions are durable');
select has_table('public', 'meal_nutrition_corrections', 'correction requests are durable');
select has_trigger(
  'public', 'meals', 'trg_apply_meal_nutrition_quality',
  'meal writes apply nutrition quality transactionally'
);
select ok(not has_function_privilege('anon', 'public.get_user_micronutrient_adequacy(date,date)', 'EXECUTE'), 'anonymous users cannot query micronutrient adequacy');
select ok(has_function_privilege('authenticated', 'public.get_user_micronutrient_adequacy(date,date)', 'EXECUTE'), 'authenticated users can query their own micronutrient adequacy');
select ok(not has_function_privilege('anon', 'public.apply_meal_nutrition_quality()', 'EXECUTE'), 'nutrition trigger is not an anonymous RPC');
select ok(not has_function_privilege('authenticated', 'public.apply_meal_nutrition_quality()', 'EXECUTE'), 'nutrition trigger is not a customer RPC');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'agent2-owner@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'agent2-other@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'agent2-admin@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'agent2-customer@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (user_id) values
  ('a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002'),
  ('a2000000-0000-4000-8000-000000000003'),
  ('a2000000-0000-4000-8000-000000000004')
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role)
values ('a2000000-0000-4000-8000-000000000003', 'admin'::public.app_role)
on conflict (user_id, role) do nothing;

insert into public.restaurants (id, owner_id, name, is_partner, approval_status)
values
  ('a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Agent 2 Kitchen', true, 'approved'::public.approval_status),
  ('a2100000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'Other Kitchen', true, 'approved'::public.approval_status);

insert into public.meals (
  id, restaurant_id, name, calories, protein_g, carbs_g, fat_g, fiber_g,
  sugar_g, sodium_mg, potassium_mg, calcium_mg, iron_mg, vitamin_d_mcg,
  vitamin_b12_mcg, magnesium_mg, nutrition_version, nutrition_provenance,
  is_available
) values
  (
    'a2200000-0000-4000-8000-000000000001',
    'a2100000-0000-4000-8000-000000000001',
    'Measured meal', 500, 35, 55, 16, 8, 4, 500, 900, 240, null, 4, 1.2, 110,
    99, '{"source":"manual","source_record_id":"label-1","version":99}', true
  ),
  (
    'a2200000-0000-4000-8000-000000000002',
    'a2100000-0000-4000-8000-000000000002',
    'Other incomplete meal', 400, 30, 40, 12, null, null, null, null, null,
    null, null, null, null, 42, '{"source":"partner_entered"}', true
  );

select is(
  (select nutrition_version from public.meals where id = 'a2200000-0000-4000-8000-000000000001'),
  1,
  'the database assigns the initial version instead of trusting the client'
);
select is(
  (select count(*) from public.meal_nutrition_revisions where meal_id = 'a2200000-0000-4000-8000-000000000001'),
  1::bigint,
  'the initial measured facts create one immutable revision'
);

update public.meals set name = 'Measured meal renamed'
where id = 'a2200000-0000-4000-8000-000000000001';
select is(
  (select nutrition_version from public.meals where id = 'a2200000-0000-4000-8000-000000000001'),
  1,
  'non-nutrition edits do not increment nutrition version'
);
select is(
  (select count(*) from public.meal_nutrition_revisions where meal_id = 'a2200000-0000-4000-8000-000000000001'),
  1::bigint,
  'non-nutrition edits do not create revisions'
);

update public.meals set potassium_mg = 1000, nutrition_version = 500
where id = 'a2200000-0000-4000-8000-000000000001';
select is(
  (select nutrition_version from public.meals where id = 'a2200000-0000-4000-8000-000000000001'),
  2,
  'a measured fact change increments exactly once in the transaction'
);
select is(
  (select (nutrients ->> 'potassium_mg')::numeric from public.meal_nutrition_revisions
   where meal_id = 'a2200000-0000-4000-8000-000000000001' and nutrition_version = 1),
  900::numeric,
  'the prior provenance revision retains its original measured value'
);
select throws_ok(
  $$update public.meal_nutrition_revisions set nutrients = '{}' where meal_id = 'a2200000-0000-4000-8000-000000000001'$$,
  'P0001', 'NUTRITION_REVISION_IMMUTABLE',
  'revision rows reject mutation'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*) from public.partner_meal_nutrition_missing_queue),
  1::bigint,
  'the partner queue exposes only incomplete meals owned by that restaurant'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select isnt(
  public.request_meal_nutrition_correction(
    'a2200000-0000-4000-8000-000000000001',
    'Supply the missing measured iron value.'
  ),
  null::uuid,
  'an admin can transactionally request a correction'
);
reset role;

select is(
  (select status from public.meal_nutrition_corrections where meal_id = 'a2200000-0000-4000-8000-000000000001'),
  'requested',
  'the correction workflow records an open request'
);
select is(
  (select is_available from public.meals where id = 'a2200000-0000-4000-8000-000000000001'),
  false,
  'requesting correction hides the incomplete meal in the same transaction'
);

update public.meals set iron_mg = 3.5
where id = 'a2200000-0000-4000-8000-000000000001';
select is(
  (select status from public.meal_nutrition_corrections where meal_id = 'a2200000-0000-4000-8000-000000000001'),
  'submitted',
  'a complete partner correction advances to submitted review'
);
select is(
  (select count(*) from public.partner_meal_nutrition_missing_queue where meal_id = 'a2200000-0000-4000-8000-000000000001'),
  1::bigint,
  'a complete correction remains in the admin queue until resolved'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$select public.resolve_meal_nutrition_correction('a2200000-0000-4000-8000-000000000001')$$,
  'an admin can resolve a submitted complete correction'
);
reset role;
select is(
  (select status from public.meal_nutrition_corrections where meal_id = 'a2200000-0000-4000-8000-000000000001'),
  'resolved',
  'resolution closes the correction audit row'
);
select is(
  (select count(*) from public.partner_meal_nutrition_missing_queue where meal_id = 'a2200000-0000-4000-8000-000000000001'),
  0::bigint,
  'resolved complete meals leave the correction queue'
);

insert into public.meal_history (
  user_id, name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
  sodium_mg, potassium_mg, calcium_mg, iron_mg, vitamin_d_mcg,
  vitamin_b12_mcg, magnesium_mg, logged_at
) values (
  'a2000000-0000-4000-8000-000000000004', 'Measured history', 500, 35, 55, 16,
  0, 0, 0, 3500, 0, null, 15, 2.4, 400, now()
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is(
  (select target from public.get_user_micronutrient_adequacy(current_date, current_date) where nutrient_code = 'potassium_mg'),
  3500::numeric,
  'daily adequacy uses one daily normalized target'
);
select is(
  (select target from public.get_user_micronutrient_adequacy(current_date - 6, current_date) where nutrient_code = 'potassium_mg'),
  24500::numeric,
  'weekly adequacy scales the target across seven inclusive days'
);
select is(
  (select consumed from public.get_user_micronutrient_adequacy(current_date, current_date) where nutrient_code = 'calcium_mg'),
  0::numeric,
  'measured zero remains a measured value'
);
select is(
  (select status from public.get_user_micronutrient_adequacy(current_date, current_date) where nutrient_code = 'calcium_mg'),
  'low',
  'measured zero is evaluated rather than reported missing'
);
select is(
  (select consumed from public.get_user_micronutrient_adequacy(current_date, current_date) where nutrient_code = 'iron_mg'),
  null::numeric,
  'an absent measurement remains null'
);
select is(
  (select status from public.get_user_micronutrient_adequacy(current_date, current_date) where nutrient_code = 'iron_mg'),
  'missing',
  'an absent measurement reports missing coverage'
);
select is(
  (select target from public.get_user_micronutrient_adequacy(current_date, current_date) where nutrient_code = 'vitamin_b12_mcg'),
  2.4::numeric,
  'vitamin B12 uses normalized microgram targets'
);
select is(
  (select label_ar from public.get_user_micronutrient_adequacy(current_date, current_date) where nutrient_code = 'magnesium_mg'),
  'المغنيسيوم',
  'adequacy rows expose rendered Arabic nutrient labels'
);
reset role;

select * from finish();
rollback;
