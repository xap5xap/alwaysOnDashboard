// RevenueCat webhook flow (testing-strategy.md §5.3): an HTTP POST with an Authorization header and
// a JSON body, no SDK. Tests POST canned event fixtures (§7) at the handler and assert the
// entitlements row against real local Postgres (service role). Covers AOD-12 §6.2 (auth, dedup,
// order-guard) and §6.3 (event -> row mapping: grant / grace / expiry / refund).

import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { handler } from "./handler.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import { makeEntitlement } from "../../../test/fixtures/factories.ts";
import { rcEvent, WEBHOOK_AUTH, webhookPost } from "../../../test/fixtures/revenuecat.ts";

const created: string[] = [];

async function freshUser(): Promise<TestUser> {
  const u = await createUser();
  created.push(u.id);
  return u;
}

interface EntRow {
  tier: string;
  status: string;
  active_product_id: string | null;
  current_period_end: Date | null;
  last_event_id: string | null;
  last_event_ms: number | null;
}

async function entRow(userId: string): Promise<EntRow | undefined> {
  const sql = db();
  const [row] = await sql<EntRow[]>`
    select tier, status, active_product_id, current_period_end, last_event_id, last_event_ms
    from public.entitlements where user_id = ${userId}
  `;
  return row;
}

beforeAll(() => {
  Deno.env.set("REVENUECAT_WEBHOOK_AUTH", WEBHOOK_AUTH);
});
afterAll(async () => {
  for (const id of created) await deleteUser(id).catch(() => {});
  await closeDb();
  await closeBrokerDb();
});

describe("revenuecat-webhook (AOD-12 §6.2/§6.3)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("auth: a wrong Authorization header returns 401 and writes nothing", async () => {
    const user = await freshUser();
    const res = await handler(webhookPost(rcEvent({ app_user_id: user.id }), "wrong-secret"));
    assertEquals(res.status, 401);
    assertEquals(await entRow(user.id), undefined);
  });

  it("event mapping: INITIAL_PURCHASE grants pro/active with product and period end", async () => {
    const user = await freshUser();
    const expMs = Date.now() + 7 * 24 * 3600 * 1000;
    const res = await handler(handlerBody(user.id, { type: "INITIAL_PURCHASE", id: "evt_grant", event_timestamp_ms: 1000, expiration_at_ms: expMs }));
    assertEquals(res.status, 200);
    assertEquals((await res.json()).applied, true);

    const row = await entRow(user.id);
    assertEquals(row?.tier, "pro");
    assertEquals(row?.status, "active");
    assertEquals(row?.active_product_id, "vela_pro_monthly");
    assertEquals(row?.last_event_id, "evt_grant");
    assertEquals(Number(row?.last_event_ms), 1000);
    assertEquals(row?.current_period_end?.getTime(), new Date(expMs).getTime());
  });

  it("event mapping: BILLING_ISSUE keeps pro and sets in_grace", async () => {
    const user = await freshUser();
    await handler(handlerBody(user.id, { type: "BILLING_ISSUE" }));
    const row = await entRow(user.id);
    assertEquals(row?.tier, "pro");
    assertEquals(row?.status, "in_grace");
  });

  it("event mapping: EXPIRATION revokes to free/expired with null product", async () => {
    const user = await freshUser();
    await handler(handlerBody(user.id, { type: "EXPIRATION" }));
    const row = await entRow(user.id);
    assertEquals(row?.tier, "free");
    assertEquals(row?.status, "expired");
    assertEquals(row?.active_product_id, null);
  });

  it("event mapping: a refund CANCELLATION (CUSTOMER_SUPPORT) revokes to free/expired", async () => {
    const user = await freshUser();
    await handler(handlerBody(user.id, { type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" }));
    const row = await entRow(user.id);
    assertEquals(row?.tier, "free");
    assertEquals(row?.status, "expired");
  });

  it("event mapping: a non-refund CANCELLATION (UNSUBSCRIBE) keeps pro until period end", async () => {
    const user = await freshUser();
    await handler(handlerBody(user.id, { type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" }));
    const row = await entRow(user.id);
    assertEquals(row?.tier, "pro");
    assertEquals(row?.status, "active");
  });

  it("idempotency: re-POSTing an event whose id == last_event_id acks 200 and leaves the row unchanged", async () => {
    const user = await freshUser();
    await makeEntitlement(user.id, {
      tier: "pro",
      status: "active",
      active_product_id: "vela_pro_monthly",
      last_event_id: "evt_dup",
      last_event_ms: 5000,
    });
    // Same id, but an EXPIRATION that WOULD downgrade if it were applied.
    const res = await handler(handlerBody(user.id, { type: "EXPIRATION", id: "evt_dup", event_timestamp_ms: 5000 }));
    assertEquals(res.status, 200);
    assertEquals((await res.json()).applied, false);
    const row = await entRow(user.id);
    assertEquals(row?.tier, "pro");
    assertEquals(row?.status, "active");
  });

  it("order-guard: an event with event_timestamp_ms <= last_event_ms is acked and ignored", async () => {
    const user = await freshUser();
    await makeEntitlement(user.id, {
      tier: "pro",
      status: "active",
      last_event_id: "evt_recent",
      last_event_ms: 9000,
    });
    const res = await handler(handlerBody(user.id, { type: "EXPIRATION", id: "evt_stale", event_timestamp_ms: 1000 }));
    assertEquals(res.status, 200);
    assertEquals((await res.json()).applied, false);
    const row = await entRow(user.id);
    assertEquals(row?.tier, "pro");
    assertEquals(row?.status, "active");
  });

  it("order-guard: a strictly newer event applies (pro -> free across the transition)", async () => {
    const user = await freshUser();
    await handler(handlerBody(user.id, { type: "INITIAL_PURCHASE", id: "evt_a", event_timestamp_ms: 1000 }));
    assertEquals((await entRow(user.id))?.tier, "pro");
    const res = await handler(handlerBody(user.id, { type: "EXPIRATION", id: "evt_b", event_timestamp_ms: 2000 }));
    assertEquals((await res.json()).applied, true);
    assertEquals((await entRow(user.id))?.tier, "free");
  });

  it("order-guard: applies to a pre-existing row with no last_event_ms (null event-tracking)", async () => {
    const user = await freshUser();
    await makeEntitlement(user.id, { tier: "free", status: "expired", last_event_id: null, last_event_ms: null });
    const res = await handler(handlerBody(user.id, { type: "INITIAL_PURCHASE", id: "evt_first", event_timestamp_ms: 1000 }));
    assertEquals((await res.json()).applied, true);
    const row = await entRow(user.id);
    assertEquals(row?.tier, "pro");
    assertEquals(row?.status, "active");
    assertEquals(Number(row?.last_event_ms), 1000);
  });
});

/** rcEvent + webhookPost with the valid secret, for the user. */
function handlerBody(userId: string, over: Omit<Parameters<typeof rcEvent>[0], "app_user_id">): Request {
  return webhookPost(rcEvent({ app_user_id: userId, ...over }));
}
