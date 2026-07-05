CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_events_partner_external_event_id
  ON public.partner_events(partner, external_event_id)
  WHERE external_event_id IS NOT NULL;
