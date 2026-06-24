// revenuecat-webhook (AOD-12 §6.2, §6.3): the server-authoritative entitlement ingest. RevenueCat
// POSTs every subscription lifecycle event here. The function authenticates the call with a shared
// Authorization secret (constant-time), validates the body, dedups on event.id, guards against
// out-of-order replays on event_timestamp_ms, maps the event type to one entitlements upsert scoped
// to the event's app_user_id (= the Supabase auth.uid(), AOD-12 §5.3) via the privileged service
// connection, and responds fast (well under RevenueCat's 60s budget). It is NOT a Supabase-JWT
// caller, so it runs with verify_jwt = false (config.toml) and the secret compare is the only auth.

import { timingSafeEqual } from "../_shared/crypto.ts";
import { db } from "../_shared/db.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorResponse, HttpError, json, methodGuard, parseBody, readJson } from "../_shared/http.ts";
import { mapEventToEntitlement, RevenueCatWebhookSchema } from "../_shared/revenuecat.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");

    // 1. Authenticate (AOD-12 §6.2 step 1). RevenueCat sends the developer-configured Authorization
    // header on every webhook; compare it constant-time against the Edge secret. A mismatch (or a
    // missing header) is rejected 401 and nothing is written. A missing server secret is a 500
    // misconfiguration, so we fail closed before reading the body.
    const expected = requireEnv("REVENUECAT_WEBHOOK_AUTH");
    const provided = req.headers.get("Authorization") ?? "";
    if (!timingSafeEqual(provided, expected)) {
      throw new HttpError(401, "unauthorized", "invalid webhook authorization");
    }

    // 2. Validate the body (the shared Zod schema, AOD-25 / testing-strategy §4.2).
    const { event } = parseBody(RevenueCatWebhookSchema, await readJson(req));

    // 3. Map the event type to the entitlements write (AOD-12 §6.3). An unmodeled type (TEST,
    // TRANSFER, PAYWALL_*, ...) maps to null: ack 200 and write nothing.
    const write = mapEventToEntitlement(event);
    if (!write) return json({ ok: true, ignored: true });

    // 4. Apply in one atomic statement that folds in dedup + order-guard (AOD-12 §6.2 steps 2-4).
    // The DO UPDATE fires only when the event is genuinely newer: a different event id AND a strictly
    // greater event_timestamp_ms (or no prior ms). A duplicate id or a stale/equal timestamp leaves
    // the row untouched and RETURNING yields no row, so the handler acks 200 without a change. The
    // upsert runs on the privileged pooled connection (service role bypasses RLS; §8.3 grants).
    const sql = db();
    const applied = await sql<{ user_id: string }[]>`
      insert into public.entitlements
        (user_id, tier, active_product_id, current_period_end, status, last_event_id, last_event_ms, updated_at)
      values
        (${event.app_user_id}, ${write.tier}, ${write.active_product_id},
         ${write.current_period_end}, ${write.status}, ${event.id}, ${event.event_timestamp_ms}, now())
      on conflict (user_id) do update set
        tier = excluded.tier,
        active_product_id = excluded.active_product_id,
        current_period_end = excluded.current_period_end,
        status = excluded.status,
        last_event_id = excluded.last_event_id,
        last_event_ms = excluded.last_event_ms,
        updated_at = now()
      where entitlements.last_event_id is distinct from excluded.last_event_id
        and (entitlements.last_event_ms is null or excluded.last_event_ms > entitlements.last_event_ms)
      returning user_id
    `;

    // 5. Respond fast. Idempotent/stale events ack 200 unchanged (applied = false).
    return json({ ok: true, applied: applied.length > 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
