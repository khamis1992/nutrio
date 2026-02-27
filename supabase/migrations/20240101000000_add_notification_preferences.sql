-- Migration: Notification Preferences System
-- Date: 2024-01-01
-- Description: Adds notification preferences to profiles and creates push_tokens table for FCM

-- ========================================
-- STEP 1: Add notification_preferences column to profiles
-- ========================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT jsonb_build_object(
  'email', jsonb_build_object(
    'marketing', true,
    'order_updates', true,
    'promotions', true,
    'newsletter', false,
    'security_alerts', true
  ),
  'push', jsonb_build_object(
    'order_updates', true,
    'delivery_updates', true,
    'promotions', false,
    'meal_reminders', true,
    'achievement_notifications', true
  ),
  'sms', jsonb_build_object(
    'order_updates', true,
    'delivery_updates', true,
    'marketing', false
  ),
  'whatsapp', jsonb_build_object(
    'order_updates', true,
    'delivery_updates', true,
    'support', true
  )
);

-- Add index for efficient querying of notification settings
CREATE INDEX IF NOT EXISTS idx_profiles_notification_prefs 
ON public.profiles USING GIN (notification_preferences);

-- ========================================
-- STEP 2: Create push_tokens table for FCM tokens
-- ========================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, token)
);

-- Indexes for push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON public.push_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(is_active) WHERE is_active = true;

-- ========================================
-- STEP 3: Enable RLS on push_tokens
-- ========================================

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push tokens
DROP POLICY IF EXISTS "Users can view their own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view their own push tokens"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert their own push tokens"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update their own push tokens"
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete their own push tokens"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all tokens (for push notification delivery)
DROP POLICY IF EXISTS "Service role can manage all push tokens" ON public.push_tokens;
CREATE POLICY "Service role can manage all push tokens"
  ON public.push_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- STEP 4: Create helper functions
-- ========================================

-- Function to get user's active push tokens
CREATE OR REPLACE FUNCTION public.get_user_push_tokens(p_user_id UUID)
RETURNS TABLE(token TEXT, platform TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.token, pt.platform
  FROM public.push_tokens pt
  WHERE pt.user_id = p_user_id
    AND pt.is_active = true
  ORDER BY pt.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update token last_used timestamp
CREATE OR REPLACE FUNCTION public.update_push_token_usage(p_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.push_tokens
  SET last_used_at = now()
  WHERE token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate old tokens (cleanup)
CREATE OR REPLACE FUNCTION public.deactivate_old_push_tokens(
  p_user_id UUID,
  p_keep_count INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
  v_deactivated_count INTEGER;
BEGIN
  WITH tokens_to_deactivate AS (
    SELECT id
    FROM public.push_tokens
    WHERE user_id = p_user_id
      AND is_active = true
    ORDER BY last_used_at DESC
    OFFSET p_keep_count
  )
  UPDATE public.push_tokens
  SET is_active = false,
      updated_at = now()
  WHERE id IN (SELECT id FROM tokens_to_deactivate);
  
  GET DIAGNOSTICS v_deactivated_count = ROW_COUNT;
  RETURN v_deactivated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 5: Create updated_at trigger
-- ========================================

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- STEP 6: Add comments
-- ========================================

COMMENT ON COLUMN public.profiles.notification_preferences IS 'JSONB storing user notification preferences by channel (email, push, sms, whatsapp)';
COMMENT ON TABLE public.push_tokens IS 'Stores FCM push notification tokens for mobile and web devices';
COMMENT ON COLUMN public.push_tokens.device_info IS 'JSONB containing device metadata (model, OS version, app version)';
