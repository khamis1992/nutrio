# Nutrio Launch Readiness Policy

Nutrio is ready for production only when every mandatory gate below passes against the deployed application and production Supabase project.

## Required Portals

The launch gate covers the customer, partner, admin, driver, fleet, and coach portals. A successful login alone is not sufficient. The portals must read the same canonical business records through their own authenticated RLS sessions.

## Cross-Portal Invariants

- Customer, partner, admin, driver, and fleet must resolve the same active meal schedule and delivery job.
- The schedule must belong to the launch customer and restaurant partner.
- The delivery job must be assigned to the launch driver and visible in fleet dispatch.
- The coach and customer must share one active assignment.
- Coach and customer must resolve identical program and message row IDs for that assignment.
- Launch verification is read-only and must fail if a portal mutates orders, schedules, delivery jobs, restaurants, or drivers.

## Security Policy

- Restaurant ownership does not grant partner access without a partner or restaurant role.
- Driver and fleet identities must not inherit restaurant ownership or customer access.
- Every privileged RPC must validate the caller identity and role inside the database function.
- OTP expiry must remain below one hour.
- Supabase leaked-password protection must be enabled.
- Known compromised or shared passwords must be rotated before production launch.
- Postgres security upgrades must be applied before their support deadline.

## Test Data Policy

- E2E identities are dedicated accounts and must not be used by real customers or operators.
- The launch customer, partner, driver, and fleet records must share a real active delivery sentinel.
- The launch coach must be actively assigned to the launch customer and have shared program and message data.
- Old pending schedules are never cancelled automatically. Cleanup requires an explicit decision about quota restoration, refunds, and notifications.
- Test data must not be included in business, payout, or retention reporting.

## Release Evidence

Before release:

1. Run lint, typecheck, unit tests, and the production build.
2. Deploy the candidate frontend and database migrations.
3. Run the `Production Launch Gate` workflow with `PRODUCTION_APP_URL` set to the deployed `/nutrio` base URL.
4. Retain the generated Playwright trace, JSON result, and JUnit result.
5. Stop the release if any portal returns a failing Supabase response or resolves a different canonical record.

The local launch gate is useful for pre-deployment verification, but it is not production launch evidence.
