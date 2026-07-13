# Nutrio Launch Checklist

This checklist intentionally contains no credentials. Store production secrets
in the deployment provider and Supabase secret manager, never in Git.

## 1. Rotate previously exposed credentials

- Rotate the Supabase service-role key and any long-lived user sessions.
- Rotate payment gateway, email, messaging, analytics, and AI provider secrets.
- Reset credentials for accounts that were previously used in test scripts.
- Invalidate old deployment credentials and verify that GitHub secrets contain
  only the newly rotated values.

## 2. Configure environments

Required client variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_APP_URL
VITE_APP_VERSION
```

Configure optional client integrations only when enabled:

```text
VITE_SENTRY_DSN
VITE_POSTHOG_KEY
VITE_POSTHOG_HOST
VITE_MAPBOX_TOKEN
VITE_GOOGLE_FIT_CLIENT_ID
VITE_FLEET_API_URL
VITE_FLEET_WS_URL
```

Server-only values such as `SUPABASE_SERVICE_ROLE_KEY`, payment credentials,
email provider keys, and AI provider keys must never use a `VITE_` prefix.

## 3. Prepare the database

1. Resolve duplicate local migration version numbers.
2. Review the pending migration list against staging.
3. Apply migrations to staging and run cross-portal lifecycle tests.
4. Back up production and apply only the reviewed migration set.
5. Verify RLS, function grants, and privileged RPC authorization.

Do not run legacy schema-creation scripts against production. Schema changes
must be delivered through versioned Supabase migrations.

## 4. Deploy edge functions

- Deploy functions using the JWT policy defined per function in
  `supabase/config.toml`.
- Do not deploy every function with `--no-verify-jwt`.
- Configure provider keys with `supabase secrets set`.
- Keep payment simulation disabled in production.

## 5. Configure E2E accounts

Use dedicated staging accounts and provide them through the variables listed in
`.env.e2e.example`. Do not use personal accounts or production passwords.

## 6. Release gates

The release is blocked until all of the following pass:

```text
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run test:e2e
```

Also verify complete customer, partner, admin, driver, fleet, and coach journeys
against staging data, including order, subscription, delivery, cancellation,
wallet, and notification state transitions.

## 7. Mobile release

- Configure Android release signing and increment version codes.
- Configure iOS signing, required permissions, and universal/deep links.
- Remove cleartext transport outside local development.
- Verify offline, background location, privacy, and store disclosure behavior.

## 8. Go-live evidence

Record the deployed commit, migration versions, edge-function versions, smoke
test results, monitoring dashboards, rollback owner, and rollback procedure.
Only mark the application launch-ready after this evidence is complete.
