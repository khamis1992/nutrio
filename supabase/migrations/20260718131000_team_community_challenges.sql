-- Team mechanics for community challenges. Team scores are always derived from
-- trusted challenge_participants progress; clients cannot write team scores.

ALTER TABLE public.community_challenges
  ADD COLUMN IF NOT EXISTS participation_mode TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS team_size INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.community_challenges
  DROP CONSTRAINT IF EXISTS community_challenges_participation_mode_check,
  ADD CONSTRAINT community_challenges_participation_mode_check
    CHECK (participation_mode IN ('individual', 'team')),
  DROP CONSTRAINT IF EXISTS community_challenges_team_size_check,
  ADD CONSTRAINT community_challenges_team_size_check
    CHECK (team_size BETWEEN 2 AND 20);

CREATE TABLE IF NOT EXISTS public.challenge_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 40),
  join_code TEXT NOT NULL UNIQUE CHECK (join_code ~ '^[A-Z0-9]{8}$'),
  captain_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS challenge_teams_unique_name_per_challenge
  ON public.challenge_teams (challenge_id, lower(name));
CREATE INDEX IF NOT EXISTS challenge_teams_challenge_id_idx
  ON public.challenge_teams (challenge_id);

CREATE TABLE IF NOT EXISTS public.challenge_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.challenge_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('captain', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id),
  UNIQUE (team_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS challenge_team_members_one_captain
  ON public.challenge_team_members (team_id) WHERE role = 'captain';
CREATE INDEX IF NOT EXISTS challenge_team_members_team_idx
  ON public.challenge_team_members (team_id, joined_at);

ALTER TABLE public.challenge_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_team_members ENABLE ROW LEVEL SECURITY;

-- No direct client policies: authenticated users interact through the guarded RPCs below.
REVOKE ALL ON public.challenge_teams FROM anon, authenticated;
REVOKE ALL ON public.challenge_team_members FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_challenge_team(
  p_challenge_id UUID,
  p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_name TEXT := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_code TEXT;
  v_team public.challenge_teams%ROWTYPE;
  v_attempts INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF char_length(v_name) NOT BETWEEN 2 AND 40 THEN
    RAISE EXCEPTION 'Team name must be between 2 and 40 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_challenges cc
    WHERE cc.id = p_challenge_id
      AND cc.participation_mode = 'team'
      AND cc.is_active = true
      AND current_date BETWEEN cc.start_date AND cc.end_date
  ) THEN
    RAISE EXCEPTION 'Team challenge is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id AND cp.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Join the challenge before creating a team';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.challenge_team_members ctm
    WHERE ctm.challenge_id = p_challenge_id AND ctm.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You already belong to a team in this challenge';
  END IF;

  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.challenge_teams WHERE join_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN RAISE EXCEPTION 'Could not generate team code'; END IF;
  END LOOP;

  INSERT INTO public.challenge_teams (challenge_id, name, join_code, captain_id)
  VALUES (p_challenge_id, v_name, v_code, v_user_id)
  RETURNING * INTO v_team;

  INSERT INTO public.challenge_team_members (challenge_id, team_id, user_id, role)
  VALUES (p_challenge_id, v_team.id, v_user_id, 'captain');

  RETURN jsonb_build_object('success', true, 'team_id', v_team.id, 'join_code', v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_challenge_team(p_join_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team public.challenge_teams%ROWTYPE;
  v_team_size INTEGER;
  v_member_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT ct.*
  INTO v_team
  FROM public.challenge_teams ct
  JOIN public.community_challenges cc ON cc.id = ct.challenge_id
  WHERE ct.join_code = upper(btrim(coalesce(p_join_code, '')))
    AND cc.participation_mode = 'team'
    AND cc.is_active = true
    AND current_date BETWEEN cc.start_date AND cc.end_date
  FOR UPDATE OF ct;

  IF NOT FOUND THEN RAISE EXCEPTION 'Team code is invalid or expired'; END IF;

  SELECT team_size INTO v_team_size
  FROM public.community_challenges
  WHERE id = v_team.challenge_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants cp
    WHERE cp.challenge_id = v_team.challenge_id AND cp.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Join the challenge before joining a team';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.challenge_team_members ctm
    WHERE ctm.challenge_id = v_team.challenge_id AND ctm.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You already belong to a team in this challenge';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.challenge_team_members WHERE team_id = v_team.id;
  IF v_member_count >= v_team_size THEN RAISE EXCEPTION 'This team is full'; END IF;

  INSERT INTO public.challenge_team_members (challenge_id, team_id, user_id)
  VALUES (v_team.challenge_id, v_team.id, v_user_id);

  RETURN jsonb_build_object('success', true, 'team_id', v_team.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_challenge_team(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_next_captain UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT role INTO v_role
  FROM public.challenge_team_members
  WHERE team_id = p_team_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'You are not a member of this team'; END IF;

  IF v_role = 'captain' THEN
    SELECT user_id INTO v_next_captain
    FROM public.challenge_team_members
    WHERE team_id = p_team_id AND user_id <> v_user_id
    ORDER BY joined_at, id
    LIMIT 1;

    IF v_next_captain IS NULL THEN
      DELETE FROM public.challenge_teams WHERE id = p_team_id;
      RETURN jsonb_build_object('success', true, 'team_deleted', true);
    END IF;

    DELETE FROM public.challenge_team_members
    WHERE team_id = p_team_id AND user_id = v_user_id;
    UPDATE public.challenge_team_members
    SET role = 'captain'
    WHERE team_id = p_team_id AND user_id = v_next_captain;
    UPDATE public.challenge_teams
    SET captain_id = v_next_captain, updated_at = now()
    WHERE id = p_team_id;
  ELSE
    DELETE FROM public.challenge_team_members
    WHERE team_id = p_team_id AND user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team_deleted', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_challenge_team_state(p_challenge_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH challenge AS (
    SELECT id, target_value, team_size
    FROM public.community_challenges
    WHERE id = p_challenge_id AND participation_mode = 'team'
  ),
  my_membership AS (
    SELECT ctm.team_id, ctm.role
    FROM public.challenge_team_members ctm
    WHERE ctm.challenge_id = p_challenge_id AND ctm.user_id = auth.uid()
  ),
  team_stats AS (
    SELECT
      ct.id,
      ct.name,
      ct.join_code,
      ct.captain_id,
      count(ctm.id)::INTEGER AS member_count,
      coalesce(sum(cp.current_progress), 0)::INTEGER AS total_progress,
      coalesce(round(avg(
        least(cp.current_progress, c.target_value)::numeric /
        greatest(c.target_value, 1) * 100
      )), 0)::INTEGER AS progress_percent
    FROM public.challenge_teams ct
    JOIN challenge c ON c.id = ct.challenge_id
    LEFT JOIN public.challenge_team_members ctm ON ctm.team_id = ct.id
    LEFT JOIN public.challenge_participants cp
      ON cp.challenge_id = ct.challenge_id AND cp.user_id = ctm.user_id
    WHERE ct.challenge_id = p_challenge_id
    GROUP BY ct.id
  ),
  ranked AS (
    SELECT ts.*, rank() OVER (
      ORDER BY ts.progress_percent DESC, ts.total_progress DESC, ts.member_count DESC, ts.name
    )::INTEGER AS rank
    FROM team_stats ts
  ),
  my_team AS (
    SELECT r.*, mm.role
    FROM ranked r JOIN my_membership mm ON mm.team_id = r.id
  ),
  my_members AS (
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', ctm.user_id,
      'name', coalesce(nullif(p.full_name, ''), 'Nutrio member'),
      'avatar_url', p.avatar_url,
      'role', ctm.role,
      'progress', coalesce(cp.current_progress, 0)
    ) ORDER BY ctm.role = 'captain' DESC, cp.current_progress DESC, ctm.joined_at) AS value
    FROM my_membership mm
    JOIN public.challenge_team_members ctm ON ctm.team_id = mm.team_id
    LEFT JOIN public.profiles p ON p.user_id = ctm.user_id
    LEFT JOIN public.challenge_participants cp
      ON cp.challenge_id = p_challenge_id AND cp.user_id = ctm.user_id
  )
  SELECT jsonb_build_object(
    'team', (SELECT to_jsonb(mt) FROM my_team mt),
    'members', coalesce((SELECT value FROM my_members), '[]'::jsonb),
    'leaderboard', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'team_id', r.id,
        'name', r.name,
        'member_count', r.member_count,
        'progress_percent', r.progress_percent,
        'total_progress', r.total_progress,
        'rank', r.rank
      ) ORDER BY r.rank, r.name)
      FROM (SELECT * FROM ranked ORDER BY rank, name LIMIT 10) r
    ), '[]'::jsonb),
    'team_size', coalesce((SELECT team_size FROM challenge), 5)
  );
$$;

REVOKE ALL ON FUNCTION public.create_challenge_team(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_challenge_team(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_challenge_team(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_challenge_team_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_challenge_team(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_challenge_team(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_challenge_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_team_state(UUID) TO authenticated;

COMMENT ON COLUMN public.community_challenges.participation_mode IS
  'individual uses the existing leaderboard; team groups participant progress into teams.';
