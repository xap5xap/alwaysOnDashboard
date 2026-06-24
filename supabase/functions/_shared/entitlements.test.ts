// Pure unit tests for the server entitlement / cache math (testing-strategy.md §4.2). No stack.

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import {
  cacheTtlSeconds,
  entitlementFloorSeconds,
  FREE,
  mayUserTriggerFetch,
  PRO,
  serverTier,
} from "./entitlements.ts";

const future = () => new Date(Date.now() + 30 * 24 * 3600 * 1000);
const past = () => new Date(Date.now() - 1000);

describe("serverTier (AOD-12 §6.3)", () => {
  it("resolves Free for a missing row", () => {
    assertEquals(serverTier(null), "free");
  });
  it("resolves Pro for tier=pro, active, within the period", () => {
    assertEquals(serverTier({ tier: "pro", status: "active", current_period_end: future() }), "pro");
  });
  it("keeps Pro in grace", () => {
    assertEquals(serverTier({ tier: "pro", status: "in_grace", current_period_end: future() }), "pro");
  });
  it("downgrades to Free when current_period_end has elapsed (missed-EXPIRATION backstop)", () => {
    assertEquals(serverTier({ tier: "pro", status: "active", current_period_end: past() }), "free");
  });
  it("resolves Free for tier=free regardless of status", () => {
    assertEquals(serverTier({ tier: "free", status: "active", current_period_end: future() }), "free");
  });
});

describe("entitlementFloorSeconds (AOD-3 / AOD-12 §4)", () => {
  it("Free is gated to 900s, Pro to 0", () => {
    assertEquals(entitlementFloorSeconds("free"), 900);
    assertEquals(entitlementFloorSeconds("pro"), 0);
  });
});

describe("mayUserTriggerFetch (AOD-12 §6.4)", () => {
  // Signature reconciled to the AOD-12 §6.4 form: (cacheAgeSeconds, widgetTtlSeconds, ent).
  it("refuses a Free user polling at 60s until the 900s floor", () => {
    assert(!mayUserTriggerFetch(60, 60, FREE));
    assert(mayUserTriggerFetch(900, 60, FREE));
  });
  it("gates a Pro user only by the widget TTL", () => {
    assert(!mayUserTriggerFetch(30, 60, PRO));
    assert(mayUserTriggerFetch(60, 60, PRO));
  });
});

describe("cacheTtlSeconds (AOD-10 §6.1)", () => {
  it("an author override wins when set", () => {
    assertEquals(cacheTtlSeconds({ authorOverrideSeconds: 120, defaultRefresh: { seconds: 600 } }), 120);
  });
  it("a manual default still yields a caching TTL of 300s", () => {
    assertEquals(cacheTtlSeconds({ defaultRefresh: "manual" }), 300);
  });
  it("never breaches the 15s minimum", () => {
    assertEquals(cacheTtlSeconds({ defaultRefresh: { seconds: 5 } }), 15);
  });
  it("caps at the 900s proxy_cache ceiling", () => {
    assertEquals(cacheTtlSeconds({ defaultRefresh: { seconds: 5000 } }), 900);
  });
});
