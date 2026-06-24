// Connect flow, part 2 (testing-strategy.md §5.2): oauth-callback with a valid state exchanges the
// code against the faked token endpoint, writes the access + refresh secrets to Vault (asserted by
// reading them back), upserts the connection to connected, and deletes the transaction; a bad or
// expired state is rejected and writes nothing. Vault is real; only globalThis.fetch is stubbed.

import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import { handler } from "./handler.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import { makeOAuthTransaction } from "../../../test/fixtures/factories.ts";
import { readSecret } from "../../../test/fixtures/vault.ts";
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

function callbackGet(code: string, state: string): Request {
  return new Request(`http://localhost/oauth-callback?code=${code}&state=${state}`, { method: "GET" });
}

describe("oauth-callback (connect, AOD-9 §7.1)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("valid state: exchanges the code, writes Vault secrets, upserts the connection, deletes the txn", async () => {
    const user = await freshUser();
    const txn = await makeOAuthTransaction(user.id, {
      service: "linear",
      state: "valid-state-001",
      code_verifier: "verifier-001",
    });
    mock = mockProvider([
      route("api.linear.app/oauth/token", () =>
        jsonResponse({ access_token: "acc-1", refresh_token: "ref-1", expires_in: 3600, scope: "read write" })),
    ]);

    const res = await handler(callbackGet("the-code", "valid-state-001"));
    assertEquals(res.status, 302);
    const location = res.headers.get("Location") ?? "";
    assert(location.startsWith("alwaysondashboard://oauth/done"), "redirects to the app deep link");
    assert(location.includes("status=ok"), "carries a success signal");
    assert(!location.includes("acc-1"), "the redirect never carries a token");
    assertEquals(mock.countMatching("oauth/token"), 1);

    const sql = db();
    const [conn] = await sql`
      select status, scopes, access_secret_id, refresh_secret_id, expires_at
      from public.connections where user_id = ${user.id} and service = 'linear'
    `;
    assertExists(conn);
    assertEquals(conn.status, "connected");
    assertEquals([...conn.scopes].sort(), ["read", "write"]);
    assertExists(conn.expires_at);
    assertEquals(await readSecret(conn.access_secret_id), "acc-1");
    assertEquals(await readSecret(conn.refresh_secret_id), "ref-1");

    const remaining = await sql`select 1 from public.oauth_transactions where id = ${txn.id}`;
    assertEquals(remaining.length, 0);
  });

  it("unknown state: rejected, nothing written", async () => {
    const user = await freshUser();
    const res = await handler(callbackGet("x", "does-not-exist"));
    assertEquals(res.status, 302);
    assert((res.headers.get("Location") ?? "").includes("status=error"));

    const sql = db();
    const conns = await sql`select 1 from public.connections where user_id = ${user.id}`;
    assertEquals(conns.length, 0);
  });

  it("expired state: rejected and the stale txn is dropped", async () => {
    const user = await freshUser();
    const txn = await makeOAuthTransaction(user.id, {
      service: "linear",
      state: "expired-state-001",
      expires_at: new Date(Date.now() - 1000),
    });
    const res = await handler(callbackGet("x", "expired-state-001"));
    assertEquals(res.status, 302);
    assert((res.headers.get("Location") ?? "").includes("status=error"));

    const sql = db();
    assertEquals((await sql`select 1 from public.oauth_transactions where id = ${txn.id}`).length, 0);
    assertEquals((await sql`select 1 from public.connections where user_id = ${user.id}`).length, 0);
  });
});
