-- Phase-one closure: never retain provider response text, credentials, or PII in telemetry.
create or replace function security.safe_notification_error_code(p_value text)
returns text
language sql
immutable
set search_path to pg_catalog
as $$
  select case
    when nullif(btrim(coalesce(p_value, '')), '') is null then null
    when lower(p_value) ~ '(timeout|timed out)' then 'provider_timeout'
    when lower(p_value) ~ '(rate.?limit|too many)' then 'provider_rate_limited'
    when lower(p_value) ~ '(unauthori[sz]ed|forbidden|(^|[^0-9])(401|403)([^0-9]|$))' then 'provider_unauthorized'
    when lower(p_value) ~ '(invalid.?token|expired.?token)' then 'provider_token_invalid'
    when lower(p_value) ~ '(network|connection|dns|socket)' then 'provider_network_error'
    when lower(p_value) ~ '(unavailable|(^|[^0-9])(502|503)([^0-9]|$))' then 'provider_unavailable'
    else 'provider_failure'
  end
$$;

update security.notification_event_deliveries
set last_error_code = security.safe_notification_error_code(last_error_code)
where last_error_code is not null;

revoke all on function security.safe_notification_error_code(text) from public, anon, authenticated;
grant execute on function security.safe_notification_error_code(text) to service_role;
