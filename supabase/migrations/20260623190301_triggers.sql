-- Migration: triggers
-- Source: docs/specs/data-model.md §9 (the shared updated_at trigger)
--
-- One shared function maintains updated_at on update, applied to every table that has an
-- updated_at column: connections, entitlements, dashboards, widget_instances, kiosk_configs,
-- user_settings. The two transient/cache tables (oauth_transactions, proxy_cache) have no
-- updated_at and get no trigger.
--
-- `set search_path = ''` hardens the function against search-path injection (Supabase function
-- lint); now() resolves from pg_catalog regardless, so behavior is identical to the spec snippet.

create or replace function public.set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_set_updated_at before update on public.connections
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.dashboards
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.widget_instances
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.kiosk_configs
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
