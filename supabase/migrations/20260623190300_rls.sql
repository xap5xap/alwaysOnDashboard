-- Migration: rls
-- Source: docs/specs/data-model.md §8 (RLS policy catalogue)
--
-- RLS enforces OWNERSHIP, never entitlement (§8.1). Two questions decide every policy:
--   1. Whose row is it?  Always user_id = auth.uid().
--   2. Who may write it?  Client-authored tables get owner CRUD; server-written tables get
--      owner-read-only or no client access, with all writes via the service role.
--
-- PRIVILEGE LAYER (build-time addition, not in the spec's illustrative §8.2 SQL):
-- Current Supabase revokes Data API privileges for newly created public tables from the
-- anon/authenticated/service_role roles by default (the `auto_expose_new_tables` change;
-- see supabase/config.toml). The spec's §8 model implicitly assumed the legacy auto-grant
-- behavior where RLS alone gated access. To make that model hold under current Supabase, we
-- grant table privileges explicitly here, encoding the same client-write vs server-write
-- split at the privilege level (defense in depth beneath the policies). Per data-model.md §2,
-- this build-time divergence is recorded in the spec (§8.3).

-- Enable RLS on every application table (§8.2). ---------------------------------------------
alter table public.connections        enable row level security;
alter table public.oauth_transactions enable row level security;
alter table public.entitlements       enable row level security;
alter table public.dashboards         enable row level security;
alter table public.widget_instances   enable row level security;
alter table public.kiosk_configs      enable row level security;
alter table public.user_settings      enable row level security;
alter table public.proxy_cache        enable row level security;

-- Privilege grants encoding the §8 writer-split. -------------------------------------------
-- Start from a clean slate so the model is deterministic regardless of any auto-expose config.
revoke all on public.connections, public.oauth_transactions, public.entitlements,
  public.dashboards, public.widget_instances, public.kiosk_configs, public.user_settings,
  public.proxy_cache
  from anon, authenticated;

-- The service role is the server writer/seeder. It bypasses RLS but still needs table
-- privileges to perform DML through PostgREST.
grant all on public.connections, public.oauth_transactions, public.entitlements,
  public.dashboards, public.widget_instances, public.kiosk_configs, public.user_settings,
  public.proxy_cache
  to service_role;

-- Server-written, owner-readable: the client may read its own rows only.
grant select on public.connections to authenticated;
grant select on public.entitlements to authenticated;

-- Server-written, no client access at all: oauth_transactions (holds the live PKCE
-- code_verifier) and proxy_cache (reached only through the proxy response). No grant to
-- authenticated, so the client cannot reach them even before RLS is considered.

-- Client-authored, owner CRUD.
grant select, insert, update, delete on public.dashboards to authenticated;
grant select, insert, update, delete on public.widget_instances to authenticated;
grant select, insert, update, delete on public.kiosk_configs to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

-- anon is intentionally left with no privileges on any table: the app requires auth.

-- Policies (§8.2, adopted as written). -----------------------------------------------------

-- Server-written, owner-readable: connections, entitlements.
-- The client reads its own rows; the service role (which bypasses RLS) does all writes.
create policy connections_select_own on public.connections
  for select using (user_id = auth.uid());
create policy entitlements_select_own on public.entitlements
  for select using (user_id = auth.uid());

-- proxy_cache and oauth_transactions: no client policy at all. With RLS enabled and no policy
-- (and no grant above), authenticated/anon get nothing; only the service role reaches them.

-- Client-authored, owner CRUD: dashboards, user_settings.
create policy dashboards_rw_own on public.dashboards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_rw_own on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Client-authored with a parent-ownership cross-check: widget_instances, kiosk_configs.
-- The WITH CHECK confirms the row is the caller's AND its dashboard is the caller's, so a row
-- cannot be attached to another user's dashboard.
create policy widget_instances_rw_own on public.widget_instances
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and dashboard_id in (select id from public.dashboards where user_id = auth.uid())
  );
create policy kiosk_configs_rw_own on public.kiosk_configs
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and dashboard_id in (select id from public.dashboards where user_id = auth.uid())
  );
