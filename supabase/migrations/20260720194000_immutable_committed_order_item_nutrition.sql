-- Close the phase-one gap between mutable cart items and immutable committed
-- order nutrition without rewriting snapshots that were already captured.

begin;

alter table public.order_items
  add column if not exists nutrition_snapshot_committed_at timestamptz,
  add column if not exists nutrition_snapshot_revision integer;

alter table public.orders
  add column if not exists order_items_committed_at timestamptz;

create or replace function public.is_committed_order_status(p_status text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(p_status, '') in (
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'completed'
  );
$$;

revoke all on function public.is_committed_order_status(text) from public, anon, authenticated;
grant execute on function public.is_committed_order_status(text) to service_role;

create or replace function public.order_item_snapshot_revision(p_snapshot jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_snapshot ->> 'nutrition_version' ~ '^[1-9][0-9]*$'
      then (p_snapshot ->> 'nutrition_version')::integer
    else 1
  end;
$$;

revoke all on function public.order_item_snapshot_revision(jsonb) from public, anon, authenticated;
grant execute on function public.order_item_snapshot_revision(jsonb) to service_role;

create or replace function public.build_order_item_nutrition_snapshot(
  p_order_item_id uuid,
  p_meal_id uuid,
  p_meal_name text,
  p_quantity integer,
  p_captured_at timestamptz default now(),
  p_backfill_kind text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
  v_backfill jsonb := 'null'::jsonb;
begin
  if p_meal_id is not null then
    v_snapshot := public.get_meal_nutrition_snapshot(p_meal_id);
  end if;

  if p_backfill_kind is not null then
    v_backfill := jsonb_build_object(
      'kind', p_backfill_kind,
      'captured_at', p_captured_at
    );
  end if;

  if v_snapshot is null then
    v_snapshot := jsonb_build_object(
      'schema_version', 2,
      'meal_id', p_meal_id,
      'meal_name', coalesce(p_meal_name, 'Legacy order item'),
      'image_url', null,
      'calories', null,
      'protein_g', null,
      'carbs_g', null,
      'fat_g', null,
      'fiber_g', null,
      'sugar_g', null,
      'sodium_mg', null,
      'micronutrients', '[]'::jsonb,
      'allergens', '[]'::jsonb,
      'diet_attributes', '[]'::jsonb,
      'nutrition_version', 1,
      'provenance', jsonb_build_object(
        'source', 'legacy_order_item',
        'source_type', 'order_item',
        'source_record_id', p_order_item_id,
        'captured_at', p_captured_at
      ),
      'captured_at', p_captured_at,
      'completeness_score', 0,
      'missing_nutrient_codes', jsonb_build_array(
        'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'
      ),
      'invalid_nutrient_codes', '[]'::jsonb
    );
  end if;

  return v_snapshot || jsonb_build_object(
    'order_item_id', p_order_item_id,
    'serving_quantity', greatest(coalesce(p_quantity, 1), 1),
    'serving_unit', 'meal',
    'source_type', 'order_item',
    'source_record_id', p_order_item_id,
    'backfill_provenance', v_backfill
  );
end;
$$;

revoke all on function public.build_order_item_nutrition_snapshot(uuid, uuid, text, integer, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.build_order_item_nutrition_snapshot(uuid, uuid, text, integer, timestamptz, text)
  to service_role;

create or replace function public.set_order_item_nutrition_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
begin
  -- Match the lock order used by an orders UPDATE: parent row first, then the
  -- advisory key. SELECT FOR UPDATE also refreshes a waiter to the latest row.
  perform 1
  from public.orders o
  where o.id = new.order_id
  for update of o;

  perform pg_advisory_xact_lock(
    hashtextextended('order-item-commit:' || new.order_id::text, 0)
  );

  if tg_op = 'UPDATE' then
    if old.nutrition_snapshot_committed_at is not null then
      if new.order_id is distinct from old.order_id
        or new.meal_id is distinct from old.meal_id
        or new.quantity is distinct from old.quantity
        or new.nutrition_snapshot is distinct from old.nutrition_snapshot
        or new.nutrition_snapshot_committed_at is distinct from old.nutrition_snapshot_committed_at
        or new.nutrition_snapshot_revision is distinct from old.nutrition_snapshot_revision then
        raise exception 'COMMITTED_ORDER_ITEM_NUTRITION_IMMUTABLE';
      end if;

      new.nutrition_snapshot := old.nutrition_snapshot;
      new.nutrition_snapshot_committed_at := old.nutrition_snapshot_committed_at;
      new.nutrition_snapshot_revision := old.nutrition_snapshot_revision;
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    v_snapshot := public.build_order_item_nutrition_snapshot(
      new.id,
      new.meal_id,
      new.meal_name,
      new.quantity,
      coalesce(new.created_at, now()),
      null
    );
    new.nutrition_snapshot := v_snapshot;
    new.nutrition_snapshot_revision := public.order_item_snapshot_revision(v_snapshot);
  elsif old.nutrition_snapshot_committed_at is null
    and new.nutrition_snapshot_committed_at is not null then
    -- The order commitment trigger is the final authority for the commercial
    -- nutrition record. Accept its freshly captured catalog snapshot once;
    -- subsequent updates are rejected by the committed branch above.
    new.nutrition_snapshot_revision := public.order_item_snapshot_revision(
      new.nutrition_snapshot
    );
  elsif new.order_id is distinct from old.order_id
    or new.meal_id is distinct from old.meal_id
    or new.quantity is distinct from old.quantity
    or old.nutrition_snapshot is null then
    v_snapshot := public.build_order_item_nutrition_snapshot(
      new.id,
      new.meal_id,
      new.meal_name,
      new.quantity,
      coalesce(new.created_at, now()),
      null
    );
    new.nutrition_snapshot := v_snapshot;
    new.nutrition_snapshot_revision := public.order_item_snapshot_revision(v_snapshot);
  else
    new.nutrition_snapshot := old.nutrition_snapshot;
    new.nutrition_snapshot_revision := coalesce(
      old.nutrition_snapshot_revision,
      new.nutrition_snapshot_revision,
      public.order_item_snapshot_revision(old.nutrition_snapshot)
    );
  end if;

  return new;
end;
$$;

create or replace function public.enforce_committed_order_item_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_status text;
  v_order_items_committed_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    v_order_id := new.order_id;
  end if;

  select o.status::text, o.order_items_committed_at
  into v_order_status, v_order_items_committed_at
  from public.orders o
  where o.id = v_order_id
  for update of o;

  perform pg_advisory_xact_lock(
    hashtextextended('order-item-commit:' || v_order_id::text, 0)
  );

  if tg_op = 'INSERT' and (
    v_order_items_committed_at is not null
    or public.is_committed_order_status(v_order_status)
  ) then
    raise exception 'COMMITTED_ORDER_ITEMS_IMMUTABLE';
  end if;

  if tg_op = 'DELETE' then
    if old.nutrition_snapshot_committed_at is not null
      or v_order_items_committed_at is not null
      or public.is_committed_order_status(v_order_status) then
      raise exception 'COMMITTED_ORDER_ITEMS_IMMUTABLE';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.nutrition_snapshot_committed_at is not null and (
      new.order_id is distinct from old.order_id
      or new.meal_id is distinct from old.meal_id
      or new.quantity is distinct from old.quantity
      or new.nutrition_snapshot is distinct from old.nutrition_snapshot
      or new.nutrition_snapshot_committed_at is distinct from old.nutrition_snapshot_committed_at
      or new.nutrition_snapshot_revision is distinct from old.nutrition_snapshot_revision
    ) then
      raise exception 'COMMITTED_ORDER_ITEM_NUTRITION_IMMUTABLE';
    end if;

    if new.order_id is distinct from old.order_id
      and (
        v_order_items_committed_at is not null
        or public.is_committed_order_status(v_order_status)
      ) then
      raise exception 'COMMITTED_ORDER_ITEMS_IMMUTABLE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_enforce_committed_order_item_immutability on public.order_items;
create trigger zz_enforce_committed_order_item_immutability
  before insert or update or delete on public.order_items
  for each row
  execute function public.enforce_committed_order_item_immutability();

create or replace function public.commit_order_item_nutrition_snapshots()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_committed_at timestamptz := now();
begin
  if tg_op = 'INSERT' then
    if public.is_committed_order_status(new.status::text) then
      new.order_items_committed_at := coalesce(new.order_items_committed_at, v_committed_at);
    end if;
    return new;
  end if;

  if old.order_items_committed_at is not null then
    new.order_items_committed_at := old.order_items_committed_at;
  end if;

  if old.status is not distinct from new.status
    or public.is_committed_order_status(old.status::text)
    or not public.is_committed_order_status(new.status::text) then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('order-item-commit:' || new.id::text, 0)
  );

  new.order_items_committed_at := coalesce(
    old.order_items_committed_at,
    new.order_items_committed_at,
    v_committed_at
  );

  update public.order_items oi
  set nutrition_snapshot = public.build_order_item_nutrition_snapshot(
        oi.id,
        oi.meal_id,
        oi.meal_name,
        oi.quantity,
        v_committed_at,
        case when oi.meal_id is null then 'upgraded_order_commit_backfill' else null end
      ),
      nutrition_snapshot_revision = public.order_item_snapshot_revision(
        public.build_order_item_nutrition_snapshot(
          oi.id,
          oi.meal_id,
          oi.meal_name,
          oi.quantity,
          v_committed_at,
          case when oi.meal_id is null then 'upgraded_order_commit_backfill' else null end
        )
      ),
      nutrition_snapshot_committed_at = coalesce(
        oi.nutrition_snapshot_committed_at,
        v_committed_at
      )
  where oi.order_id = new.id;

  if exists (
    select 1
    from public.order_items oi
    where oi.order_id = new.id
      and (
        oi.nutrition_snapshot is null
        or jsonb_typeof(oi.nutrition_snapshot) <> 'object'
        or oi.nutrition_snapshot_revision is null
        or oi.nutrition_snapshot_revision < 1
        or oi.nutrition_snapshot_committed_at is null
      )
  ) then
    raise exception 'COMMITTED_ORDER_ITEM_SNAPSHOT_REQUIRED';
  end if;

  return new;
end;
$$;

drop trigger if exists capture_committed_order_item_nutrition on public.orders;
create trigger capture_committed_order_item_nutrition
  before update of status, order_items_committed_at on public.orders
  for each row
  execute function public.commit_order_item_nutrition_snapshots();

drop trigger if exists initialize_committed_order_item_nutrition on public.orders;
create trigger initialize_committed_order_item_nutrition
  before insert on public.orders
  for each row
  execute function public.commit_order_item_nutrition_snapshots();

-- Preserve valid upgraded snapshots exactly as stored. Only missing snapshots
-- receive an explicitly labeled legacy reconstruction.
update public.orders o
set order_items_committed_at = coalesce(o.order_items_committed_at, o.updated_at, o.created_at, now())
where public.is_committed_order_status(o.status::text)
  and o.order_items_committed_at is null;

update public.order_items oi
set nutrition_snapshot = coalesce(
      oi.nutrition_snapshot,
      public.build_order_item_nutrition_snapshot(
        oi.id,
        oi.meal_id,
        oi.meal_name,
        oi.quantity,
        coalesce(o.updated_at, o.created_at, now()),
        'upgraded_committed_order_backfill'
      )
    ),
    nutrition_snapshot_revision = greatest(
      coalesce(
        oi.nutrition_snapshot_revision,
        public.order_item_snapshot_revision(oi.nutrition_snapshot),
        1
      ),
      1
    ),
    nutrition_snapshot_committed_at = coalesce(
      oi.nutrition_snapshot_committed_at,
      o.updated_at,
      o.created_at,
      now()
    )
from public.orders o
where o.id = oi.order_id
  and public.is_committed_order_status(o.status::text)
  and (
    oi.nutrition_snapshot is null
    or oi.nutrition_snapshot_revision is null
    or oi.nutrition_snapshot_committed_at is null
  );

alter table public.order_items
  drop constraint if exists order_items_committed_nutrition_snapshot,
  add constraint order_items_committed_nutrition_snapshot
    check (
      nutrition_snapshot_committed_at is null
      or (
        nutrition_snapshot is not null
        and jsonb_typeof(nutrition_snapshot) = 'object'
        and nutrition_snapshot_revision is not null
        and nutrition_snapshot_revision > 0
      )
    ) not valid;

alter table public.order_items
  validate constraint order_items_committed_nutrition_snapshot;

comment on column public.order_items.nutrition_snapshot_committed_at is
  'Commercial commitment boundary after which meal, quantity, and nutrition snapshot are immutable.';
comment on column public.order_items.nutrition_snapshot_revision is
  'Catalog nutrition version captured by this immutable order-item snapshot.';
comment on column public.orders.order_items_committed_at is
  'First commercial commitment of the order item set; remains set after cancellation or status regression.';

-- Order-item mutations cross a commercial and nutrition-history boundary.
-- Customers may read their rows through RLS, but may not update them directly.
revoke update on table public.order_items from anon, authenticated;

commit;
