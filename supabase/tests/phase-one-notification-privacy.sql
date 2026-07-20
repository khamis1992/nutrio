begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, security, extensions, pg_temp;

select plan(9);

select is(security.safe_notification_error_code('Provider failed phone=555123 token=secret'), 'provider_failure', 'arbitrary provider error is reduced to an allowlisted category');
select is(security.safe_notification_error_code('request timed out for user@example.test'), 'provider_timeout', 'timeout is categorized without retaining identity');
select is(security.safe_notification_error_code('HTTP 401 token=secret'), 'provider_unauthorized', 'authorization failure is categorized');
select is(security.safe_notification_error_code('socket error at 10.0.0.5'), 'provider_network_error', 'network failure is categorized');
select is(security.safe_notification_error_code('503 unavailable body=email@example.test'), 'provider_unavailable', 'availability failure is categorized');
select is(security.safe_notification_error_code(null), null, 'empty provider error remains null');

select ok(not has_function_privilege('authenticated', 'security.safe_notification_error_code(text)', 'EXECUTE'), 'authenticated clients cannot call the internal sanitizer');
select ok(not has_function_privilege('anon', 'security.safe_notification_error_code(text)', 'EXECUTE'), 'anonymous clients cannot call the internal sanitizer');
select ok(has_function_privilege('service_role', 'security.safe_notification_error_code(text)', 'EXECUTE'), 'service role can categorize provider failures');

select * from finish();
rollback;
