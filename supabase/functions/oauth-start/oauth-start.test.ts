// Connect flow, part 1 (testing-strategy.md §5.2): oauth-start writes an oauth_transactions row
// (state + PKCE code_verifier) and returns the provider authorize URL. Real Postgres; no provider
// HTTP (oauth-start only builds a URL string).

import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import { handler } from "./handler.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import { makeConnection } from "../../../test/fixtures/factories.ts";
import { userPost } from "../../../test/fixtures/edge.ts";

let user: TestUser;
const created: string[] = [];

async function freshUser(): Promise<TestUser> {
  const u = await createUser();
  created.push(u.id);
  return u;
}

beforeAll(async () => {
  user = await createUser();
});

afterAll(async () => {
  await deleteUser(user.id);
  for (const id of created) await deleteUser(id).catch(() => {});
  await closeDb();
  await closeBrokerDb();
});

describe("oauth-start (connect, AOD-9 §7.1)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("writes an oauth_transactions row and returns the authorize URL", async () => {
    const res = await handler(await userPost("oauth-start", user, { service: "linear" }));
    assertEquals(res.status, 200);

    const { authorizeUrl } = await res.json();
    assertExists(authorizeUrl);
    const url = new URL(authorizeUrl);
    assertEquals(url.origin + url.pathname, "https://linear.app/oauth/authorize");
    const state = url.searchParams.get("state");
    assertExists(state);
    assertExists(url.searchParams.get("code_challenge"));
    assertEquals(url.searchParams.get("code_challenge_method"), "S256");
    assertEquals(url.searchParams.get("response_type"), "code");

    const sql = db();
    const rows = await sql`
      select state, code_verifier from public.oauth_transactions where user_id = ${user.id} and service = 'linear'
    `;
    assertEquals(rows.length, 1);
    assertEquals(rows[0].state, state);
    assertExists(rows[0].code_verifier);
  });

  it("rejects an unauthenticated request (401)", async () => {
    const req = new Request("http://localhost/oauth-start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "linear" }),
    });
    assertEquals((await handler(req)).status, 401);
  });

  it("rejects an unknown service (400)", async () => {
    assertEquals((await handler(await userPost("oauth-start", user, { service: "nope" }))).status, 400);
  });

  it("connect-service count (AOD-12 §7.1): a Free user's 3rd backend service is refused 403, no transaction written", async () => {
    const u = await freshUser(); // no entitlements row -> Free, maxConnectedServices = 2
    await makeConnection(u.id, { service: "anthropic_usage", auth_class: "admin_key" });
    await makeConnection(u.id, { service: "weather", auth_class: "platform_key" });

    const res = await handler(await userPost("oauth-start", u, { service: "linear" })); // a new 3rd service
    assertEquals(res.status, 403);
    assertEquals((await res.json()).error, "over_limit");

    const sql = db();
    const rows = await sql`select 1 from public.oauth_transactions where user_id = ${u.id} and service = 'linear'`;
    assertEquals(rows.length, 0); // no OAuth start
  });

  it("connect-service count: reconnecting an already-connected service at the limit is allowed", async () => {
    const u = await freshUser();
    await makeConnection(u.id, { service: "linear", auth_class: "oauth2" });
    await makeConnection(u.id, { service: "anthropic_usage", auth_class: "admin_key" });

    // linear is already connected, so it is excluded from the count: reconnect is not blocked.
    const res = await handler(await userPost("oauth-start", u, { service: "linear" }));
    assertEquals(res.status, 200);
  });
});
