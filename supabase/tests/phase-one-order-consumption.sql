begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(47);

select ok(not has_function_privilege('anon', 'public.set_order_item_nutrition_snapshot()', 'EXECUTE'), 'order snapshot trigger is not an anonymous RPC');
select ok(not has_function_privilege('authenticated', 'public.set_order_item_nutrition_snapshot()', 'EXECUTE'), 'order snapshot trigger is not a customer RPC');
select ok(not has_function_privilege('anon', 'public.commit_order_item_nutrition_snapshots()', 'EXECUTE'), 'commit trigger is not an anonymous RPC');
select ok(not has_function_privilege('authenticated', 'public.enforce_committed_order_item_immutability()', 'EXECUTE'), 'immutability trigger is not a customer RPC');

select has_column(
  'public', 'order_items', 'nutrition_snapshot_committed_at',
  'order items expose the durable commitment boundary'
);
select has_column(
  'public', 'order_items', 'nutrition_snapshot_revision',
  'order items expose the captured nutrition revision'
);
select has_column(
  'public', 'orders', 'order_items_committed_at',
  'orders retain a durable closed-item-set marker'
);
select has_trigger(
  'public', 'order_items', 'zz_enforce_committed_order_item_immutability',
  'order items enforce immutable committed nutrition'
);
select has_trigger(
  'public', 'orders', 'capture_committed_order_item_nutrition',
  'order commitment captures item snapshots transactionally'
);
select matches(
  pg_get_functiondef('public.set_order_item_nutrition_snapshot()'::regprocedure),
  'pg_advisory_xact_lock',
  'item edits take the order commitment advisory lock'
);
select matches(
  pg_get_functiondef('public.commit_order_item_nutrition_snapshots()'::regprocedure),
  'pg_advisory_xact_lock',
  'order commitment takes the same advisory lock'
);

-- Isolate order-consumption assertions from the legacy notification trigger.
-- The authoritative baseline renamed notifications.metadata to data without
-- updating that unrelated trigger; this DDL is transactional and rolls back.
alter table public.orders disable trigger on_order_notification;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'agent-1-owner@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'agent-1-other@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

-- The authoritative baseline keeps the customer-facing user projection separate
-- from auth.users, and orders.user_id references this projection directly.
insert into public.users (id, email, full_name)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'agent-1-owner@local.test',
    'Agent 1 Owner'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'agent-1-other@local.test',
    'Agent 1 Other'
  )
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name;

insert into public.profiles (user_id)
values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002')
on conflict (user_id) do nothing;

insert into public.restaurants (id, name, is_partner, approval_status)
values (
  'a1100000-0000-4000-8000-000000000001',
  'Agent 1 Test Kitchen',
  true,
  'approved'::public.approval_status
);

insert into public.meals (
  id, restaurant_id, name, calories, protein_g, carbs_g, fat_g, fiber_g,
  sugar_g, sodium_mg, nutrient_completeness_score
) values
  (
    'a1200000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'Snapshot Meal A', 508, 38, 47, 18, 8, 6, 420, 100
  ),
  (
    'a1200000-0000-4000-8000-000000000002',
    'a1100000-0000-4000-8000-000000000001',
    'Snapshot Meal B', 620, 44, 61, 21, 9, 7, 510, 100
  );

-- Catalog revisions are system-owned. Two nutrition changes advance Meal A
-- from its initial revision to revision 3 before the customer commits.
update public.meals
set calories = 509
where id = 'a1200000-0000-4000-8000-000000000001';

update public.meals
set calories = 510
where id = 'a1200000-0000-4000-8000-000000000001';

insert into public.orders (
  id, user_id, restaurant_id, meal_id, total_amount, status, order_type
) values
  (
    'a1300000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    25, 'pending', 'manual'
  ),
  (
    'a1300000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    20, 'pending', 'legacy'
  ),
  (
    'a1300000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    30, 'pending', 'manual'
  ),
  (
    'a1300000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000002',
    30, 'pending', 'manual'
  );

insert into public.order_items (
  id, order_id, meal_id, meal_name, quantity, unit_price, subtotal
) values
  (
    'a1400000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    'Snapshot Meal A', 1, 25, 25
  ),
  (
    'a1400000-0000-4000-8000-000000000002',
    'a1300000-0000-4000-8000-000000000002',
    null,
    'Unavailable legacy meal', 1, 20, 20
  ),
  (
    'a1400000-0000-4000-8000-000000000003',
    'a1300000-0000-4000-8000-000000000003',
    'a1200000-0000-4000-8000-000000000001',
    'Snapshot Meal A', 1, 30, 30
  ),
  (
    'a1400000-0000-4000-8000-000000000004',
    'a1300000-0000-4000-8000-000000000004',
    'a1200000-0000-4000-8000-000000000002',
    'Snapshot Meal B', 1, 30, 30
  );

select is(
  (
    select nutrition_version
    from public.meals
    where id = 'a1200000-0000-4000-8000-000000000001'
  ),
  3,
  'the catalog advances the nutrition revision for each facts change'
);
select is(
  (
    select (nutrition_snapshot ->> 'nutrition_version')::integer
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000001'
  ),
  3,
  'the mutable order snapshot starts from the current catalog revision'
);

select is(
  (
    select nutrition_snapshot_committed_at
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000001'
  ),
  null::timestamptz,
  'pending order item is not marked as historical truth'
);

update public.orders
set status = 'confirmed'
where id in (
  'a1300000-0000-4000-8000-000000000001',
  'a1300000-0000-4000-8000-000000000002',
  'a1300000-0000-4000-8000-000000000003',
  'a1300000-0000-4000-8000-000000000004'
);

select is(
  (
    select (nutrition_snapshot ->> 'calories')::integer
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000001'
  ),
  510,
  'commitment captures the catalog nutrition snapshot'
);
select isnt(
  (
    select nutrition_snapshot_committed_at
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000001'
  ),
  null::timestamptz,
  'commitment stamps the immutable boundary'
);
select is(
  (
    select nutrition_snapshot_revision
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000001'
  ),
  3,
  'commitment retains the catalog nutrition revision'
);
select is(
  (
    select nutrition_snapshot ->> 'calories'
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000002'
  ),
  null::text,
  'legacy fallback records unknown nutrition as null'
);
select ok(
  (
    select nutrition_snapshot -> 'missing_nutrient_codes' ? 'calories'
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000002'
  ),
  'legacy fallback declares missing nutrient codes'
);

update public.meals
set calories = 999,
    nutrition_version = nutrition_version + 1
where id = 'a1200000-0000-4000-8000-000000000001';

select is(
  (
    select (nutrition_snapshot ->> 'calories')::integer
    from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000001'
  ),
  510,
  'catalog edits do not rewrite committed order nutrition'
);

select throws_ok(
  $$
    update public.order_items
    set meal_id = 'a1200000-0000-4000-8000-000000000002'
    where id = 'a1400000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'COMMITTED_ORDER_ITEM_NUTRITION_IMMUTABLE',
  'committed item meal replacement is rejected'
);
select throws_ok(
  $$
    update public.order_items
    set nutrition_snapshot = jsonb_build_object('calories', 1)
    where id = 'a1400000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'COMMITTED_ORDER_ITEM_NUTRITION_IMMUTABLE',
  'committed snapshot replacement is rejected'
);
select throws_ok(
  $$
    delete from public.order_items
    where id = 'a1400000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'COMMITTED_ORDER_ITEMS_IMMUTABLE',
  'committed order item deletion is rejected'
);

update public.orders
set status = 'cancelled'
where id = 'a1300000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    update public.order_items
    set quantity = 2
    where id = 'a1400000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'COMMITTED_ORDER_ITEM_NUTRITION_IMMUTABLE',
  'post-commit cancellation does not unlock item nutrition'
);
select throws_ok(
  $$
    insert into public.order_items (
      id, order_id, meal_id, meal_name, quantity, unit_price, subtotal
    ) values (
      'a1400000-0000-4000-8000-000000000099',
      'a1300000-0000-4000-8000-000000000001',
      'a1200000-0000-4000-8000-000000000001',
      'Late replacement', 1, 30, 30
    )
  $$,
  'P0001',
  'COMMITTED_ORDER_ITEMS_IMMUTABLE',
  'new items cannot be inserted after commitment'
);
select is(
  has_table_privilege('authenticated', 'public.order_items', 'UPDATE'),
  false,
  'authenticated users have no direct order-item update privilege'
);

update public.orders
set status = 'delivered'
where id = 'a1300000-0000-4000-8000-000000000004';

select is(
  (
    select count(*)
    from public.meal_consumptions
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'delivery alone creates no consumption fact'
);

update public.orders
set status = 'delivered'
where id = 'a1300000-0000-4000-8000-000000000004';

select is(
  (
    select count(*)
    from public.meal_consumptions
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'duplicate delivery remains nutrition-neutral'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.record_order_meal_consumption(
      'order',
      'a1300000-0000-4000-8000-000000000004',
      'a1200000-0000-4000-8000-000000000002',
      'full', 100, null,
      'a1500000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'DELIVERED_ORDER_NOT_FOUND',
  'another user cannot consume the owner order'
);

reset role;

update public.meals
set calories = 1200,
    nutrition_version = nutrition_version + 1
where id = 'a1200000-0000-4000-8000-000000000002';

create temp table agent_1_results (
  result_key text primary key,
  result jsonb not null
);
grant select, insert, update on agent_1_results to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into agent_1_results (result_key, result)
values (
  'first',
  public.record_order_meal_consumption(
    'order',
    'a1300000-0000-4000-8000-000000000004',
    'a1200000-0000-4000-8000-000000000002',
    'full', 100, null,
    'a1500000-0000-4000-8000-000000000002'
  )
);

select is(
  (select (result -> 'nutrition' ->> 'calories')::integer from agent_1_results where result_key = 'first'),
  620,
  'consumption reads committed nutrition after a catalog change'
);

insert into agent_1_results (result_key, result)
values (
  'same-request',
  public.record_order_meal_consumption(
    'order',
    'a1300000-0000-4000-8000-000000000004',
    'a1200000-0000-4000-8000-000000000002',
    'full', 100, null,
    'a1500000-0000-4000-8000-000000000002'
  )
);

select is(
  (select (result ->> 'already_processed')::boolean from agent_1_results where result_key = 'same-request'),
  true,
  'same request id returns the previously committed result'
);

insert into agent_1_results (result_key, result)
values (
  'same-command',
  public.record_order_meal_consumption(
    'order',
    'a1300000-0000-4000-8000-000000000004',
    'a1200000-0000-4000-8000-000000000002',
    'full', 100, null,
    'a1500000-0000-4000-8000-000000000003'
  )
);

select is(
  (select (result ->> 'already_processed')::boolean from agent_1_results where result_key = 'same-command'),
  true,
  'same semantic command with a new request id is idempotent'
);
select is(
  (
    select count(*)
    from public.meal_consumption_events
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  'repeated commands create one consumption event'
);
select is(
  (
    select count(*)
    from public.meal_history
    where source_order_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  'repeated commands create one nutrition history projection'
);

insert into agent_1_results (result_key, result)
values (
  'substitute',
  public.record_order_meal_consumption(
    'order',
    'a1300000-0000-4000-8000-000000000004',
    'a1200000-0000-4000-8000-000000000002',
    'substituted', 100,
    'a1200000-0000-4000-8000-000000000001',
    'a1500000-0000-4000-8000-000000000004'
  )
);

select is(
  (select result ->> 'status' from agent_1_results where result_key = 'substitute'),
  'substituted',
  'substitution records a distinct consumption outcome'
);
select is(
  (
    select nutrition_snapshot ->> 'original_meal_id'
    from public.meal_consumptions
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  'a1200000-0000-4000-8000-000000000002',
  'substitution preserves the original ordered meal reference'
);

insert into agent_1_results (result_key, result)
values (
  'partial-edit',
  public.record_order_meal_consumption(
    'order',
    'a1300000-0000-4000-8000-000000000004',
    'a1200000-0000-4000-8000-000000000002',
    'partial', 50, null,
    'a1500000-0000-4000-8000-000000000005'
  )
);

select is(
  (select (result -> 'nutrition' ->> 'calories')::integer from agent_1_results where result_key = 'partial-edit'),
  310,
  'editing to a partial portion rescales the committed snapshot'
);

insert into agent_1_results (result_key, result)
values (
  'reverse',
  public.record_order_meal_consumption(
    'order',
    'a1300000-0000-4000-8000-000000000004',
    'a1200000-0000-4000-8000-000000000002',
    'reversed', 0, null,
    'a1500000-0000-4000-8000-000000000006'
  )
);

select is(
  (select (result -> 'nutrition' ->> 'calories')::integer from agent_1_results where result_key = 'reverse'),
  0,
  'reversal removes projected nutrition'
);
select is(
  (
    select count(*)
    from public.meal_consumption_events
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  4::bigint,
  'substitute, edit, and reverse append event versions'
);
select is(
  (
    select array_agg(event_version order by event_version)
    from public.meal_consumption_events
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  array[1, 2, 3, 4],
  'consumption event versions are contiguous and ordered'
);
select is(
  (
    select (nutrition_delta ->> 'calories')::integer
    from public.meal_consumption_events
    where source_id = 'a1300000-0000-4000-8000-000000000004'
      and event_version = 4
  ),
  -310,
  'reversal stores a compensating nutrition delta'
);
select is(
  (
    select count(*)
    from public.meal_history
    where source_order_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'reversal removes the current history projection without deleting events'
);
select is(
  (
    select coalesce(calories_consumed, 0)
    from public.progress_logs
    where user_id = 'a1000000-0000-4000-8000-000000000001'
      and log_date = (now() at time zone 'Asia/Qatar')::date
  ),
  0,
  'reversal restores daily projected calories to zero'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)
    from public.meal_consumptions
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'RLS hides another user consumption projection'
);
select is(
  (
    select count(*)
    from public.meal_consumption_events
    where source_id = 'a1300000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'RLS hides another user append-only consumption events'
);

reset role;

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indexrelid
    where i.indrelid = 'public.meal_consumption_events'::regclass
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%user_id%request_id%'
  ),
  'request replay has a database uniqueness backstop'
);
select has_index(
  'public', 'meal_consumption_events', 'uq_meal_consumption_events_semantic_identity',
  'semantic event replay has a database uniqueness backstop'
);

select * from finish();
rollback;
