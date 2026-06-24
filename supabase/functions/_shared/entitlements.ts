// The canonical freemium entitlement model (AOD-12). One shape, two readers: the Expo client
// resolves it from RevenueCat CustomerInfo (UX only), the Edge server from the persisted
// entitlements row (authoritative). Pure and I/O-free.
//
// CANONICAL HOME. It physically lives here, under supabase/functions/_shared/, because the Supabase
// Edge runtime (functions serve / deploy) only bundles files under supabase/functions/ and cannot
// reach packages/ (verified 2026-06-24: serve boots with "Module not found" for an out-of-tree
// import). The Expo client imports the same source through @vela/shared, which re-exports this file
// (packages/shared/src/entitlements.ts). See testing-strategy.md §3.2 / §11 and AOD-25.

export type Tier = "free" | "pro";

// AOD-12 §4: the single shape both halves of the product read. The client consumes canUseKiosk
// (AOD-11 §4.4) and the rest for UX gating; the server reads the same object to enforce.
export interface Entitlements {
  tier: Tier;
  maxConnectedServices: number; // backend-cost services; Infinity = unlimited (Pro). Clock excluded.
  maxDashboards: number; // Infinity = unlimited (Pro)
  entitlementFloorSeconds: number; // AOD-10 §6.2 effectiveInterval floor; 0 = no tier floor
  canUseKiosk: boolean; // AOD-11 §4.4
  canUseThemes: boolean; // non-default themes
  canUsePremiumPacks: boolean; // flights, finance (AOD-8/AOD-10 §10 registry gate)
}

// AOD-3's matrix encoded once (AOD-12 §4). Infinity for "unlimited" so every count check is the
// same expression on both tiers (current >= max is simply never true for Pro, no sentinel branch).
export const FREE: Entitlements = {
  tier: "free",
  maxConnectedServices: 2, // AOD-3: 2 backend-cost services
  maxDashboards: 1, // AOD-3: 1 dashboard
  entitlementFloorSeconds: 900, // AOD-3: 15 min, equals the OS background cap (AOD-10 §6.5)
  canUseKiosk: false, // AOD-3: kiosk is Pro-only
  canUseThemes: false, // AOD-3: default theme only
  canUsePremiumPacks: false, // AOD-3: no flights/finance
};

export const PRO: Entitlements = {
  tier: "pro",
  maxConnectedServices: Number.POSITIVE_INFINITY, // AOD-3: unlimited
  maxDashboards: Number.POSITIVE_INFINITY, // AOD-3: multiple
  entitlementFloorSeconds: 0, // AOD-3: per-widget floors apply (e.g. Linear 60s, AOD-10 §6.2)
  canUseKiosk: true,
  canUseThemes: true,
  canUsePremiumPacks: true,
};

/** Resolve the full Entitlements for a tier (AOD-12 §4). */
export function entitlementsFor(tier: Tier): Entitlements {
  return tier === "pro" ? PRO : FREE;
}

/** The single RevenueCat entitlement (AOD-12 §5.1): its presence means Pro, its absence Free. */
export const PRO_ENTITLEMENT_ID = "pro";

/**
 * Resolve the tier from an active-entitlement id set (AOD-12 §5.2). Works for both readers: the
 * client passes Object.keys(customerInfo.entitlements.active); the server can pass the set derived
 * from the persisted row. The webhook itself maps by event type (revenuecat.ts), not through this.
 */
export function tierFromActiveEntitlements(activeIds: Set<string>): Tier {
  return activeIds.has(PRO_ENTITLEMENT_ID) ? "pro" : "free";
}

// The persisted entitlements row, read shape (data-model.md §5.3, AOD-12 §6.1). DB hands back
// current_period_end as a Date (or an ISO string over PostgREST); tier/status are text columns.
export interface EntitlementRow {
  tier: string;
  status: string; // active | in_grace | expired
  current_period_end: string | Date | null;
}

/**
 * The authoritative server tier at read time (AOD-12 §6.3). A missing row is Free (the safe
 * default). An elapsed current_period_end downgrades to Free even when tier=pro (the missed-
 * EXPIRATION backstop); status in {active, in_grace} keeps Pro while the period is still valid.
 */
export function serverTier(row: EntitlementRow | null | undefined, now: Date = new Date()): Tier {
  if (!row) return "free";
  if (row.tier !== "pro") return "free";
  if (row.current_period_end && new Date(row.current_period_end).getTime() <= now.getTime()) return "free";
  if (row.status === "active" || row.status === "in_grace") return "pro";
  return "free";
}

/** The full Entitlements every server enforcement point reads (AOD-12 §6.3). */
export function serverEntitlements(row: EntitlementRow | null | undefined, now: Date = new Date()): Entitlements {
  return entitlementsFor(serverTier(row, now));
}

/** The per-tier refresh floor in seconds (AOD-3 / AOD-12 §4): Free 900s, Pro 0. */
export function entitlementFloorSeconds(tier: Tier): number {
  return entitlementsFor(tier).entitlementFloorSeconds;
}

/**
 * May a user trigger a fresh provider fetch yet (AOD-12 §6.4)? The floor is
 * max(widgetTtlSeconds, ent.entitlementFloorSeconds): a Free user (900) polling at 60s age is
 * refused until 900s and served the cached value instead; a Pro user (0) is gated only by the
 * widget TTL. This is a per-user fetch-trigger gate, orthogonal to the per-user cache key
 * (data-model.md §5.8/§12); it does not fork the cache.
 */
export function mayUserTriggerFetch(cacheAgeSeconds: number, widgetTtlSeconds: number, ent: Entitlements): boolean {
  const floor = Math.max(widgetTtlSeconds, ent.entitlementFloorSeconds);
  return cacheAgeSeconds >= floor;
}

// --- connect-service count (AOD-12 §7.1) ---------------------------------------------------------

/** The connection columns the count gate reads. */
export interface ConnectionLike {
  service: string;
  auth_class: string;
  status: string;
}

/**
 * The set of active backend service names that count toward maxConnectedServices (AOD-12 §7.1).
 * Clock (auth_class "none") never counts, per AOD-3; a disconnected row is not active. The target
 * service is excluded so reconnecting an already-connected service is never blocked at the limit.
 */
export function activeBackendServiceNames(connections: ConnectionLike[], excludeService?: string): Set<string> {
  const names = new Set<string>();
  for (const c of connections) {
    if (c.auth_class === "none") continue;
    if (c.status === "disconnected") continue;
    if (excludeService !== undefined && c.service === excludeService) continue;
    names.add(c.service);
  }
  return names;
}

/**
 * May the user connect (or reconnect) targetService without exceeding their tier (AOD-12 §7.1)?
 * Infinity for Pro makes this always true; Free is bounded at maxConnectedServices distinct
 * backend services.
 */
export function mayConnectAnother(connections: ConnectionLike[], ent: Entitlements, targetService: string): boolean {
  return activeBackendServiceNames(connections, targetService).size < ent.maxConnectedServices;
}

// --- cache TTL (AOD-10 §6.1) ---------------------------------------------------------------------

const CACHE_MIN_SECONDS = 15;
const CACHE_MAX_SECONDS = 900; // the AOD-5 / proxy_cache CHECK ceiling (data-model.md §5.8)
const MANUAL_CACHE_DEFAULT_SECONDS = 300;

/**
 * The provider-facing cache TTL (AOD-10 §6.1), bounded to the proxy_cache 900s ceiling. An author
 * override wins when set; a "manual" refresh still yields a caching TTL (300s); the 15s minimum is
 * never breached. Owned by AOD-10; colocated here because the proxy reads it alongside the tier math.
 */
export function cacheTtlSeconds(
  opts: { authorOverrideSeconds?: number; defaultRefresh: { seconds: number } | "manual" },
): number {
  let ttl: number;
  if (opts.authorOverrideSeconds != null) ttl = opts.authorOverrideSeconds;
  else if (opts.defaultRefresh === "manual") ttl = MANUAL_CACHE_DEFAULT_SECONDS;
  else ttl = opts.defaultRefresh.seconds;
  return Math.min(CACHE_MAX_SECONDS, Math.max(CACHE_MIN_SECONDS, ttl));
}
