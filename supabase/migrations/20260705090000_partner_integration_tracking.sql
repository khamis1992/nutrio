-- Partner integration tracking for Nutrio x SportHub and future partners.

CREATE TABLE IF NOT EXISTS public.partner_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner TEXT NOT NULL,
  external_user_id TEXT,
  consent_status TEXT NOT NULL DEFAULT 'not_linked'
    CHECK (consent_status IN ('not_linked', 'pending', 'linked', 'revoked', 'failed', 'needs_reauth')),
  linked_at TIMESTAMPTZ,
  unlinked_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner)
);

CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app TEXT NOT NULL,
  target_app TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_user_hash TEXT,
  referral_code TEXT,
  campaign TEXT,
  status TEXT NOT NULL DEFAULT 'clicked'
    CHECK (status IN ('clicked', 'signed_up', 'converted', 'expired', 'rejected')),
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  eligibility_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (eligibility_status IN ('pending', 'eligible', 'redeemed', 'expired', 'cancelled')),
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  partner TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_event_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_integrations_user_partner
  ON public.partner_integrations(user_id, partner);

CREATE INDEX IF NOT EXISTS idx_partner_integrations_status
  ON public.partner_integrations(partner, consent_status);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_user_created
  ON public.partner_referrals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_campaign_status
  ON public.partner_referrals(target_app, campaign, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_rewards_user_status
  ON public.partner_rewards(user_id, partner, eligibility_status);

CREATE INDEX IF NOT EXISTS idx_partner_rewards_partner_created
  ON public.partner_rewards(partner, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_events_user_created
  ON public.partner_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_events_partner_type
  ON public.partner_events(partner, event_type, occurred_at DESC);

ALTER TABLE public.partner_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their partner integrations" ON public.partner_integrations;
CREATE POLICY "Users can read their partner integrations"
  ON public.partner_integrations
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their partner integrations" ON public.partner_integrations;
CREATE POLICY "Users can create their partner integrations"
  ON public.partner_integrations
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their partner integrations" ON public.partner_integrations;
CREATE POLICY "Users can update their partner integrations"
  ON public.partner_integrations
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage partner integrations" ON public.partner_integrations;
CREATE POLICY "Admins can manage partner integrations"
  ON public.partner_integrations
  FOR ALL
  USING (public.has_role((select auth.uid()), 'admin'))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Users can read their partner referrals" ON public.partner_referrals;
CREATE POLICY "Users can read their partner referrals"
  ON public.partner_referrals
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their partner referrals" ON public.partner_referrals;
CREATE POLICY "Users can create their partner referrals"
  ON public.partner_referrals
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their partner referrals" ON public.partner_referrals;
CREATE POLICY "Users can update their partner referrals"
  ON public.partner_referrals
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage partner referrals" ON public.partner_referrals;
CREATE POLICY "Admins can manage partner referrals"
  ON public.partner_referrals
  FOR ALL
  USING (public.has_role((select auth.uid()), 'admin'))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Users can read their partner rewards" ON public.partner_rewards;
CREATE POLICY "Users can read their partner rewards"
  ON public.partner_rewards
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage partner rewards" ON public.partner_rewards;
CREATE POLICY "Admins can manage partner rewards"
  ON public.partner_rewards
  FOR ALL
  USING (public.has_role((select auth.uid()), 'admin'))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Users can read their partner events" ON public.partner_events;
CREATE POLICY "Users can read their partner events"
  ON public.partner_events
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their partner events" ON public.partner_events;
CREATE POLICY "Users can create their partner events"
  ON public.partner_events
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage partner events" ON public.partner_events;
CREATE POLICY "Admins can manage partner events"
  ON public.partner_events
  FOR ALL
  USING (public.has_role((select auth.uid()), 'admin'))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'));

