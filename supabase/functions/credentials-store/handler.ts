// credentials-store (AOD-9 §6, §7.2): the non-OAuth connect path. For api_key / admin_key it stores
// the user-supplied key in Vault; for platform_key (Weather) it stores only the user's location as
// the connection config and writes NO Vault secret (the provider key is a platform secret in env).

import { deriveUser } from "../_shared/auth.ts";
import { errorResponse, HttpError, json, methodGuard, parseBody, readJson } from "../_shared/http.ts";
import { getBackend } from "../_shared/registry.ts";
import { CredentialsStoreSchema } from "../_shared/schemas.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { createSecret, deleteSecret } from "../_shared/vault.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");
    const user = await deriveUser(req);
    const body = parseBody(CredentialsStoreSchema, await readJson(req));
    const backend = getBackend(body.service);
    const svc = serviceClient();

    if (backend.authClass === "platform_key") {
      if (!body.location) throw new HttpError(400, "missing_location", "platform_key requires a location");
      const { error } = await svc.from("connections").upsert({
        user_id: user.id,
        service: body.service,
        auth_class: "platform_key",
        status: "connected",
        access_secret_id: null,
        refresh_secret_id: null,
        config: body.location,
        account_label: body.accountLabel ?? null,
      }, { onConflict: "user_id,service" });
      if (error) throw new HttpError(500, "db_error", error.message);
      return json({ ok: true });
    }

    if (backend.authClass === "api_key" || backend.authClass === "admin_key") {
      if (!body.apiKey) throw new HttpError(400, "missing_api_key", `${body.service} requires an api key`);
      // (An optional single provider validation call is wired per-integration; omitted here.)
      const { data: existing } = await svc.from("connections")
        .select("access_secret_id").eq("user_id", user.id).eq("service", body.service).maybeSingle();

      const accessId = await createSecret(body.apiKey, `${body.service} key for ${user.id}`);
      const { error } = await svc.from("connections").upsert({
        user_id: user.id,
        service: body.service,
        auth_class: backend.authClass,
        status: "connected",
        access_secret_id: accessId,
        refresh_secret_id: null,
        account_label: body.accountLabel ?? null,
      }, { onConflict: "user_id,service" });
      if (error) throw new HttpError(500, "db_error", error.message);

      if (existing?.access_secret_id && existing.access_secret_id !== accessId) {
        await deleteSecret(existing.access_secret_id).catch(() => {});
      }
      return json({ ok: true });
    }

    throw new HttpError(400, "unsupported_class", `credentials-store does not handle ${backend.authClass}`);
  } catch (e) {
    return errorResponse(e);
  }
}
