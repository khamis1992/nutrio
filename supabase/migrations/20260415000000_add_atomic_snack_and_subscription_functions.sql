-- Atomic snack usage increment to prevent race conditions
-- See: Dashboard Audit C-03

CREATE OR REPLACE FUNCTION public.increment_snack_usage(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_max_snacks INTEGER;
BEGIN
  SELECT snacks_used_this_month, snacks_per_month
  INTO v_current_count, v_max_snacks
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_max_snacks IS NOT NULL AND v_max_snacks > 0 AND v_current_count >= v_max_snacks THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET snacks_used_this_month = snacks_used_this_month + 1,
      updated_at = NOW()
  WHERE id = p_subscription_id;

  RETURN TRUE;
END;
$$;

-- Atomic pause subscription with state validation
-- See: Dashboard Audit H-01

CREATE OR REPLACE FUNCTION public.pause_subscription(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  SELECT status INTO v_current_status
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_current_status != 'active' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET status = 'pending',
      active = FALSE,
      updated_at = NOW()
  WHERE id = p_subscription_id;

  RETURN TRUE;
END;
$$;

-- Atomic resume subscription with state validation
-- See: Dashboard Audit H-01

CREATE OR REPLACE FUNCTION public.resume_subscription(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  SELECT status INTO v_current_status
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_current_status != 'pending' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET status = 'active',
      active = TRUE,
      updated_at = NOW()
  WHERE id = p_subscription_id;

  RETURN TRUE;
END;
$$;