-- Complete the phase-one nutrition quality contract without rewriting prior migrations.

begin;

alter table public.meals
  add column if not exists calcium_mg numeric(10, 2),
  add column if not exists iron_mg numeric(10, 2),
  add column if not exists vitamin_d_mcg numeric(10, 2),
  add column if not exists vitamin_b12_mcg numeric(10, 2),
  add column if not exists magnesium_mg numeric(10, 2);

alter table public.meal_history
  add column if not exists potassium_mg numeric(10, 2),
  add column if not exists calcium_mg numeric(10, 2),
  add column if not exists iron_mg numeric(10, 2),
  add column if not exists vitamin_d_mcg numeric(10, 2),
  add column if not exists vitamin_b12_mcg numeric(10, 2),
  add column if not exists magnesium_mg numeric(10, 2);

-- Earlier manual logging used zero as a storage default. New writes must be able
-- to state that a nutrient was not measured.
alter table public.meal_history
  alter column fiber_g drop not null,
  alter column fiber_g drop default,
  alter column sugar_g drop not null,
  alter column sugar_g drop default,
  alter column sodium_mg drop not null,
  alter column sodium_mg drop default;

create or replace function public.calculate_nutrient_completeness(p_nutrition jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_required text[] := array['calories', 'protein_g', 'carbs_g', 'fat_g'];
  v_quality text[] := array[
    'fiber_g', 'sugar_g', 'sodium_mg', 'potassium_mg', 'calcium_mg',
    'iron_mg', 'vitamin_d_mcg', 'vitamin_b12_mcg', 'magnesium_mg'
  ];
  v_all text[] := v_required || v_quality;
  v_code text;
  v_value numeric;
  v_present_required integer := 0;
  v_present_quality integer := 0;
  v_missing text[] := array[]::text[];
  v_invalid text[] := array[]::text[];
begin
  foreach v_code in array v_all loop
    if not p_nutrition ? v_code or nullif(btrim(p_nutrition ->> v_code), '') is null then
      v_missing := array_append(v_missing, v_code);
    else
      begin
        v_value := (p_nutrition ->> v_code)::numeric;
        if v_value < 0 then
          v_invalid := array_append(v_invalid, v_code);
        elsif v_code = any(v_required) then
          v_present_required := v_present_required + 1;
        else
          v_present_quality := v_present_quality + 1;
        end if;
      exception when invalid_text_representation or numeric_value_out_of_range then
        v_invalid := array_append(v_invalid, v_code);
      end;
    end if;
  end loop;

  return jsonb_build_object(
    'score', round(
      (v_present_required::numeric / array_length(v_required, 1)) * 70
      + (v_present_quality::numeric / array_length(v_quality, 1)) * 30
    )::integer,
    'missing_codes', v_missing,
    'invalid_codes', v_invalid,
    'required_missing_codes', (
      select coalesce(array_agg(code), array[]::text[])
      from unnest(v_required) as code
      where code = any(v_missing) or code = any(v_invalid)
    )
  );
end;
$$;

create table if not exists public.meal_nutrition_revisions (
  id bigint generated always as identity primary key,
  meal_id uuid not null,
  restaurant_id uuid,
  nutrition_version integer not null check (nutrition_version > 0),
  nutrients jsonb not null,
  provenance jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default now(),
  unique (meal_id, nutrition_version)
);

create index if not exists idx_meal_nutrition_revisions_restaurant
  on public.meal_nutrition_revisions (restaurant_id, created_at desc);

alter table public.meal_nutrition_revisions enable row level security;

drop policy if exists meal_nutrition_revisions_scoped_read on public.meal_nutrition_revisions;
create policy meal_nutrition_revisions_scoped_read
  on public.meal_nutrition_revisions for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    or exists (
      select 1 from public.restaurants r
      where r.id = meal_nutrition_revisions.restaurant_id
        and r.owner_id = (select auth.uid())
    )
  );

grant select on public.meal_nutrition_revisions to authenticated;

create or replace function public.reject_meal_nutrition_revision_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'NUTRITION_REVISION_IMMUTABLE';
end;
$$;

drop trigger if exists trg_immutable_meal_nutrition_revisions on public.meal_nutrition_revisions;
create trigger trg_immutable_meal_nutrition_revisions
before update or delete on public.meal_nutrition_revisions
for each row execute function public.reject_meal_nutrition_revision_mutation();

create table if not exists public.meal_nutrition_corrections (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  requested_version integer not null,
  status text not null default 'requested' check (status in ('requested', 'submitted', 'resolved')),
  reason text not null,
  missing_codes text[] not null default array[]::text[],
  invalid_codes text[] not null default array[]::text[],
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  resolved_at timestamptz
);

create unique index if not exists idx_one_open_meal_nutrition_correction
  on public.meal_nutrition_corrections (meal_id)
  where status in ('requested', 'submitted');

alter table public.meal_nutrition_corrections enable row level security;

drop policy if exists meal_nutrition_corrections_scoped_read on public.meal_nutrition_corrections;
create policy meal_nutrition_corrections_scoped_read
  on public.meal_nutrition_corrections for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    or exists (
      select 1 from public.restaurants r
      where r.id = meal_nutrition_corrections.restaurant_id
        and r.owner_id = (select auth.uid())
    )
  );

grant select on public.meal_nutrition_corrections to authenticated;

create or replace function public.apply_meal_nutrition_quality()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_facts_changed boolean;
  v_source text;
  v_source_record_id text;
  v_nutrients jsonb;
begin
  if tg_op = 'INSERT' then
    v_facts_changed := true;
  else
    v_facts_changed := row(
      new.calories, new.protein_g, new.carbs_g, new.fat_g, new.fiber_g,
      new.sugar_g, new.sodium_mg, new.saturated_fat_g, new.cholesterol_mg,
      new.potassium_mg, new.calcium_mg, new.iron_mg, new.vitamin_d_mcg,
      new.vitamin_b12_mcg, new.magnesium_mg,
      coalesce(new.nutrition_provenance ->> 'source', 'partner_entered'),
      new.nutrition_provenance ->> 'source_record_id'
    ) is distinct from row(
      old.calories, old.protein_g, old.carbs_g, old.fat_g, old.fiber_g,
      old.sugar_g, old.sodium_mg, old.saturated_fat_g, old.cholesterol_mg,
      old.potassium_mg, old.calcium_mg, old.iron_mg, old.vitamin_d_mcg,
      old.vitamin_b12_mcg, old.magnesium_mg,
      coalesce(old.nutrition_provenance ->> 'source', 'partner_entered'),
      old.nutrition_provenance ->> 'source_record_id'
    );
  end if;

  v_result := public.calculate_nutrient_completeness(jsonb_build_object(
    'calories', new.calories,
    'protein_g', new.protein_g,
    'carbs_g', new.carbs_g,
    'fat_g', new.fat_g,
    'fiber_g', new.fiber_g,
    'sugar_g', new.sugar_g,
    'sodium_mg', new.sodium_mg,
    'potassium_mg', new.potassium_mg,
    'calcium_mg', new.calcium_mg,
    'iron_mg', new.iron_mg,
    'vitamin_d_mcg', new.vitamin_d_mcg,
    'vitamin_b12_mcg', new.vitamin_b12_mcg,
    'magnesium_mg', new.magnesium_mg
  ));

  new.nutrient_completeness_score := coalesce((v_result ->> 'score')::integer, 0);
  new.nutrient_missing_codes := coalesce(
    array(select jsonb_array_elements_text(v_result -> 'missing_codes')),
    array[]::text[]
  );
  new.nutrient_invalid_codes := coalesce(
    array(select jsonb_array_elements_text(v_result -> 'invalid_codes')),
    array[]::text[]
  );

  if tg_op = 'INSERT' then
    new.nutrition_version := 1;
  elsif v_facts_changed then
    new.nutrition_version := greatest(coalesce(old.nutrition_version, 1), 1) + 1;
  else
    new.nutrition_version := greatest(coalesce(old.nutrition_version, 1), 1);
  end if;

  v_source := coalesce(nullif(btrim(new.nutrition_provenance ->> 'source'), ''), 'partner_entered');
  v_source_record_id := nullif(btrim(new.nutrition_provenance ->> 'source_record_id'), '');
  if v_source not in (
    'partner_entered', 'nutrition_label_ocr', 'open_food_facts',
    'manual', 'estimated', 'backfilled'
  ) then
    raise exception 'INVALID_NUTRITION_SOURCE';
  end if;
  v_source_record_id := left(v_source_record_id, 120);
  new.nutrition_provenance := jsonb_build_object(
    'source', v_source,
    'source_record_id', v_source_record_id,
    'version', new.nutrition_version,
    'captured_at', case
      when v_facts_changed then now()
      else coalesce(nullif(old.nutrition_provenance ->> 'captured_at', '')::timestamptz, now())
    end
  );

  if v_facts_changed then
    v_nutrients := jsonb_build_object(
      'calories', new.calories,
      'protein_g', new.protein_g,
      'carbs_g', new.carbs_g,
      'fat_g', new.fat_g,
      'fiber_g', new.fiber_g,
      'sugar_g', new.sugar_g,
      'sodium_mg', new.sodium_mg,
      'potassium_mg', new.potassium_mg,
      'calcium_mg', new.calcium_mg,
      'iron_mg', new.iron_mg,
      'vitamin_d_mcg', new.vitamin_d_mcg,
      'vitamin_b12_mcg', new.vitamin_b12_mcg,
      'magnesium_mg', new.magnesium_mg
    );

    insert into public.meal_nutrition_revisions (
      meal_id, restaurant_id, nutrition_version, nutrients, provenance, changed_by
    ) values (
      new.id, new.restaurant_id, new.nutrition_version, v_nutrients,
      new.nutrition_provenance, auth.uid()
    ) on conflict (meal_id, nutrition_version) do nothing;

    if tg_op = 'UPDATE' then
      update public.meal_nutrition_corrections
      set status = case
            when coalesce(array_length(new.nutrient_missing_codes, 1), 0) = 0
              and coalesce(array_length(new.nutrient_invalid_codes, 1), 0) = 0
            then 'submitted'
            else 'requested'
          end,
          submitted_at = case
            when coalesce(array_length(new.nutrient_missing_codes, 1), 0) = 0
              and coalesce(array_length(new.nutrient_invalid_codes, 1), 0) = 0
            then now()
            else null
          end
      where meal_id = new.id and status = 'requested';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_meal_nutrition_quality on public.meals;
create trigger trg_apply_meal_nutrition_quality
before insert or update on public.meals
for each row execute function public.apply_meal_nutrition_quality();

-- Recompute expanded completeness without creating a synthetic nutrition revision.
update public.meals set nutrition_version = nutrition_version;

insert into public.meal_nutrition_revisions (
  meal_id, restaurant_id, nutrition_version, nutrients, provenance, changed_by, created_at
)
select
  m.id,
  m.restaurant_id,
  greatest(coalesce(m.nutrition_version, 1), 1),
  jsonb_build_object(
    'calories', m.calories, 'protein_g', m.protein_g, 'carbs_g', m.carbs_g,
    'fat_g', m.fat_g, 'fiber_g', m.fiber_g, 'sugar_g', m.sugar_g,
    'sodium_mg', m.sodium_mg, 'potassium_mg', m.potassium_mg,
    'calcium_mg', m.calcium_mg, 'iron_mg', m.iron_mg,
    'vitamin_d_mcg', m.vitamin_d_mcg, 'vitamin_b12_mcg', m.vitamin_b12_mcg,
    'magnesium_mg', m.magnesium_mg
  ),
  coalesce(m.nutrition_provenance, '{}'::jsonb) || jsonb_build_object(
    'version', greatest(coalesce(m.nutrition_version, 1), 1),
    'captured_at', coalesce(m.nutrition_provenance ->> 'captured_at', now()::text)
  ),
  null,
  coalesce(nullif(m.nutrition_provenance ->> 'captured_at', '')::timestamptz, now())
from public.meals m
on conflict (meal_id, nutrition_version) do nothing;

create or replace function public.request_meal_nutrition_correction(
  p_meal_id uuid,
  p_reason text default 'Complete or correct the measured nutrition values.'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_meal public.meals%rowtype;
  v_id uuid;
begin
  if v_actor is null or not public.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_meal from public.meals where id = p_meal_id for update;
  if v_meal.id is null then raise exception 'MEAL_NOT_FOUND'; end if;
  if coalesce(array_length(v_meal.nutrient_missing_codes, 1), 0) = 0
    and coalesce(array_length(v_meal.nutrient_invalid_codes, 1), 0) = 0 then
    raise exception 'CORRECTION_NOT_REQUIRED';
  end if;

  insert into public.meal_nutrition_corrections (
    meal_id, restaurant_id, requested_version, reason, missing_codes,
    invalid_codes, requested_by
  ) values (
    v_meal.id, v_meal.restaurant_id, v_meal.nutrition_version,
    left(coalesce(nullif(btrim(p_reason), ''), 'Complete or correct the measured nutrition values.'), 500),
    v_meal.nutrient_missing_codes, v_meal.nutrient_invalid_codes, v_actor
  )
  on conflict (meal_id) where status in ('requested', 'submitted')
  do update set
    requested_version = excluded.requested_version,
    status = 'requested',
    reason = excluded.reason,
    missing_codes = excluded.missing_codes,
    invalid_codes = excluded.invalid_codes,
    requested_by = excluded.requested_by,
    requested_at = now(),
    submitted_at = null
  returning id into v_id;

  update public.meals
  set approval_status = 'pending', is_available = false
  where id = v_meal.id;

  return v_id;
end;
$$;

revoke all on function public.request_meal_nutrition_correction(uuid, text) from public, anon;
grant execute on function public.request_meal_nutrition_correction(uuid, text) to authenticated;

create or replace function public.resolve_meal_nutrition_correction(p_meal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_meal public.meals%rowtype;
begin
  if v_actor is null or not public.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_meal from public.meals where id = p_meal_id for update;
  if v_meal.id is null then raise exception 'MEAL_NOT_FOUND'; end if;
  if coalesce(array_length(v_meal.nutrient_missing_codes, 1), 0) > 0
    or coalesce(array_length(v_meal.nutrient_invalid_codes, 1), 0) > 0 then
    raise exception 'NUTRITION_CORRECTION_INCOMPLETE';
  end if;

  update public.meal_nutrition_corrections
  set status = 'resolved', resolved_at = now()
  where meal_id = p_meal_id and status = 'submitted';
  if not found then raise exception 'SUBMITTED_CORRECTION_NOT_FOUND'; end if;

  update public.meals
  set approval_status = 'approved', is_available = true
  where id = p_meal_id;
end;
$$;

revoke all on function public.resolve_meal_nutrition_correction(uuid) from public, anon;
grant execute on function public.resolve_meal_nutrition_correction(uuid) to authenticated;

drop view if exists public.partner_meal_nutrition_missing_queue;
create view public.partner_meal_nutrition_missing_queue
with (security_invoker = true)
as
select
  m.id as meal_id,
  m.restaurant_id,
  m.name as meal_name,
  m.approval_status,
  m.is_available,
  m.nutrient_completeness_score,
  m.nutrient_missing_codes,
  m.nutrient_invalid_codes,
  m.nutrition_version,
  c.status as correction_status,
  c.reason as correction_reason,
  c.requested_at as updated_at
from public.meals m
left join lateral (
  select correction.status, correction.reason, correction.requested_at
  from public.meal_nutrition_corrections correction
  where correction.meal_id = m.id
    and correction.status in ('requested', 'submitted')
  order by correction.requested_at desc
  limit 1
) c on true
where (
    coalesce(m.nutrient_completeness_score, 0) < 100
    or coalesce(array_length(m.nutrient_invalid_codes, 1), 0) > 0
    or c.status is not null
  )
  and (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    or exists (
      select 1 from public.restaurants r
      where r.id = m.restaurant_id and r.owner_id = (select auth.uid())
    )
  );

grant select on public.partner_meal_nutrition_missing_queue to authenticated;

create or replace function public.get_user_micronutrient_adequacy(
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  nutrient_code text, label_en text, label_ar text, unit text, target numeric,
  direction text, consumed numeric, percentage integer, status text,
  measured_entries integer, missing_entries integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_start date := coalesce(p_start_date, (now() at time zone 'Asia/Qatar')::date);
  v_end date := coalesce(p_end_date, coalesce(p_start_date, (now() at time zone 'Asia/Qatar')::date));
  v_days integer;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if v_start > v_end or v_end > (now() at time zone 'Asia/Qatar')::date
    or v_start < (now() at time zone 'Asia/Qatar')::date - 370 then
    raise exception 'INVALID_DATE_RANGE';
  end if;
  v_days := (v_end - v_start) + 1;

  return query
  with targets as (
    select * from (values
      ('fiber_g', 'Fiber', 'الألياف', 'g', 30::numeric, 'minimum', 1),
      ('sodium_mg', 'Sodium', 'الصوديوم', 'mg', 2300::numeric, 'maximum', 2),
      ('sugar_g', 'Sugar', 'السكر', 'g', 45::numeric, 'maximum', 3),
      ('potassium_mg', 'Potassium', 'البوتاسيوم', 'mg', 3500::numeric, 'minimum', 4),
      ('calcium_mg', 'Calcium', 'الكالسيوم', 'mg', 1000::numeric, 'minimum', 5),
      ('iron_mg', 'Iron', 'الحديد', 'mg', 8::numeric, 'minimum', 6),
      ('vitamin_d_mcg', 'Vitamin D', 'فيتامين د', 'mcg', 15::numeric, 'minimum', 7),
      ('vitamin_b12_mcg', 'Vitamin B12', 'فيتامين ب١٢', 'mcg', 2.4::numeric, 'minimum', 8),
      ('magnesium_mg', 'Magnesium', 'المغنيسيوم', 'mg', 400::numeric, 'minimum', 9)
    ) as t(nutrient_code, label_en, label_ar, unit, daily_target, direction, sort_order)
  ),
  history as (
    select mh.*, mc.nutrition_snapshot,
      (coalesce(mh.logged_at, mh.created_at, now()) at time zone 'Asia/Qatar')::date as local_log_date
    from public.meal_history mh
    left join public.meal_consumptions mc on mc.id = mh.source_consumption_id
    where mh.user_id = v_user_id
  ),
  facts as (
    select h.id, t.nutrient_code,
      case t.nutrient_code
        when 'fiber_g' then h.fiber_g
        when 'sodium_mg' then coalesce(h.sodium_mg, (h.nutrition_snapshot ->> 'sodium_mg')::numeric)
        when 'sugar_g' then coalesce(h.sugar_g, (h.nutrition_snapshot ->> 'sugar_g')::numeric)
        when 'potassium_mg' then coalesce(h.potassium_mg, (r.nutrients ->> 'potassium_mg')::numeric)
        when 'calcium_mg' then coalesce(h.calcium_mg, (r.nutrients ->> 'calcium_mg')::numeric)
        when 'iron_mg' then coalesce(h.iron_mg, (r.nutrients ->> 'iron_mg')::numeric)
        when 'vitamin_d_mcg' then coalesce(h.vitamin_d_mcg, (r.nutrients ->> 'vitamin_d_mcg')::numeric)
        when 'vitamin_b12_mcg' then coalesce(h.vitamin_b12_mcg, (r.nutrients ->> 'vitamin_b12_mcg')::numeric)
        when 'magnesium_mg' then coalesce(h.magnesium_mg, (r.nutrients ->> 'magnesium_mg')::numeric)
      end as value
    from history h
    cross join targets t
    left join public.meal_nutrition_revisions r
      on r.meal_id = h.source_meal_id
      and r.nutrition_version = nullif(h.nutrition_snapshot ->> 'nutrition_version', '')::integer
    where h.local_log_date between v_start and v_end
  ),
  aggregated as (
    select f.nutrient_code,
      sum(f.value) filter (where f.value is not null) as consumed,
      count(*) filter (where f.value is not null) as measured_entries,
      count(*) filter (where f.value is null) as missing_entries
    from facts f group by f.nutrient_code
  )
  select t.nutrient_code, t.label_en, t.label_ar, t.unit,
    round(t.daily_target * v_days, 2) as target, t.direction,
    round(a.consumed, 2) as consumed,
    case when coalesce(a.measured_entries, 0) = 0 then null
      else round((a.consumed / nullif(t.daily_target * v_days, 0)) * 100)::integer end as percentage,
    case when coalesce(a.measured_entries, 0) = 0 then 'missing'
      when t.direction = 'minimum' and a.consumed >= t.daily_target * v_days then 'on_track'
      when t.direction = 'minimum' then 'low'
      when a.consumed <= t.daily_target * v_days then 'on_track'
      else 'over_limit' end as status,
    coalesce(a.measured_entries, 0)::integer,
    coalesce(a.missing_entries, 0)::integer
  from targets t left join aggregated a using (nutrient_code)
  order by t.sort_order;
end;
$$;

grant execute on function public.get_user_micronutrient_adequacy(date, date) to authenticated;

commit;
