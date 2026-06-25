alter table public.meal_schedules
  add column if not exists schedule_source text not null default 'customer',
  add column if not exists coach_program_id uuid references public.coach_programs(id) on delete set null,
  add column if not exists program_meal_id uuid references public.program_meals(id) on delete set null,
  add column if not exists coach_suggested_meal_id uuid references public.meals(id) on delete set null,
  add column if not exists coach_replacement_status text,
  add column if not exists coach_replacement_delta jsonb;

do $$
begin
  alter table public.meal_schedules
    add constraint meal_schedules_schedule_source_check
    check (schedule_source in ('customer', 'coach_program', 'coach_replacement'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.meal_schedules
    add constraint meal_schedules_coach_replacement_status_check
    check (coach_replacement_status is null or coach_replacement_status in ('followed', 'replaced'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_meal_schedules_program_meal
  on public.meal_schedules(program_meal_id)
  where program_meal_id is not null;

create index if not exists idx_meal_schedules_coach_context
  on public.meal_schedules(user_id, scheduled_date, meal_type, coach_replacement_status)
  where program_meal_id is not null;

comment on column public.meal_schedules.program_meal_id is
  'Links a customer schedule row to the coach program meal that it follows or replaces.';

comment on column public.meal_schedules.coach_replacement_status is
  'followed when the scheduled meal matches the coach suggestion, replaced when the client selected a different meal.';

comment on column public.meal_schedules.coach_replacement_delta is
  'Macro delta between selected meal and coach suggested meal, stored as JSON for coach adherence review.';
