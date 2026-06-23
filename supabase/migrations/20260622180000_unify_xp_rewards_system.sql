-- Unify XP, levels, badge rewards, and duplicate protection.

CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  source_id TEXT,
  xp_amount INTEGER NOT NULL CHECK (xp_amount <> 0),
  reason TEXT NOT NULL DEFAULT 'Activity',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_transactions_unique_source
  ON public.xp_transactions (user_id, action_type, COALESCE(source_id, '__none__'));

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_created
  ON public.xp_transactions (user_id, created_at DESC);

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own xp transactions" ON public.xp_transactions;
CREATE POLICY "Users can view own xp transactions"
  ON public.xp_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.reward_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  xp_required INTEGER,
  level_required INTEGER,
  badge_id TEXT REFERENCES public.badges(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('wallet_credit', 'discount', 'free_snack', 'free_delivery', 'badge_only')),
  reward_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (xp_required IS NOT NULL OR level_required IS NOT NULL OR badge_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_definitions_badge_active
  ON public.reward_definitions (badge_id)
  WHERE badge_id IS NOT NULL AND is_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_definitions_xp_active
  ON public.reward_definitions (xp_required)
  WHERE xp_required IS NOT NULL AND is_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_definitions_level_active
  ON public.reward_definitions (level_required)
  WHERE level_required IS NOT NULL AND is_active;

ALTER TABLE public.reward_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active rewards" ON public.reward_definitions;
CREATE POLICY "Anyone can view active rewards"
  ON public.reward_definitions FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_definition_id UUID REFERENCES public.reward_definitions(id) ON DELETE SET NULL,
  badge_id TEXT REFERENCES public.badges(id) ON DELETE SET NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('wallet_credit', 'discount', 'free_snack', 'free_delivery', 'badge_only')),
  reward_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'claimed', 'expired', 'failed')),
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_transactions_unique_definition
  ON public.reward_transactions (user_id, reward_definition_id)
  WHERE reward_definition_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_transactions_user_created
  ON public.reward_transactions (user_id, created_at DESC);

ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reward transactions" ON public.reward_transactions;
CREATE POLICY "Users can view own reward transactions"
  ON public.reward_transactions FOR SELECT
  USING (user_id = auth.uid());

INSERT INTO public.reward_definitions (title, description, xp_required, level_required, badge_id, reward_type, reward_value)
VALUES
  ('500 XP wallet credit', 'Earn QAR 5 wallet credit when you reach 500 XP.', 500, NULL, NULL, 'wallet_credit', 5),
  ('1000 XP discount', 'Unlock a QAR 10 discount at 1000 XP.', 1000, NULL, NULL, 'discount', 10),
  ('Level 5 free snack', 'Reach level 5 and unlock a free snack reward.', NULL, 5, NULL, 'free_snack', 1),
  ('Social Butterfly wallet credit', 'Refer 3 friends who subscribe and receive QAR 5 wallet credit.', NULL, NULL, 'social_butterfly', 'wallet_credit', 5)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_badge_reward(
  p_user_id UUID,
  p_badge_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.reward_definitions%ROWTYPE;
  v_reward_transaction_id UUID;
  v_wallet_transaction_id UUID;
  v_granted JSONB := '[]'::jsonb;
BEGIN
  FOR v_reward IN
    SELECT *
    FROM public.reward_definitions
    WHERE is_active = true
      AND badge_id = p_badge_id
  LOOP
    v_reward_transaction_id := NULL;

    INSERT INTO public.reward_transactions (
      user_id,
      reward_definition_id,
      badge_id,
      reward_type,
      reward_value,
      metadata
    )
    VALUES (
      p_user_id,
      v_reward.id,
      p_badge_id,
      v_reward.reward_type,
      v_reward.reward_value,
      jsonb_build_object('source', 'badge_unlock')
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_reward_transaction_id;

    IF v_reward_transaction_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_reward.reward_type = 'wallet_credit' AND v_reward.reward_value > 0 THEN
      v_wallet_transaction_id := public.credit_wallet(
        p_user_id,
        v_reward.reward_value,
        'reward',
        'reward',
        v_reward_transaction_id,
        v_reward.title,
        jsonb_build_object('badge_id', p_badge_id, 'reward_definition_id', v_reward.id)
      );

      UPDATE public.reward_transactions
      SET wallet_transaction_id = v_wallet_transaction_id
      WHERE id = v_reward_transaction_id;
    END IF;

    v_granted := v_granted || jsonb_build_array(jsonb_build_object(
      'reward_id', v_reward.id,
      'title', v_reward.title,
      'reward_type', v_reward.reward_type,
      'reward_value', v_reward.reward_value
    ));
  END LOOP;

  RETURN jsonb_build_object('success', true, 'rewards', v_granted);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_progress_rewards(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.reward_definitions%ROWTYPE;
  v_reward_transaction_id UUID;
  v_wallet_transaction_id UUID;
  v_lifetime_xp INTEGER;
  v_level INTEGER;
  v_granted JSONB := '[]'::jsonb;
BEGIN
  SELECT COALESCE(SUM(GREATEST(xp_amount, 0)), 0)
  INTO v_lifetime_xp
  FROM public.xp_transactions
  WHERE user_id = p_user_id;

  SELECT COALESCE(level, 1)
  INTO v_level
  FROM public.profiles
  WHERE user_id = p_user_id;

  FOR v_reward IN
    SELECT *
    FROM public.reward_definitions
    WHERE is_active = true
      AND badge_id IS NULL
      AND (
        (xp_required IS NOT NULL AND xp_required <= v_lifetime_xp)
        OR (level_required IS NOT NULL AND level_required <= v_level)
      )
    ORDER BY COALESCE(xp_required, 2147483647), COALESCE(level_required, 2147483647)
  LOOP
    v_reward_transaction_id := NULL;

    INSERT INTO public.reward_transactions (
      user_id,
      reward_definition_id,
      reward_type,
      reward_value,
      metadata
    )
    VALUES (
      p_user_id,
      v_reward.id,
      v_reward.reward_type,
      v_reward.reward_value,
      jsonb_build_object(
        'source', 'progress_reward',
        'lifetime_xp', v_lifetime_xp,
        'level', v_level
      )
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_reward_transaction_id;

    IF v_reward_transaction_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_reward.reward_type = 'wallet_credit' AND v_reward.reward_value > 0 THEN
      v_wallet_transaction_id := public.credit_wallet(
        p_user_id,
        v_reward.reward_value,
        'reward',
        'reward',
        v_reward_transaction_id,
        v_reward.title,
        jsonb_build_object('reward_definition_id', v_reward.id)
      );

      UPDATE public.reward_transactions
      SET wallet_transaction_id = v_wallet_transaction_id
      WHERE id = v_reward_transaction_id;
    END IF;

    v_granted := v_granted || jsonb_build_array(jsonb_build_object(
      'reward_id', v_reward.id,
      'title', v_reward.title,
      'reward_type', v_reward.reward_type,
      'reward_value', v_reward.reward_value
    ));
  END LOOP;

  RETURN jsonb_build_object('success', true, 'rewards', v_granted);
END;
$$;

DROP FUNCTION IF EXISTS public.award_xp(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_reason TEXT DEFAULT 'Activity',
  p_action_type TEXT DEFAULT 'activity',
  p_source_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_xp_to_next INTEGER;
  v_leveled_up BOOLEAN := false;
  v_transaction_id UUID;
  v_progress_rewards JSONB;
BEGIN
  SELECT COALESCE(xp, 0), COALESCE(level, 1)
  INTO v_current_xp, v_current_level
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  INSERT INTO public.xp_transactions (
    user_id,
    action_type,
    source_id,
    xp_amount,
    reason,
    metadata
  )
  VALUES (
    p_user_id,
    p_action_type,
    p_source_id,
    p_xp_amount,
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate', true,
      'xp_awarded', 0,
      'total_xp', v_current_xp,
      'new_level', v_current_level,
      'leveled_up', false,
      'reason', p_reason
    );
  END IF;

  v_new_xp := GREATEST(0, v_current_xp + p_xp_amount);
  v_new_level := v_current_level;
  v_xp_to_next := GREATEST(100, v_new_level * 100);

  WHILE v_new_xp >= v_xp_to_next LOOP
    v_new_xp := v_new_xp - v_xp_to_next;
    v_new_level := v_new_level + 1;
    v_xp_to_next := GREATEST(100, v_new_level * 100);
    v_leveled_up := true;
  END LOOP;

  WHILE v_new_xp < 0 AND v_new_level > 1 LOOP
    v_new_level := v_new_level - 1;
    v_xp_to_next := GREATEST(100, v_new_level * 100);
    v_new_xp := v_new_xp + v_xp_to_next;
  END LOOP;

  UPDATE public.profiles
  SET
    xp = v_new_xp,
    level = v_new_level,
    updated_at = now()
  WHERE user_id = p_user_id;

  v_progress_rewards := public.grant_progress_rewards(p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'xp_awarded', p_xp_amount,
    'total_xp', v_new_xp,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up,
    'xp_to_next_level', v_xp_to_next - v_new_xp,
    'reason', p_reason,
    'rewards', v_progress_rewards
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak_days INTEGER;
  v_meals_logged INTEGER;
  v_badge_record public.badges%ROWTYPE;
  v_awarded_badges TEXT[] := ARRAY[]::TEXT[];
  v_reward_results JSONB := '[]'::jsonb;
BEGIN
  SELECT COALESCE(streak_days, 0), COALESCE(total_meals_logged, 0)
  INTO v_streak_days, v_meals_logged
  FROM public.profiles
  WHERE user_id = p_user_id;

  FOR v_badge_record IN SELECT * FROM public.badges LOOP
    IF EXISTS (
      SELECT 1 FROM public.user_badges
      WHERE user_id = p_user_id AND badge_id = v_badge_record.id
    ) THEN
      CONTINUE;
    END IF;

    IF (
      v_badge_record.requirement_type = 'streak_days'
      AND v_streak_days >= v_badge_record.requirement_value
    ) OR (
      v_badge_record.requirement_type = 'meals_logged'
      AND v_meals_logged >= v_badge_record.requirement_value
    ) THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (p_user_id, v_badge_record.id)
      ON CONFLICT DO NOTHING;

      PERFORM public.award_xp(
        p_user_id,
        v_badge_record.xp_reward,
        'Badge unlocked: ' || v_badge_record.name,
        'badge_unlock',
        v_badge_record.id,
        jsonb_build_object('badge_id', v_badge_record.id)
      );

      v_reward_results := v_reward_results || jsonb_build_array(public.grant_badge_reward(p_user_id, v_badge_record.id));
      v_awarded_badges := array_append(v_awarded_badges, v_badge_record.id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'awarded_badges', v_awarded_badges,
    'count', COALESCE(array_length(v_awarded_badges, 1), 0),
    'rewards', v_reward_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_award_badges(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_badge_reward(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_progress_rewards(UUID) TO authenticated;

COMMENT ON TABLE public.xp_transactions IS 'Append-only XP ledger. Prevents duplicate XP grants for the same user/action/source.';
COMMENT ON TABLE public.reward_definitions IS 'Configurable XP, level, and badge rewards.';
COMMENT ON TABLE public.reward_transactions IS 'Tracks rewards granted to users and linked wallet credits.';
