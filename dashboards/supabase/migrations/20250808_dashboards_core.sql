-- Roles table
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','restaurant_owner','gym_owner','driver','customer')),
  created_at timestamp with time zone default now(),
  primary key (user_id, role)
);

-- Restaurant ownership
create table if not exists public.restaurant_users (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamp with time zone default now(),
  primary key (restaurant_id, user_id)
);

-- Gym ownership
create table if not exists public.gym_users (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamp with time zone default now(),
  primary key (gym_id, user_id)
);

-- Orders core (if not exists)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  address_text text,
  lat double precision,
  lng double precision,
  phone text,
  delivery_scheduled_at timestamp with time zone,
  delivery_window_start time,
  delivery_window_end time,
  delivery_instructions text,
  status text not null default 'pending' check (status in ('pending','accepted','preparing','ready','out_for_delivery','delivered','cancelled')),
  payment_status text default 'pending' check (payment_status in ('pending','paid','refunded')),
  total_amount numeric(12,2) default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Order items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0
);

-- Drivers
create table if not exists public.drivers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive','active')),
  phone text,
  vehicle_type text,
  created_at timestamp with time zone default now()
);

-- Driver assignments
create table if not exists public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned','accepted','picked_up','delivered','rejected')),
  assigned_at timestamp with time zone default now(),
  accepted_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  delivered_at timestamp with time zone
);

-- Gym classes
create table if not exists public.gym_classes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  description text,
  coach text,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  capacity integer not null default 20,
  price numeric(12,2) default 0,
  image_url text,
  active boolean not null default true
);

-- Gym bookings
create table if not exists public.gym_bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.gym_classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at timestamp with time zone default now(),
  unique (class_id, user_id)
);

-- Capacity trigger
create or replace function public.enforce_class_capacity()
returns trigger as $$
declare
  cnt integer;
  cap integer;
begin
  select capacity into cap from public.gym_classes where id = new.class_id;
  select count(*) into cnt from public.gym_bookings where class_id = new.class_id and status in ('pending','confirmed');
  if cnt >= cap then
    raise exception 'Class is full';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_class_capacity on public.gym_bookings;
create trigger trg_enforce_class_capacity
before insert on public.gym_bookings
for each row execute function public.enforce_class_capacity();

-- RLS
alter table public.user_roles enable row level security;
alter table public.restaurant_users enable row level security;
alter table public.gym_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_assignments enable row level security;
alter table public.gym_classes enable row level security;
alter table public.gym_bookings enable row level security;

-- Policies (basic)
create policy if not exists "roles_self_read" on public.user_roles
for select using (auth.uid() = user_id);

create policy if not exists "restaurant_users_self_read" on public.restaurant_users
for select using (auth.uid() = user_id);

create policy if not exists "gym_users_self_read" on public.gym_users
for select using (auth.uid() = user_id);

create policy if not exists "orders_by_owner" on public.orders
for select using (
  auth.uid() = user_id
  or exists (select 1 from public.restaurant_users ru where ru.restaurant_id = orders.restaurant_id and ru.user_id = auth.uid())
);

create policy if not exists "orders_insert_by_user" on public.orders
for insert with check (auth.uid() = user_id);

create policy if not exists "order_items_access" on public.order_items
for select using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = auth.uid() or exists (select 1 from public.restaurant_users ru where ru.restaurant_id = o.restaurant_id and ru.user_id = auth.uid())))
);

create policy if not exists "drivers_self" on public.drivers
for select using (auth.uid() = user_id);

create policy if not exists "assignments_driver_access" on public.driver_assignments
for select using (driver_id = auth.uid());

create policy if not exists "classes_public_read" on public.gym_classes
for select using (true);

create policy if not exists "bookings_by_user" on public.gym_bookings
for select using (auth.uid() = user_id);


