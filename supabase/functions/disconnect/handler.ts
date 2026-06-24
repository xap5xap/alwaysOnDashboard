// disconnect (AOD-9 §6, §10; AOD-5 hard delete; data-model.md §11): stop using the credential,
// best-effort revoke at the provider, then purge. Order: revoke -> delete Vault secrets -> delete
// the connection row -> delete that service's proxy_cache -> eager-delete its widget_instances. A
// provider revoke failure never blocks the local purge.

import { deriveUser } from "../_shared/auth.ts";
import { errorResponse, HttpError, json, methodGuard, parseBody, readJson } from "../_shared/http.ts";
import { revokeToken } from "../_shared/providers.ts";
import { getBackend } from "../_shared/registry.ts";
import { DisconnectSchema } from "../_shared/schemas.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { deleteSecret, readSecret } from "../_shared/vault.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");
    const user = await deriveUser(req);
    const { connectionId } = parseBody(DisconnectSchema, await readJson(req));
    const svc = serviceClient();

    const { data: conn } = await svc.from("connections").select("*").eq("id", connectionId).maybeSingle();
    if (!conn) return json({ ok: true }); // idempotent: already gone
    if (conn.user_id !== user.id) throw new HttpError(403, "forbidden", "connection does not belong to caller");

    const backend = getBackend(conn.service);

    // 1. Best-effort provider revoke.
    if (backend.authClass === "oauth2" && backend.oauth?.revokeUrl && conn.access_secret_id) {
      try {
        const token = await readSecret(conn.access_secret_id);
        if (token) await revokeToken(backend, token);
      } catch {
        // best effort: a provider that is down or lacks a revoke endpoint does not block the purge
      }
    }

    // 2. Delete the Vault secrets (privacy-critical; not swallowed).
    if (conn.access_secret_id) await deleteSecret(conn.access_secret_id);
    if (conn.refresh_secret_id) await deleteSecret(conn.refresh_secret_id);

    // 3-5. Hard-delete the row, the service's cache, and its widget instances (the seam: service_id).
    await svc.from("connections").delete().eq("id", conn.id);
    await svc.from("proxy_cache").delete().eq("user_id", user.id).eq("service", conn.service);
    await svc.from("widget_instances").delete().eq("user_id", user.id).eq("service_id", conn.service);

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
