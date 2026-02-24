-- Add sample featured listings for testing
-- These will allow the admin and customer apps to display featured restaurants

INSERT INTO public.featured_listings (
    restaurant_id,
    package_type,
    price_paid,
    starts_at,
    ends_at,
    status
) VALUES 
    ('62d2f490-84ac-4de2-a168-382937441dc6', 'monthly', 149, NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days', 'active'),
    ('36d93cf3-34a8-42b0-a63d-47a8831a75f5', 'weekly', 49, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 'active'),
    ('56278b97-0167-4cc5-8ae4-61e2be9abced', 'biweekly', 89, NOW() - INTERVAL '3 days', NOW() + INTERVAL '11 days', 'active')
ON CONFLICT DO NOTHING;
