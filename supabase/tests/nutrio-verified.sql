begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(21);

select has_table('public', 'meal_nutrition_verification_requests', 'partner verification requests are durable');
select has_table('public', 'meal_nutrition_verifications', 'version-bound verification claims are durable');
select has_table('public', 'meal_nutrition_verification_samples', 'verification sampling is durable');
select has_table('public', 'meal_nutrition_verification_events', 'verification events are auditable');
select has_trigger('public', 'meals', 'supersede_meal_nutrition_verification_trigger', 'nutrition changes invalidate claims');
select ok(not has_function_privilege('anon', 'public.request_meal_nutrition_verification(uuid,text,text,text)', 'EXECUTE'), 'anonymous callers cannot request verification');
select ok(has_function_privilege('authenticated', 'public.request_meal_nutrition_verification(uuid,text,text,text)', 'EXECUTE'), 'partners can call the guarded request RPC');
select ok(has_function_privilege('anon', 'public.get_current_meal_nutrition_verification(uuid)', 'EXECUTE'), 'customers can read the privacy-safe public claim');
select ok(has_function_privilege('authenticated', 'public.admin_review_meal_nutrition_verification(uuid,text,text,text,integer)', 'EXECUTE'), 'authenticated admins can call the internally AAL2-guarded review RPC');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a4000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'verified-partner@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a4000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'verified-other@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a4000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'verified-admin@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values ('a4000000-0000-4000-8000-000000000003', 'admin'::public.app_role)
on conflict (user_id, role) do nothing;

insert into public.restaurants (id, owner_id, name, is_partner, is_active, approval_status)
values (
  'a4100000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'Verified Test Kitchen', true, true, 'approved'::public.approval_status
);

insert into public.meals (
  id, restaurant_id, name, calories, protein_g, carbs_g, fat_g, fiber_g,
  sugar_g, sodium_mg, potassium_mg, calcium_mg, iron_mg, vitamin_d_mcg,
  vitamin_b12_mcg, magnesium_mg, nutrition_provenance, is_available,
  approval_status
) values (
  'a4200000-0000-4000-8000-000000000001',
  'a4100000-0000-4000-8000-000000000001',
  'Versioned verified meal', 520, 42, 48, 18, 9,
  5, 430, 920, 250, 3.4, 4.2, 1.5, 120,
  '{"source":"manual","source_record_id":"recipe-v1"}'::jsonb,
  true, 'approved'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.request_meal_nutrition_verification('a4200000-0000-4000-8000-000000000001', 'recipe_standardized', 'other-ref', null)$$,
  'P0001', 'MEAL_NOT_FOUND',
  'a different user cannot request verification for the partner meal'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select isnt(
  public.request_meal_nutrition_verification(
    'a4200000-0000-4000-8000-000000000001',
    'recipe_standardized',
    'recipe-v1',
    'Standardized portion and recipe record.'
  ),
  null::uuid,
  'the owning partner can request verification for complete sourced nutrition'
);
reset role;

select is(
  (select count(*) from public.meal_nutrition_verification_requests where meal_id = 'a4200000-0000-4000-8000-000000000001'),
  1::bigint,
  'one open request is recorded'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.admin_review_meal_nutrition_verification((select id from public.meal_nutrition_verification_requests where meal_id = 'a4200000-0000-4000-8000-000000000001'), 'approved', 'Recipe and nutrition values were standardized.', 'AAL1 must fail.', 90)$$,
  '42501', 'ADMIN_AAL2_REQUIRED',
  'an admin cannot approve a claim without AAL2'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.admin_review_meal_nutrition_verification((select id from public.meal_nutrition_verification_requests where meal_id = 'a4200000-0000-4000-8000-000000000001'), 'approved', 'Recipe and nutrition values were standardized.', 'Evidence checked.', 90)$$,
  'an AAL2 admin can issue a bounded verification claim'
);
reset role;

select is(
  (select status from public.meal_nutrition_verification_requests where meal_id = 'a4200000-0000-4000-8000-000000000001'),
  'approved',
  'approval closes the request'
);
select is(
  (select status from public.meal_nutrition_verifications where meal_id = 'a4200000-0000-4000-8000-000000000001'),
  'current',
  'approval creates one current claim'
);
select is(
  public.get_current_meal_nutrition_verification('a4200000-0000-4000-8000-000000000001') ->> 'tier',
  'recipe_standardized',
  'the public contract exposes the approved tier'
);
select ok(
  not (public.get_current_meal_nutrition_verification('a4200000-0000-4000-8000-000000000001') ? 'verified_by'),
  'the public contract does not expose reviewer identity'
);
select ok(
  not (public.get_current_meal_nutrition_verification('a4200000-0000-4000-8000-000000000001') ? 'evidence_reference'),
  'the public contract does not expose private evidence'
);

update public.meals
set potassium_mg = 930
where id = 'a4200000-0000-4000-8000-000000000001';

select is(
  (select status from public.meal_nutrition_verifications where meal_id = 'a4200000-0000-4000-8000-000000000001'),
  'superseded',
  'changing measured nutrition supersedes the current claim'
);
select is(
  public.get_current_meal_nutrition_verification('a4200000-0000-4000-8000-000000000001'),
  '{}'::jsonb,
  'a superseded claim disappears from the customer contract immediately'
);

select * from finish();
rollback;
