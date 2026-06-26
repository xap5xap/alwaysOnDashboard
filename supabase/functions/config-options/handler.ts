// config-options (AOD-10 §4.3): the config-time option-source resolution path. Parallel to the
// widget proxy (proxy/handler.ts): the client names a service + an allow-listed option-source id,
// never a URL or token. Gate the connection (409 if reauth_required/disconnected), serve a fresh
// cache hit, else invoke the allow-listed server-side resolver (a static source returns fixed
// choices; a provider-backed source calls the allow-listed endpoint with the user's secret attached
// and maps the response), cache the Choice[] on the short proxy_cache TTL keyed by user/service/
// option-source, and return. 409 needs_reconnect + typed provider errors mirror the widget proxy.

import { deriveUser } from "../_shared/auth.ts";
import { isConnectionUsable, loadConnection, makeProviderCaller } from "../_shared/connection.ts";
import { paramsHash } from "../_shared/crypto.ts";
import { errorResponse, HttpError, json, methodGuard, needsReconnect, parseBody, readJson } from "../_shared/http.ts";
import { type Choice, getOptionSource } from "../_shared/option-sources.ts";
import { getBackend } from "../_shared/registry.ts";
import { OptionSourceSchema } from "../_shared/schemas.ts";
import { serviceClient } from "../_shared/supabase.ts";

// Config-time reads are interactive (a user is in the config form), not a polling loop, so there is
// no AOD-12 per-user fetch-floor here. The TTL stays within the AOD-5 900s proxy_cache ceiling.
const OPTIONS_TTL_SECONDS = 300;
// proxy_cache widget_type namespace so an option set never collides with a real widget's cache row.
const CACHE_PREFIX = "@opt:";

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");
    const user = await deriveUser(req);
    const body = parseBody(OptionSourceSchema, await readJson(req));

    const backend = getBackend(body.service);
    const resolver = getOptionSource(body.service, body.optionSource);
    const svc = serviceClient();

    // Same authenticated, RLS-scoped connection gate as a widget read (AOD-10 §4.3 step 2).
    const conn = await loadConnection(svc, user.id, body.service);
    if (!isConnectionUsable(conn)) return needsReconnect();

    const params = body.params ?? {};
    const cacheKey = CACHE_PREFIX + body.optionSource;
    const hash = await paramsHash(params);

    // Fresh cache hit: serve the option set without re-resolving (AOD-10 §4.3 step 3 / §6.1).
    const { data: cached } = await svc.from("proxy_cache")
      .select("payload, expires_at")
      .eq("user_id", user.id).eq("service", body.service).eq("widget_type", cacheKey).eq("params_hash", hash)
      .maybeSingle();
    if (cached && new Date(cached.expires_at) > new Date()) {
      return json({ choices: cached.payload as Choice[], cached: true });
    }

    // Resolve: a static source returns fixed choices (no provider, no secret); a provider-backed
    // source calls the allow-listed endpoint with the user's secret attached via the lazy caller.
    const choices = await resolver({ params, callProvider: makeProviderCaller(conn, backend) });

    const writtenAt = new Date();
    const expiresAt = new Date(writtenAt.getTime() + OPTIONS_TTL_SECONDS * 1000);
    const { error: cacheErr } = await svc.from("proxy_cache").upsert({
      user_id: user.id,
      service: body.service,
      widget_type: cacheKey,
      params_hash: hash,
      payload: choices,
      fetched_at: writtenAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: "user_id,service,widget_type,params_hash" });
    if (cacheErr) throw new HttpError(500, "cache_write_failed", cacheErr.message);

    return json({ choices, cached: false });
  } catch (e) {
    return errorResponse(e);
  }
}
