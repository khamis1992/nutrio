alter table public.meal_schedules
  add column if not exists restaurant_note text;

comment on column public.meal_schedules.restaurant_note is
  'Optional customer note for the restaurant kitchen on a scheduled meal.';
