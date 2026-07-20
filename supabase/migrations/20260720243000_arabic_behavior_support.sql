-- Bounded bilingual behavior support with reflection, preference, and notification-budget controls.

BEGIN;

CREATE TABLE IF NOT EXISTS public.behavior_micro_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_]+$'),
  category TEXT NOT NULL CHECK (category IN ('planning', 'hydration', 'protein', 'movement', 'recovery', 'mindful_eating')),
  title_en TEXT NOT NULL CHECK (char_length(btrim(title_en)) BETWEEN 2 AND 120),
  title_ar TEXT NOT NULL CHECK (char_length(btrim(title_ar)) BETWEEN 2 AND 120),
  body_en TEXT NOT NULL CHECK (char_length(btrim(body_en)) BETWEEN 2 AND 420),
  body_ar TEXT NOT NULL CHECK (char_length(btrim(body_ar)) BETWEEN 2 AND 420),
  action_label_en TEXT NOT NULL CHECK (char_length(btrim(action_label_en)) BETWEEN 2 AND 80),
  action_label_ar TEXT NOT NULL CHECK (char_length(btrim(action_label_ar)) BETWEEN 2 AND 80),
  action_route TEXT NOT NULL CHECK (action_route ~ '^/'),
  review_tier TEXT NOT NULL DEFAULT 'editorial' CHECK (review_tier IN ('editorial', 'dietitian')),
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'published', 'archived')),
  review_reference TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (review_status <> 'published' OR (reviewed_at IS NOT NULL AND review_reference IS NOT NULL))
);

INSERT INTO public.behavior_micro_lessons (
  slug, category, title_en, title_ar, body_en, body_ar,
  action_label_en, action_label_ar, action_route,
  review_tier, review_status, review_reference, reviewed_at
) VALUES
  ('plan_next_meal', 'planning', 'Make the next choice easy', 'سهّل قرار الوجبة القادمة',
   'Choose your next meal now. One planned choice reduces last-minute decisions later.',
   'اختر وجبتك القادمة الآن. قرار واحد مخطط يقلل الحيرة عند اقتراب موعد الوجبة.',
   'Choose a meal', 'اختر وجبة', '/meals', 'editorial', 'published', 'Nutrio low-risk habit content baseline v1', now()),
  ('water_with_meal', 'hydration', 'Pair water with your next meal', 'اربط الماء بوجبتك القادمة',
   'Log one glass with your next meal. Linking two actions makes the new habit easier to remember.',
   'سجّل كوب ماء مع وجبتك القادمة. ربط الفعلين يجعل تذكّر العادة أسهل.',
   'Log water', 'سجّل الماء', '/tracker', 'editorial', 'published', 'Nutrio low-risk habit content baseline v1', now()),
  ('protein_first', 'protein', 'Start with the protein option', 'ابدأ بخيار البروتين',
   'When comparing meals, check the protein amount first, then confirm the meal fits your full plan.',
   'عند مقارنة الوجبات، راجع كمية البروتين أولاً ثم تأكد أن الوجبة تناسب خطتك كاملة.',
   'Compare meals', 'قارن الوجبات', '/meals', 'editorial', 'published', 'Nutrio low-risk habit content baseline v1', now()),
  ('short_movement', 'movement', 'A short session still counts', 'حتى الجلسة القصيرة لها قيمة',
   'Choose an activity you can complete today and log the time you actually do.',
   'اختر نشاطاً تستطيع إكماله اليوم وسجّل المدة التي نفذتها فعلياً.',
   'Log activity', 'سجّل نشاطاً', '/dashboard/activity', 'editorial', 'published', 'Nutrio low-risk habit content baseline v1', now()),
  ('protect_recovery', 'recovery', 'Protect today''s recovery', 'احمِ تعافيك اليوم',
   'Use today''s performance decision to choose a realistic session and a matching meal.',
   'استخدم قرار الأداء لليوم لاختيار تمرين واقعي ووجبة مناسبة له.',
   'View today''s plan', 'اعرض خطة اليوم', '/dashboard/activity', 'editorial', 'published', 'Nutrio low-risk habit content baseline v1', now()),
  ('pause_before_choice', 'mindful_eating', 'Pause before choosing', 'توقف لحظة قبل الاختيار',
   'Name what matters for this meal: hunger, timing, protein, or preference. Then compare the options.',
   'حدد ما يهم في هذه الوجبة: الجوع أو الوقت أو البروتين أو التفضيل، ثم قارن الخيارات.',
   'Browse meals', 'تصفح الوجبات', '/meals', 'editorial', 'published', 'Nutrio low-risk habit content baseline v1', now())
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_behavior_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en')),
  max_prompts_per_day SMALLINT NOT NULL DEFAULT 1 CHECK (max_prompts_per_day BETWEEN 0 AND 3),
  max_prompts_per_week SMALLINT NOT NULL DEFAULT 4 CHECK (max_prompts_per_week BETWEEN 0 AND 14),
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Qatar',
  allowed_contexts TEXT[] NOT NULL DEFAULT ARRAY['dashboard']::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (allowed_contexts <@ ARRAY['dashboard', 'meals', 'activity', 'progress']::TEXT[])
);

CREATE TABLE IF NOT EXISTS public.behavior_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Qatar')::DATE),
  barrier TEXT NOT NULL CHECK (barrier IN ('time', 'choice', 'energy', 'hunger', 'routine', 'none')),
  confidence SMALLINT CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date)
);

CREATE TABLE IF NOT EXISTS public.behavior_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.behavior_micro_lessons(id) ON DELETE RESTRICT,
  intervention_date DATE NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('dashboard', 'meals', 'activity', 'progress')),
  experiment_key TEXT NOT NULL DEFAULT 'behavior_support_v1',
  variant TEXT NOT NULL DEFAULT 'action_first' CHECK (variant IN ('action_first', 'reflection_first', 'control')),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'shown', 'acted', 'completed', 'dismissed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shown_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  UNIQUE (user_id, intervention_date, context)
);

CREATE TABLE IF NOT EXISTS public.behavior_intervention_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES public.behavior_interventions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('shown', 'acted', 'completed', 'dismissed')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (intervention_id, event_type)
);

CREATE INDEX IF NOT EXISTS behavior_interventions_user_assigned_idx
  ON public.behavior_interventions (user_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS behavior_events_user_created_idx
  ON public.behavior_intervention_events (user_id, created_at DESC);

ALTER TABLE public.behavior_micro_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_intervention_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_micro_lessons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_reflections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_interventions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_intervention_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.behavior_micro_lessons, public.user_behavior_preferences,
  public.behavior_reflections, public.behavior_interventions,
  public.behavior_intervention_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.behavior_micro_lessons, public.user_behavior_preferences,
  public.behavior_reflections, public.behavior_interventions,
  public.behavior_intervention_events TO service_role;

CREATE OR REPLACE FUNCTION public.behavior_local_time(p_timezone TEXT)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN now() AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'Asia/Qatar');
EXCEPTION WHEN invalid_parameter_value THEN
  RETURN now() AT TIME ZONE 'Asia/Qatar';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_behavior_support(p_context TEXT DEFAULT 'dashboard')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pref public.user_behavior_preferences%ROWTYPE;
  v_local TIMESTAMP;
  v_today DATE;
  v_week_start DATE;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_barrier TEXT;
  v_category TEXT;
  v_intervention public.behavior_interventions%ROWTYPE;
  v_lesson public.behavior_micro_lessons%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_context NOT IN ('dashboard', 'meals', 'activity', 'progress') THEN
    RAISE EXCEPTION 'INVALID_BEHAVIOR_CONTEXT';
  END IF;

  INSERT INTO public.user_behavior_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_pref FROM public.user_behavior_preferences WHERE user_id = v_user_id;

  v_local := public.behavior_local_time(v_pref.timezone);
  v_today := v_local::DATE;
  v_week_start := date_trunc('week', v_local)::DATE;

  IF NOT v_pref.enabled OR NOT (p_context = ANY(v_pref.allowed_contexts)) THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'disabled');
  END IF;
  IF (v_pref.quiet_hours_start < v_pref.quiet_hours_end AND v_local::TIME >= v_pref.quiet_hours_start AND v_local::TIME < v_pref.quiet_hours_end)
     OR (v_pref.quiet_hours_start > v_pref.quiet_hours_end AND (v_local::TIME >= v_pref.quiet_hours_start OR v_local::TIME < v_pref.quiet_hours_end)) THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'quiet_hours');
  END IF;

  SELECT * INTO v_intervention
  FROM public.behavior_interventions
  WHERE user_id = v_user_id AND intervention_date = v_today AND context = p_context;

  IF NOT FOUND THEN
    SELECT count(*) INTO v_daily_count
    FROM public.behavior_interventions
    WHERE user_id = v_user_id AND intervention_date = v_today;
    SELECT count(*) INTO v_weekly_count
    FROM public.behavior_interventions
    WHERE user_id = v_user_id AND intervention_date BETWEEN v_week_start AND v_today;
    IF v_daily_count >= v_pref.max_prompts_per_day OR v_weekly_count >= v_pref.max_prompts_per_week THEN
      RETURN jsonb_build_object('available', FALSE, 'reason', 'budget_reached');
    END IF;

    SELECT barrier INTO v_barrier
    FROM public.behavior_reflections
    WHERE user_id = v_user_id
    ORDER BY reflection_date DESC LIMIT 1;
    v_category := CASE v_barrier
      WHEN 'time' THEN 'planning'
      WHEN 'choice' THEN 'mindful_eating'
      WHEN 'energy' THEN 'recovery'
      WHEN 'hunger' THEN 'protein'
      WHEN 'routine' THEN 'planning'
      ELSE 'hydration'
    END;

    SELECT * INTO v_lesson
    FROM public.behavior_micro_lessons
    WHERE review_status = 'published' AND category = v_category
    ORDER BY version DESC, slug
    LIMIT 1;
    IF NOT FOUND THEN
      SELECT * INTO v_lesson
      FROM public.behavior_micro_lessons
      WHERE review_status = 'published'
      ORDER BY slug LIMIT 1;
    END IF;
    IF NOT FOUND THEN RETURN jsonb_build_object('available', FALSE, 'reason', 'no_reviewed_content'); END IF;

    INSERT INTO public.behavior_interventions (user_id, lesson_id, intervention_date, context, variant)
    VALUES (
      v_user_id, v_lesson.id, v_today, p_context,
      CASE abs(hashtext(v_user_id::TEXT || v_week_start::TEXT)) % 2
        WHEN 0 THEN 'action_first' ELSE 'reflection_first'
      END
    )
    RETURNING * INTO v_intervention;
  ELSE
    SELECT * INTO v_lesson FROM public.behavior_micro_lessons WHERE id = v_intervention.lesson_id;
  END IF;

  RETURN jsonb_build_object(
    'available', v_intervention.status <> 'dismissed',
    'reason', CASE WHEN v_intervention.status = 'dismissed' THEN 'dismissed' ELSE NULL END,
    'intervention_id', v_intervention.id,
    'status', v_intervention.status,
    'variant', v_intervention.variant,
    'title', CASE WHEN v_pref.preferred_language = 'ar' THEN v_lesson.title_ar ELSE v_lesson.title_en END,
    'body', CASE WHEN v_pref.preferred_language = 'ar' THEN v_lesson.body_ar ELSE v_lesson.body_en END,
    'action_label', CASE WHEN v_pref.preferred_language = 'ar' THEN v_lesson.action_label_ar ELSE v_lesson.action_label_en END,
    'action_route', v_lesson.action_route,
    'category', v_lesson.category,
    'language', v_pref.preferred_language,
    'review_tier', v_lesson.review_tier
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_my_behavior_intervention_event(
  p_intervention_id UUID,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_event_type NOT IN ('shown', 'acted', 'completed', 'dismissed') THEN RAISE EXCEPTION 'INVALID_BEHAVIOR_EVENT'; END IF;
  IF jsonb_typeof(COALESCE(p_metadata, '{}'::JSONB)) <> 'object' THEN RAISE EXCEPTION 'INVALID_EVENT_METADATA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.behavior_interventions WHERE id = p_intervention_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'INTERVENTION_NOT_FOUND';
  END IF;
  INSERT INTO public.behavior_intervention_events (intervention_id, user_id, event_type, metadata)
  VALUES (p_intervention_id, v_user_id, p_event_type, COALESCE(p_metadata, '{}'::JSONB))
  ON CONFLICT (intervention_id, event_type) DO NOTHING;
  UPDATE public.behavior_interventions SET
    status = CASE p_event_type WHEN 'shown' THEN 'shown' WHEN 'acted' THEN 'acted' WHEN 'completed' THEN 'completed' ELSE 'dismissed' END,
    shown_at = CASE WHEN p_event_type = 'shown' THEN COALESCE(shown_at, now()) ELSE shown_at END,
    acted_at = CASE WHEN p_event_type = 'acted' THEN COALESCE(acted_at, now()) ELSE acted_at END,
    completed_at = CASE WHEN p_event_type = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END,
    dismissed_at = CASE WHEN p_event_type = 'dismissed' THEN COALESCE(dismissed_at, now()) ELSE dismissed_at END
  WHERE id = p_intervention_id AND user_id = v_user_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_my_behavior_reflection(
  p_barrier TEXT,
  p_confidence SMALLINT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_timezone TEXT := 'Asia/Qatar';
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_barrier NOT IN ('time', 'choice', 'energy', 'hunger', 'routine', 'none') THEN RAISE EXCEPTION 'INVALID_BARRIER'; END IF;
  SELECT timezone INTO v_timezone FROM public.user_behavior_preferences WHERE user_id = v_user_id;
  INSERT INTO public.behavior_reflections (user_id, reflection_date, barrier, confidence, note)
  VALUES (v_user_id, public.behavior_local_time(COALESCE(v_timezone, 'Asia/Qatar'))::DATE, p_barrier, p_confidence, NULLIF(btrim(p_note), ''))
  ON CONFLICT (user_id, reflection_date) DO UPDATE SET
    barrier = EXCLUDED.barrier, confidence = EXCLUDED.confidence, note = EXCLUDED.note, created_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_behavior_preferences(
  p_enabled BOOLEAN,
  p_preferred_language TEXT,
  p_max_prompts_per_day SMALLINT,
  p_max_prompts_per_week SMALLINT,
  p_quiet_hours_start TIME,
  p_quiet_hours_end TIME,
  p_timezone TEXT DEFAULT 'Asia/Qatar',
  p_allowed_contexts TEXT[] DEFAULT ARRAY['dashboard']::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid(); v_row public.user_behavior_preferences%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  INSERT INTO public.user_behavior_preferences (
    user_id, enabled, preferred_language, max_prompts_per_day, max_prompts_per_week,
    quiet_hours_start, quiet_hours_end, timezone, allowed_contexts, updated_at
  ) VALUES (
    v_user_id, p_enabled, p_preferred_language, p_max_prompts_per_day, p_max_prompts_per_week,
    p_quiet_hours_start, p_quiet_hours_end, p_timezone, p_allowed_contexts, now()
  ) ON CONFLICT (user_id) DO UPDATE SET
    enabled = EXCLUDED.enabled, preferred_language = EXCLUDED.preferred_language,
    max_prompts_per_day = EXCLUDED.max_prompts_per_day, max_prompts_per_week = EXCLUDED.max_prompts_per_week,
    quiet_hours_start = EXCLUDED.quiet_hours_start, quiet_hours_end = EXCLUDED.quiet_hours_end,
    timezone = EXCLUDED.timezone, allowed_contexts = EXCLUDED.allowed_contexts, updated_at = now()
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_behavior_preferences()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid(); v_row public.user_behavior_preferences%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  INSERT INTO public.user_behavior_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_row FROM public.user_behavior_preferences WHERE user_id = v_user_id;
  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_behavior_support(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_my_behavior_intervention_event(UUID, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_my_behavior_reflection(TEXT, SMALLINT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_behavior_preferences(BOOLEAN, TEXT, SMALLINT, SMALLINT, TIME, TIME, TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_behavior_preferences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_behavior_support(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_behavior_intervention_event(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_behavior_reflection(TEXT, SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_behavior_preferences(BOOLEAN, TEXT, SMALLINT, SMALLINT, TIME, TIME, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_behavior_preferences() TO authenticated;

COMMENT ON TABLE public.behavior_micro_lessons IS 'Bilingual low-risk habit lessons; publication requires an explicit editorial or dietitian review timestamp.';
COMMENT ON FUNCTION public.get_my_behavior_support(TEXT) IS 'Returns at most one context-aware intervention within the user prompt budget and quiet-hour controls.';

COMMIT;
