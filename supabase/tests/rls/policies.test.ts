// RLS policy tests (testing-strategy.md §5.1, one test per AOD-22 §8 catalogue row).
// These run through per-user supabase-js clients carrying real JWTs, i.e. the `authenticated`
// role through PostgREST under RLS, exactly as the app issues queries. seedScenario builds the
// canonical userA / userB / userFresh world; cross-user isolation is asserted by user B reading
// zero of user A's rows.

import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { closeDb } from "../../../test/fixtures/db.ts";
import { type Scenario, seedScenario } from "../../../test/fixtures/seedScenario.ts";

let s: Scenario;

beforeAll(async () => {
  s = await seedScenario();
});

afterAll(async () => {
  await s.cleanup();
  await closeDb();
});

/** Assert a supabase-js operation was denied (returned an error). */
function denied(error: unknown, msg: string) {
  assert(error !== null && error !== undefined, `expected denial: ${msg}`);
}

/** Assert no rows came back (RLS-empty or permission-denied both collapse to this). */
function noRows(data: unknown[] | null, msg: string) {
  assertEquals((data ?? []).length, 0, msg);
}

describe("RLS policies (§8)", { sanitizeResources: false, sanitizeOps: false }, () => {
  // --- Server-written, owner-readable -------------------------------------------------------

  describe("connections", () => {
    it("owner reads its own rows", async () => {
      const { data, error } = await s.userA.client.from("connections").select("id, user_id");
      assertEquals(error, null);
      assert((data ?? []).length >= 1, "userA should see its connection");
      for (const row of data ?? []) assertEquals(row.user_id, s.userA.id);
    });

    it("client cannot insert / update / delete (server-written)", async () => {
      const ins = await s.userA.client
        .from("connections")
        .insert({ user_id: s.userA.id, service: "github", auth_class: "oauth2", status: "connected" });
      denied(ins.error, "insert into connections");

      const upd = await s.userA.client
        .from("connections")
        .update({ account_label: "x" })
        .eq("user_id", s.userA.id);
      denied(upd.error, "update connections");

      const del = await s.userA.client.from("connections").delete().eq("user_id", s.userA.id);
      denied(del.error, "delete connections");
    });

    it("user B sees none of user A's connections", async () => {
      const { data } = await s.userB.client
        .from("connections")
        .select("id, user_id")
        .eq("user_id", s.userA.id);
      noRows(data, "userB must not read userA connections");
    });
  });

  describe("entitlements", () => {
    it("owner reads its own row", async () => {
      const { data, error } = await s.userA.client.from("entitlements").select("user_id, tier");
      assertEquals(error, null);
      assertEquals((data ?? []).length, 1);
      assertEquals(data?.[0].user_id, s.userA.id);
    });

    it("client cannot write (webhook-written)", async () => {
      const ins = await s.userA.client
        .from("entitlements")
        .insert({ user_id: s.userA.id, tier: "pro", status: "active" });
      denied(ins.error, "insert into entitlements");

      const upd = await s.userA.client.from("entitlements").update({ tier: "free" }).eq("user_id", s.userA.id);
      denied(upd.error, "update entitlements");
    });

    it("cross-user read is empty", async () => {
      const { data } = await s.userB.client.from("entitlements").select("user_id").eq("user_id", s.userA.id);
      noRows(data, "userB must not read userA entitlement");
    });
  });

  // --- Server-written, NO client access -----------------------------------------------------

  describe("oauth_transactions", () => {
    it("no client access at all (holds the live PKCE code_verifier)", async () => {
      const sel = await s.userA.client.from("oauth_transactions").select("id");
      noRows(sel.data, "client must not read oauth_transactions");

      const ins = await s.userA.client
        .from("oauth_transactions")
        .insert({ user_id: s.userA.id, service: "linear", state: "x", expires_at: new Date().toISOString() });
      denied(ins.error, "insert into oauth_transactions");
    });
  });

  describe("proxy_cache", () => {
    it("no client access (proxy-only, service role)", async () => {
      const sel = await s.userA.client.from("proxy_cache").select("user_id");
      noRows(sel.data, "client must not read proxy_cache");

      const ins = await s.userA.client.from("proxy_cache").insert({
        user_id: s.userA.id,
        service: "linear",
        widget_type: "my_issues",
        params_hash: "h",
        payload: {},
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      });
      denied(ins.error, "insert into proxy_cache");
    });
  });

  // --- Client-authored, owner CRUD ----------------------------------------------------------

  describe("dashboards", () => {
    it("owner can CRUD own rows", async () => {
      const ins = await s.userA.client
        .from("dashboards")
        .insert({ user_id: s.userA.id, name: "Desk" })
        .select();
      assertEquals(ins.error, null);
      assertEquals(ins.data?.length, 1);
      const id = ins.data![0].id;

      const upd = await s.userA.client.from("dashboards").update({ name: "Desk 2" }).eq("id", id).select();
      assertEquals(upd.error, null);
      assertEquals(upd.data?.[0].name, "Desk 2");

      const del = await s.userA.client.from("dashboards").delete().eq("id", id).select();
      assertEquals(del.error, null);
      assertEquals(del.data?.length, 1);
    });

    it("user B cannot read, update, or delete user A's dashboard", async () => {
      const sel = await s.userB.client.from("dashboards").select("id").eq("id", s.userA.dashboardId);
      noRows(sel.data, "userB must not read userA dashboard");

      const upd = await s.userB.client
        .from("dashboards")
        .update({ name: "hacked" })
        .eq("id", s.userA.dashboardId)
        .select();
      noRows(upd.data, "userB update must affect 0 of userA's rows");

      const del = await s.userB.client.from("dashboards").delete().eq("id", s.userA.dashboardId).select();
      noRows(del.data, "userB delete must affect 0 of userA's rows");
    });
  });

  describe("widget_instances", () => {
    it("owner can insert on its own dashboard", async () => {
      const ins = await s.userA.client
        .from("widget_instances")
        .insert({
          dashboard_id: s.userA.dashboardId,
          user_id: s.userA.id,
          service_id: "linear",
          widget_type: "my_issues",
          size: "small",
          config: {},
          rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
        })
        .select();
      assertEquals(ins.error, null);
      assertEquals(ins.data?.length, 1);
    });

    it("dashboard-ownership WITH CHECK rejects attaching to another user's dashboard", async () => {
      // userA is the caller; user_id is set to the caller (passes user_id = auth.uid()), but the
      // dashboard belongs to userB, so the dashboard-ownership half of the WITH CHECK rejects it.
      const ins = await s.userA.client.from("widget_instances").insert({
        dashboard_id: s.userB.dashboardId,
        user_id: s.userA.id,
        service_id: "linear",
        widget_type: "my_issues",
        size: "small",
        config: {},
        rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
      });
      denied(ins.error, "insert widget_instance onto userB's dashboard");
    });
  });

  describe("kiosk_configs", () => {
    it("owner can insert for its own dashboard", async () => {
      // Fresh dashboard (the scenario dashboard already has a kiosk config; PK is dashboard_id).
      const dash = await s.userA.client.from("dashboards").insert({ user_id: s.userA.id, name: "Kiosk" }).select();
      const dashboardId = dash.data![0].id;
      const ins = await s.userA.client
        .from("kiosk_configs")
        .insert({
          dashboard_id: dashboardId,
          user_id: s.userA.id,
          schedule: { mode: "fixed", dayStartMin: 420, nightStartMin: 1260, transitionMinutes: 30 },
          curve: { dayDim: 0, nightDim: 0.7 },
          profile: { theme: "dark", typeScale: 1.2, minContrast: "AA", hideChrome: true },
        })
        .select();
      assertEquals(ins.error, null);
      assertEquals(ins.data?.length, 1);
    });

    it("dashboard-ownership WITH CHECK rejects another user's dashboard", async () => {
      const ins = await s.userA.client.from("kiosk_configs").insert({
        dashboard_id: s.userB.dashboardId,
        user_id: s.userA.id,
        schedule: { mode: "fixed", dayStartMin: 420, nightStartMin: 1260, transitionMinutes: 30 },
        curve: { dayDim: 0, nightDim: 0.7 },
        profile: { theme: "dark", typeScale: 1.2, minContrast: "AA", hideChrome: true },
      });
      denied(ins.error, "insert kiosk_config onto userB's dashboard");
    });
  });

  describe("user_settings", () => {
    it("owner can CRUD own row", async () => {
      const ins = await s.userFresh.client
        .from("user_settings")
        .insert({ user_id: s.userFresh.id, theme: "dark" })
        .select();
      assertEquals(ins.error, null);
      assertEquals(ins.data?.[0].theme, "dark");

      const upd = await s.userFresh.client
        .from("user_settings")
        .update({ theme: "default" })
        .eq("user_id", s.userFresh.id)
        .select();
      assertEquals(upd.error, null);
      assertEquals(upd.data?.[0].theme, "default");
    });

    it("cannot read another user's settings", async () => {
      await s.userA.client.from("user_settings").insert({ user_id: s.userA.id, theme: "aqua" });
      const { data } = await s.userB.client.from("user_settings").select("user_id").eq("user_id", s.userA.id);
      noRows(data, "userB must not read userA settings");
    });
  });
});
