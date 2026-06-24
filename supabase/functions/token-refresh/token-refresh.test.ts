// Refresh flow (testing-strategy.md §5.2): token-refresh selects a near-expiry oauth2 connection
// and refreshes it against the faked token endpoint. A rotated refresh token updates BOTH Vault
// secrets and expires_at atomically (old refresh gone); an invalid_grant sets reauth_required and
// stops; the FOR UPDATE lock serializes concurrent refresh so a rotating token is not double-spent.

import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { handler } from "./handler.ts";
import { refreshConnection } from "../_shared/refresh.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import { makeNearExpiryConnection } from "../../../test/fixtures/factories.ts";
import { readSecret } from "../../../test/fixtures/vault.ts";
import { servicePost } from "../../../test/fixtures/edge.ts";
import { jsonResponse, mockProvider, type ProviderMock, route } from "../../../test/fixtures/mockProvider.ts";

const created: string[] = [];
let mock: ProviderMock | undefined;

async function freshUser(): Promise<TestUser> {
  const u = await createUser();
  created.push(u.id);
  return u;
}

beforeAll(() => {});
afterEach(() => {
  mock?.restore();
  mock = undefined;
});
afterAll(async () => {
  for (const id of created) await deleteUser(id).catch(() => {});
  await closeDb();
  await closeBrokerDb();
});

describe("token-refresh (refresh, AOD-9 §8)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("refreshes a near-expiry connection, rotating both Vault secrets and expires_at atomically", async () => {
    const user = await freshUser();
    const conn = await makeNearExpiryConnection(user.id);
    mock = mockProvider([
      route("api.linear.app/oauth/token", () =>
        jsonResponse({ access_token: "new-access", refresh_token: "rotated-refresh", expires_in: 3600 })),
    ]);

    const res = await handler(servicePost("token-refresh", {}));
    assertEquals(res.status, 200);
    const summary = await res.json();
    assert(summary.refreshed >= 1, "at least one connection refreshed");
    assertEquals(mock.countMatching("oauth/token"), 1);

    // Rotation: the old refresh token is gone, replaced by the rotated one (AOD-9 §8.2 step 3).
    assertEquals(await readSecret(conn.access_secret_id!), "new-access");
    assertEquals(await readSecret(conn.refresh_secret_id!), "rotated-refresh");

    const sql = db();
    const [row] = await sql`select status, expires_at from public.connections where id = ${conn.id}`;
    assertEquals(row.status, "connected");
    assert(new Date(row.expires_at).getTime() > Date.now() + 3_000_000, "expires_at advanced ~1h");
  });

  it("invalid_grant sets reauth_required and leaves the secrets in place", async () => {
    const user = await freshUser();
    const conn = await makeNearExpiryConnection(user.id, { secrets: { access: "keep-access", refresh: "keep-refresh" } });
    mock = mockProvider([
      route("api.linear.app/oauth/token", () => jsonResponse({ error: "invalid_grant" }, 400)),
    ]);

    const res = await handler(servicePost("token-refresh", {}));
    assertEquals(res.status, 200);
    const summary = await res.json();
    assert(summary.reauth_required >= 1);

    const sql = db();
    const [row] = await sql`select status from public.connections where id = ${conn.id}`;
    assertEquals(row.status, "reauth_required");
    assertEquals(await readSecret(conn.access_secret_id!), "keep-access");
    assertEquals(await readSecret(conn.refresh_secret_id!), "keep-refresh");
  });

  it("the FOR UPDATE lock serializes concurrent refresh: the token endpoint is hit once", async () => {
    const user = await freshUser();
    const conn = await makeNearExpiryConnection(user.id);
    mock = mockProvider([
      route("api.linear.app/oauth/token", () =>
        jsonResponse({ access_token: "single-access", refresh_token: "single-refresh", expires_in: 3600 })),
    ]);

    const [a, b] = await Promise.all([
      refreshConnection(conn.id, { graceSeconds: 300 }),
      refreshConnection(conn.id, { graceSeconds: 300 }),
    ]);
    // One does the refresh; the other acquires the lock afterward, sees the extended expiry, skips.
    assertEquals([a, b].sort(), ["refreshed", "skipped"]);
    assertEquals(mock.countMatching("oauth/token"), 1);
    assertEquals(await readSecret(conn.access_secret_id!), "single-access");
  });

  it("rejects a call without the service token (401)", async () => {
    const req = new Request("http://localhost/token-refresh", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer not-the-service-key" },
      body: "{}",
    });
    assertEquals((await handler(req)).status, 401);
  });
});
