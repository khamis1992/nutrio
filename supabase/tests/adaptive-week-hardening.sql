begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(17);

select has_column('public', 'weekly_ai_check_ins', 'recommendation_state', 'weekly decisions expose change, maintain, or hold');
select has_column('public', 'weekly_ai_check_ins', 'data_quality', 'data quality evidence is durable');
select has_column('public', 'weekly_ai_check_ins', 'weight_trend', 'smoothed trend evidence is durable');
select has_column('public', 'weekly_ai_check_ins', 'safety_context', 'safety context evidence is durable');
select has_column('public', 'weekly_ai_check_ins', 'goal_id_snapshot', 'proposal is bound to a goal');
select has_column('public', 'weekly_ai_check_ins', 'goal_version_snapshot', 'proposal is bound to a goal version');
select has_column('public', 'weekly_ai_check_ins', 'proposal_fingerprint', 'proposal has a server-owned fingerprint');
select has_column('public', 'weekly_ai_check_ins', 'expires_at', 'proposal has a bounded lifetime');
select ok(
  has_function_privilege('authenticated', 'public.create_weekly_ai_check_in(smallint,smallint,smallint,smallint,numeric,text)', 'EXECUTE'),
  'authenticated users can create their own bounded review'
);
select ok(
  not has_function_privilege('anon', 'public.resolve_weekly_ai_check_in(uuid,text)', 'EXECUTE'),
  'anonymous users cannot resolve a review'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'ad000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'adaptive-week@local.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into public.profiles (
  user_id, full_name, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g
) values (
  'ad000000-0000-4000-8000-000000000001', 'Adaptive Week Fixture', 2000, 150, 220, 70
) on conflict (user_id) do update set
  daily_calorie_target = excluded.daily_calorie_target,
  protein_target_g = excluded.protein_target_g,
  carbs_target_g = excluded.carbs_target_g,
  fat_target_g = excluded.fat_target_g;

insert into public.nutrition_goals (
  user_id, goal_type, daily_calorie_target, protein_target_g, carbs_target_g,
  fat_target_g, is_active, version
) values (
  'ad000000-0000-4000-8000-000000000001', 'weight_loss', 2000, 150, 220, 70, true, 1
);

insert into public.adaptive_goal_settings (
  user_id, auto_adjust_enabled, min_calorie_floor, max_calorie_ceiling
) values (
  'ad000000-0000-4000-8000-000000000001', true, 1200, 4000
) on conflict (user_id) do update set auto_adjust_enabled = true;

insert into public.progress_logs (user_id, log_date, calories_consumed)
select 'ad000000-0000-4000-8000-000000000001', current_date - offset_days, 2000
from unnest(array[1,2,3,4,5]) as offset_days
on conflict (user_id, log_date) do update set calories_consumed = excluded.calories_consumed;

insert into public.body_measurements (user_id, log_date, weight_kg)
select 'ad000000-0000-4000-8000-000000000001', current_date - sample.offset_days, sample.weight_kg
from (values
  (25, 90.1::numeric), (21, 90.0::numeric), (16, 90.1::numeric),
  (10, 90.0::numeric), (5, 90.1::numeric), (1, 90.0::numeric)
) as sample(offset_days, weight_kg)
on conflict (user_id, log_date) do update set weight_kg = excluded.weight_kg;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.create_weekly_ai_check_in(4, 2, 4, 4, 90.0, 'Consistent test week')$$,
  'a user can create a review from sufficient reliable data'
);
reset role;

select is(
  (select recommendation_state from public.weekly_ai_check_ins where user_id = 'ad000000-0000-4000-8000-000000000001'),
  'change',
  'a flat smoothed trend with sufficient adherence produces a bounded change proposal'
);
select is(
  (select data_quality ->> 'label' from public.weekly_ai_check_ins where user_id = 'ad000000-0000-4000-8000-000000000001'),
  'high',
  'the fixture passes the high-quality evidence gate'
);
select is(
  (select (proposed_targets ->> 'protein')::integer from public.weekly_ai_check_ins where user_id = 'ad000000-0000-4000-8000-000000000001'),
  150,
  'a calorie decrease does not reduce protein'
);
select ok(
  (select abs((proposed_targets ->> 'calories')::integer - (current_targets ->> 'calories')::integer) <= 100
   from public.weekly_ai_check_ins where user_id = 'ad000000-0000-4000-8000-000000000001'),
  'the proposed decrease is within the weekly absolute limit'
);

update public.nutrition_goals
set version = version + 1
where user_id = 'ad000000-0000-4000-8000-000000000001' and is_active;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  public.resolve_weekly_ai_check_in(
    (select id from public.weekly_ai_check_ins where user_id = 'ad000000-0000-4000-8000-000000000001'),
    'apply'
  ) ->> 'status',
  'stale',
  'a proposal cannot apply after the active goal version changes'
);
reset role;

select is(
  (select daily_calorie_target from public.nutrition_goals where user_id = 'ad000000-0000-4000-8000-000000000001' and is_active),
  2000,
  'a stale proposal leaves the goal unchanged'
);

select * from finish();
rollback;
