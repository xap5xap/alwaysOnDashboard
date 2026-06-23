-- Migration: extensions
-- Source: docs/specs/data-model.md §9
--
-- Enable the extensions the schema and its scheduled jobs depend on.
--   pg_cron  - in-database job scheduler for the prune + token-refresh jobs (cron migration).
--   pg_net   - async HTTP from Postgres; the token-refresh cron uses net.http_post.
--   pgcrypto - provides gen_random_uuid() for surrogate primary keys (§3).
--
-- On Supabase these install into the `extensions` schema. Forward-only and idempotent.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;
