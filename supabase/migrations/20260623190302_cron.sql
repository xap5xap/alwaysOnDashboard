-- Migration: cron
-- Source: docs/specs/data-model.md §9 (scheduled jobs) and §11 (cache ceiling prune)
--
-- The schema only DECLARES that these jobs exist; their operational logic is owned by AOD-9.
-- Exact intervals and the refresh grace window are tuned at build time (§9, §13).

-- Prune jobs: pure-SQL deletes, fully functional now. ---------------------------------------
-- Expired in-flight OAuth state (~10 min lifetime, AOD-9 §5.2).
select cron.schedule(
  'prune-oauth-transactions',
  '*/5 * * * *',
  $$ delete from public.oauth_transactions where expires_at < now() $$
);
-- Expired proxy cache rows (the AOD-5 900s ceiling is also a CHECK; this sweeps continuously).
select cron.schedule(
  'prune-proxy-cache',
  '*/5 * * * *',
  $$ delete from public.proxy_cache where expires_at < now() $$
);

-- Token-refresh job: DECLARED here, INERT until AOD-9. ---------------------------------------
-- The token-refresh Edge Function and the Vault secrets it needs are AOD-9 deliverables, out
-- of scope for this schema task. The job reads its target URL and bearer from Vault at
-- fire-time (the verified Supabase pattern, §9) and is guarded by `where exists`, so until
-- AOD-9 seeds the `token_refresh_url` secret the job is silently inert. Declaring it now (with
-- no migration-time Vault dependency) satisfies "the schema declares that this job exists"
-- while keeping the migration forward-only: AOD-9 sets the secret value (data), not a schema edit.
select cron.schedule(
  'token-refresh',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'token_refresh_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'token_refresh_service_token'),
        ''
      )
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'token_refresh_url');
  $job$
);
