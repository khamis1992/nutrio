-- Agent 9: notification event catalogue, quiet-hour preferences, delivery
-- receipts, and operator-safe observability.

begin;

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  push_notifications boolean default true,
  email_notifications boolean default true,
  meal_reminders boolean default true,
  order_updates boolean default true,
  promotional_emails boolean default false,
  weekly_summary boolean default true,
  reminder_time time without time zone default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'Users can view their own notification preferences'
  ) then
    create policy "Users can view their own notification preferences"
      on public.notification_preferences
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'Users can insert their own notification preferences'
  ) then
    create policy "Users can insert their own notification preferences"
      on public.notification_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'Users can update their own notification preferences'
  ) then
    create policy "Users can update their own notification preferences"
      on public.notification_preferences
      for update
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.update_updated_at_column()') is not null
     and not exists (
       select 1
       from pg_trigger
       where tgname = 'update_notification_preferences_updated_at'
         and tgrelid = 'public.notification_preferences'::regclass
     ) then
    create trigger update_notification_preferences_updated_at
      before update on public.notification_preferences
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'general',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

alter table public.notification_preferences
  add column if not exists timezone text not null default 'Asia/Qatar',
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start time without time zone default '22:00',
  add column if not exists quiet_hours_end time without time zone default '07:00',
  add column if not exists delivery_updates boolean default true,
  add column if not exists health_insights boolean default true,
  add column if not exists plan_updates boolean default true,
  add column if not exists subscription_updates boolean default true,
  add column if not exists achievements boolean default true,
  add column if not exists system_alerts boolean default true,
  add column if not exists support boolean default true;

alter table public.notifications
  add column if not exists template_key text,
  add column if not exists event_type text,
  add column if not exists preference_key text,
  add column if not exists deep_link_type text,
  add column if not exists deferred_until timestamptz,
  add column if not exists suppressed_at timestamptz,
  add column if not exists suppression_reason text;

create table if not exists security.notification_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  notification_id uuid references public.notifications(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  template_key text not null,
  notification_type text not null,
  preference_key text not null,
  channel text not null check (channel in ('in_app', 'push', 'email', 'whatsapp')),
  status text not null default 'pending' check (status in (
    'pending',
    'deferred',
    'suppressed',
    'processing',
    'delivered',
    'failed',
    'dead_letter'
  )),
  dedupe_key text not null,
  quiet_hours_policy text not null default 'respect' check (quiet_hours_policy in ('respect', 'bypass')),
  deep_link_type text,
  deferred_until timestamptz,
  suppressed_at timestamptz,
  suppression_reason text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  last_error_code text,
  retryable boolean not null default true,
  provider_message_id text,
  analytics_event text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_event_deliveries_dedupe_unique unique (user_id, channel, dedupe_key)
);

create index if not exists notification_event_deliveries_status_idx
  on security.notification_event_deliveries (status, updated_at desc);

create index if not exists notification_event_deliveries_user_idx
  on security.notification_event_deliveries (user_id, created_at desc);

alter table security.notification_event_deliveries enable row level security;
alter table security.notification_event_deliveries force row level security;
revoke all on security.notification_event_deliveries from public, anon, authenticated;
grant all on security.notification_event_deliveries to service_role;

create or replace function security.safe_notification_error_code(p_value text)
returns text
language sql
immutable
set search_path to pg_catalog
as $$
  select nullif(left(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9_.-]', '', 'g'), 120), '')
$$;

create or replace function public.record_notification_event_delivery(
  p_user_id uuid,
  p_event_type text,
  p_template_key text,
  p_notification_type text,
  p_preference_key text,
  p_channel text,
  p_status text,
  p_dedupe_key text,
  p_quiet_hours_policy text default 'respect',
  p_deep_link_type text default null,
  p_notification_id uuid default null,
  p_event_id uuid default null,
  p_deferred_until timestamptz default null,
  p_suppression_reason text default null,
  p_error_code text default null,
  p_retryable boolean default true,
  p_provider_message_id text default null,
  p_analytics_event text default null
)
returns jsonb
language plpgsql
security definer
set search_path to security, public, pg_temp
as $$
declare
  v_status text := lower(trim(coalesce(p_status, 'pending')));
  v_channel text := lower(trim(coalesce(p_channel, '')));
  v_quiet_hours_policy text := lower(trim(coalesce(p_quiet_hours_policy, 'respect')));
  v_error_code text := security.safe_notification_error_code(p_error_code);
  v_row security.notification_event_deliveries%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if p_user_id is null
     or v_channel not in ('in_app', 'push', 'email', 'whatsapp')
     or v_status not in ('pending', 'deferred', 'suppressed', 'processing', 'delivered', 'failed', 'dead_letter')
     or v_quiet_hours_policy not in ('respect', 'bypass')
     or char_length(coalesce(p_event_type, '')) not between 1 and 120
     or char_length(coalesce(p_template_key, '')) not between 1 and 160
     or char_length(coalesce(p_dedupe_key, '')) not between 1 and 220 then
    raise exception 'Invalid notification delivery event';
  end if;

  insert into security.notification_event_deliveries (
    event_id,
    notification_id,
    user_id,
    event_type,
    template_key,
    notification_type,
    preference_key,
    channel,
    status,
    dedupe_key,
    quiet_hours_policy,
    deep_link_type,
    deferred_until,
    suppressed_at,
    suppression_reason,
    attempt_count,
    last_error_code,
    retryable,
    provider_message_id,
    analytics_event,
    updated_at
  )
  values (
    p_event_id,
    p_notification_id,
    p_user_id,
    left(p_event_type, 120),
    left(p_template_key, 160),
    left(coalesce(p_notification_type, 'general'), 80),
    left(coalesce(p_preference_key, 'system_alerts'), 80),
    v_channel,
    v_status,
    left(p_dedupe_key, 220),
    v_quiet_hours_policy,
    nullif(left(coalesce(p_deep_link_type, ''), 80), ''),
    case when v_status = 'deferred' then p_deferred_until else null end,
    case when v_status = 'suppressed' then now() else null end,
    case when v_status = 'suppressed' then left(coalesce(p_suppression_reason, 'suppressed'), 120) else null end,
    case when v_status in ('processing', 'failed', 'dead_letter') then 1 else 0 end,
    v_error_code,
    coalesce(p_retryable, true),
    nullif(left(coalesce(p_provider_message_id, ''), 250), ''),
    nullif(left(coalesce(p_analytics_event, ''), 120), ''),
    now()
  )
  on conflict (user_id, channel, dedupe_key)
  do update set
    status = excluded.status,
    notification_id = coalesce(excluded.notification_id, security.notification_event_deliveries.notification_id),
    event_id = coalesce(excluded.event_id, security.notification_event_deliveries.event_id),
    deferred_until = excluded.deferred_until,
    suppressed_at = coalesce(excluded.suppressed_at, security.notification_event_deliveries.suppressed_at),
    suppression_reason = excluded.suppression_reason,
    attempt_count = case
      when excluded.status in ('processing', 'failed', 'dead_letter')
        then least(security.notification_event_deliveries.attempt_count + 1, 20)
      else security.notification_event_deliveries.attempt_count
    end,
    last_error_code = excluded.last_error_code,
    retryable = excluded.retryable,
    provider_message_id = coalesce(excluded.provider_message_id, security.notification_event_deliveries.provider_message_id),
    analytics_event = coalesce(excluded.analytics_event, security.notification_event_deliveries.analytics_event),
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'status', v_row.status,
    'attempt_count', v_row.attempt_count,
    'delivery_id', v_row.id
  );
end;
$$;

create or replace view security.notification_operations_status as
select
  template_key,
  channel,
  status,
  count(*)::integer as delivery_count,
  min(created_at) as oldest_created_at,
  max(updated_at) as latest_updated_at,
  max(attempt_count)::integer as max_attempt_count,
  count(*) filter (where status = 'dead_letter')::integer as dead_letter_count,
  count(*) filter (where status = 'suppressed')::integer as suppressed_count,
  count(*) filter (where status = 'deferred')::integer as deferred_count,
  min(deferred_until) filter (where status = 'deferred') as next_deferred_until,
  array_remove(array_agg(distinct suppression_reason), null) as suppression_reasons,
  array_remove(array_agg(distinct last_error_code), null) as error_codes
from security.notification_event_deliveries
group by template_key, channel, status;

revoke all on security.notification_operations_status from public, anon, authenticated;
grant select on security.notification_operations_status to service_role;

revoke all on function security.safe_notification_error_code(text) from public, anon, authenticated;
revoke all on function public.record_notification_event_delivery(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  boolean,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.record_notification_event_delivery(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  boolean,
  text,
  text
) to service_role;

comment on table security.notification_event_deliveries is
  'Agent 9 privacy-safe event-to-notification delivery ledger.';
comment on view security.notification_operations_status is
  'Service-role-only notification delivery operations summary without recipient PII.';
comment on function public.record_notification_event_delivery(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  boolean,
  text,
  text
) is 'Service-role-only Agent 9 delivery receipt recorder with idempotent per-channel dedupe.';

commit;
