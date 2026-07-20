-- Compatibility guard for environments where Agent 9 observability was
-- applied without the legacy notification_preferences table.

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

commit;
