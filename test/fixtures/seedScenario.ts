// The canonical fixture world (testing-strategy.md §7). seedScenario assembles the default
// world most policy tests share: userA and userB (cross-user isolation), userFresh (missing-row
// defaults), each with the rows the §5.1 catalogue exercises. Returns ids + per-user clients +
// a cleanup that hard-deletes the users (cascade wipes their rows).

import { createUser, deleteUser, type TestUser } from "./clients.ts";
import {
  makeConnection,
  makeDashboard,
  makeEntitlement,
  makeKioskConfig,
  makeOAuthTransaction,
  makeProxyCacheRow,
  makeWidgetInstance,
} from "./factories.ts";

export interface SeededUser extends TestUser {
  /** A dashboard owned by this user. */
  dashboardId: string;
  /** A widget instance on that dashboard. */
  widgetInstanceId: string;
}

export interface Scenario {
  userA: SeededUser;
  userB: SeededUser;
  /** A user with no application rows: resolves Free + all default settings. */
  userFresh: TestUser;
  cleanup: () => Promise<void>;
}

async function seedUser(): Promise<SeededUser> {
  const user = await createUser();
  const dashboard = await makeDashboard(user.id, { name: "Wall" });
  const instance = await makeWidgetInstance(dashboard.id, user.id, { size: "medium" });
  return { ...user, dashboardId: dashboard.id, widgetInstanceId: instance.id };
}

export async function seedScenario(): Promise<Scenario> {
  const userA = await seedUser();
  const userB = await seedUser();
  const userFresh = await createUser();

  // userA: a fuller world the read/no-access tests assert against.
  await makeConnection(userA.id, { service: "linear", auth_class: "oauth2" });
  await makeEntitlement(userA.id, { tier: "pro", status: "active" });
  await makeKioskConfig(userA.dashboardId, userA.id);
  await makeOAuthTransaction(userA.id); // service-role only; client must never read it
  await makeProxyCacheRow(userA.id); // proxy-only; client must never read it

  // userB: just a connection, to prove cross-user reads return empty.
  await makeConnection(userB.id, { service: "linear", auth_class: "oauth2" });

  return {
    userA,
    userB,
    userFresh,
    cleanup: async () => {
      await deleteUser(userA.id);
      await deleteUser(userB.id);
      await deleteUser(userFresh.id);
    },
  };
}
