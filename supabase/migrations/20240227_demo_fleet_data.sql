-- ==========================================
-- DEMO DATA FOR FLEET MANAGEMENT PORTAL
-- Run this after applying the fleet management migration
-- ==========================================

-- 1. Create Demo Cities (if not exists)
INSERT INTO cities (id, name, name_ar, country, latitude, longitude, timezone, is_active)
VALUES 
  ('doha-city-uuid', 'Doha', 'الدوحة', 'Qatar', 25.2854, 51.5310, 'Asia/Qatar', true),
  ('al-rayyan-uuid', 'Al Rayyan', 'الريان', 'Qatar', 25.2916, 51.4244, 'Asia/Qatar', true),
  ('al-wakrah-uuid', 'Al Wakrah', 'الوكرة', 'Qatar', 25.1659, 51.5976, 'Asia/Qatar', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Demo Zones for Doha
INSERT INTO zones (id, city_id, name, name_ar, is_active)
VALUES 
  ('west-bay-zone', 'doha-city-uuid', 'West Bay', 'الخليج الغربي', true),
  ('pearl-zone', 'doha-city-uuid', 'The Pearl', 'اللؤلؤة', true),
  ('souq-waqif-zone', 'doha-city-uuid', 'Souq Waqif', 'سوق واقف', true),
  ('msheireb-zone', 'doha-city-uuid', 'Msheireb', 'مشيرب', true),
  ('education-city-zone', 'al-rayyan-uuid', 'Education City', 'مدينة التعليم', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Create Demo Fleet Manager Account
-- First, create the auth user (you'll need to do this via Supabase Auth UI or API)
-- Then run this to link the fleet manager record

-- Note: Replace 'demo-fleet-manager-auth-uuid' with the actual auth.user id after creating via Supabase Auth
INSERT INTO fleet_managers (
  id,
  auth_user_id,
  email,
  full_name,
  phone,
  role,
  assigned_city_ids,
  is_active,
  created_at
)
VALUES (
  'demo-fleet-manager-uuid',
  'demo-fleet-manager-auth-uuid', -- Replace this with actual auth user UUID
  'fleet.demo@nutriofuel.qa',
  'Demo Fleet Manager',
  '+974 5000 1234',
  'fleet_manager',
  ARRAY['doha-city-uuid', 'al-rayyan-uuid']::UUID[],
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  assigned_city_ids = ARRAY['doha-city-uuid', 'al-rayyan-uuid']::UUID[];

-- 4. Create Demo Super Admin (optional)
INSERT INTO fleet_managers (
  id,
  auth_user_id,
  email,
  full_name,
  phone,
  role,
  assigned_city_ids,
  is_active,
  created_at
)
VALUES (
  'demo-super-admin-uuid',
  'demo-super-admin-auth-uuid', -- Replace this with actual auth user UUID
  'admin.demo@nutriofuel.qa',
  'Demo Super Admin',
  '+974 5000 9999',
  'super_admin',
  ARRAY[]::UUID[], -- Empty array means access to all cities
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  role = 'super_admin';

-- 5. Create Demo Drivers
INSERT INTO drivers (
  id,
  auth_user_id,
  email,
  phone,
  full_name,
  city_id,
  assigned_zone_ids,
  status,
  current_latitude,
  current_longitude,
  location_updated_at,
  is_online,
  total_deliveries,
  rating,
  cancellation_rate,
  current_balance,
  total_earnings,
  created_at
)
VALUES 
  -- Active drivers in Doha
  ('driver-001', NULL, 'ahmed.driver@demo.qa', '+974 5511 1111', 'Ahmed Al-Dosari', 'doha-city-uuid', ARRAY['west-bay-zone', 'pearl-zone']::UUID[], 'active', 25.2854, 51.5310, NOW(), true, 342, 4.8, 0.02, 1250.00, 8500.00, NOW() - INTERVAL '3 months'),
  ('driver-002', NULL, 'khalid.driver@demo.qa', '+974 5522 2222', 'Khalid Al-Kuwari', 'doha-city-uuid', ARRAY['souq-waqif-zone']::UUID[], 'active', 25.2860, 51.5330, NOW(), true, 198, 4.9, 0.01, 890.00, 5200.00, NOW() - INTERVAL '2 months'),
  ('driver-003', NULL, 'mohammed.driver@demo.qa', '+974 5533 3333', 'Mohammed Al-Hajri', 'doha-city-uuid', ARRAY['msheireb-zone', 'west-bay-zone']::UUID[], 'active', 25.2840, 51.5290, NOW(), true, 512, 4.7, 0.03, 2100.00, 12000.00, NOW() - INTERVAL '6 months'),
  
  -- Offline driver
  ('driver-004', NULL, 'saad.driver@demo.qa', '+974 5544 4444', 'Saad Al-Muhannadi', 'doha-city-uuid', ARRAY['pearl-zone']::UUID[], 'active', 25.2920, 51.5350, NOW() - INTERVAL '2 hours', false, 156, 4.6, 0.04, 450.00, 3800.00, NOW() - INTERVAL '1 month'),
  
  -- Pending verification
  ('driver-005', NULL, 'fahad.driver@demo.qa', '+974 5555 5555', 'Fahad Al-Marri', 'doha-city-uuid', ARRAY['west-bay-zone']::UUID[], 'pending_verification', NULL, NULL, NULL, false, 0, 0.0, 0.00, 0.00, 0.00, NOW() - INTERVAL '3 days'),
  
  -- Suspended driver
  ('driver-006', NULL, 'abdullah.driver@demo.qa', '+974 5566 6666', 'Abdullah Al-Attiyah', 'doha-city-uuid', ARRAY['souq-waqif-zone']::UUID[], 'suspended', 25.2830, 51.5280, NOW() - INTERVAL '5 days', false, 89, 3.2, 0.15, 0.00, 2100.00, NOW() - INTERVAL '4 months'),
  
  -- Drivers in Al Rayyan
  ('driver-007', NULL, 'hamad.driver@demo.qa', '+974 5577 7777', 'Hamad Al-Thani', 'al-rayyan-uuid', ARRAY['education-city-zone']::UUID[], 'active', 25.2916, 51.4244, NOW(), true, 267, 4.8, 0.01, 1680.00, 9500.00, NOW() - INTERVAL '4 months'),
  ('driver-008', NULL, 'jassem.driver@demo.qa', '+974 5588 8888', 'Jassem Al-Kaabi', 'al-rayyan-uuid', ARRAY['education-city-zone']::UUID[], 'active', 25.2930, 51.4260, NOW(), true, 145, 4.7, 0.02, 720.00, 4100.00, NOW() - INTERVAL '2 months')

ON CONFLICT (email) DO UPDATE SET
  status = EXCLUDED.status,
  is_online = EXCLUDED.is_online,
  current_latitude = EXCLUDED.current_latitude,
  current_longitude = EXCLUDED.current_longitude;

-- 6. Create Demo Vehicles
INSERT INTO vehicles (
  id,
  city_id,
  type,
  make,
  model,
  year,
  color,
  plate_number,
  registration_number,
  insurance_provider,
  insurance_expiry,
  status,
  assigned_driver_id,
  created_at
)
VALUES 
  ('vehicle-001', 'doha-city-uuid', 'motorcycle', 'Honda', 'CBR 250R', 2022, 'Red', '12345', 'REG-2022-001', 'Qatar Insurance', '2025-06-15', 'assigned', 'driver-001', NOW()),
  ('vehicle-002', 'doha-city-uuid', 'motorcycle', 'Yamaha', 'MT-07', 2023, 'Black', '12346', 'REG-2023-002', 'Qatar Insurance', '2025-08-20', 'assigned', 'driver-002', NOW()),
  ('vehicle-003', 'doha-city-uuid', 'car', 'Toyota', 'Corolla', 2021, 'White', '12347', 'REG-2021-003', 'Doha Insurance', '2025-03-10', 'assigned', 'driver-003', NOW()),
  ('vehicle-004', 'doha-city-uuid', 'motorcycle', 'Suzuki', 'GSX-R150', 2023, 'Blue', '12348', 'REG-2023-004', 'Qatar Insurance', '2024-12-30', 'available', NULL, NOW()),
  ('vehicle-005', 'al-rayyan-uuid', 'motorcycle', 'Honda', 'CBR 150R', 2022, 'Red', '22345', 'REG-2022-005', 'Qatar Insurance', '2025-07-22', 'assigned', 'driver-007', NOW()),
  ('vehicle-006', 'al-rayyan-uuid', 'car', 'Kia', 'Rio', 2023, 'Silver', '22346', 'REG-2023-006', 'Doha Insurance', '2025-09-15', 'assigned', 'driver-008', NOW())
ON CONFLICT (plate_number) DO UPDATE SET
  status = EXCLUDED.status,
  assigned_driver_id = EXCLUDED.assigned_driver_id;

-- 7. Create Demo Driver Documents
INSERT INTO driver_documents (driver_id, document_type, document_url, verification_status, expiry_date, created_at)
SELECT 
  d.id,
  'driving_license',
  'https://demo.nutriofuel.qa/docs/license_' || d.id || '.pdf',
  CASE 
    WHEN d.status = 'active' THEN 'approved'
    WHEN d.status = 'pending_verification' THEN 'pending'
    ELSE 'approved'
  END,
  CASE 
    WHEN d.status IN ('active', 'suspended') THEN '2026-12-31'
    ELSE NULL
  END,
  NOW()
FROM drivers d
ON CONFLICT DO NOTHING;

INSERT INTO driver_documents (driver_id, document_type, document_url, verification_status, expiry_date, created_at)
SELECT 
  d.id,
  'id_card',
  'https://demo.nutriofuel.qa/docs/id_' || d.id || '.pdf',
  CASE 
    WHEN d.status = 'active' THEN 'approved'
    WHEN d.status = 'pending_verification' THEN 'pending'
    ELSE 'approved'
  END,
  NULL,
  NOW()
FROM drivers d
ON CONFLICT DO NOTHING;

-- 8. Create Demo Driver Payouts
INSERT INTO driver_payouts (
  id,
  driver_id,
  city_id,
  period_start,
  period_end,
  base_earnings,
  bonus_amount,
  penalty_amount,
  total_amount,
  status,
  payment_method,
  payment_reference,
  paid_at,
  idempotency_key,
  created_at
)
VALUES 
  ('payout-001', 'driver-001', 'doha-city-uuid', '2024-02-01', '2024-02-15', 1200.00, 150.00, 0.00, 1350.00, 'paid', 'bank_transfer', 'TRX-20240215-001', NOW() - INTERVAL '5 days', 'payout-driver-001-20240201-20240215', NOW() - INTERVAL '5 days'),
  ('payout-002', 'driver-002', 'doha-city-uuid', '2024-02-01', '2024-02-15', 800.00, 100.00, 0.00, 900.00, 'paid', 'bank_transfer', 'TRX-20240215-002', NOW() - INTERVAL '5 days', 'payout-driver-002-20240201-20240215', NOW() - INTERVAL '5 days'),
  ('payout-003', 'driver-001', 'doha-city-uuid', '2024-02-16', '2024-02-29', 1100.00, 0.00, 50.00, 1050.00, 'pending', NULL, NULL, NULL, 'payout-driver-001-20240216-20240229', NOW() - INTERVAL '1 day'),
  ('payout-004', 'driver-007', 'al-rayyan-uuid', '2024-02-01', '2024-02-15', 950.00, 75.00, 0.00, 1025.00, 'paid', 'bank_transfer', 'TRX-20240215-003', NOW() - INTERVAL '5 days', 'payout-driver-007-20240201-20240215', NOW() - INTERVAL '5 days')
ON CONFLICT (idempotency_key) DO NOTHING;

-- 9. Create Demo Driver Activity Logs
INSERT INTO driver_activity_logs (driver_id, activity_type, details, created_at)
VALUES 
  ('driver-001', 'login', '{"ip": "192.168.1.100", "device": "mobile"}'::jsonb, NOW() - INTERVAL '2 hours'),
  ('driver-001', 'order_completed', '{"order_id": "ord-12345", "amount": 45.50}'::jsonb, NOW() - INTERVAL '1 hour'),
  ('driver-002', 'login', '{"ip": "192.168.1.101", "device": "mobile"}'::jsonb, NOW() - INTERVAL '3 hours'),
  ('driver-002', 'order_completed', '{"order_id": "ord-12346", "amount": 32.00}'::jsonb, NOW() - INTERVAL '2 hours'),
  ('driver-003', 'login', '{"ip": "192.168.1.102", "device": "mobile"}'::jsonb, NOW() - INTERVAL '4 hours'),
  ('driver-003', 'order_completed', '{"order_id": "ord-12347", "amount": 58.75}'::jsonb, NOW() - INTERVAL '30 minutes');

-- 10. Create Demo Fleet Activity Logs
INSERT INTO fleet_activity_logs (manager_id, city_id, action, entity_type, entity_id, new_values, created_at)
VALUES 
  ('demo-fleet-manager-uuid', 'doha-city-uuid', 'driver_created', 'driver', 'driver-005', '{"email": "fahad.driver@demo.qa"}'::jsonb, NOW() - INTERVAL '3 days'),
  ('demo-fleet-manager-uuid', 'doha-city-uuid', 'driver_status_changed', 'driver', 'driver-006', '{"status": "suspended", "reason": "Multiple violations"}'::jsonb, NOW() - INTERVAL '5 days');

-- ==========================================
-- DEMO ACCOUNT LOGIN CREDENTIALS
-- ==========================================
-- IMPORTANT: You must manually create these users in Supabase Auth first!
-- 
-- Go to: https://supabase.com/dashboard/project/_/auth/users
-- Or use the Supabase CLI: npx supabase auth signup
--
-- Fleet Manager Account:
-- Email: fleet.demo@nutriofuel.qa
-- Password: DemoFleet2024!
-- Role: fleet_manager (access to Doha and Al Rayyan)
--
-- Super Admin Account:
-- Email: admin.demo@nutriofuel.qa  
-- Password: DemoAdmin2024!
-- Role: super_admin (access to all cities)
--
-- After creating auth users, get their UUIDs and run:
-- UPDATE fleet_managers SET auth_user_id = 'actual-auth-uuid' WHERE email = 'fleet.demo@nutriofuel.qa';
-- ==========================================
