#!/usr/bin/env bash
set -euo pipefail

if [[ "${NUTRIO_ENV:-}" != "staging" ]]; then
  echo "Refusing to seed fleet demo data outside NUTRIO_ENV=staging."
  exit 1
fi

: "${SUPABASE_PROJECT_ID:?Set SUPABASE_PROJECT_ID for staging}"
: "${E2E_FLEET_EMAIL:?Set E2E_FLEET_EMAIL for the staging account}"
: "${E2E_FLEET_PASSWORD:?Set E2E_FLEET_PASSWORD for the staging account}"

echo "Reviewing pending staging migrations..."
npx supabase db push --dry-run --include-all

echo "Apply the reviewed migration set explicitly before continuing."
echo "Deploying fleet edge functions with their configured JWT policies..."

functions=(
  fleet-auth
  fleet-dashboard
  fleet-drivers
  fleet-vehicles
  fleet-payouts
  fleet-tracking
)

for function_name in "${functions[@]}"; do
  npx supabase functions deploy "$function_name" \
    --project-ref "$SUPABASE_PROJECT_ID"
done

cat <<'INSTRUCTIONS'
Fleet functions are deployed to staging.

Provision the dedicated fleet test account through the approved admin flow,
using E2E_FLEET_EMAIL and E2E_FLEET_PASSWORD from the secret store. Never
print those values or add them to SQL migrations. Seed demo operational data
only after verifying that the target project is the isolated staging project.
INSTRUCTIONS
