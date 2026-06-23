-- Migration: core_tables
-- Source: docs/specs/data-model.md §5 (the eight application tables)
--
-- Conventions (§3):
--   - Surrogate uuid PKs default gen_random_uuid(); four tables use a natural owning id.
--   - Every application table carries user_id -> auth.users(id) ON DELETE CASCADE; it is the
--     RLS anchor (§8). Child tables denormalize user_id so RLS is a direct predicate, not a join.
--   - created_at / updated_at are timestamptz default now(); updated_at is maintained by the
--     shared set_updated_at() trigger (triggers migration). Pure-transient/cache tables use a
--     single domain timestamp instead (expires_at / fetched_at).
--   - Enumerations are text + CHECK, not native enums (§3); Zod owns the canonical unions.
--   - Structured interiors (config, rect, refresh, schedule, curve, profile, preferences,
--     payload) are jsonb, validated by Zod on write (§3, §10). No DB-level shape constraint.
--
-- Tables are created parent-before-child so the foreign keys resolve.

-- 5.1 connections -------------------------------------------------------------
-- One row per user per connected service. Metadata + Vault secret references only;
-- never secret material. RLS: client select-own; all writes server-side (§8).
create table public.connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  service           text not null,
  auth_class        text not null,
  status            text not null,
  scopes            text[] not null default '{}',
  access_secret_id  uuid,
  refresh_secret_id uuid,
  config            jsonb,
  expires_at        timestamptz,
  account_label     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint connections_auth_class_check
    check (auth_class in ('oauth2', 'api_key', 'admin_key', 'platform_key')),
  constraint connections_status_check
    check (status in ('connected', 'reauth_required', 'error', 'disconnected')),
  -- One connection per user per service: a duplicate connect upserts, never duplicates (§5.1).
  constraint connections_user_service_unique unique (user_id, service)
);
-- The unique (user_id, service) index also serves the RLS-scoped per-user list and point
-- lookups by service, so no separate (user_id) index is added (it would be a redundant prefix).

-- 5.2 oauth_transactions ------------------------------------------------------
-- Short-lived in-flight authorization state (CSRF + PKCE). Service-role only, no client
-- access at all (holds the live code_verifier). Pruned by cron in ~10 min (§9).
create table public.oauth_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  service       text not null,
  state         text not null,
  code_verifier text,
  expires_at    timestamptz not null
);
create index oauth_transactions_state_idx on public.oauth_transactions (state);
create index oauth_transactions_expires_at_idx on public.oauth_transactions (expires_at);
create index oauth_transactions_user_id_idx on public.oauth_transactions (user_id);

-- 5.3 entitlements ------------------------------------------------------------
-- One row per user, the authoritative tier. user_id = RevenueCat app_user_id.
-- RLS: client select-own; only the webhook (service role) writes (§8). Missing row = Free.
create table public.entitlements (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  tier               text not null,
  active_product_id  text,
  current_period_end timestamptz,
  status             text not null,
  last_event_id      text,
  last_event_ms      bigint,
  updated_at         timestamptz not null default now(),
  constraint entitlements_tier_check check (tier in ('free', 'pro')),
  constraint entitlements_status_check check (status in ('active', 'in_grace', 'expired'))
);

-- 5.4 dashboards --------------------------------------------------------------
-- A user's named layout; parent of widget instances. RLS: full owner CRUD (§8).
create table public.dashboards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dashboards_user_id_idx on public.dashboards (user_id);

-- 5.5 widget_instances --------------------------------------------------------
-- One placed, configured, sized widget on a dashboard. service_id is a logical match to
-- connections.service through the registry seam; there is deliberately NO foreign key on it
-- (§5.5). RLS: owner CRUD with a dashboard-ownership WITH CHECK (§8).
create table public.widget_instances (
  id           uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  service_id   text not null,
  widget_type  text not null,
  size         text not null,
  config       jsonb not null default '{}',
  rect         jsonb not null,
  refresh      jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint widget_instances_size_check
    check (size in ('small', 'medium', 'large', 'wide', 'tall'))
);
create index widget_instances_dashboard_id_idx on public.widget_instances (dashboard_id);
create index widget_instances_user_service_idx on public.widget_instances (user_id, service_id);

-- 5.6 kiosk_configs -----------------------------------------------------------
-- Kiosk presentation + schedule for a dashboard, 1:1 (PK = dashboard_id). The scalar knobs
-- are first-class columns; the structured shapes are Zod-validated jsonb (§5.6, §7.3).
-- RLS: owner CRUD with a dashboard-ownership WITH CHECK (§8).
create table public.kiosk_configs (
  dashboard_id             uuid primary key references public.dashboards (id) on delete cascade,
  user_id                  uuid not null references auth.users (id) on delete cascade,
  keep_awake               boolean not null default true,
  control_backlight        boolean not null default true,
  night_interval_multiplier numeric not null default 1,
  schedule                 jsonb not null,
  curve                    jsonb not null,
  profile                  jsonb not null,
  pinning                  jsonb,
  exit                     jsonb,
  updated_at               timestamptz not null default now(),
  -- Kiosk only ever stretches a cadence at night, never speeds it up (§5.6, AOD-11 §6.2).
  constraint kiosk_configs_night_multiplier_check check (night_interval_multiplier >= 1)
);
create index kiosk_configs_user_id_idx on public.kiosk_configs (user_id);

-- 5.7 user_settings -----------------------------------------------------------
-- User-global preferences: active theme + a small preferences bag. One row per user.
-- A missing row reads as all defaults. RLS: full owner CRUD (§8).
create table public.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  theme       text not null default 'default',
  preferences jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

-- 5.8 proxy_cache -------------------------------------------------------------
-- Encrypted (platform-level), per-user, short-lived cache of normalized widget data. Never
-- credentials. Natural composite PK so the proxy upserts on conflict. RLS: no client access;
-- proxy Edge Function (service role) only (§8). The 900s ceiling is a structural CHECK (§11).
create table public.proxy_cache (
  user_id     uuid not null references auth.users (id) on delete cascade,
  service     text not null,
  widget_type text not null,
  params_hash text not null,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  constraint proxy_cache_pkey primary key (user_id, service, widget_type, params_hash),
  -- AOD-5 ceiling: nothing we fetch on a user's behalf rests more than 15 minutes.
  constraint proxy_cache_ttl_check
    check (expires_at > fetched_at and expires_at <= fetched_at + interval '900 seconds')
);
create index proxy_cache_expires_at_idx on public.proxy_cache (expires_at);
create index proxy_cache_user_service_idx on public.proxy_cache (user_id, service);
