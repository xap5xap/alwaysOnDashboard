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

deno test --allow-all supabase/tests
