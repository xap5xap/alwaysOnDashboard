// Row factories (testing-strategy.md §7). One factory per table; each inserts over the direct
// SQL (superuser) connection so it can seed any user's rows and the server-written tables, then
// returns the typed row. seedScenario.ts composes these into the canonical world.
//
// makeConnection defaults to PLACEHOLDER Vault secret UUIDs (the schema suite never reads Vault).
// Pass `secrets: { access, refresh }` to write REAL Vault secrets and use their UUIDs: this is the
// AOD-9 broker path the §5.2 flow tests read back through vault.decrypted_secrets.

import { db } from "./db.ts";
import { writeSecret } from "./vault.ts";

// --- Plain value fixtures (also consumed by the unit layer; §7) -----------------------------

/** Fixed day/night schedule: 07:00 day, 21:00 night (AOD-11 §8.2). */
export const fixedSchedule = {
  mode: "fixed",
  dayStartMin: 420,
  nightStartMin: 1260,
  transitionMinutes: 30,
} as const;

export const solarSchedule = {
  mode: "solar",
  location: "device",
  transitionMinutes: 30,
} as const;

export const dimCurve = { dayDim: 0, nightDim: 0.7 } as const;

export const wallMountProfile = {
  theme: "dark",
  typeScale: 1.2,
  minContrast: "AA",
  hideChrome: true,
} as const;

// --- Row types (the columns the tests assert on) --------------------------------------------

export interface ConnectionRow {
  id: string;
  user_id: string;
  service: string;
  auth_class: string;
  status: string;
  scopes: string[];
  access_secret_id: string | null;
  refresh_secret_id: string | null;
  config: unknown;
  expires_at: Date | null;
  account_label: string | null;
}

export interface EntitlementRow {
  user_id: string;
  tier: string;
  active_product_id: string | null;
  current_period_end: Date | null;
  status: string;
  last_event_id: string | null;
  last_event_ms: number | null;
}

export interface DashboardRow {
  id: string;
  user_id: string;
  name: string;
  position: number;
}

export interface WidgetInstanceRow {
  id: string;
  dashboard_id: string;
  user_id: string;
  service_id: string;
  widget_type: string;
  size: string;
  config: unknown;
  rect: unknown;
  refresh: unknown;
}

export interface KioskConfigRow {
  dashboard_id: string;
  user_id: string;
  keep_awake: boolean;
  control_backlight: boolean;
  night_interval_multiplier: number;
}

export interface ProxyCacheRow {
  user_id: string;
  service: string;
  widget_type: string;
  params_hash: string;
}

export interface OAuthTransactionRow {
  id: string;
  user_id: string;
  service: string;
  state: string;
  code_verifier: string | null;
  expires_at: Date;
}

// --- Factories ------------------------------------------------------------------------------

export interface MakeConnectionOptions extends Partial<Omit<ConnectionRow, "id" | "user_id">> {
  /**
   * When set, write REAL Vault secrets and use their UUIDs as access_secret_id / refresh_secret_id
   * (the AOD-9 broker path). Omit a key to leave that secret ref at its default.
   */
  secrets?: { access?: string; refresh?: string };
}

export async function makeConnection(
  userId: string,
  over: MakeConnectionOptions = {},
): Promise<ConnectionRow> {
  const sql = db();
  const isPlatformKey = (over.auth_class ?? "oauth2") === "platform_key";

  // Secret-ref resolution: real Vault secret > explicit override (incl. null) > class default
  // (placeholder UUID for credentialed classes; null for platform_key, which has no per-user secret).
  let accessSecretId: string | null;
  if (over.secrets?.access !== undefined) accessSecretId = await writeSecret(over.secrets.access, `access for ${userId}`);
  else if ("access_secret_id" in over) accessSecretId = over.access_secret_id ?? null;
  else accessSecretId = isPlatformKey ? null : crypto.randomUUID();

  let refreshSecretId: string | null;
  if (over.secrets?.refresh !== undefined) refreshSecretId = await writeSecret(over.secrets.refresh, `refresh for ${userId}`);
  else if ("refresh_secret_id" in over) refreshSecretId = over.refresh_secret_id ?? null;
  else refreshSecretId = isPlatformKey ? null : crypto.randomUUID();

  const row = {
    service: over.service ?? "linear",
    auth_class: over.auth_class ?? "oauth2",
    status: over.status ?? "connected",
    scopes: over.scopes ?? ["read"],
    access_secret_id: accessSecretId,
    refresh_secret_id: refreshSecretId,
    config: over.config ?? null,
    expires_at: over.expires_at ?? null,
    account_label: over.account_label ?? null,
  };
  const [inserted] = await sql<ConnectionRow[]>`
    insert into public.connections
      (user_id, service, auth_class, status, scopes, access_secret_id, refresh_secret_id, config, expires_at, account_label)
    values
      (${userId}, ${row.service}, ${row.auth_class}, ${row.status}, ${row.scopes},
       ${row.access_secret_id}, ${row.refresh_secret_id},
       ${row.config === null ? null : sql.json(row.config as Parameters<typeof sql.json>[0])},
       ${row.expires_at}, ${row.account_label})
    returning *
  `;
  return inserted;
}

/**
 * A near-expiry oauth2 connection with REAL Vault access + refresh secrets: the refresh-flow target
 * (testing-strategy.md §7). Defaults to expiring in ~30s (within any reasonable grace window);
 * override `expires_at` to a past time to model an already-expired token for the proxy inline path.
 */
export function makeNearExpiryConnection(
  userId: string,
  over: MakeConnectionOptions = {},
): Promise<ConnectionRow> {
  return makeConnection(userId, {
    service: "linear",
    auth_class: "oauth2",
    status: "connected",
    expires_at: new Date(Date.now() + 30_000),
    secrets: { access: "old-access-token", refresh: "old-refresh-token" },
    ...over,
  });
}

/** A reauth_required oauth2 connection: the proxy 409 path (testing-strategy.md §7). */
export function makeReauthRequiredConnection(
  userId: string,
  over: MakeConnectionOptions = {},
): Promise<ConnectionRow> {
  return makeConnection(userId, {
    service: "linear",
    auth_class: "oauth2",
    status: "reauth_required",
    secrets: { access: "dead-access-token", refresh: "dead-refresh-token" },
    ...over,
  });
}

export async function makeEntitlement(
  userId: string,
  over: Partial<Omit<EntitlementRow, "user_id">> = {},
): Promise<EntitlementRow> {
  const sql = db();
  const row = {
    tier: over.tier ?? "pro",
    active_product_id: over.active_product_id ?? "vela_pro_monthly",
    current_period_end:
      over.current_period_end ?? new Date(Date.now() + 30 * 24 * 3600 * 1000),
    status: over.status ?? "active",
    last_event_id: over.last_event_id ?? null,
    last_event_ms: over.last_event_ms ?? null,
  };
  const [inserted] = await sql<EntitlementRow[]>`
    insert into public.entitlements
      (user_id, tier, active_product_id, current_period_end, status, last_event_id, last_event_ms)
    values
      (${userId}, ${row.tier}, ${row.active_product_id}, ${row.current_period_end},
       ${row.status}, ${row.last_event_id}, ${row.last_event_ms})
    returning *
  `;
  return inserted;
}

export async function makeDashboard(
  userId: string,
  over: Partial<Omit<DashboardRow, "id" | "user_id">> = {},
): Promise<DashboardRow> {
  const sql = db();
  const [inserted] = await sql<DashboardRow[]>`
    insert into public.dashboards (user_id, name, position)
    values (${userId}, ${over.name ?? "Wall"}, ${over.position ?? 0})
    returning *
  `;
  return inserted;
}

export async function makeWidgetInstance(
  dashboardId: string,
  userId: string,
  over: Partial<Omit<WidgetInstanceRow, "id" | "dashboard_id" | "user_id">> = {},
): Promise<WidgetInstanceRow> {
  const sql = db();
  const row = {
    service_id: over.service_id ?? "linear",
    widget_type: over.widget_type ?? "my_issues",
    size: over.size ?? "medium",
    config: over.config ?? {},
    rect: over.rect ?? { x: 0, y: 0, w: 2, h: 2, z: 0 },
    refresh: over.refresh ?? null,
  };
  const [inserted] = await sql<WidgetInstanceRow[]>`
    insert into public.widget_instances
      (dashboard_id, user_id, service_id, widget_type, size, config, rect, refresh)
    values
      (${dashboardId}, ${userId}, ${row.service_id}, ${row.widget_type}, ${row.size},
       ${sql.json(row.config as Parameters<typeof sql.json>[0])}, ${sql.json(row.rect as Parameters<typeof sql.json>[0])},
       ${row.refresh === null ? null : sql.json(row.refresh as Parameters<typeof sql.json>[0])})
    returning *
  `;
  return inserted;
}

export async function makeKioskConfig(
  dashboardId: string,
  userId: string,
  over: Partial<Omit<KioskConfigRow, "dashboard_id" | "user_id">> = {},
): Promise<KioskConfigRow> {
  const sql = db();
  const row = {
    keep_awake: over.keep_awake ?? true,
    control_backlight: over.control_backlight ?? true,
    night_interval_multiplier: over.night_interval_multiplier ?? 1,
  };
  const [inserted] = await sql<KioskConfigRow[]>`
    insert into public.kiosk_configs
      (dashboard_id, user_id, keep_awake, control_backlight, night_interval_multiplier, schedule, curve, profile)
    values
      (${dashboardId}, ${userId}, ${row.keep_awake}, ${row.control_backlight},
       ${row.night_interval_multiplier}, ${sql.json(fixedSchedule)}, ${sql.json(dimCurve)}, ${sql.json(wallMountProfile)})
    returning dashboard_id, user_id, keep_awake, control_backlight, night_interval_multiplier
  `;
  return inserted;
}

export async function makeProxyCacheRow(
  userId: string,
  over: Partial<Omit<ProxyCacheRow, "user_id">> & { ttlSeconds?: number } = {},
): Promise<ProxyCacheRow> {
  const sql = db();
  const ttl = over.ttlSeconds ?? 300;
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + ttl * 1000);
  const [inserted] = await sql<ProxyCacheRow[]>`
    insert into public.proxy_cache
      (user_id, service, widget_type, params_hash, payload, fetched_at, expires_at)
    values
      (${userId}, ${over.service ?? "linear"}, ${over.widget_type ?? "my_issues"},
       ${over.params_hash ?? crypto.randomUUID()}, ${sql.json({ items: [] })}, ${fetchedAt}, ${expiresAt})
    returning user_id, service, widget_type, params_hash
  `;
  return inserted;
}

export async function makeOAuthTransaction(
  userId: string,
  over: Partial<Omit<OAuthTransactionRow, "id" | "user_id">> = {},
): Promise<OAuthTransactionRow> {
  const sql = db();
  const row = {
    service: over.service ?? "linear",
    state: over.state ?? crypto.randomUUID(),
    code_verifier: over.code_verifier ?? crypto.randomUUID(),
    expires_at: over.expires_at ?? new Date(Date.now() + 600 * 1000),
  };
  const [inserted] = await sql<OAuthTransactionRow[]>`
    insert into public.oauth_transactions (user_id, service, state, code_verifier, expires_at)
    values (${userId}, ${row.service}, ${row.state}, ${row.code_verifier}, ${row.expires_at})
    returning *
  `;
  return inserted;
}
