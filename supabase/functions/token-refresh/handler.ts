// token-refresh (AOD-9 §6, §8.2): invoked by pg_cron (the call's bearer is the service token from
// Vault). Selects oauth2 connections within the grace window of expiry and refreshes each under the
// per-connection FOR UPDATE lock (refresh.ts). Also the in-process refresh logic the proxy reuses
// inline (§8.3) via refreshConnection directly.

import { authorizeServiceCall } from "../_shared/auth.ts";
import { errorResponse, HttpError, json, methodGuard } from "../_shared/http.ts";
import { refreshConnection } from "../_shared/refresh.ts";
import { serviceClient } from "../_shared/supabase.ts";

const GRACE_SECONDS = 300; // refresh tokens expiring within 5 min (tuned per AOD-9 §11)

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");
    authorizeServiceCall(req);

    const dueBefore = new Date(Date.now() + GRACE_SECONDS * 1000).toISOString();
    const { data: due, error } = await serviceClient().from("connections")
      .select("id")
      .eq("auth_class", "oauth2")
      .eq("status", "connected")
      .not("expires_at", "is", null)
      .lt("expires_at", dueBefore);
    if (error) throw new HttpError(500, "db_error", error.message);

    let refreshed = 0, reauth_required = 0, skipped = 0, errored = 0;
    for (const row of due ?? []) {
      // Per-connection isolation: a transient provider failure on one connection must not abort the
      // whole batch (invalid_grant is handled inside refreshConnection as reauth_required, not a throw).
      try {
        const outcome = await refreshConnection(row.id, { graceSeconds: GRACE_SECONDS });
        if (outcome === "refreshed") refreshed++;
        else if (outcome === "reauth_required") reauth_required++;
        else skipped++;
      } catch (err) {
        errored++;
        console.error(`token-refresh: connection ${row.id} failed:`, err instanceof Error ? err.message : err);
      }
    }
    return json({ refreshed, reauth_required, skipped, errored });
  } catch (e) {
    return errorResponse(e);
  }
}
