// The connect-service count gate (AOD-12 §7.1), the server half of the maxConnectedServices lever.
// Plugs into the AOD-9 connect functions (oauth-start, credentials-store) without touching their
// token mechanics: it reads the user's active connections and authoritative entitlements and throws
// 403 over_limit if connecting targetService would exceed the tier. A Free user is bounded to 2
// backend services; Clock (auth_class "none") never counts; reconnecting an already-connected
// service is always allowed (targetService is excluded from the count). Pro is unbounded (Infinity).

import { type ConnectionLike, mayConnectAnother, serverEntitlements } from "./entitlements.ts";
import { HttpError } from "./http.ts";
import { serviceClient } from "./supabase.ts";

/**
 * Throw 403 over_limit unless the user may connect (or reconnect) targetService under their tier.
 * Called before any connection row, OAuth transaction, or Vault secret is written, so a refusal
 * leaves no trace (AOD-12 §7.1 acceptance).
 */
export async function assertMayConnect(userId: string, targetService: string): Promise<void> {
  const svc = serviceClient();
  const { data: connections } = await svc.from("connections")
    .select("service, auth_class, status").eq("user_id", userId);
  const { data: entRow } = await svc.from("entitlements")
    .select("tier, status, current_period_end").eq("user_id", userId).maybeSingle();

  const ent = serverEntitlements(entRow, new Date());
  if (!mayConnectAnother((connections ?? []) as ConnectionLike[], ent, targetService)) {
    throw new HttpError(403, "over_limit", `Free is limited to ${ent.maxConnectedServices} connected services`);
  }
}
