-- Migration: Enable Supabase Realtime on key tables
-- Date: 2026-03-18
-- Purpose: Enable real-time subscriptions for orders, deliveries, drivers

-- Enable realtime for orders table
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Enable realtime for deliveries table  
ALTER TABLE deliveries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;

-- Enable realtime for drivers table (for location tracking)
ALTER TABLE drivers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;

-- Enable realtime for meal_schedules table (order schedule updates)
ALTER TABLE meal_schedules REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_schedules;

-- Enable realtime for notifications table (push notification sync)
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;