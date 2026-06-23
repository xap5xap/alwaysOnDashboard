// Schema constraint tests (testing-strategy.md §5.1): the CHECKs and the unique, asserted with
// direct SQL on the superuser connection (the assertion is about the table itself, not a policy).

import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals, assertRejects } from "@std/assert";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { makeDashboard } from "../../../test/fixtures/factories.ts";

let sql: ReturnType<typeof db>;
let user: TestUser;
let dashboardId: string;

beforeAll(async () => {
  sql = db();
  user = await createUser();
  const dashboard = await makeDashboard(user.id);
  dashboardId = dashboard.id;
});

afterAll(async () => {
  await deleteUser(user.id);
  await closeDb();
});

describe("schema constraints (§5.1)", { sanitizeResources: false, sanitizeOps: false }, () => {
  describe("CHECK: proxy_cache 900s ceiling", () => {
    const insertCache = (fetchedAt: Date, expiresAt: Date) =>
      sql`
        insert into public.proxy_cache (user_id, service, widget_type, params_hash, payload, fetched_at, expires_at)
        values (${user.id}, 'linear', 'my_issues', ${crypto.randomUUID()}, ${sql.json({})}, ${fetchedAt}, ${expiresAt})
      `;

    it("accepts expires_at within the 900s window", async () => {
      const now = new Date();
      await insertCache(now, new Date(now.getTime() + 300_000));
    });

    it("rejects expires_at more than 900s after fetched_at", async () => {
      const now = new Date();
      await assertRejects(() => insertCache(now, new Date(now.getTime() + 901_000)));
    });

    it("rejects expires_at <= fetched_at", async () => {
      const now = new Date();
      await assertRejects(() => insertCache(now, now));
    });
  });

  describe("CHECK: kiosk_configs night_interval_multiplier >= 1", () => {
    const insertKiosk = (multiplier: number) =>
      sql`
        insert into public.kiosk_configs (dashboard_id, user_id, night_interval_multiplier, schedule, curve, profile)
        values (${dashboardId}, ${user.id}, ${multiplier},
          ${sql.json({ mode: "fixed", dayStartMin: 420, nightStartMin: 1260, transitionMinutes: 30 })},
          ${sql.json({ dayDim: 0, nightDim: 0.7 })},
          ${sql.json({ theme: "dark", typeScale: 1.2, minContrast: "AA", hideChrome: true })})
      `;

    it("rejects a multiplier below 1 (kiosk only stretches, never speeds up)", async () => {
      await assertRejects(() => insertKiosk(0.5));
    });
  });

  describe("CHECK: text enums", () => {
    it("rejects an out-of-set connections.auth_class", async () => {
      await assertRejects(() =>
        sql`insert into public.connections (user_id, service, auth_class, status)
            values (${user.id}, 'x', 'bogus', 'connected')`
      );
    });

    it("rejects an out-of-set connections.status", async () => {
      await assertRejects(() =>
        sql`insert into public.connections (user_id, service, auth_class, status)
            values (${user.id}, 'x', 'oauth2', 'bogus')`
      );
    });

    it("rejects an out-of-set entitlements.tier", async () => {
      await assertRejects(() =>
        sql`insert into public.entitlements (user_id, tier, status)
            values (${user.id}, 'platinum', 'active')`
      );
    });

    it("rejects an out-of-set widget_instances.size", async () => {
      await assertRejects(() =>
        sql`insert into public.widget_instances (dashboard_id, user_id, service_id, widget_type, size, rect)
            values (${dashboardId}, ${user.id}, 'linear', 'my_issues', 'huge', ${sql.json({ x: 0, y: 0, w: 1, h: 1, z: 0 })})`
      );
    });
  });

  describe("UNIQUE: connections (user_id, service)", () => {
    it("rejects a duplicate and supports upsert (one row per user per service)", async () => {
      await sql`insert into public.connections (user_id, service, auth_class, status)
                values (${user.id}, 'github', 'oauth2', 'connected')`;

      // A plain duplicate violates the unique constraint.
      await assertRejects(() =>
        sql`insert into public.connections (user_id, service, auth_class, status)
            values (${user.id}, 'github', 'oauth2', 'connected')`
      );

      // The same connect via ON CONFLICT upserts rather than duplicating.
      await sql`insert into public.connections (user_id, service, auth_class, status)
                values (${user.id}, 'github', 'api_key', 'reauth_required')
                on conflict (user_id, service) do update set status = excluded.status, auth_class = excluded.auth_class`;

      const rows = await sql`select count(*)::int as n from public.connections
                             where user_id = ${user.id} and service = 'github'`;
      assertEquals(rows[0].n, 1);
    });
  });
});
