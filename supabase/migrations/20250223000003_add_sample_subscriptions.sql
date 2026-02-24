-- Add sample subscription for testing
INSERT INTO public.subscriptions (
    user_id,
    plan,
    plan_type,
    status,
    tier,
    price,
    meals_per_week,
    meals_per_month,
    meals_used_this_week,
    meals_used_this_month,
    start_date,
    end_date,
    week_start_date,
    month_start_date,
    includes_gym,
    active
) VALUES 
    ('1ababe86-ea8a-4573-8a25-d4c0e89b7883', 'monthly', 'monthly', 'active', 'premium', 299, 7, 30, 3, 12, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE, CURRENT_DATE, true, true),
    ('a21236fe-e5a5-47cb-912d-4fa0ac3fd8fa', 'weekly', 'weekly', 'active', 'basic', 99, 5, 20, 1, 8, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE, CURRENT_DATE, false, true)
ON CONFLICT DO NOTHING;
