-- Let authenticated users inspect their own non-sensitive consent history
-- while preserving service-only writes and strict cross-user isolation.

begin;

revoke all on table public.health_context_consent_events
  from public, anon, authenticated;
grant select on table public.health_context_consent_events to authenticated;
grant all on table public.health_context_consent_events to service_role;

drop policy if exists health_context_consent_events_owner_read
  on public.health_context_consent_events;
create policy health_context_consent_events_owner_read
  on public.health_context_consent_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

commit;
