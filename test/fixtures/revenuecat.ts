// Canned RevenueCat webhook fixtures (testing-strategy.md §6, §7). The webhook is just an
// authenticated POST, so faithfully reproducing the payload is the whole test: no SDK. Tests POST
// these bodies with an Authorization header at the handler. The builder defaults to a valid
// INITIAL_PURCHASE; overrides cover every event type, a duplicate id, and an out-of-order timestamp.

/** The shared webhook secret the §5.3 suite configures (Deno.env REVENUECAT_WEBHOOK_AUTH) and sends. */
export const WEBHOOK_AUTH = "test-revenuecat-webhook-secret";

export interface RcEventOverrides {
  app_user_id: string; // the Supabase auth.uid() (AOD-12 §5.3); required
  id?: string;
  type?: string;
  event_timestamp_ms?: number;
  product_id?: string | null;
  entitlement_ids?: string[];
  expiration_at_ms?: number | null;
  cancel_reason?: string;
}

/** Build a full RevenueCat webhook body { api_version, event } (envelope verified 2026-06-24). */
export function rcEvent(over: RcEventOverrides): Record<string, unknown> {
  const event: Record<string, unknown> = {
    id: over.id ?? crypto.randomUUID(),
    type: over.type ?? "INITIAL_PURCHASE",
    app_user_id: over.app_user_id,
    event_timestamp_ms: over.event_timestamp_ms ?? Date.now(),
    product_id: over.product_id !== undefined ? over.product_id : "vela_pro_monthly",
    entitlement_ids: over.entitlement_ids ?? ["pro"],
    expiration_at_ms: over.expiration_at_ms !== undefined ? over.expiration_at_ms : Date.now() + 30 * 24 * 3600 * 1000,
  };
  if (over.cancel_reason !== undefined) event.cancel_reason = over.cancel_reason;
  return { api_version: "1.0", event };
}

/** A POST Request carrying an Authorization header (defaults to the valid secret). */
export function webhookPost(body: unknown, authHeader: string = WEBHOOK_AUTH): Request {
  return new Request("http://localhost/revenuecat-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
}
