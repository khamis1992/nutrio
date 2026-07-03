-- Expired Subscription Recovery Flow
-- Adds recovery_offers, subscription_recovery tracking, subscriptions.expired_at, and RPCs

-- 1. Recovery offers catalog
create table if not exists public.recovery_offers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  offer_type    text not null check (offer_type in ('discount', 'bonus_credits', 'free_week', 'downgrade_retention')),
  discount_percent numeric(5,2),
  bonus_credits    numeric(10,2),
  free_days        integer,
  downgrade_to_tier text,
  is_active     boolean not null default true,
  priority      integer not null default 0,
  max_uses      integer,
  uses_count    integer not null default 0,
  created_at    timestamptz not null default now()
);

-- 2. Subscription recovery tracking
create table if not exists public.subscription_recovery (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  subscription_id     uuid not null references public.subscriptions(id) on delete cascade,
  status              text not null default 'pending' check (status in ('pending', 'notified', 'offer_viewed', 'offer_applied', 'reactivated', 'dismissed', 'expired')),
  expired_at          timestamptz not null,
  recovery_offer_id   uuid references public.recovery_offers(id),
  offer_applied_at    timestamptz,
  reactivated_at      timestamptz,
  dismissed_at        timestamptz,
  notification_stage  integer not null default 0,
  next_notif_due_at   timestamptz,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_subscription_recovery_user on public.subscription_recovery(user_id);
create index if not exists idx_subscription_recovery_status on public.subscription_recovery(status);
create index if not exists idx_subscription_recovery_next_notif on public.subscription_recovery(next_notif_due_at)
  where status = 'pending';

-- 3. Add expired_at to subscriptions
alter table public.subscriptions
  add column if not exists expired_at timestamptz;

-- 4. Enable RLS
alter table public.recovery_offers enable row level security;
alter table public.subscription_recovery enable row level security;

-- 5. RLS policies
create policy "Users can view active recovery offers"
  on public.recovery_offers for select
  using (is_active = true);

create policy "Admin full access to recovery_offers"
  on public.recovery_offers for all
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::app_role))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::app_role));

create policy "Users can view own recovery"
  on public.subscription_recovery for select
  using (user_id = auth.uid());

create policy "Users can update own recovery"
  on public.subscription_recovery for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "System can insert recovery"
  on public.subscription_recovery for insert
  with check (true);

create policy "Admin full access to subscription_recovery"
  on public.subscription_recovery for all
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::app_role))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::app_role));

-- 6. Seed recovery offers
insert into public.recovery_offers (name, description, offer_type, discount_percent, bonus_credits, free_days, downgrade_to_tier, priority) values
  ('Welcome Back 30% Off', '30% off your next month when you reactivate', 'discount', 30, null, null, null, 100),
  ('Welcome Back 20% Off', '20% off your next month when you reactivate', 'discount', 20, null, null, null, 90),
  ('50 QAR Bonus Credits', 'Get 50 QAR in bonus credits to spend on meals', 'bonus_credits', null, 50, null, null, 80),
  ('Free Week Trial', 'Try us again with a free week on us', 'free_week', null, null, 7, null, 70),
  ('Downgrade to Basic', 'Keep your subscription active at a lower price point', 'downgrade_retention', null, null, null, 'basic', 60),
  ('Downgrade to Standard', 'Keep your subscription active at a lower tier', 'downgrade_retention', null, null, null, 'standard', 50)
on conflict do nothing;

-- 7. RPC: check_and_expire_subscriptions
create or replace function public.check_and_expire_subscriptions()
returns table(subscription_id uuid, user_id uuid, expired_at timestamptz)
language plpgsql
security definer
as $$
begin
  return query
  with expired_subs as (
    update public.subscriptions
    set status = 'expired',
        expired_at = now(),
        updated_at = now()
    where status = 'cancelled'
      and end_date is not null
      and end_date <= now()
      and expired_at is null
    returning id, user_id, now() as expired_at_ts
  )
  insert into public.subscription_recovery (user_id, subscription_id, expired_at, next_notif_due_at)
  select user_id, id, expired_at_ts, expired_at_ts + interval '7 days'
  from expired_subs
  on conflict do nothing
  returning subscription_id, user_id, expired_at;
end;
$$;

-- 8. RPC: get_recovery_offers
create or replace function public.get_recovery_offers()
returns setof public.recovery_offers
language plpgsql
security definer
as $$
begin
  return query
  select *
  from public.recovery_offers
  where is_active = true
  order by priority desc;
end;
$$;

-- 9. RPC: reactivate_subscription
create or replace function public.reactivate_subscription(p_subscription_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_plan_id uuid;
begin
  select user_id, plan_id into v_user_id, v_plan_id
  from public.subscriptions
  where id = p_subscription_id and status = 'expired';

  if not found then
    return false;
  end if;

  update public.subscriptions
  set status = 'active',
      expired_at = null,
      updated_at = now()
  where id = p_subscription_id;

  update public.subscription_recovery
  set status = 'reactivated',
      reactivated_at = now(),
      updated_at = now()
  where subscription_id = p_subscription_id and status in ('pending', 'offer_viewed', 'notified');

  insert into public.retention_audit_logs (user_id, action, details)
  values (v_user_id, 'subscription_reactivated', jsonb_build_object('subscription_id', p_subscription_id));

  return true;
end;
$$;

-- 10. RPC: apply_recovery_offer
create or replace function public.apply_recovery_offer(
  p_subscription_id uuid,
  p_offer_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_offer public.recovery_offers;
  v_user_id uuid;
begin
  select * into v_offer
  from public.recovery_offers
  where id = p_offer_id and is_active = true;

  if not found then
    return false;
  end if;

  select user_id into v_user_id
  from public.subscriptions
  where id = p_subscription_id and status = 'expired';

  if not found then
    return false;
  end if;

  if v_offer.offer_type = 'discount' then
    update public.subscriptions
    set status = 'active',
        expired_at = null,
        updated_at = now()
    where id = p_subscription_id;
  elsif v_offer.offer_type = 'bonus_credits' and v_offer.bonus_credits is not null then
    perform public.credit_wallet(
      p_user_id => v_user_id,
      p_amount => v_offer.bonus_credits,
      p_type => 'recovery_reactivation',
      p_reference_type => 'subscription',
      p_reference_id => p_subscription_id,
      p_description => 'Recovery offer bonus credits'
    );
    update public.subscriptions
    set status = 'active',
        expired_at = null,
        updated_at = now()
    where id = p_subscription_id;
  elsif v_offer.offer_type = 'free_week' then
    update public.subscriptions
    set status = 'active',
        expired_at = null,
        end_date = end_date + (v_offer.free_days || ' days')::interval,
        updated_at = now()
    where id = p_subscription_id;
  elsif v_offer.offer_type = 'downgrade_retention' and v_offer.downgrade_to_tier is not null then
    update public.subscriptions
    set status = 'active',
        expired_at = null,
        plan_id = (select id from public.subscription_plans where tier = v_offer.downgrade_to_tier limit 1),
        updated_at = now()
    where id = p_subscription_id;
  else
    return false;
  end if;

  update public.subscription_recovery
  set status = 'offer_applied',
      recovery_offer_id = p_offer_id,
      offer_applied_at = now(),
      updated_at = now()
  where subscription_id = p_subscription_id and status in ('pending', 'offer_viewed', 'notified');

  update public.recovery_offers
  set uses_count = uses_count + 1
  where id = p_offer_id;

  insert into public.retention_audit_logs (user_id, action, details)
  values (v_user_id, 'recovery_offer_applied', jsonb_build_object('subscription_id', p_subscription_id, 'offer_id', p_offer_id, 'offer_type', v_offer.offer_type));

  return true;
end;
$$;

-- 11. RPC: dismiss_recovery
create or replace function public.dismiss_recovery(p_subscription_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.subscriptions
  where id = p_subscription_id;

  if not found then
    return false;
  end if;

  update public.subscription_recovery
  set status = 'dismissed',
      dismissed_at = now(),
      updated_at = now()
  where subscription_id = p_subscription_id and status = 'pending';

  insert into public.retention_audit_logs (user_id, action, details)
  values (v_user_id, 'recovery_dismissed', jsonb_build_object('subscription_id', p_subscription_id));

  return true;
end;
$$;

-- 12. RPC: get_recovery_status
create or replace function public.get_recovery_status(p_user_id uuid default auth.uid())
returns table(
  id uuid,
  subscription_id uuid,
  status text,
  expired_at timestamptz,
  recovery_offer_id uuid,
  offer_applied_at timestamptz,
  reactivated_at timestamptz,
  notification_stage integer,
  days_since_expiry integer
)
language plpgsql
security definer
as $$
begin
  return query
  select
    sr.id,
    sr.subscription_id,
    sr.status,
    sr.expired_at,
    sr.recovery_offer_id,
    sr.offer_applied_at,
    sr.reactivated_at,
    sr.notification_stage,
    extract(day from now() - sr.expired_at)::integer as days_since_expiry
  from public.subscription_recovery sr
  where sr.user_id = p_user_id
  order by sr.created_at desc
  limit 1;
end;
$$;
