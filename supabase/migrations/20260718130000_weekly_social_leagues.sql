-- Weekly social leagues built on the append-only XP ledger.

CREATE TABLE IF NOT EXISTS public.social_league_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_on DATE NOT NULL UNIQUE,
  ends_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_league_season_length CHECK (ends_on = starts_on + 6)
);

CREATE TABLE IF NOT EXISTS public.social_league_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.social_league_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'bronze'
    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  group_id UUID NOT NULL,
  starting_xp INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  rank INTEGER CHECK (rank IS NULL OR rank > 0),
  movement TEXT NOT NULL DEFAULT 'new'
    CHECK (movement IN ('new', 'same', 'promoted', 'demoted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_league_memberships_group_rank
  ON public.social_league_memberships (season_id, group_id, rank);
CREATE INDEX IF NOT EXISTS idx_social_league_memberships_user_season
  ON public.social_league_memberships (user_id, season_id);

ALTER TABLE public.social_league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_league_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read league seasons" ON public.social_league_seasons;
CREATE POLICY "Authenticated users read league seasons"
  ON public.social_league_seasons FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users read own league membership" ON public.social_league_memberships;
CREATE POLICY "Users read own league membership"
  ON public.social_league_memberships FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.social_league_tier_step(p_tier TEXT, p_direction INTEGER)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_direction > 0 THEN CASE p_tier
      WHEN 'bronze' THEN 'silver'
      WHEN 'silver' THEN 'gold'
      WHEN 'gold' THEN 'platinum'
      WHEN 'platinum' THEN 'diamond'
      ELSE 'diamond'
    END
    WHEN p_direction < 0 THEN CASE p_tier
      WHEN 'diamond' THEN 'platinum'
      WHEN 'platinum' THEN 'gold'
      WHEN 'gold' THEN 'silver'
      WHEN 'silver' THEN 'bronze'
      ELSE 'bronze'
    END
    ELSE p_tier
  END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_social_league_group(
  p_season_id UUID,
  p_group_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  SELECT starts_on, ends_on INTO v_start, v_end
  FROM public.social_league_seasons
  WHERE id = p_season_id;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'LEAGUE_SEASON_NOT_FOUND';
  END IF;

  UPDATE public.social_league_memberships membership
  SET score = COALESCE((
        SELECT SUM(transaction.xp_amount)::INTEGER
        FROM public.xp_transactions transaction
        WHERE transaction.user_id = membership.user_id
          AND transaction.xp_amount > 0
          AND transaction.created_at >= (v_start::TIMESTAMP AT TIME ZONE 'Asia/Qatar')
          AND transaction.created_at < ((v_end + 1)::TIMESTAMP AT TIME ZONE 'Asia/Qatar')
      ), 0),
      updated_at = now()
  WHERE membership.season_id = p_season_id
    AND membership.group_id = p_group_id;

  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC, user_id ASC)::INTEGER AS new_rank
    FROM public.social_league_memberships
    WHERE season_id = p_season_id AND group_id = p_group_id
  )
  UPDATE public.social_league_memberships membership
  SET rank = ranked.new_rank
  FROM ranked
  WHERE membership.id = ranked.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_social_league_membership()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_week_start DATE;
  v_season public.social_league_seasons%ROWTYPE;
  v_existing public.social_league_memberships%ROWTYPE;
  v_previous public.social_league_memberships%ROWTYPE;
  v_previous_count INTEGER := 0;
  v_tier TEXT := 'bronze';
  v_movement TEXT := 'new';
  v_group_id UUID;
  v_starting_xp INTEGER := 0;
  v_membership_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  v_week_start := v_today - (EXTRACT(ISODOW FROM v_today)::INTEGER - 1);

  INSERT INTO public.social_league_seasons (starts_on, ends_on)
  VALUES (v_week_start, v_week_start + 6)
  ON CONFLICT (starts_on) DO NOTHING;

  SELECT * INTO v_season
  FROM public.social_league_seasons
  WHERE starts_on = v_week_start;

  SELECT * INTO v_existing
  FROM public.social_league_memberships
  WHERE season_id = v_season.id AND user_id = v_user_id;

  IF v_existing.id IS NOT NULL THEN
    PERFORM public.refresh_social_league_group(v_season.id, v_existing.group_id);
    RETURN v_existing.id;
  END IF;

  SELECT membership.* INTO v_previous
  FROM public.social_league_memberships membership
  JOIN public.social_league_seasons season ON season.id = membership.season_id
  WHERE membership.user_id = v_user_id
    AND season.starts_on < v_week_start
  ORDER BY season.starts_on DESC
  LIMIT 1;

  IF v_previous.id IS NOT NULL THEN
    PERFORM public.refresh_social_league_group(v_previous.season_id, v_previous.group_id);
    SELECT * INTO v_previous
    FROM public.social_league_memberships
    WHERE id = v_previous.id;

    SELECT COUNT(*)::INTEGER INTO v_previous_count
    FROM public.social_league_memberships
    WHERE season_id = v_previous.season_id AND group_id = v_previous.group_id;

    v_tier := v_previous.tier;
    v_movement := 'same';
    IF v_previous_count >= 10
      AND v_previous.rank <= 3
      AND v_previous.tier <> 'diamond' THEN
      v_tier := public.social_league_tier_step(v_previous.tier, 1);
      v_movement := 'promoted';
    ELSIF v_previous_count >= 10
      AND v_previous.rank > v_previous_count - 3
      AND v_previous.tier <> 'bronze' THEN
      v_tier := public.social_league_tier_step(v_previous.tier, -1);
      v_movement := 'demoted';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_season.id::TEXT || ':' || v_tier, 0));

  -- A second request for the same user may have waited on the group lock.
  -- Re-check after acquiring it so membership creation remains idempotent.
  SELECT * INTO v_existing
  FROM public.social_league_memberships
  WHERE season_id = v_season.id AND user_id = v_user_id;

  IF v_existing.id IS NOT NULL THEN
    PERFORM public.refresh_social_league_group(v_season.id, v_existing.group_id);
    RETURN v_existing.id;
  END IF;

  SELECT membership.group_id INTO v_group_id
  FROM public.social_league_memberships membership
  WHERE membership.season_id = v_season.id AND membership.tier = v_tier
  GROUP BY membership.group_id
  HAVING COUNT(*) < 30
  ORDER BY COUNT(*) DESC, MIN(membership.created_at)
  LIMIT 1;

  v_group_id := COALESCE(v_group_id, gen_random_uuid());

  SELECT COALESCE(xp, 0)::INTEGER INTO v_starting_xp
  FROM public.profiles
  WHERE user_id = v_user_id;

  INSERT INTO public.social_league_memberships (
    season_id, user_id, tier, group_id, starting_xp, movement
  ) VALUES (
    v_season.id, v_user_id, v_tier, v_group_id, COALESCE(v_starting_xp, 0), v_movement
  )
  RETURNING id INTO v_membership_id;

  PERFORM public.refresh_social_league_group(v_season.id, v_group_id);
  RETURN v_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_social_league()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_membership_id UUID;
  v_membership public.social_league_memberships%ROWTYPE;
  v_season public.social_league_seasons%ROWTYPE;
  v_member_count INTEGER;
  v_members JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  v_membership_id := public.ensure_my_social_league_membership();

  SELECT * INTO v_membership
  FROM public.social_league_memberships
  WHERE id = v_membership_id;

  PERFORM public.refresh_social_league_group(v_membership.season_id, v_membership.group_id);

  SELECT * INTO v_membership
  FROM public.social_league_memberships
  WHERE id = v_membership_id;

  SELECT * INTO v_season
  FROM public.social_league_seasons
  WHERE id = v_membership.season_id;

  SELECT COUNT(*)::INTEGER INTO v_member_count
  FROM public.social_league_memberships
  WHERE season_id = v_membership.season_id AND group_id = v_membership.group_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', membership.user_id,
    'name', COALESCE(profile.full_name, 'Nutrio member'),
    'avatar_url', profile.avatar_url,
    'level', COALESCE(profile.level, 1),
    'score', membership.score,
    'rank', membership.rank,
    'is_me', membership.user_id = v_user_id
  ) ORDER BY membership.rank), '[]'::JSONB)
  INTO v_members
  FROM public.social_league_memberships membership
  LEFT JOIN public.profiles profile ON profile.user_id = membership.user_id
  WHERE membership.season_id = v_membership.season_id
    AND membership.group_id = v_membership.group_id;

  RETURN jsonb_build_object(
    'season', jsonb_build_object(
      'id', v_season.id,
      'starts_on', v_season.starts_on,
      'ends_on', v_season.ends_on
    ),
    'league', jsonb_build_object(
      'tier', v_membership.tier,
      'rank', v_membership.rank,
      'score', v_membership.score,
      'movement', v_membership.movement,
      'member_count', v_member_count,
      'promotion_rank', CASE WHEN v_member_count >= 10 THEN 3 ELSE 0 END,
      'demotion_rank', CASE WHEN v_member_count >= 10 THEN v_member_count - 2 ELSE NULL END
    ),
    'members', v_members
  );
END;
$$;

REVOKE ALL ON FUNCTION public.social_league_tier_step(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_social_league_group(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_my_social_league_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_social_league() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_social_league() TO authenticated;

COMMENT ON TABLE public.social_league_memberships IS
  'Weekly, privacy-scoped league cohorts. Scores are derived server-side from positive XP ledger entries.';
