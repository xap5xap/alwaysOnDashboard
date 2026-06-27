// proxy (AOD-9 §6, §9): the widget data path. The client names a service + widget, never a URL or a
// token. Serve a fresh cache hit; otherwise load the connection (409 if reauth_required/
// disconnected), inline-refresh an expired token, read the secret (Vault, or the platform key from
// env), call the allow-listed provider endpoint, normalize, and cache within the <=900s ceiling.

import { deriveUser } from "../_shared/auth.ts";
import { isConnectionUsable, loadConnection, resolveCallSecret } from "../_shared/connection.ts";
import { paramsHash } from "../_shared/crypto.ts";
import { cacheTtlSeconds, mayUserTriggerFetch, serverEntitlements } from "../_shared/entitlements.ts";
import { errorResponse, HttpError, json, methodGuard, needsReconnect, parseBody, readJson } from "../_shared/http.ts";
import { getOperation } from "../_shared/operations.ts";
import { callProviderApi, providerErrorResponse } from "../_shared/providers.ts";
import { getBackend, getEndpoint } from "../_shared/registry.ts";
import { ProxySchema } from "../_shared/schemas.ts";
import { serviceClient } from "../_shared/supabase.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");
    const user = await deriveUser(req);
    const body = parseBody(ProxySchema, await readJson(req));

    const backend = getBackend(body.service);
    const endpoint = getEndpoint(backend, body.widget);
    const svc = serviceClient();

    const conn = await loadConnection(svc, user.id, body.service);
    if (!isConnectionUsable(conn)) return needsReconnect();

    // Cache hit within TTL: one provider call serves every device polling this widget (AOD-9 §9 step 6).
    const hash = await paramsHash(body.params ?? {});
    const { data: cached } = await svc.from("proxy_cache")
      .select("payload, expires_at, fetched_at")
      .eq("user_id", user.id).eq("service", body.service).eq("widget_type", body.widget).eq("params_hash", hash)
      .maybeSingle();
    const now = new Date();
    if (cached && new Date(cached.expires_at) > now) {
      return json({ data: cached.payload, cached: true });
    }

    // AOD-12 §6.4 per-user fetch-floor: the cache is missing or stale. Read the user's authoritative
    // entitlements and decide whether THIS user may trigger a fresh provider fetch yet. A Free user
    // (900s floor) cannot refetch faster than the floor: the stale cached value is served instead, so
    // a tampered device timer cannot force fresher provider data. The per-user cache key is unchanged
    // (data-model.md §5.8/§12); this is an orthogonal per-user fetch-trigger gate.
    const widgetTtlSeconds = cacheTtlSeconds({ defaultRefresh: { seconds: 300 } });
    if (cached) {
      // Only a stale cache can be floored; a first fetch (no row) always proceeds, so the
      // entitlements read happens only when there is a cached value to serve instead.
      const { data: entRow } = await svc.from("entitlements")
        .select("tier, status, current_period_end").eq("user_id", user.id).maybeSingle();
      const ent = serverEntitlements(entRow, now);
      const cacheAgeSeconds = (now.getTime() - new Date(cached.fetched_at).getTime()) / 1000;
      if (!mayUserTriggerFetch(cacheAgeSeconds, widgetTtlSeconds, ent)) {
        return json({ data: cached.payload, cached: true, stale: true });
      }
    }

    // Inline-refresh an expired oauth2 token (AOD-9 §8.3) and resolve the per-call secret: Vault for
    // credentialed classes; platform_key reads the key from env. Shared with the option-source path.
    const secret = await resolveCallSecret(conn, backend);

    // The single generic operation seam (integration-linear.md §6.3, refined for REST by
    // integration-calendar.md §6.3): a GraphQL service (Linear) builds its provider body server-side; a
    // REST service (Calendar) builds its time-derived URL query server-side via buildQuery; services with
    // no operation (stub, Weather pass-through) keep the pass-through query below. One lookup serves all.
    const op = getOperation(body.service, body.widget);
    const params = body.params ?? {};

    // buildQuery owns the URL query for a REST op, so timeMin/timeMax are computed at call time and never
    // enter the cache key (hashed on body.params above; integration-calendar.md §6.2). Otherwise platform_key
    // / pass-through merges the user's stored config (e.g. a location) with the params (AOD-9 §9 step 5).
    const callBody = op?.buildBody ? op.buildBody(params) : params;
    const callQuery = op?.buildQuery
      ? op.buildQuery(params)
      : { ...(conn.config as Record<string, unknown> | null ?? {}), ...params };
    // pathParams fills any {token} slot in the allow-listed registry path (Calendar's {calendarId});
    // a token-free path is unchanged, so Linear/Weather/stub/Anthropic are untouched (§6.3c).
    const result = await callProviderApi(backend, endpoint, { secret, query: callQuery, body: callBody, pathParams: params });

    // Map provider failure to the typed result the widget reacts to (AOD-9 §9, AOD-10 §6.4). Shared
    // with the option-source path (providerErrorResponse) so both fail identically.
    const errResponse = providerErrorResponse(result);
    if (errResponse) return errResponse;

    // Normalize before caching (AOD-8 §6.1): the cache stores small normalized payloads, so every device
    // and the kiosk get the renderer's data shape and the AOD-5 "normalized data only" rule holds
    // literally. A pass-through service caches raw provider JSON exactly as before. No credentials (AOD-5 C2).
    const payload = op ? op.normalize(result.json) : result.json;
    const writtenAt = new Date();
    const expiresAt = new Date(writtenAt.getTime() + widgetTtlSeconds * 1000);
    const { error: cacheErr } = await svc.from("proxy_cache").upsert({
      user_id: user.id,
      service: body.service,
      widget_type: body.widget,
      params_hash: hash,
      payload,
      fetched_at: writtenAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: "user_id,service,widget_type,params_hash" });
    if (cacheErr) throw new HttpError(500, "cache_write_failed", cacheErr.message);

    return json({ data: payload, cached: false });
  } catch (e) {
    return errorResponse(e);
  }
}
