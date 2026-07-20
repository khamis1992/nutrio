-- Agent 0 integration fix: align Agent 1 order-consumption facts with ADR 0001
-- and ADR 0002 without rewriting the already-applied Agent 1 migration.

begin;

alter table public.meals
  add column if not exists sugar_g numeric(8, 2),
  add column if not exists sodium_mg numeric(10, 2),
  add column if not exists saturated_fat_g numeric(8, 2),
  add column if not exists cholesterol_mg numeric(10, 2),
  add column if not exists potassium_mg numeric(10, 2),
  add column if not exists nutrition_version integer not null default 1,
  add column if not exists nutrition_provenance jsonb not null default jsonb_build_object(
    'source', 'partner_entered',
    'source_record_id', null,
    'version', 1
  ),
  add column if not exists nutrient_completeness_score integer not null default 0 check (nutrient_completeness_score between 0 and 100),
  add column if not exists nutrient_missing_codes text[] not null default array[]::text[],
  add column if not exists nutrient_invalid_codes text[] not null default array[]::text[];

alter table public.meal_consumptions
  add column if not exists portion numeric(6, 5)
    generated always as (round((portion_percent / 100.0)::numeric, 5)) stored,
  add column if not exists source_snapshot jsonb,
  add column if not exists semantic_idempotency_key text;

alter table public.meal_consumption_events
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists source_meal_id uuid,
  add column if not exists event_type text not null default 'consumed',
  add column if not exists semantic_idempotency_key text;

create or replace function public.get_meal_nutrition_snapshot(p_meal_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with meal_row as (
    select
      m.*,
      coalesce(m.protein_g, m.protein) as canonical_protein_g,
      coalesce(m.carbs_g, m.carbs) as canonical_carbs_g,
      coalesce(m.fat_g, m.fats) as canonical_fat_g
    from public.meals m
    where m.id = p_meal_id
  ),
  missing as (
    select
      mr.id,
      array_remove(array[
        case when mr.calories is null then 'calories' end,
        case when mr.canonical_protein_g is null then 'protein_g' end,
        case when mr.canonical_carbs_g is null then 'carbs_g' end,
        case when mr.canonical_fat_g is null then 'fat_g' end,
        case when mr.fiber_g is null then 'fiber_g' end,
        case when mr.sugar_g is null then 'sugar_g' end,
        case when mr.sodium_mg is null then 'sodium_mg' end
      ], null)::text[] as missing_codes
    from meal_row mr
  ),
  allergens as (
    select
      ma.meal_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', at.id,
            'name', at.name,
            'name_ar', at.name_ar,
            'severity', at.severity
          )
          order by at.name
        ) filter (where at.id is not null),
        '[]'::jsonb
      ) as allergen_items
    from public.meal_allergens ma
    left join public.allergen_tags at on at.id = ma.allergen_id
    where ma.meal_id = p_meal_id
    group by ma.meal_id
  ),
  diet_attrs as (
    select
      mdt.meal_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', dt.id,
            'name', dt.name
          )
          order by dt.name
        ) filter (where dt.id is not null),
        '[]'::jsonb
      ) as diet_items
    from public.meal_diet_tags mdt
    left join public.diet_tags dt on dt.id = mdt.diet_tag_id
    where mdt.meal_id = p_meal_id
    group by mdt.meal_id
  )
  select jsonb_build_object(
    'schema_version', 2,
    'meal_id', mr.id,
    'order_item_id', null,
    'meal_name', mr.name,
    'image_url', mr.image_url,
    'serving_quantity', 1,
    'serving_unit', 'meal',
    'calories', mr.calories,
    'protein_g', mr.canonical_protein_g,
    'carbs_g', mr.canonical_carbs_g,
    'fat_g', mr.canonical_fat_g,
    'fiber_g', mr.fiber_g,
    'sugar_g', mr.sugar_g,
    'sodium_mg', mr.sodium_mg,
    'saturated_fat_g', mr.saturated_fat_g,
    'cholesterol_mg', mr.cholesterol_mg,
    'potassium_mg', mr.potassium_mg,
    'micronutrients', jsonb_build_array(
      jsonb_build_object('nutrient_code', 'sodium_mg', 'value', mr.sodium_mg, 'unit', 'mg'),
      jsonb_build_object('nutrient_code', 'potassium_mg', 'value', mr.potassium_mg, 'unit', 'mg'),
      jsonb_build_object('nutrient_code', 'cholesterol_mg', 'value', mr.cholesterol_mg, 'unit', 'mg')
    ),
    'allergens', coalesce(a.allergen_items, '[]'::jsonb),
    'diet_attributes', coalesce(d.diet_items, '[]'::jsonb),
    'nutrition_version', greatest(coalesce(mr.nutrition_version, 1), 1),
    'provenance', coalesce(mr.nutrition_provenance, '{}'::jsonb) || jsonb_build_object(
      'source_type', 'meal',
      'source_record_id', mr.id,
      'captured_at', now()
    ),
    'captured_at', now(),
    'completeness_score', coalesce(mr.nutrient_completeness_score, 0),
    'missing_nutrient_codes', coalesce(nullif(mr.nutrient_missing_codes, array[]::text[]), m.missing_codes),
    'invalid_nutrient_codes', coalesce(mr.nutrient_invalid_codes, array[]::text[]),
    'backfill_provenance', null
  )
  from meal_row mr
  join missing m on m.id = mr.id
  left join allergens a on a.meal_id = mr.id
  left join diet_attrs d on d.meal_id = mr.id;
$$;

revoke all on function public.get_meal_nutrition_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.get_meal_nutrition_snapshot(uuid) to service_role;

create or replace function public.set_order_item_nutrition_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
begin
  if tg_op = 'insert' then
    v_snapshot := public.get_meal_nutrition_snapshot(new.meal_id);
  elsif new.meal_id is distinct from old.meal_id
     or new.quantity is distinct from old.quantity then
    v_snapshot := public.get_meal_nutrition_snapshot(new.meal_id);
  else
    new.nutrition_snapshot := old.nutrition_snapshot;
    return new;
  end if;

  if v_snapshot is null then
    new.nutrition_snapshot := null;
  else
    new.nutrition_snapshot := v_snapshot || jsonb_build_object(
      'order_item_id', new.id,
      'serving_quantity', greatest(coalesce(new.quantity, 1), 1),
      'serving_unit', 'meal',
      'source_type', 'order_item',
      'source_record_id', new.id
    );
  end if;

  return new;
end;
$$;

create or replace function public.set_schedule_nutrition_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
begin
  if tg_op = 'insert' then
    v_snapshot := public.get_meal_nutrition_snapshot(new.meal_id);
  elsif new.meal_id is distinct from old.meal_id then
    v_snapshot := public.get_meal_nutrition_snapshot(new.meal_id);
  else
    new.nutrition_snapshot := old.nutrition_snapshot;
    return new;
  end if;

  if v_snapshot is null then
    new.nutrition_snapshot := null;
  else
    new.nutrition_snapshot := v_snapshot || jsonb_build_object(
      'source_type', 'meal_schedule',
      'source_record_id', new.id
    );
  end if;

  return new;
end;
$$;

update public.order_items oi
set nutrition_snapshot = public.get_meal_nutrition_snapshot(oi.meal_id) || jsonb_build_object(
  'order_item_id', oi.id,
  'serving_quantity', greatest(coalesce(oi.quantity, 1), 1),
  'serving_unit', 'meal',
  'source_type', 'order_item',
  'source_record_id', oi.id,
  'backfill_provenance', jsonb_build_object(
    'kind', 'post_commit_contract_alignment',
    'captured_at', now(),
    'original_snapshot', oi.nutrition_snapshot
  )
)
where oi.meal_id is not null
  and (
    oi.nutrition_snapshot is null
    or coalesce((oi.nutrition_snapshot ->> 'schema_version')::integer, 1) < 2
    or not (oi.nutrition_snapshot ? 'missing_nutrient_codes')
  );

update public.meal_schedules ms
set nutrition_snapshot = public.get_meal_nutrition_snapshot(ms.meal_id) || jsonb_build_object(
  'source_type', 'meal_schedule',
  'source_record_id', ms.id,
  'backfill_provenance', jsonb_build_object(
    'kind', 'schedule_forecast_contract_alignment',
    'captured_at', now(),
    'original_snapshot', ms.nutrition_snapshot
  )
)
where ms.meal_id is not null
  and (
    ms.nutrition_snapshot is null
    or coalesce((ms.nutrition_snapshot ->> 'schema_version')::integer, 1) < 2
    or not (ms.nutrition_snapshot ? 'missing_nutrient_codes')
  );

update public.meal_consumptions mc
set
  source_snapshot = coalesce(source_snapshot, nutrition_snapshot),
  semantic_idempotency_key = coalesce(
    semantic_idempotency_key,
    concat_ws(':', user_id::text, source_type, source_id::text, source_meal_id::text, status, event_version::text)
  );

update public.meal_consumption_events mce
set
  source_type = coalesce(mce.source_type, mc.source_type),
  source_id = coalesce(mce.source_id, mc.source_id),
  source_meal_id = coalesce(mce.source_meal_id, mc.source_meal_id),
  event_type = coalesce(nullif(mce.event_type, ''), mc.status, 'consumed'),
  semantic_idempotency_key = coalesce(
    mce.semantic_idempotency_key,
    concat_ws(':', mce.user_id::text, mc.source_type, mc.source_id::text, mc.source_meal_id::text, coalesce(nullif(mce.event_type, ''), mc.status, 'consumed'), mce.event_version::text)
  )
from public.meal_consumptions mc
where mc.id = mce.consumption_id;

create unique index if not exists uq_meal_consumption_events_semantic_identity
  on public.meal_consumption_events (
    user_id,
    source_type,
    source_id,
    source_meal_id,
    event_type,
    event_version
  )
  where source_type is not null
    and source_id is not null
    and source_meal_id is not null;

create or replace function public.record_order_meal_consumption(
  p_source_type text,
  p_source_id uuid,
  p_source_meal_id uuid,
  p_status text,
  p_portion_percent numeric default 100,
  p_substitute_meal_id uuid default null,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_source_type text := lower(coalesce(p_source_type, ''));
  v_status text := lower(coalesce(p_status, ''));
  v_event_type text;
  v_portion numeric(6, 5);
  v_source_snapshot jsonb;
  v_effective_snapshot jsonb;
  v_order public.orders%rowtype;
  v_consumption public.meal_consumptions%rowtype;
  v_existing_result jsonb;
  v_consumption_id uuid;
  v_event_version integer;
  v_log_date date := (now() at time zone 'Asia/Qatar')::date;
  v_old_log_date date;
  v_old_calories integer := 0;
  v_old_protein integer := 0;
  v_old_carbs integer := 0;
  v_old_fat integer := 0;
  v_old_fiber integer := 0;
  v_new_calories integer := 0;
  v_new_protein integer := 0;
  v_new_carbs integer := 0;
  v_new_fat integer := 0;
  v_new_fiber integer := 0;
  v_history_id uuid;
  v_result jsonb;
  v_previous_state jsonb;
  v_current_state jsonb;
  v_semantic_key text;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_request_id is null then
    raise exception 'REQUEST_ID_REQUIRED';
  end if;
  if v_source_type not in ('order', 'meal_schedule') then
    raise exception 'INVALID_CONSUMPTION_SOURCE';
  end if;
  if v_status not in ('full', 'partial', 'skipped', 'substituted', 'reversed') then
    raise exception 'INVALID_CONSUMPTION_STATUS';
  end if;

  perform 1
  from public.profiles p
  where p.user_id = v_actor
  for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_request_id::text, 0));
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || v_source_type || ':' || p_source_id::text || ':' || p_source_meal_id::text, 0)
  );

  select mce.result_snapshot
  into v_existing_result
  from public.meal_consumption_events mce
  where mce.user_id = v_actor
    and mce.request_id = p_request_id;

  if found then
    return v_existing_result || jsonb_build_object('already_processed', true);
  end if;

  if v_source_type = 'meal_schedule' then
    select coalesce(ms.nutrition_snapshot, public.get_meal_nutrition_snapshot(ms.meal_id))
    into v_source_snapshot
    from public.meal_schedules ms
    where ms.id = p_source_id
      and ms.user_id = v_actor
      and ms.meal_id = p_source_meal_id
      and ms.order_status in ('delivered', 'completed')
    for update of ms;

    if not found then
      raise exception 'DELIVERED_SCHEDULE_NOT_FOUND';
    end if;
  else
    select *
    into v_order
    from public.orders o
    where o.id = p_source_id
      and o.user_id = v_actor
      and o.status::text in ('delivered', 'completed')
    for update;

    if not found then
      raise exception 'DELIVERED_ORDER_NOT_FOUND';
    end if;

    select jsonb_build_object(
      'schema_version', 2,
      'meal_id', p_source_meal_id,
      'order_item_ids', jsonb_agg(oi.id order by oi.id),
      'meal_name', max(coalesce(oi.nutrition_snapshot ->> 'meal_name', oi.meal_name, m.name)),
      'image_url', max(coalesce(oi.nutrition_snapshot ->> 'image_url', m.image_url)),
      'serving_quantity', sum(greatest(coalesce(oi.quantity, 1), 1)),
      'serving_unit', 'meal',
      'calories', sum(coalesce((oi.nutrition_snapshot ->> 'calories')::numeric, m.calories) * greatest(coalesce(oi.quantity, 1), 1)),
      'protein_g', sum(coalesce((oi.nutrition_snapshot ->> 'protein_g')::numeric, m.protein_g, m.protein) * greatest(coalesce(oi.quantity, 1), 1)),
      'carbs_g', sum(coalesce((oi.nutrition_snapshot ->> 'carbs_g')::numeric, m.carbs_g, m.carbs) * greatest(coalesce(oi.quantity, 1), 1)),
      'fat_g', sum(coalesce((oi.nutrition_snapshot ->> 'fat_g')::numeric, m.fat_g, m.fats) * greatest(coalesce(oi.quantity, 1), 1)),
      'fiber_g', sum(coalesce((oi.nutrition_snapshot ->> 'fiber_g')::numeric, m.fiber_g) * greatest(coalesce(oi.quantity, 1), 1)),
      'sugar_g', sum(coalesce((oi.nutrition_snapshot ->> 'sugar_g')::numeric, m.sugar_g) * greatest(coalesce(oi.quantity, 1), 1)),
      'sodium_mg', sum(coalesce((oi.nutrition_snapshot ->> 'sodium_mg')::numeric, m.sodium_mg) * greatest(coalesce(oi.quantity, 1), 1)),
      'captured_at', min(coalesce(oi.nutrition_snapshot ->> 'captured_at', oi.created_at::text)),
      'source_type', 'order',
      'source_record_id', p_source_id,
      'missing_nutrient_codes', (
        select coalesce(jsonb_agg(distinct code), '[]'::jsonb)
        from (
          select jsonb_array_elements_text(coalesce(oi2.nutrition_snapshot -> 'missing_nutrient_codes', '[]'::jsonb)) as code
          from public.order_items oi2
          where oi2.order_id = p_source_id
            and oi2.meal_id = p_source_meal_id
        ) missing_codes
      )
    )
    into v_source_snapshot
    from public.order_items oi
    left join public.meals m on m.id = oi.meal_id
    where oi.order_id = p_source_id
      and oi.meal_id = p_source_meal_id
    having count(*) > 0;

    if v_source_snapshot is null and v_order.meal_id = p_source_meal_id then
      v_source_snapshot := public.get_meal_nutrition_snapshot(v_order.meal_id);
    end if;

    if v_source_snapshot is null then
      raise exception 'MEAL_NOT_IN_ORDER';
    end if;
  end if;

  if v_status = 'full' then
    p_portion_percent := 100;
    p_substitute_meal_id := null;
    v_event_type := 'consumed';
  elsif v_status = 'partial' then
    if p_portion_percent is null or p_portion_percent <= 0 or p_portion_percent >= 100 then
      raise exception 'PARTIAL_PORTION_MUST_BE_BETWEEN_0_AND_100';
    end if;
    p_substitute_meal_id := null;
    v_event_type := 'consumed';
  elsif v_status = 'substituted' then
    if p_substitute_meal_id is null or p_substitute_meal_id = p_source_meal_id then
      raise exception 'SUBSTITUTE_MEAL_REQUIRED';
    end if;
    if p_portion_percent is null or p_portion_percent <= 0 or p_portion_percent > 100 then
      raise exception 'INVALID_PORTION_PERCENT';
    end if;
    v_event_type := 'substituted';
  elsif v_status = 'reversed' then
    p_portion_percent := 0;
    p_substitute_meal_id := null;
    v_event_type := 'reversed';
  else
    p_portion_percent := 0;
    p_substitute_meal_id := null;
    v_event_type := 'skipped';
  end if;

  v_portion := round((p_portion_percent / 100.0)::numeric, 5);

  if v_status = 'substituted' then
    v_effective_snapshot := public.get_meal_nutrition_snapshot(p_substitute_meal_id);
    if v_effective_snapshot is null then
      raise exception 'SUBSTITUTE_MEAL_NOT_FOUND';
    end if;
    v_effective_snapshot := v_effective_snapshot || jsonb_build_object(
      'original_meal_id', p_source_meal_id,
      'substitute_meal_id', p_substitute_meal_id,
      'substitution_source_snapshot', v_source_snapshot
    );
  else
    v_effective_snapshot := v_source_snapshot;
  end if;

  select *
  into v_consumption
  from public.meal_consumptions mc
  where mc.user_id = v_actor
    and mc.source_type = v_source_type
    and mc.source_id = p_source_id
    and mc.source_meal_id = p_source_meal_id
  for update;

  if found then
    if v_consumption.status = v_status
      and v_consumption.portion_percent = p_portion_percent
      and v_consumption.substitute_meal_id is not distinct from p_substitute_meal_id then
      return jsonb_build_object(
        'success', true,
        'already_processed', true,
        'consumption_id', v_consumption.id,
        'event_version', v_consumption.event_version,
        'status', v_consumption.status,
        'portion_percent', v_consumption.portion_percent,
        'portion', round((v_consumption.portion_percent / 100.0)::numeric, 5),
        'nutrition', jsonb_build_object(
          'calories', v_consumption.applied_calories,
          'protein_g', v_consumption.applied_protein_g,
          'carbs_g', v_consumption.applied_carbs_g,
          'fat_g', v_consumption.applied_fat_g,
          'fiber_g', v_consumption.applied_fiber_g
        )
      );
    end if;

    v_consumption_id := v_consumption.id;
    v_event_version := v_consumption.event_version + 1;
    v_old_log_date := v_consumption.log_date;
    v_old_calories := v_consumption.applied_calories;
    v_old_protein := v_consumption.applied_protein_g;
    v_old_carbs := v_consumption.applied_carbs_g;
    v_old_fat := v_consumption.applied_fat_g;
    v_old_fiber := v_consumption.applied_fiber_g;
    v_previous_state := jsonb_build_object(
      'status', v_consumption.status,
      'portion_percent', v_consumption.portion_percent,
      'portion', round((v_consumption.portion_percent / 100.0)::numeric, 5),
      'substitute_meal_id', v_consumption.substitute_meal_id,
      'log_date', v_consumption.log_date
    );
  else
    v_consumption_id := gen_random_uuid();
    v_event_version := 1;
    v_old_log_date := v_log_date;
    v_previous_state := null;
  end if;

  v_semantic_key := concat_ws(':', v_actor::text, v_source_type, p_source_id::text, p_source_meal_id::text, v_event_type, v_event_version::text);

  if p_portion_percent > 0 then
    v_new_calories := round(coalesce((v_effective_snapshot ->> 'calories')::numeric, 0) * v_portion)::integer;
    v_new_protein := round(coalesce((v_effective_snapshot ->> 'protein_g')::numeric, 0) * v_portion)::integer;
    v_new_carbs := round(coalesce((v_effective_snapshot ->> 'carbs_g')::numeric, 0) * v_portion)::integer;
    v_new_fat := round(coalesce((v_effective_snapshot ->> 'fat_g')::numeric, 0) * v_portion)::integer;
    v_new_fiber := round(coalesce((v_effective_snapshot ->> 'fiber_g')::numeric, 0) * v_portion)::integer;
  end if;

  if v_old_calories + v_old_protein + v_old_carbs + v_old_fat + v_old_fiber > 0 then
    update public.progress_logs
    set calories_consumed = greatest(0, coalesce(calories_consumed, 0) - v_old_calories),
        protein_consumed_g = greatest(0, coalesce(protein_consumed_g, 0) - v_old_protein),
        carbs_consumed_g = greatest(0, coalesce(carbs_consumed_g, 0) - v_old_carbs),
        fat_consumed_g = greatest(0, coalesce(fat_consumed_g, 0) - v_old_fat),
        fiber_consumed_g = greatest(0, coalesce(fiber_consumed_g, 0) - v_old_fiber),
        updated_at = now()
    where user_id = v_actor
      and log_date = v_old_log_date;
  end if;

  if v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 then
    insert into public.progress_logs (
      user_id, log_date, calories_consumed, protein_consumed_g,
      carbs_consumed_g, fat_consumed_g, fiber_consumed_g, created_at, updated_at
    ) values (
      v_actor, v_log_date, v_new_calories, v_new_protein,
      v_new_carbs, v_new_fat, v_new_fiber, now(), now()
    )
    on conflict (user_id, log_date) do update
    set calories_consumed = coalesce(public.progress_logs.calories_consumed, 0) + excluded.calories_consumed,
        protein_consumed_g = coalesce(public.progress_logs.protein_consumed_g, 0) + excluded.protein_consumed_g,
        carbs_consumed_g = coalesce(public.progress_logs.carbs_consumed_g, 0) + excluded.carbs_consumed_g,
        fat_consumed_g = coalesce(public.progress_logs.fat_consumed_g, 0) + excluded.fat_consumed_g,
        fiber_consumed_g = coalesce(public.progress_logs.fiber_consumed_g, 0) + excluded.fiber_consumed_g,
        updated_at = now();
  end if;

  if v_consumption.id is null then
    insert into public.meal_consumptions (
      id, user_id, source_type, source_id, source_meal_id, status,
      portion_percent, substitute_meal_id, nutrition_snapshot, source_snapshot,
      applied_calories, applied_protein_g, applied_carbs_g, applied_fat_g,
      applied_fiber_g, log_date, event_version, semantic_idempotency_key,
      created_at, updated_at
    ) values (
      v_consumption_id, v_actor, v_source_type, p_source_id, p_source_meal_id, v_status,
      p_portion_percent, p_substitute_meal_id, v_effective_snapshot, v_source_snapshot,
      v_new_calories, v_new_protein, v_new_carbs, v_new_fat,
      v_new_fiber, v_log_date, v_event_version, v_semantic_key, now(), now()
    );
  else
    update public.meal_consumptions
    set status = v_status,
        portion_percent = p_portion_percent,
        substitute_meal_id = p_substitute_meal_id,
        nutrition_snapshot = v_effective_snapshot,
        source_snapshot = v_source_snapshot,
        applied_calories = v_new_calories,
        applied_protein_g = v_new_protein,
        applied_carbs_g = v_new_carbs,
        applied_fat_g = v_new_fat,
        applied_fiber_g = v_new_fiber,
        log_date = v_log_date,
        event_version = v_event_version,
        semantic_idempotency_key = v_semantic_key,
        updated_at = now()
    where id = v_consumption_id;
  end if;

  select mh.id
  into v_history_id
  from public.meal_history mh
  where mh.source_consumption_id = v_consumption_id
  for update;

  if v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 then
    if v_history_id is null then
      insert into public.meal_history (
        user_id, name, calories, protein_g, carbs_g, fat_g, fiber_g, image_url,
        logged_at, source, schedule_id, source_order_id, source_meal_id,
        source_consumption_id
      ) values (
        v_actor,
        coalesce(v_effective_snapshot ->> 'meal_name', 'Meal'),
        v_new_calories,
        v_new_protein,
        v_new_carbs,
        v_new_fat,
        v_new_fiber,
        nullif(v_effective_snapshot ->> 'image_url', ''),
        now(),
        'order_consumption',
        case when v_source_type = 'meal_schedule' then p_source_id else null end,
        case when v_source_type = 'order' then p_source_id else null end,
        p_source_meal_id,
        v_consumption_id
      )
      returning id into v_history_id;
    else
      update public.meal_history
      set name = coalesce(v_effective_snapshot ->> 'meal_name', name),
          calories = v_new_calories,
          protein_g = v_new_protein,
          carbs_g = v_new_carbs,
          fat_g = v_new_fat,
          fiber_g = v_new_fiber,
          image_url = nullif(v_effective_snapshot ->> 'image_url', ''),
          logged_at = now(),
          source = 'order_consumption'
      where id = v_history_id;
    end if;
  elsif v_history_id is not null then
    update public.meal_history set fiber_g = 0 where id = v_history_id;
    delete from public.meal_history where id = v_history_id;
    v_history_id := null;
  end if;

  update public.meal_consumptions
  set meal_history_id = v_history_id
  where id = v_consumption_id;

  if v_source_type = 'meal_schedule' then
    update public.meal_schedules
    set is_completed = v_status in ('full', 'partial', 'substituted'),
        completed_at = case when v_status in ('full', 'partial', 'substituted') then now() else null end,
        updated_at = now()
    where id = p_source_id
      and user_id = v_actor;
  end if;

  update public.profiles p
  set total_meals_logged = counts.meal_count,
      updated_at = now()
  from (
    select count(*)::integer as meal_count
    from public.meal_history mh
    where mh.user_id = v_actor
  ) counts
  where p.user_id = v_actor;

  if v_old_calories + v_old_protein + v_old_carbs + v_old_fat + v_old_fiber = 0
    and v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 then
    perform public.award_xp(
      v_actor,
      10,
      'Delivered meal logged',
      'delivered_meal_log',
      v_consumption_id::text,
      jsonb_build_object(
        'consumption_id', v_consumption_id,
        'source_type', v_source_type,
        'source_id', p_source_id,
        'source_meal_id', p_source_meal_id
      )
    );
  end if;

  v_current_state := jsonb_build_object(
    'status', v_status,
    'portion_percent', p_portion_percent,
    'portion', v_portion,
    'substitute_meal_id', p_substitute_meal_id,
    'log_date', v_log_date
  );

  v_result := jsonb_build_object(
    'success', true,
    'already_processed', false,
    'consumption_id', v_consumption_id,
    'meal_history_id', v_history_id,
    'event_version', v_event_version,
    'event_type', v_event_type,
    'semantic_idempotency_key', v_semantic_key,
    'status', v_status,
    'portion_percent', p_portion_percent,
    'portion', v_portion,
    'nutrition', jsonb_build_object(
      'calories', v_new_calories,
      'protein_g', v_new_protein,
      'carbs_g', v_new_carbs,
      'fat_g', v_new_fat,
      'fiber_g', v_new_fiber
    )
  );

  insert into public.meal_consumption_events (
    consumption_id, user_id, request_id, event_version, previous_state,
    current_state, nutrition_delta, result_snapshot,
    source_type, source_id, source_meal_id, event_type, semantic_idempotency_key
  ) values (
    v_consumption_id,
    v_actor,
    p_request_id,
    v_event_version,
    v_previous_state,
    v_current_state,
    jsonb_build_object(
      'calories', v_new_calories - v_old_calories,
      'protein_g', v_new_protein - v_old_protein,
      'carbs_g', v_new_carbs - v_old_carbs,
      'fat_g', v_new_fat - v_old_fat,
      'fiber_g', v_new_fiber - v_old_fiber
    ),
    v_result,
    v_source_type,
    p_source_id,
    p_source_meal_id,
    v_event_type,
    v_semantic_key
  );

  update public.notifications
  set status = 'read',
      read_at = coalesce(read_at, now())
  where user_id = v_actor
    and type::text = 'order_delivered'
    and related_entity_id = p_source_id
    and data ->> 'meal_id' = p_source_meal_id::text;

  if v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 then
    perform public.check_and_award_badges(v_actor);
  end if;

  return v_result;
end;
$$;

revoke all on function public.record_order_meal_consumption(text, uuid, uuid, text, numeric, uuid, uuid)
  from public, anon;
grant execute on function public.record_order_meal_consumption(text, uuid, uuid, text, numeric, uuid, uuid)
  to authenticated;

commit;
