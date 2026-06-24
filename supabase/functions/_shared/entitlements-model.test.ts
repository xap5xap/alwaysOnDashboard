// Pure unit tests for the canonical AOD-12 model + the RevenueCat webhook schema/mapping
// (testing-strategy.md §4.2), plus the cross-runtime import smoke (§3.2). No stack: this runs in
// the every-push unit CI job (deno test supabase/functions/_shared). The model is imported through
// the bare @vela/shared specifier so a failure to resolve the shared module fails this file.

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import {
  activeBackendServiceNames,
  entitlementsFor,
  FREE,
  mayConnectAnother,
  PRO,
  serverEntitlements,
  tierFromActiveEntitlements,
} from "@vela/shared";
import { mapEventToEntitlement, RevenueCatWebhookSchema } from "@vela/shared/revenuecat";

describe("cross-runtime import smoke (testing-strategy.md §3.2)", () => {
  it("the shared module loads under Deno via the @vela/shared specifier", () => {
    // If the bare specifier did not resolve, the import above would have thrown at load.
    assertEquals(typeof entitlementsFor, "function");
    assertEquals(entitlementsFor("pro").canUseKiosk, true);
  });
});

describe("tierFromActiveEntitlements / entitlementsFor (AOD-12 §4, §5.2)", () => {
  it("an active set containing pro resolves Pro, else Free", () => {
    assertEquals(tierFromActiveEntitlements(new Set(["pro"])), "pro");
    assertEquals(tierFromActiveEntitlements(new Set(["something_else"])), "free");
    assertEquals(tierFromActiveEntitlements(new Set()), "free");
  });
  it("entitlementsFor returns the AOD-3 Free and Pro matrices", () => {
    assertEquals(FREE, {
      tier: "free",
      maxConnectedServices: 2,
      maxDashboards: 1,
      entitlementFloorSeconds: 900,
      canUseKiosk: false,
      canUseThemes: false,
      canUsePremiumPacks: false,
    });
    assertEquals(entitlementsFor("pro"), PRO);
    assertEquals(PRO.canUseKiosk, true);
    assertEquals(PRO.canUsePremiumPacks, true);
  });
  it("Infinity limits make current >= max never true on Pro", () => {
    assertEquals(PRO.maxConnectedServices, Number.POSITIVE_INFINITY);
    assert(!(999 >= PRO.maxConnectedServices));
    assert(!(999 >= PRO.maxDashboards));
  });
});

describe("serverEntitlements (AOD-12 §6.3)", () => {
  it("returns the full Entitlements for the resolved tier", () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    assertEquals(serverEntitlements(null), FREE);
    assertEquals(serverEntitlements({ tier: "pro", status: "active", current_period_end: future }), PRO);
    assertEquals(serverEntitlements({ tier: "pro", status: "active", current_period_end: new Date(Date.now() - 1000) }), FREE);
  });
});

describe("activeBackendServiceNames / mayConnectAnother (AOD-12 §7.1)", () => {
  const conns = [
    { service: "linear", auth_class: "oauth2", status: "connected" },
    { service: "google_calendar", auth_class: "oauth2", status: "connected" },
    { service: "clock", auth_class: "none", status: "connected" }, // never counts (AOD-3)
    { service: "weather", auth_class: "platform_key", status: "disconnected" }, // not active
  ];
  it("counts only active, non-Clock connections", () => {
    assertEquals(activeBackendServiceNames(conns), new Set(["linear", "google_calendar"]));
  });
  it("excludes the target service so reconnecting at the limit is allowed", () => {
    assertEquals(activeBackendServiceNames(conns, "linear"), new Set(["google_calendar"]));
    assert(mayConnectAnother(conns, FREE, "linear"));
  });
  it("refuses a Free user's 3rd distinct backend service", () => {
    assert(!mayConnectAnother(conns, FREE, "anthropic_usage"));
  });
  it("allows a 1st/2nd service and never bounds Pro", () => {
    assert(mayConnectAnother([], FREE, "linear"));
    assert(mayConnectAnother([conns[0]], FREE, "google_calendar"));
    assert(mayConnectAnother(conns, PRO, "anthropic_usage"));
  });
});

describe("RevenueCatWebhookSchema (testing-strategy.md §4.2)", () => {
  const validEvent = {
    api_version: "1.0",
    event: {
      id: "evt_1",
      type: "INITIAL_PURCHASE",
      app_user_id: "user-uuid",
      event_timestamp_ms: 1_700_000_000_000,
      product_id: "vela_pro_monthly",
      entitlement_ids: ["pro"],
      expiration_at_ms: 1_700_600_000_000,
    },
  };
  it("accepts a valid webhook body", () => {
    assert(RevenueCatWebhookSchema.safeParse(validEvent).success);
  });
  it("rejects a body missing event.id", () => {
    const bad = { event: { ...validEvent.event, id: undefined } };
    assert(!RevenueCatWebhookSchema.safeParse(bad).success);
  });
  it("rejects a non-numeric event_timestamp_ms", () => {
    const bad = { event: { ...validEvent.event, event_timestamp_ms: "soon" } };
    assert(!RevenueCatWebhookSchema.safeParse(bad).success);
  });
});

describe("mapEventToEntitlement (AOD-12 §6.3)", () => {
  const base = {
    id: "e",
    app_user_id: "u",
    event_timestamp_ms: 1_700_000_000_000,
    product_id: "vela_pro_monthly",
    expiration_at_ms: 1_700_600_000_000,
  };
  const expectedPeriodEnd = new Date(1_700_600_000_000).toISOString();

  it("grant events resolve to pro/active with the product and period end", () => {
    for (const type of ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED"]) {
      assertEquals(mapEventToEntitlement({ ...base, type }), {
        tier: "pro",
        status: "active",
        active_product_id: "vela_pro_monthly",
        current_period_end: expectedPeriodEnd,
      });
    }
  });
  it("BILLING_ISSUE keeps pro and sets in_grace", () => {
    const w = mapEventToEntitlement({ ...base, type: "BILLING_ISSUE" });
    assertEquals(w?.tier, "pro");
    assertEquals(w?.status, "in_grace");
  });
  it("CANCELLATION (auto-renew off) keeps pro until the period end", () => {
    const w = mapEventToEntitlement({ ...base, type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" });
    assertEquals(w, { tier: "pro", status: "active", active_product_id: "vela_pro_monthly", current_period_end: expectedPeriodEnd });
  });
  it("CANCELLATION (refund via support) revokes to free/expired", () => {
    const w = mapEventToEntitlement({ ...base, type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" });
    assertEquals(w, { tier: "free", status: "expired", active_product_id: null, current_period_end: null });
  });
  it("EXPIRATION revokes to free/expired", () => {
    assertEquals(mapEventToEntitlement({ ...base, type: "EXPIRATION" }), {
      tier: "free",
      status: "expired",
      active_product_id: null,
      current_period_end: null,
    });
  });
  it("an unmodeled event type is ignored (null)", () => {
    assertEquals(mapEventToEntitlement({ ...base, type: "TEST" }), null);
    assertEquals(mapEventToEntitlement({ ...base, type: "TRANSFER" }), null);
  });
  it("a grant with no expiration leaves current_period_end null", () => {
    const w = mapEventToEntitlement({ id: "e", app_user_id: "u", event_timestamp_ms: 1, type: "INITIAL_PURCHASE" });
    assertExists(w);
    assertEquals(w?.current_period_end, null);
  });
});
