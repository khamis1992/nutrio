-- Agent 4: complete ADR 0003 provenance, metric precedence, and source lifecycle.
-- Additive follow-up to the remotely applied 20260720110000 foundation.

alter table public.wearable_sync_sources
  add column if not exists provider_user_id text,
  add column if not exists source_timezone text not null default 'UTC';

update public.wearable_sync_sources
set provider_user_id = coalesce(
  nullif(sync_cursor ->> 'provider_user_id', ''),
  nullif(sync_cursor ->> 'providerUserId', ''),
  'legacy-unavailable:' || id::text
)
where provider_user_id is null;

alter table public.wearable_sync_sources
  alter column provider_user_id set not null;

alter table public.wearable_metric_samples
  add column if not exists provider_user_id text,
  add column if not exists connection_id uuid references public.wearable_sync_sources(id) on delete set null,
  add column if not exists source_timezone text not null default 'UTC',
  add column if not exists received_at timestamptz,
  add column if not exists quality_state text,
  add column if not exists quality_reason text,
  add column if not exists ingestion_version text not null default '1';

update public.wearable_metric_samples
set provider_user_id = coalesce(
      source.provider_user_id,
      'legacy-unavailable:' || public.wearable_metric_samples.id::text
    ),
    connection_id = coalesce(public.wearable_metric_samples.connection_id, source.id),
    received_at = coalesce(
      public.wearable_metric_samples.received_at,
      public.wearable_metric_samples.synced_at,
      public.wearable_metric_samples.created_at
    ),
    quality_state = case
      when public.wearable_metric_samples.sync_status = 'revoked' then 'revoked'
      else 'accepted'
    end
from public.wearable_sync_sources source
where (
    public.wearable_metric_samples.provider_user_id is null
    or public.wearable_metric_samples.received_at is null
    or public.wearable_metric_samples.quality_state is null
  )
  and source.user_id = public.wearable_metric_samples.user_id
  and source.provider = public.wearable_metric_samples.provider;

update public.wearable_metric_samples
set provider_user_id = 'legacy-unavailable:' || id::text,
    received_at = coalesce(received_at, synced_at, created_at),
    quality_state = case when sync_status = 'revoked' then 'revoked' else 'accepted' end
where provider_user_id is null
   or received_at is null
   or quality_state is null;

alter table public.wearable_metric_samples
  alter column provider_user_id set not null,
  alter column received_at set not null,
  alter column quality_state set not null;

alter table public.wearable_metric_samples
  drop constraint if exists wearable_metric_samples_quality_state_check;
alter table public.wearable_metric_samples
  add constraint wearable_metric_samples_quality_state_check
  check (quality_state in ('accepted', 'duplicate', 'invalid', 'stale', 'revoked'));

alter table public.wearable_metric_samples
  drop constraint if exists wearable_metric_samples_metric_type_check;
alter table public.wearable_metric_samples
  add constraint wearable_metric_samples_metric_type_check check (metric_type in (
    'steps', 'workouts_count', 'active_calories', 'average_heart_rate',
    'resting_heart_rate', 'hrv', 'sleep_minutes', 'deep_sleep_minutes',
    'rem_sleep_minutes', 'respiratory_rate', 'spo2', 'skin_temperature',
    'body_weight_kg', 'body_fat_percent', 'blood_glucose'
  ));

alter table public.health_daily_metrics
  add column if not exists selected_source_metadata jsonb not null default '{}'::jsonb;

create or replace function public.upsert_wearable_sync_state(
  p_provider text,
  p_status text,
  p_cursor jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_provider_user_id text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select source.provider_user_id
  into v_provider_user_id
  from public.wearable_sync_sources source
  where source.user_id = v_user_id
    and source.provider = p_provider;

  if v_provider_user_id is null then
    select sample.provider_user_id
    into v_provider_user_id
    from public.wearable_metric_samples sample
    where sample.user_id = v_user_id
      and sample.provider = p_provider
      and sample.provider_user_id is not null
    order by sample.received_at desc nulls last, sample.created_at desc
    limit 1;
  end if;

  v_provider_user_id := coalesce(
    v_provider_user_id,
    nullif(p_cursor ->> 'provider_user_id', ''),
    nullif(p_cursor ->> 'providerUserId', '')
  );

  if v_provider_user_id is null then
    raise exception 'PROVIDER_IDENTITY_REQUIRED' using errcode = '22023';
  end if;

  insert into public.wearable_sync_sources (
    user_id,
    provider,
    provider_user_id,
    status,
    sync_cursor,
    source_precedence,
    last_success_at,
    last_error_at,
    last_error_message,
    updated_at
  )
  values (
    v_user_id,
    p_provider,
    v_provider_user_id,
    p_status,
    coalesce(p_cursor, '{}'::jsonb),
    public.wearable_provider_precedence(p_provider),
    case when p_status = 'synced' then now() else null end,
    case when p_status = 'error' then now() else null end,
    p_error_message,
    now()
  )
  on conflict (user_id, provider)
  do update set
    status = excluded.status,
    sync_cursor = excluded.sync_cursor,
    source_precedence = excluded.source_precedence,
    last_success_at = coalesce(excluded.last_success_at, public.wearable_sync_sources.last_success_at),
    last_error_at = coalesce(excluded.last_error_at, public.wearable_sync_sources.last_error_at),
    last_error_message = excluded.last_error_message,
    revoked_at = case
      when excluded.status = 'revoked' then now()
      when public.wearable_sync_sources.status = 'revoked' then null
      else public.wearable_sync_sources.revoked_at
    end,
    updated_at = now();
end;
$$;

create index if not exists idx_wearable_metric_samples_connection
  on public.wearable_metric_samples (connection_id, external_id, metric_type)
  where external_id is not null;

create or replace function public.wearable_metric_source_precedence(
  p_metric_type text,
  p_provider text
)
returns integer
language sql
immutable
as $$
  select case
    when p_metric_type in ('body_weight_kg', 'body_fat_percent') then case p_provider
      when 'body_scale' then 100 when 'apple_health' then 80 when 'google_fit' then 70
      when 'manual' then 60 else public.wearable_provider_precedence(p_provider) end
    when p_metric_type in ('workouts_count', 'active_calories') then case p_provider
      when 'sporthub' then 100 when 'file_import' then 90 when 'apple_health' then 80
      when 'google_fit' then 70 when 'nutrio_activity' then 60
      else public.wearable_provider_precedence(p_provider) end
    when p_metric_type = 'steps' then case p_provider
      when 'apple_health' then 100 when 'google_fit' then 90 when 'file_import' then 60
      when 'sporthub' then 50 else public.wearable_provider_precedence(p_provider) end
    when p_metric_type in ('average_heart_rate', 'resting_heart_rate', 'hrv',
      'sleep_minutes', 'deep_sleep_minutes', 'rem_sleep_minutes', 'respiratory_rate',
      'spo2', 'skin_temperature', 'blood_glucose') and p_provider = 'apple_health' then 100
    when p_metric_type in ('average_heart_rate', 'resting_heart_rate', 'hrv',
      'sleep_minutes', 'deep_sleep_minutes', 'rem_sleep_minutes', 'respiratory_rate',
      'spo2', 'skin_temperature', 'blood_glucose') and p_provider = 'google_fit' then 90
    else public.wearable_provider_precedence(p_provider)
  end
$$;

create or replace function public.rebuild_health_daily_metrics_from_wearables(
  p_user_id uuid,
  p_metric_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_steps integer := 0;
  v_workouts_count integer := 0;
  v_active_calories integer := 0;
  v_resting_heart_rate numeric;
  v_average_heart_rate numeric;
  v_hrv numeric;
  v_sleep_minutes integer;
  v_deep_sleep_minutes integer;
  v_rem_sleep_minutes integer;
  v_respiratory_rate numeric;
  v_spo2 numeric;
  v_skin_temperature numeric;
  v_source text := 'manual';
  v_selected_source_metadata jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  with provider_metric as (
    select metric_type,
           provider,
           public.wearable_metric_source_precedence(metric_type, provider) as precedence,
           max(received_at) as latest_received_at,
           count(*) as sample_count,
           case
             when metric_type in ('steps', 'workouts_count', 'active_calories', 'sleep_minutes',
               'deep_sleep_minutes', 'rem_sleep_minutes') then sum(value)
             else avg(value)
           end as metric_value
    from public.wearable_metric_samples
    where user_id = p_user_id
      and metric_date = p_metric_date
      and deleted_at is null
      and sync_status = 'synced'
      and quality_state = 'accepted'
    group by metric_type, provider
  ), selected_metric as (
    select distinct on (metric_type)
           metric_type, provider, precedence, latest_received_at, sample_count, metric_value
    from provider_metric
    order by metric_type, precedence desc, latest_received_at desc, provider
  ), projection as (
    select
      coalesce(max(metric_value) filter (where metric_type = 'steps'), 0)::integer as steps,
      coalesce(max(metric_value) filter (where metric_type = 'workouts_count'), 0)::integer as workouts_count,
      coalesce(max(metric_value) filter (where metric_type = 'active_calories'), 0)::integer as active_calories,
      max(metric_value) filter (where metric_type = 'resting_heart_rate') as resting_heart_rate,
      max(metric_value) filter (where metric_type = 'average_heart_rate') as average_heart_rate,
      max(metric_value) filter (where metric_type = 'hrv') as hrv,
      max(metric_value) filter (where metric_type = 'sleep_minutes')::integer as sleep_minutes,
      max(metric_value) filter (where metric_type = 'deep_sleep_minutes')::integer as deep_sleep_minutes,
      max(metric_value) filter (where metric_type = 'rem_sleep_minutes')::integer as rem_sleep_minutes,
      max(metric_value) filter (where metric_type = 'respiratory_rate') as respiratory_rate,
      max(metric_value) filter (where metric_type = 'spo2') as spo2,
      max(metric_value) filter (where metric_type = 'skin_temperature') as skin_temperature,
      coalesce(string_agg(distinct provider, '+' order by provider), 'manual') as source,
      coalesce(jsonb_object_agg(
        metric_type,
        jsonb_build_object(
          'provider', provider,
          'precedence', precedence,
          'precedence_version', '2',
          'sample_count', sample_count,
          'latest_received_at', latest_received_at,
          'available_providers', (
            select jsonb_agg(pm.provider order by pm.precedence desc, pm.provider)
            from provider_metric pm where pm.metric_type = selected_metric.metric_type
          )
        )
      ), '{}'::jsonb) as selected_source_metadata
    from selected_metric
  )
  select steps, workouts_count, active_calories, resting_heart_rate, average_heart_rate,
         hrv, sleep_minutes, deep_sleep_minutes, rem_sleep_minutes, respiratory_rate,
         spo2, skin_temperature, source, selected_source_metadata
  into v_steps, v_workouts_count, v_active_calories, v_resting_heart_rate,
       v_average_heart_rate, v_hrv, v_sleep_minutes, v_deep_sleep_minutes,
       v_rem_sleep_minutes, v_respiratory_rate, v_spo2, v_skin_temperature,
       v_source, v_selected_source_metadata
  from projection;

  insert into public.health_daily_metrics (
    user_id, metric_date, steps, workouts_count, active_calories, resting_heart_rate,
    average_heart_rate, hrv, sleep_minutes, deep_sleep_minutes, rem_sleep_minutes,
    respiratory_rate, spo2, skin_temperature, source, selected_source_metadata,
    synced_at, updated_at
  ) values (
    p_user_id, p_metric_date, v_steps, v_workouts_count, v_active_calories,
    v_resting_heart_rate, v_average_heart_rate, v_hrv, v_sleep_minutes,
    v_deep_sleep_minutes, v_rem_sleep_minutes, v_respiratory_rate, v_spo2,
    v_skin_temperature, v_source, v_selected_source_metadata, now(), now()
  )
  on conflict (user_id, metric_date) do update set
    steps = excluded.steps,
    workouts_count = excluded.workouts_count,
    active_calories = excluded.active_calories,
    resting_heart_rate = excluded.resting_heart_rate,
    average_heart_rate = excluded.average_heart_rate,
    hrv = excluded.hrv,
    sleep_minutes = excluded.sleep_minutes,
    deep_sleep_minutes = excluded.deep_sleep_minutes,
    rem_sleep_minutes = excluded.rem_sleep_minutes,
    respiratory_rate = excluded.respiratory_rate,
    spo2 = excluded.spo2,
    skin_temperature = excluded.skin_temperature,
    source = excluded.source,
    selected_source_metadata = excluded.selected_source_metadata,
    synced_at = excluded.synced_at,
    updated_at = now();
end;
$$;

create or replace function public.ingest_wearable_metric_samples(p_samples jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_sample jsonb;
  v_metric_date date;
  v_start_at timestamptz;
  v_connection_id uuid;
  v_changed integer;
  v_changed_count integer := 0;
  v_unchanged_count integer := 0;
  v_rejected_count integer := 0;
  v_dates date[] := '{}';
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_samples) <> 'array' then raise exception 'SAMPLES_MUST_BE_ARRAY'; end if;
  if jsonb_array_length(p_samples) > 500 then raise exception 'TOO_MANY_SAMPLES'; end if;

  for v_sample in select value from jsonb_array_elements(p_samples)
  loop
    begin
      if coalesce(v_sample ->> 'provider_user_id', '') = ''
         or coalesce(v_sample ->> 'source_timezone', '') = ''
         or coalesce(v_sample ->> 'received_at', '') = ''
         or coalesce(v_sample ->> 'quality_state', '') = ''
         or coalesce(v_sample ->> 'ingestion_version', '') = '' then
        raise exception 'MISSING_PROVENANCE';
      end if;

      v_metric_date := (v_sample ->> 'metric_date')::date;
      v_start_at := (v_sample ->> 'start_at')::timestamptz;
      if (v_start_at at time zone (v_sample ->> 'source_timezone'))::date <> v_metric_date then
        raise exception 'SOURCE_TIMEZONE_DATE_MISMATCH';
      end if;

      insert into public.wearable_sync_sources (
        user_id, provider, provider_user_id, source_timezone, status, source_precedence, updated_at
      ) values (
        v_user_id, v_sample ->> 'provider', v_sample ->> 'provider_user_id',
        v_sample ->> 'source_timezone', 'connected',
        public.wearable_provider_precedence(v_sample ->> 'provider'), now()
      )
      on conflict (user_id, provider) do update set
        provider_user_id = excluded.provider_user_id,
        source_timezone = excluded.source_timezone,
        status = case when public.wearable_sync_sources.status = 'revoked' then 'connected'
          else public.wearable_sync_sources.status end,
        revoked_at = case when public.wearable_sync_sources.status = 'revoked' then null
          else public.wearable_sync_sources.revoked_at end,
        updated_at = now()
      returning id into v_connection_id;

      insert into public.wearable_metric_samples (
        user_id, provider, provider_user_id, connection_id, metric_type, metric_date,
        start_at, end_at, value, unit, external_id, dedupe_key, checksum, source_app,
        device_id, source_timezone, received_at, quality_state, quality_reason,
        ingestion_version, sync_status, raw, synced_at, deleted_at, updated_at
      ) values (
        v_user_id, v_sample ->> 'provider', v_sample ->> 'provider_user_id', v_connection_id,
        v_sample ->> 'metric_type', v_metric_date, v_start_at,
        (v_sample ->> 'end_at')::timestamptz, (v_sample ->> 'value')::numeric,
        v_sample ->> 'unit', nullif(v_sample ->> 'external_id', ''),
        v_sample ->> 'dedupe_key', v_sample ->> 'checksum',
        nullif(v_sample ->> 'source_app', ''), nullif(v_sample ->> 'device_id', ''),
        v_sample ->> 'source_timezone', (v_sample ->> 'received_at')::timestamptz,
        v_sample ->> 'quality_state', nullif(v_sample ->> 'quality_reason', ''),
        v_sample ->> 'ingestion_version', coalesce(nullif(v_sample ->> 'sync_status', ''), 'synced'),
        coalesce(v_sample -> 'raw', '{}'::jsonb), now(), null, now()
      )
      on conflict (user_id, dedupe_key) do update set
        provider_user_id = excluded.provider_user_id,
        connection_id = excluded.connection_id,
        metric_type = excluded.metric_type,
        metric_date = excluded.metric_date,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        value = excluded.value,
        unit = excluded.unit,
        external_id = excluded.external_id,
        checksum = excluded.checksum,
        source_app = excluded.source_app,
        device_id = excluded.device_id,
        source_timezone = excluded.source_timezone,
        received_at = excluded.received_at,
        quality_state = excluded.quality_state,
        quality_reason = excluded.quality_reason,
        ingestion_version = excluded.ingestion_version,
        sync_status = excluded.sync_status,
        raw = excluded.raw,
        synced_at = excluded.synced_at,
        deleted_at = null,
        updated_at = now()
      where public.wearable_metric_samples.checksum is distinct from excluded.checksum
         or public.wearable_metric_samples.quality_state is distinct from excluded.quality_state
         or public.wearable_metric_samples.deleted_at is not null
         or public.wearable_metric_samples.sync_status is distinct from excluded.sync_status;

      get diagnostics v_changed = row_count;
      if v_changed = 0 then v_unchanged_count := v_unchanged_count + 1;
      else v_changed_count := v_changed_count + 1; end if;
      v_dates := array_append(v_dates, v_metric_date);
    exception when others then
      v_rejected_count := v_rejected_count + 1;
    end;
  end loop;

  for v_metric_date in select distinct unnest(v_dates)
  loop
    perform public.rebuild_health_daily_metrics_from_wearables(v_user_id, v_metric_date);
  end loop;

  return jsonb_build_object('ok', true, 'inserted_or_updated', v_changed_count,
    'unchanged', v_unchanged_count, 'rejected', v_rejected_count);
end;
$$;

create or replace function public.refresh_my_wearable_sync_staleness(
  p_stale_after interval default interval '45 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_changed integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_stale_after < interval '5 minutes' then raise exception 'STALE_WINDOW_TOO_SHORT'; end if;
  update public.wearable_sync_sources
  set status = 'stale', updated_at = now()
  where user_id = v_user_id
    and status in ('connected', 'synced')
    and coalesce(last_success_at, connected_at) < now() - p_stale_after;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.revoke_wearable_provider(p_provider text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_dates date[];
  v_metric_date date;
  v_deleted integer := 0;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct metric_date), '{}') into v_dates
  from public.wearable_metric_samples
  where user_id = v_user_id and provider = p_provider and deleted_at is null;

  update public.wearable_metric_samples
  set deleted_at = now(), sync_status = 'revoked', quality_state = 'revoked',
      quality_reason = 'provider_disconnected', updated_at = now()
  where user_id = v_user_id and provider = p_provider and deleted_at is null;
  get diagnostics v_deleted = row_count;

  perform public.upsert_wearable_sync_state(
    p_provider, 'revoked', jsonb_build_object('revokedAt', now()), null
  );
  for v_metric_date in select unnest(v_dates)
  loop
    perform public.rebuild_health_daily_metrics_from_wearables(v_user_id, v_metric_date);
  end loop;
  return jsonb_build_object('ok', true, 'revoked_samples', v_deleted);
end;
$$;

revoke all on function public.wearable_metric_source_precedence(text, text) from public;
revoke all on function public.refresh_my_wearable_sync_staleness(interval) from public;
grant execute on function public.wearable_metric_source_precedence(text, text) to authenticated;
grant execute on function public.refresh_my_wearable_sync_staleness(interval) to authenticated;
