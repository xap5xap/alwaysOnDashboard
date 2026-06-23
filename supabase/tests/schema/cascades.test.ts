// Cascade tests (testing-strategy.md §5.1): the two ON DELETE CASCADE behaviors (data-model §11).
// Direct SQL on the superuser connection; the auth user is removed via the Auth admin API (the
// real account-deletion final step) so the FK cascade fires exactly as it would in production.

import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import {
  makeConnection,
  makeDashboard,
  makeEntitlement,
  makeKioskConfig,
  makeOAuthTransaction,
  makeProxyCacheRow,
  makeWidgetInstance,
} from "../../../test/fixtures/factories.ts";

const APPLICATION_TABLES = [
  "connections",
  "oauth_transactions",
  "entitlements",
  "dashboards",
  "widget_instances",
  "kiosk_configs",
  "user_settings",
  "proxy_cache",
];

let sql: ReturnType<typeof db>;
let userAccount: TestUser; // deleted inside the account-deletion test
let userDash: TestUser; // kept; used by the dashboard-deletion test

beforeAll(async () => {
  sql = db();
  userAccount = await createUser();
  userDash = await createUser();
});

afterAll(async () => {
  for (const id of [userAccount.id, userDash.id]) {
    try {
      await deleteUser(id);
    } catch {
      // userAccount is already gone if its test ran; ignore.
    }
  }
  await closeDb();
});

describe("cascades (§5.1)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("account deletion wipes every application table", async () => {
    // Seed one row in each of the eight tables for this user.
    const dash = await makeDashboard(userAccount.id);
    await makeConnection(userAccount.id);
    await makeOAuthTransaction(userAccount.id);
    await makeEntitlement(userAccount.id);
    await makeWidgetInstance(dash.id, userAccount.id);
    await makeKioskConfig(dash.id, userAccount.id);
    await makeProxyCacheRow(userAccount.id);
    await sql`insert into public.user_settings (user_id, theme) values (${userAccount.id}, 'dark')`;

    // Sanity: rows exist before deletion.
    for (const table of APPLICATION_TABLES) {
      const before = await sql.unsafe(
        `select count(*)::int as n from public.${table} where user_id = $1`,
        [userAccount.id],
      );
      assertEquals(before[0].n, 1, `${table} should have 1 row before deletion`);
    }

    // Hard-delete the auth user (cascades via every table's user_id FK).
    await deleteUser(userAccount.id);

    for (const table of APPLICATION_TABLES) {
      const after = await sql.unsafe(
        `select count(*)::int as n from public.${table} where user_id = $1`,
        [userAccount.id],
      );
      assertEquals(after[0].n, 0, `${table} should be empty after account deletion`);
    }
  });

  it("dashboard deletion wipes its children but not the user's other data", async () => {
    const dash = await makeDashboard(userDash.id);
    await makeWidgetInstance(dash.id, userDash.id);
    await makeKioskConfig(dash.id, userDash.id);
    // A connection is owned by the user, not the dashboard; it must survive a dashboard delete.
    await makeConnection(userDash.id, { service: "weather", auth_class: "platform_key" });

    await sql`delete from public.dashboards where id = ${dash.id}`;

    const widgets = await sql`select count(*)::int as n from public.widget_instances where dashboard_id = ${dash.id}`;
    assertEquals(widgets[0].n, 0, "widget_instances should cascade with the dashboard");

    const kiosk = await sql`select count(*)::int as n from public.kiosk_configs where dashboard_id = ${dash.id}`;
    assertEquals(kiosk[0].n, 0, "kiosk_configs should cascade with the dashboard");

    const connections = await sql`select count(*)::int as n from public.connections where user_id = ${userDash.id}`;
    assertEquals(connections[0].n, 1, "the user's connection must survive a dashboard delete");
  });
});
