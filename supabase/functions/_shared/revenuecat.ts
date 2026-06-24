// The RevenueCat webhook body (Zod, the one shared validation layer per AOD-25) and the pure
// event -> entitlements-write mapping (AOD-12 §6.3). Pure and I/O-free: the webhook Edge Function
// validates the body and applies the mapping; the mapping is unit-tested under deno (testing-
// strategy.md §4.2).
//
// CANONICAL HOME under supabase/functions/_shared/ (same reason as entitlements.ts: the Edge runtime
// only bundles files under supabase/functions/). The Expo client imports it via @vela/shared, which
// re-exports this file. Field names and event semantics verified against current RevenueCat docs
// (AOD-12 §13; re-confirmed 2026-06-24: envelope { api_version, event }, refunds are CANCELLATION
// events keyed by cancel_reason).

import { z } from "zod";
import type { Tier } from "./entitlements.ts";

// One event object inside the webhook envelope. Only the fields the mapping reads are modeled;
// RevenueCat sends many more (app_id, store, price, period_type, ...) which Zod strips. `type` is a
// plain string, never an enum, so an unmodeled event type validates and is then acked-and-ignored.
export const RevenueCatEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  app_user_id: z.string().min(1),
  event_timestamp_ms: z.number().int(),
  product_id: z.string().nullish(),
  entitlement_ids: z.array(z.string()).nullish(),
  expiration_at_ms: z.number().int().nullish(),
  cancel_reason: z.string().nullish(),
});

export const RevenueCatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: RevenueCatEventSchema,
});

export type RevenueCatEvent = z.infer<typeof RevenueCatEventSchema>;
export type RevenueCatWebhookBody = z.infer<typeof RevenueCatWebhookSchema>;

// The fields one event resolves to on the entitlements row (data-model.md §5.3). current_period_end
// is an ISO timestamptz string (or null); last_event_id / last_event_ms are added by the handler.
export interface EntitlementWrite {
  tier: Tier;
  status: "active" | "in_grace" | "expired";
  active_product_id: string | null;
  current_period_end: string | null;
}

// AOD-12 §6.3 granting/continuing events: all resolve to Pro/active.
const GRANT_TYPES = new Set<string>([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);

// A refund-driven CANCELLATION revokes immediately; every other cancel_reason (UNSUBSCRIBE,
// PRICE_INCREASE, ...) keeps Pro until the paid period ends, where the serverTier backstop then
// downgrades. Verified 2026-06-24: refunds arrive as CANCELLATION; CUSTOMER_SUPPORT is the
// documented refund-via-support reason (auto-renew status alone cannot identify a refund).
const REFUND_CANCEL_REASON = "CUSTOMER_SUPPORT";

function periodEndIso(expirationAtMs: number | null | undefined): string | null {
  return expirationAtMs != null ? new Date(expirationAtMs).toISOString() : null;
}

/**
 * Map a RevenueCat event to the entitlements write (AOD-12 §6.3), or null for an event type the
 * webhook does not act on (TEST, TRANSFER, PAYWALL_*, ...): the handler acks 200 and writes nothing.
 */
export function mapEventToEntitlement(event: RevenueCatEvent): EntitlementWrite | null {
  const productId = event.product_id ?? null;
  const periodEnd = periodEndIso(event.expiration_at_ms);

  if (GRANT_TYPES.has(event.type)) {
    return { tier: "pro", status: "active", active_product_id: productId, current_period_end: periodEnd };
  }
  if (event.type === "BILLING_ISSUE") {
    // Keep Pro through the billing-retry / grace window; do not revoke (AOD-12 §6.3).
    return { tier: "pro", status: "in_grace", active_product_id: productId, current_period_end: periodEnd };
  }
  if (event.type === "SUBSCRIPTION_PAUSED") {
    // Do not revoke on pause; access stays bounded by current_period_end (AOD-12 §6.3).
    return { tier: "pro", status: "active", active_product_id: productId, current_period_end: periodEnd };
  }
  if (event.type === "CANCELLATION") {
    if (event.cancel_reason === REFUND_CANCEL_REASON) {
      return { tier: "free", status: "expired", active_product_id: null, current_period_end: null };
    }
    // Auto-renew off: keep Pro for the period already paid; only the future renewal is gone.
    return { tier: "pro", status: "active", active_product_id: productId, current_period_end: periodEnd };
  }
  if (event.type === "EXPIRATION") {
    return { tier: "free", status: "expired", active_product_id: null, current_period_end: null };
  }
  return null;
}
