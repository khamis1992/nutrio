-- Make challenge XP and wallet rewards replay-safe, reversible, and auditable.

ALTER TABLE public.customer_wallets
  ADD COLUMN IF NOT EXISTS reward_adjustment_due NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.customer_wallets
  DROP CONSTRAINT IF EXISTS customer_wallets_reward_adjustment_due_check;

ALTER TABLE public.customer_wallets
  ADD CONSTRAINT customer_wallets_reward_adjustment_due_check
  CHECK (reward_adjustment_due >= 0);

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_wallet_transactions_user_idempotency_key
  ON public.wallet_transactions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_reference_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_reference_type_check
  CHECK (
    reference_type IS NULL
    OR reference_type IN (
      'topup',
      'order',
      'refund',
      'bonus',
      'cashback',
      'withdrawal',
      'admin_adjustment',
      'community_challenge'
    )
  );

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS reward_wallet_gross_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_wallet_credited_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_wallet_recovery_applied NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_wallet_pending_recovery NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_wallet_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_wallet_reversal_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_wallet_reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_settlement_finalized_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.community_challenge_reward_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.challenge_participants(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completion_version INTEGER NOT NULL CHECK (completion_version > 0),
  source_key TEXT NOT NULL,
  gross_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  credited_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (credited_amount >= 0),
  recovery_applied NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (recovery_applied >= 0),
  reversed_debit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (reversed_debit_amount >= 0),
  pending_recovery_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (pending_recovery_amount >= 0),
  status TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'reversed')),
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  wallet_reversal_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  reward_transaction_id UUID REFERENCES public.reward_transactions(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (participant_id, completion_version),
  UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS idx_challenge_reward_settlements_user_created
  ON public.community_challenge_reward_settlements(user_id, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_challenge_reward_settlements_pending
  ON public.community_challenge_reward_settlements(user_id, pending_recovery_amount)
  WHERE pending_recovery_amount > 0;

ALTER TABLE public.community_challenge_reward_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their challenge reward settlements"
  ON public.community_challenge_reward_settlements;

CREATE POLICY "Users can view their challenge reward settlements"
  ON public.community_challenge_reward_settlements
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.grant_community_challenge_wallet_reward(
  p_user_id UUID,
  p_challenge_id UUID,
  p_participant_id UUID,
  p_completion_version INTEGER,
  p_source_key TEXT,
  p_gross_amount NUMERIC,
  p_challenge_title TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.community_challenge_reward_settlements%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_recovery_applied NUMERIC(10, 2) := 0;
  v_credited_amount NUMERIC(10, 2) := 0;
  v_wallet_transaction_id UUID;
  v_reward_transaction_id UUID;
  v_settlement_id UUID;
  v_gross_amount NUMERIC(10, 2) := greatest(coalesce(p_gross_amount, 0), 0);
BEGIN
  IF p_user_id IS NULL OR p_challenge_id IS NULL OR p_participant_id IS NULL
     OR p_completion_version <= 0 OR nullif(btrim(p_source_key), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_CHALLENGE_REWARD_INPUT';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('challenge-wallet:' || p_user_id::TEXT || ':' || p_source_key, 0)
  );

  SELECT * INTO v_existing
  FROM public.community_challenge_reward_settlements
  WHERE participant_id = p_participant_id
    AND completion_version = p_completion_version;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'settlement_id', v_existing.id,
      'gross_amount', v_existing.gross_amount,
      'credited_amount', v_existing.credited_amount,
      'recovery_applied', v_existing.recovery_applied,
      'status', v_existing.status
    );
  END IF;

  INSERT INTO public.customer_wallets (
    user_id, balance, total_credits, total_debits, is_active, reward_adjustment_due
  ) VALUES (
    p_user_id, 0, 0, 0, true, 0
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.customer_wallets
  WHERE user_id = p_user_id
    AND coalesce(is_active, true)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND_OR_INACTIVE';
  END IF;

  v_recovery_applied := least(coalesce(v_wallet.reward_adjustment_due, 0), v_gross_amount);
  v_credited_amount := v_gross_amount - v_recovery_applied;

  UPDATE public.customer_wallets
  SET balance = coalesce(balance, 0) + v_credited_amount,
      total_credits = coalesce(total_credits, 0) + v_credited_amount,
      reward_adjustment_due = greatest(coalesce(reward_adjustment_due, 0) - v_recovery_applied, 0),
      updated_at = now()
  WHERE id = v_wallet.id;

  IF v_credited_amount > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id,
      user_id,
      type,
      amount,
      balance_after,
      reference_type,
      reference_id,
      description,
      metadata,
      idempotency_key
    ) VALUES (
      v_wallet.id,
      p_user_id,
      'bonus',
      v_credited_amount,
      coalesce(v_wallet.balance, 0) + v_credited_amount,
      'community_challenge',
      p_challenge_id,
      'Community challenge reward: ' || coalesce(p_challenge_title, 'Challenge'),
      jsonb_build_object(
        'source_key', p_source_key,
        'completion_version', p_completion_version,
        'gross_amount', v_gross_amount,
        'credited_amount', v_credited_amount,
        'recovery_applied', v_recovery_applied
      ),
      'challenge-reward:' || p_user_id::TEXT || ':' || p_source_key
    )
    RETURNING id INTO v_wallet_transaction_id;
  END IF;

  INSERT INTO public.reward_transactions (
    user_id,
    reward_type,
    reward_value,
    status,
    wallet_transaction_id,
    metadata
  ) VALUES (
    p_user_id,
    'wallet_credit',
    v_credited_amount,
    CASE WHEN v_credited_amount > 0 THEN 'granted' ELSE 'expired' END,
    v_wallet_transaction_id,
    jsonb_build_object(
      'source_key', p_source_key,
      'challenge_id', p_challenge_id,
      'completion_version', p_completion_version,
      'gross_amount', v_gross_amount,
      'credited_amount', v_credited_amount,
      'recovery_applied', v_recovery_applied
    )
  )
  RETURNING id INTO v_reward_transaction_id;

  INSERT INTO public.community_challenge_reward_settlements (
    participant_id,
    challenge_id,
    user_id,
    completion_version,
    source_key,
    gross_amount,
    credited_amount,
    recovery_applied,
    wallet_transaction_id,
    reward_transaction_id,
    metadata
  ) VALUES (
    p_participant_id,
    p_challenge_id,
    p_user_id,
    p_completion_version,
    p_source_key,
    v_gross_amount,
    v_credited_amount,
    v_recovery_applied,
    v_wallet_transaction_id,
    v_reward_transaction_id,
    jsonb_build_object('challenge_title', p_challenge_title)
  )
  RETURNING id INTO v_settlement_id;

  UPDATE public.challenge_participants
  SET reward_wallet_gross_amount = v_gross_amount,
      reward_wallet_credited_amount = v_credited_amount,
      reward_wallet_recovery_applied = v_recovery_applied,
      reward_wallet_pending_recovery = 0,
      reward_wallet_transaction_id = v_wallet_transaction_id,
      reward_wallet_reversal_transaction_id = NULL,
      reward_wallet_reversed_at = NULL,
      updated_at = now()
  WHERE id = p_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'settlement_id', v_settlement_id,
    'gross_amount', v_gross_amount,
    'credited_amount', v_credited_amount,
    'recovery_applied', v_recovery_applied,
    'wallet_transaction_id', v_wallet_transaction_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_community_challenge_wallet_reward(
  p_user_id UUID,
  p_participant_id UUID,
  p_completion_version INTEGER,
  p_reason TEXT DEFAULT 'Challenge evidence no longer qualifies'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement public.community_challenge_reward_settlements%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_debit_amount NUMERIC(10, 2) := 0;
  v_pending_recovery NUMERIC(10, 2) := 0;
  v_reversal_transaction_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'challenge-wallet-reversal:' || p_user_id::TEXT || ':' || p_participant_id::TEXT || ':' || p_completion_version::TEXT,
      0
    )
  );

  SELECT * INTO v_settlement
  FROM public.community_challenge_reward_settlements
  WHERE participant_id = p_participant_id
    AND completion_version = p_completion_version
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'missing_settlement', true);
  END IF;

  IF v_settlement.status = 'reversed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'debited_amount', v_settlement.reversed_debit_amount,
      'pending_recovery', v_settlement.pending_recovery_amount
    );
  END IF;

  SELECT * INTO v_wallet
  FROM public.customer_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_debit_amount := least(coalesce(v_wallet.balance, 0), v_settlement.credited_amount);
  v_pending_recovery := greatest(v_settlement.gross_amount - v_debit_amount, 0);

  UPDATE public.customer_wallets
  SET balance = greatest(coalesce(balance, 0) - v_debit_amount, 0),
      total_debits = coalesce(total_debits, 0) + v_debit_amount,
      reward_adjustment_due = coalesce(reward_adjustment_due, 0) + v_pending_recovery,
      updated_at = now()
  WHERE id = v_wallet.id;

  IF v_debit_amount > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id,
      user_id,
      type,
      amount,
      balance_after,
      reference_type,
      reference_id,
      description,
      metadata,
      idempotency_key
    ) VALUES (
      v_wallet.id,
      p_user_id,
      'debit',
      v_debit_amount,
      greatest(coalesce(v_wallet.balance, 0) - v_debit_amount, 0),
      'community_challenge',
      v_settlement.challenge_id,
      coalesce(p_reason, 'Challenge reward reversed'),
      jsonb_build_object(
        'source_key', v_settlement.source_key,
        'compensates_wallet_transaction_id', v_settlement.wallet_transaction_id,
        'gross_amount', v_settlement.gross_amount,
        'debited_amount', v_debit_amount,
        'pending_recovery', v_pending_recovery
      ),
      'challenge-reversal:' || p_user_id::TEXT || ':' || v_settlement.source_key
    )
    RETURNING id INTO v_reversal_transaction_id;
  END IF;

  UPDATE public.reward_transactions
  SET status = 'expired',
      metadata = coalesce(metadata, '{}'::JSONB) || jsonb_build_object(
        'reversed_at', now(),
        'reversal_transaction_id', v_reversal_transaction_id,
        'pending_recovery', v_pending_recovery
      )
  WHERE id = v_settlement.reward_transaction_id;

  UPDATE public.community_challenge_reward_settlements
  SET status = 'reversed',
      reversed_debit_amount = v_debit_amount,
      pending_recovery_amount = v_pending_recovery,
      wallet_reversal_transaction_id = v_reversal_transaction_id,
      reversed_at = now(),
      metadata = metadata || jsonb_build_object('reversal_reason', p_reason)
  WHERE id = v_settlement.id;

  UPDATE public.challenge_participants
  SET reward_wallet_pending_recovery = v_pending_recovery,
      reward_wallet_reversal_transaction_id = v_reversal_transaction_id,
      reward_wallet_reversed_at = now(),
      updated_at = now()
  WHERE id = p_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'debited_amount', v_debit_amount,
    'pending_recovery', v_pending_recovery,
    'wallet_reversal_transaction_id', v_reversal_transaction_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_community_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_challenge public.community_challenges%ROWTYPE;
  v_type TEXT;
  v_progress INTEGER := 0;
  v_protein_target INTEGER := 120;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_challenge
  FROM public.community_challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_type := lower(coalesce(v_challenge.challenge_type, ''));
  v_window_start := v_challenge.start_date::TIMESTAMP AT TIME ZONE 'Asia/Qatar';
  v_window_end := (v_challenge.end_date + 1)::TIMESTAMP AT TIME ZONE 'Asia/Qatar';

  IF v_type IN ('meals', 'meal_logging') THEN
    SELECT count(*)::INTEGER INTO v_progress
    FROM public.meal_history mh
    WHERE mh.user_id = p_user_id
      AND mh.logged_at >= v_window_start
      AND mh.logged_at < v_window_end;

  ELSIF v_type = 'streak' THEN
    SELECT count(DISTINCT pl.log_date)::INTEGER INTO v_progress
    FROM public.progress_logs pl
    WHERE pl.user_id = p_user_id
      AND pl.log_date BETWEEN v_challenge.start_date AND v_challenge.end_date
      AND coalesce(pl.calories_consumed, 0) > 0;

  ELSIF v_type IN ('protein', 'nutrition') THEN
    SELECT coalesce((
      SELECT ng.protein_target_g
      FROM public.nutrition_goals ng
      WHERE ng.user_id = p_user_id AND ng.is_active = true
      ORDER BY ng.created_at DESC
      LIMIT 1
    ), 120) INTO v_protein_target;

    SELECT count(DISTINCT pl.log_date)::INTEGER INTO v_progress
    FROM public.progress_logs pl
    WHERE pl.user_id = p_user_id
      AND pl.log_date BETWEEN v_challenge.start_date AND v_challenge.end_date
      AND coalesce(pl.protein_consumed_g, 0) >= greatest(v_protein_target, 1);

  ELSIF v_type IN ('water', 'hydration') THEN
    SELECT count(*)::INTEGER INTO v_progress
    FROM (
      SELECT sum(coalesce(we.amount_ml, 0)) AS total_ml
      FROM public.water_entries we
      WHERE we.user_id = p_user_id
        AND we.log_date BETWEEN v_challenge.start_date AND v_challenge.end_date
      GROUP BY we.log_date
    ) hydration_days
    WHERE hydration_days.total_ml >= 2500;

  ELSIF v_type IN ('activity', 'workout') THEN
    SELECT count(DISTINCT ws.session_date)::INTEGER INTO v_progress
    FROM public.workout_sessions ws
    WHERE ws.user_id = p_user_id
      AND ws.session_date BETWEEN v_challenge.start_date AND v_challenge.end_date
      AND (coalesce(ws.duration_minutes, 0) > 0 OR coalesce(ws.calories_burned, 0) > 0);

  ELSIF v_type = 'coach' THEN
    IF to_regclass('public.program_meal_completions') IS NOT NULL THEN
      SELECT count(*)::INTEGER INTO v_progress
      FROM public.program_meal_completions pmc
      WHERE pmc.client_id = p_user_id
        AND pmc.completed_at >= v_window_start
        AND pmc.completed_at < v_window_end;
    END IF;

    IF to_regclass('public.program_exercise_completions') IS NOT NULL THEN
      v_progress := v_progress + coalesce((
        SELECT count(*)::INTEGER
        FROM public.program_exercise_completions pec
        WHERE pec.client_id = p_user_id
          AND pec.completed_at >= v_window_start
          AND pec.completed_at < v_window_end
      ), 0);
    END IF;

    IF to_regclass('public.coach_workout_sessions') IS NOT NULL THEN
      v_progress := v_progress + coalesce((
        SELECT count(*)::INTEGER
        FROM public.coach_workout_sessions cws
        WHERE cws.user_id = p_user_id
          AND cws.completed_at >= v_window_start
          AND cws.completed_at < v_window_end
      ), 0);
    END IF;

  ELSIF v_type = 'referral' THEN
    SELECT count(*)::INTEGER INTO v_progress
    FROM public.referrals r
    WHERE r.referrer_id = p_user_id
      AND r.status = 'completed'
      AND r.completed_at >= v_window_start
      AND r.completed_at < v_window_end;

  ELSIF v_type = 'subscription' THEN
    SELECT count(*)::INTEGER INTO v_progress
    FROM generate_series(v_challenge.start_date, v_challenge.end_date, interval '1 day') challenge_day(day)
    WHERE EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
        AND (s.active = true OR s.status = 'active')
        AND coalesce(s.start_date::DATE, s.created_at::DATE, v_challenge.start_date) <= challenge_day.day::DATE
        AND coalesce(s.end_date::DATE, s.next_renewal_date::DATE, v_challenge.end_date) >= challenge_day.day::DATE
    );

  ELSE
    SELECT coalesce(cp.current_progress, 0) INTO v_progress
    FROM public.challenge_participants cp
    WHERE cp.user_id = p_user_id
      AND cp.challenge_id = p_challenge_id
    LIMIT 1;
  END IF;

  RETURN greatest(coalesce(v_progress, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_community_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.challenge_participants%ROWTYPE;
  v_challenge public.community_challenges%ROWTYPE;
  v_progress INTEGER;
  v_new_progress INTEGER;
  v_reward_version INTEGER;
  v_reward_source TEXT;
  v_reward_amount INTEGER;
  v_xp_result JSONB := NULL;
  v_wallet_result JSONB := NULL;
  v_qatar_today DATE := (now() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_can_award BOOLEAN := false;
  v_has_wallet_settlement BOOLEAN := false;
BEGIN
  SELECT * INTO v_participant
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not participating in this challenge');
  END IF;

  SELECT * INTO v_challenge
  FROM public.community_challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not found');
  END IF;

  v_progress := public.calculate_community_challenge_progress(p_user_id, p_challenge_id);
  v_new_progress := least(greatest(v_progress, 0), greatest(coalesce(v_challenge.target_value, 0), 0));
  v_can_award := v_challenge.target_value > 0
    AND v_challenge.start_date <= v_qatar_today
    AND (coalesce(v_challenge.is_active, false) OR v_challenge.end_date < v_qatar_today);

  IF v_can_award
     AND v_new_progress >= v_challenge.target_value
     AND v_participant.completed_at IS NULL THEN
    v_reward_version := greatest(v_participant.completion_version, 0) + 1;
    v_reward_source := p_challenge_id::TEXT || ':v' || v_reward_version;
    v_reward_amount := greatest(coalesce(v_challenge.xp_reward, v_challenge.reward_points, 100), 0);

    IF v_reward_amount > 0 THEN
      v_xp_result := public.award_xp(
        p_user_id,
        v_reward_amount,
        'Community challenge completed: ' || coalesce(v_challenge.title, 'Challenge'),
        'community_challenge_complete',
        v_reward_source,
        jsonb_build_object('challenge_id', p_challenge_id, 'completion_version', v_reward_version)
      );
    END IF;

    v_wallet_result := public.grant_community_challenge_wallet_reward(
      p_user_id,
      p_challenge_id,
      v_participant.id,
      v_reward_version,
      v_reward_source,
      coalesce(v_challenge.wallet_reward_amount, 0),
      v_challenge.title
    );

    UPDATE public.challenge_participants
    SET current_progress = v_new_progress,
        completed_at = now(),
        completion_version = v_reward_version,
        reward_source_id = v_reward_source,
        reward_xp_amount = v_reward_amount,
        reward_reversed_at = NULL,
        reward_settlement_finalized_at = CASE
          WHEN v_challenge.end_date < v_qatar_today THEN now()
          ELSE reward_settlement_finalized_at
        END,
        updated_at = now()
    WHERE id = v_participant.id;

  ELSIF v_new_progress >= v_challenge.target_value
     AND v_participant.completed_at IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.community_challenge_reward_settlements settlement
      WHERE settlement.participant_id = v_participant.id
        AND settlement.completion_version = greatest(v_participant.completion_version, 1)
    ) INTO v_has_wallet_settlement;

    IF NOT v_has_wallet_settlement THEN
      v_wallet_result := public.grant_community_challenge_wallet_reward(
        p_user_id,
        p_challenge_id,
        v_participant.id,
        greatest(v_participant.completion_version, 1),
        coalesce(v_participant.reward_source_id, p_challenge_id::TEXT || ':v1'),
        coalesce(v_challenge.wallet_reward_amount, 0),
        v_challenge.title
      );
    END IF;

    UPDATE public.challenge_participants
    SET current_progress = v_new_progress,
        reward_settlement_finalized_at = CASE
          WHEN v_challenge.end_date < v_qatar_today THEN now()
          ELSE reward_settlement_finalized_at
        END,
        updated_at = now()
    WHERE id = v_participant.id;

  ELSIF (v_challenge.target_value <= 0 OR v_new_progress < v_challenge.target_value)
     AND v_participant.completed_at IS NOT NULL THEN
    IF v_participant.reward_xp_amount > 0 AND v_participant.reward_source_id IS NOT NULL THEN
      v_xp_result := public.award_xp(
        p_user_id,
        -v_participant.reward_xp_amount,
        'Community challenge evidence reversed: ' || coalesce(v_challenge.title, 'Challenge'),
        'community_challenge_reversed',
        v_participant.reward_source_id,
        jsonb_build_object(
          'challenge_id', p_challenge_id,
          'completion_version', v_participant.completion_version,
          'compensates_action', 'community_challenge_complete'
        )
      );
      PERFORM public.rebuild_xp_profile_from_ledger(p_user_id);
    END IF;

    v_wallet_result := public.reverse_community_challenge_wallet_reward(
      p_user_id,
      v_participant.id,
      greatest(v_participant.completion_version, 1),
      'Community challenge evidence reversed: ' || coalesce(v_challenge.title, 'Challenge')
    );

    UPDATE public.challenge_participants
    SET current_progress = v_new_progress,
        completed_at = NULL,
        reward_reversed_at = now(),
        reward_settlement_finalized_at = CASE
          WHEN v_challenge.end_date < v_qatar_today THEN now()
          ELSE reward_settlement_finalized_at
        END,
        updated_at = now()
    WHERE id = v_participant.id;

  ELSE
    UPDATE public.challenge_participants
    SET current_progress = v_new_progress,
        reward_settlement_finalized_at = CASE
          WHEN v_challenge.end_date < v_qatar_today THEN now()
          ELSE reward_settlement_finalized_at
        END,
        updated_at = now()
    WHERE id = v_participant.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'completed', v_challenge.target_value > 0 AND v_new_progress >= v_challenge.target_value,
    'progress', v_new_progress,
    'target', v_challenge.target_value,
    'reward_version', coalesce(v_reward_version, v_participant.completion_version),
    'xp', v_xp_result,
    'wallet', v_wallet_result,
    'settlement_finalized', v_challenge.end_date < v_qatar_today,
    'reason_code', CASE lower(coalesce(v_challenge.challenge_type, ''))
      WHEN 'meals' THEN 'verified_meal_logs'
      WHEN 'meal_logging' THEN 'verified_meal_logs'
      WHEN 'activity' THEN 'verified_activity_days'
      WHEN 'workout' THEN 'verified_activity_days'
      WHEN 'water' THEN 'verified_hydration_days'
      WHEN 'hydration' THEN 'verified_hydration_days'
      ELSE 'verified_challenge_evidence'
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_community_challenge_progress_for_user(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant RECORD;
  v_result JSONB;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing user id');
  END IF;

  FOR v_participant IN
    SELECT cp.challenge_id
    FROM public.challenge_participants cp
    JOIN public.community_challenges cc ON cc.id = cp.challenge_id
    WHERE cp.user_id = p_user_id
    ORDER BY cc.start_date DESC, cp.joined_at DESC
  LOOP
    v_result := public.apply_community_challenge_progress(p_user_id, v_participant.challenge_id);
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('challenge_id', v_participant.challenge_id, 'result', v_result)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'results', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_ended_community_challenges(
  p_limit INTEGER DEFAULT 250
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant RECORD;
  v_result JSONB;
  v_results JSONB := '[]'::JSONB;
  v_count INTEGER := 0;
  v_qatar_today DATE := (now() AT TIME ZONE 'Asia/Qatar')::DATE;
BEGIN
  FOR v_participant IN
    SELECT cp.user_id, cp.challenge_id
    FROM public.challenge_participants cp
    JOIN public.community_challenges cc ON cc.id = cp.challenge_id
    WHERE cc.end_date < v_qatar_today
      AND cp.reward_settlement_finalized_at IS NULL
    ORDER BY cc.end_date, cp.joined_at
    LIMIT greatest(least(coalesce(p_limit, 250), 1000), 1)
    FOR UPDATE OF cp SKIP LOCKED
  LOOP
    v_result := public.apply_community_challenge_progress(
      v_participant.user_id,
      v_participant.challenge_id
    );
    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_participant.user_id,
        'challenge_id', v_participant.challenge_id,
        'result', v_result
      )
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_count, 'results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_community_challenge_wallet_reward(UUID, UUID, UUID, INTEGER, TEXT, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_community_challenge_wallet_reward(UUID, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_community_challenge_progress(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_community_challenge_progress(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_community_challenge_progress_for_user(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_ended_community_challenges(INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_my_community_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ended_community_challenges(INTEGER) TO service_role;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR v_job_id IN
      SELECT jobid FROM cron.job WHERE jobname = 'settle-ended-community-challenges'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;

    PERFORM cron.schedule(
      'settle-ended-community-challenges',
      '17 * * * *',
      'SELECT public.settle_ended_community_challenges(250);'
    );
  END IF;
END;
$$;

COMMENT ON COLUMN public.customer_wallets.reward_adjustment_due IS
  'Invalidated reward credit that could not be recovered without making the wallet negative; future reward credits offset it first.';
COMMENT ON TABLE public.community_challenge_reward_settlements IS
  'Immutable-per-version audit record connecting challenge completion to wallet grant and compensating reversal.';
COMMENT ON FUNCTION public.settle_ended_community_challenges(INTEGER) IS
  'Finalizes ended challenge evidence and rewards in replay-safe batches.';
