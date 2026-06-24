// Server-side pure functions the proxy and (later) the webhook consume. Deterministic and
// I/O-free, so unit-tested in the wide base (testing-strategy.md §4.2). Owned by AOD-12 (tier
// resolution, refresh floor) and AOD-10 (cache TTL); this is the minimal slice the broker needs.
//
// NOTE: this task ships and unit-tests these functions; full entitlement ENFORCEMENT (the six
// gates) and the RevenueCat webhook are the separate AOD-12 implementation task. The proxy wires
// cacheTtlSeconds; serverTier/mayUserTriggerFetch are wired into the proxy's tier refresh floor.

export type Tier = "free" | "pro";

export interface EntitlementRow {
  tier: string;
  status: string; // active | in_grace | expired
  current_period_end: string | Date | null;
}

/**
 * Resolve the authoritative server tier (AOD-12 §6.3). A missing row is Free (the safe default).
 * An elapsed `current_period_end` downgrades to Free even when `tier=pro` (the missed-EXPIRATION
 * backstop); `status` in {active, in_grace} keeps Pro while the period is still valid.
 */
export function serverTier(row: EntitlementRow | null | undefined, now: Date = new Date()): Tier {
  if (!row) return "free";
  if (row.tier !== "pro") return "free";
  if (row.current_period_end && new Date(row.current_period_end).getTime() <= now.getTime()) return "free";
  if (row.status === "active" || row.status === "in_grace") return "pro";
  return "free";
}

/** The per-tier refresh floor in seconds (AOD-3 / AOD-12 §4): Free is gated to 900s, Pro to 0. */
export function entitlementFloorSeconds(tier: Tier): number {
  return tier === "pro" ? 0 : 900;
}

/**
 * May a user trigger a fresh provider fetch yet (AOD-12 §6.4)? The floor is
 * max(widgetTtlSeconds, entitlementFloorSeconds): a Free user (900) polling at 60s age is refused
 * until 900s; a Pro user (0) is gated only by the widget TTL.
 */
export function mayUserTriggerFetch(
  opts: { widgetTtlSeconds: number; entitlementFloorSeconds: number; ageSeconds: number },
): boolean {
  const floor = Math.max(opts.widgetTtlSeconds, opts.entitlementFloorSeconds);
  return opts.ageSeconds >= floor;
}

const CACHE_MIN_SECONDS = 15;
const CACHE_MAX_SECONDS = 900; // the AOD-5 / proxy_cache CHECK ceiling (data-model.md §5.8)
const MANUAL_CACHE_DEFAULT_SECONDS = 300;

/**
 * The provider-facing cache TTL (AOD-10 §6.1), bounded to the proxy_cache 900s ceiling. An author
 * override wins when set; a "manual" refresh still yields a caching TTL (300s); the 15s minimum is
 * never breached.
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
