#!/usr/bin/env bash
# Run the schema integration suite (testing-strategy.md §5.1, §8) against the local stack.
# Exports the local Supabase connection from `supabase status` so `deno test` can reach it.
# Identical command locally and in CI, so a green local run reproduces in CI.
#
# Prerequisite: `supabase start` is running (or `npm run db:start`).
set -euo pipefail

# `supabase status -o env` emits KEY="value" lines (ANON_KEY, API_URL, DB_URL, SERVICE_ROLE_KEY,
# ...). Keep only the four we need, then map to the SUPABASE_* names the tests read (env.ts).
eval "$(npx --no-install supabase status -o env \
  | grep -E '^(ANON_KEY|API_URL|DB_URL|SERVICE_ROLE_KEY)=' \
  | sed 's/^/export /')"

export SUPABASE_URL="${API_URL}"
export SUPABASE_ANON_KEY="${ANON_KEY}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
export SUPABASE_DB_URL="${DB_URL}"

# Broker env (AOD-9): the platform_key provider key the proxy attaches for Weather. A test
# placeholder; the provider HTTP boundary is faked in the §5.2 suite. OAuth client creds default
# to test values in the broker env helper, so they need no export here.
export WEATHER_PROVIDER_KEY="${WEATHER_PROVIDER_KEY:-test-weather-key}"

# Entitlement env (AOD-12): the RevenueCat webhook shared secret. The §5.3 webhook suite also sets
# this in-process, but exporting a default keeps `functions serve` and CI consistent.
export REVENUECAT_WEBHOOK_AUTH="${REVENUECAT_WEBHOOK_AUTH:-test-revenuecat-webhook-secret}"

# Schema suite (RLS + constraints + cascades) + the broker four-flow integration tests (§5.2) +
# the entitlement webhook flow (§5.3).
deno test --allow-all supabase/tests supabase/functions
