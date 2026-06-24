// Disconnect flow (testing-strategy.md §5.2; AOD-9 §10; AOD-5 hard delete): disconnect revokes at
// the provider (best effort), deletes both Vault secrets, hard-deletes the connection row, deletes
// that service's proxy_cache rows, and eagerly deletes the widget_instances for that service_id; a
// provider revoke failure does not block the local purge.

import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { handler } from "./handler.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import { makeConnection, makeDashboard, makeProxyCacheRow, makeWidgetInstance } from "../../../test/fixtures/factories.ts";
import { secretExists } from "../../../test/fixtures/vault.ts";
import { userPost } from "../../../test/fixtures/edge.ts";
import { mockProvider, type ProviderMock, route } from "../../../test/fixtures/mockProvider.ts";

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

describe("disconnect (AOD-9 §10, AOD-5 hard delete)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("revokes, purges Vault, and hard-deletes the connection, cache, and widget instances", async () => {
    const user = await freshUser();
    const conn = await makeConnection(user.id, {
      service: "linear",
      auth_class: "oauth2",
      status: "connected",
      secrets: { access: "acc", refresh: "ref" },
    });
    const dashboard = await makeDashboard(user.id);
    await makeWidgetInstance(dashboard.id, user.id, { service_id: "linear", widget_type: "my_issues" });
    await makeProxyCacheRow(user.id, { service: "linear", widget_type: "my_issues" });

    let revokeCalls = 0;
    mock = mockProvider([
      route("api.linear.app/oauth/revoke", () => {
        revokeCalls++;
        return new Response(null, { status: 200 });
      }),
    ]);

    const res = await handler(await userPost("disconnect", user, { connectionId: conn.id }));
    assertEquals(res.status, 200);
    assertEquals(revokeCalls, 1);

    assertEquals(await secretExists(conn.access_secret_id!), false);
    assertEquals(await secretExists(conn.refresh_secret_id!), false);

    const sql = db();
    assertEquals((await sql`select 1 from public.connections where id = ${conn.id}`).length, 0);
    assertEquals(
      (await sql`select 1 from public.proxy_cache where user_id = ${user.id} and service = 'linear'`).length,
      0,
    );
    assertEquals(
      (await sql`select 1 from public.widget_instances where user_id = ${user.id} and service_id = 'linear'`).length,
      0,
    );
  });

  it("a provider revoke failure does not block the local purge", async () => {
    const user = await freshUser();
    const conn = await makeConnection(user.id, {
      service: "linear",
      secrets: { access: "acc", refresh: "ref" },
    });
    mock = mockProvider([
      route("api.linear.app/oauth/revoke", () => {
        throw new Error("revoke endpoint down");
      }),
    ]);

    const res = await handler(await userPost("disconnect", user, { connectionId: conn.id }));
    assertEquals(res.status, 200);
    assertEquals(await secretExists(conn.access_secret_id!), false);
    const sql = db();
    assertEquals((await sql`select 1 from public.connections where id = ${conn.id}`).length, 0);
  });

  it("rejects disconnecting another user's connection (403)", async () => {
    const owner = await freshUser();
    const attacker = await freshUser();
    const conn = await makeConnection(owner.id, { service: "linear", secrets: { access: "a", refresh: "r" } });

    const res = await handler(await userPost("disconnect", attacker, { connectionId: conn.id }));
    assertEquals(res.status, 403);
    const sql = db();
    assertEquals((await sql`select 1 from public.connections where id = ${conn.id}`).length, 1);
  });
});
