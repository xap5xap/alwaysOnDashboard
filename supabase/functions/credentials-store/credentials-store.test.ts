// Non-OAuth connect (AOD-9 §7.2): credentials-store. admin_key stores the key in Vault and writes
// the connection; platform_key stores only the location config and writes NO Vault secret.

import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists } from "@std/assert";
import { handler } from "./handler.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import { readSecret } from "../../../test/fixtures/vault.ts";
import { userPost } from "../../../test/fixtures/edge.ts";

const created: string[] = [];

async function freshUser(): Promise<TestUser> {
  const u = await createUser();
  created.push(u.id);
  return u;
}

beforeAll(() => {});
afterAll(async () => {
  for (const id of created) await deleteUser(id).catch(() => {});
  await closeDb();
  await closeBrokerDb();
});

describe("credentials-store (connect, AOD-9 §7.2)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("admin_key: stores the key in Vault and writes the connection", async () => {
    const user = await freshUser();
    const res = await handler(
      await userPost("credentials-store", user, {
        service: "anthropic_usage",
        apiKey: "sk-ant-admin-secret",
        accountLabel: "My Org",
      }),
    );
    assertEquals(res.status, 200);

    const sql = db();
    const [conn] = await sql`
      select auth_class, status, access_secret_id, refresh_secret_id, account_label
      from public.connections where user_id = ${user.id} and service = 'anthropic_usage'
    `;
    assertExists(conn);
    assertEquals(conn.auth_class, "admin_key");
    assertEquals(conn.status, "connected");
    assertEquals(conn.refresh_secret_id, null);
    assertEquals(conn.account_label, "My Org");
    assertEquals(await readSecret(conn.access_secret_id), "sk-ant-admin-secret");
  });

  it("platform_key: stores the location config and writes NO Vault secret", async () => {
    const user = await freshUser();
    const res = await handler(
      await userPost("credentials-store", user, { service: "weather", location: { city: "Quito" } }),
    );
    assertEquals(res.status, 200);

    const sql = db();
    const [conn] = await sql`
      select auth_class, access_secret_id, refresh_secret_id, config
      from public.connections where user_id = ${user.id} and service = 'weather'
    `;
    assertEquals(conn.auth_class, "platform_key");
    assertEquals(conn.access_secret_id, null);
    assertEquals(conn.refresh_secret_id, null);
    assertEquals(conn.config.city, "Quito");
  });

  it("admin_key without a key is rejected (400)", async () => {
    const user = await freshUser();
    const res = await handler(await userPost("credentials-store", user, { service: "anthropic_usage" }));
    assertEquals(res.status, 400);
  });
});
