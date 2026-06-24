// proxy (AOD-9 §6, §9): the widget data path. The client names a service + widget, never a URL or a
// token. Serve a fresh cache hit; otherwise load the connection (409 if reauth_required/
// disconnected), inline-refresh an expired token, read the secret (Vault, or the platform key from
// env), call the allow-listed provider endpoint, normalize, and cache within the <=900s ceiling.

import { deriveUser } from "../_shared/auth.ts";
import { paramsHash } from "../_shared/crypto.ts";
import { cacheTtlSeconds } from "../_shared/entitlements.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorResponse, HttpError, json, methodGuard, needsReconnect, parseBody, readJson } from "../_shared/http.ts";
import { callProviderApi } from "../_shared/providers.ts";
import { refreshConnection } from "../_shared/refresh.ts";
import { getBackend, getEndpoint } from "../_shared/registry.ts";
import { ProxySchema } from "../_shared/schemas.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { readSecret } from "../_shared/vault.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");
    const user = await deriveUser(req);
    const body = parseBody(ProxySchema, await readJson(req));

    const backend = getBackend(body.service);
    const endpoint = getEndpoint(backend, body.widget);
    const svc = serviceClient();

    const { data: conn } = await svc.from("connections").select("*")
      .eq("user_id", user.id).eq("service", body.service).maybeSingle();
    if (!conn || conn.status === "reauth_required" || conn.status === "disconnected") return needsReconnect();

    // Cache hit within TTL: one provider call serves every device polling this widget (AOD-9 §9 step 6).
    const hash = await paramsHash(body.params ?? {});
    const { data: cached } = await svc.from("proxy_cache")
      .select("payload, expires_at")
      .eq("user_id", user.id).eq("service", body.service).eq("widget_type", body.widget).eq("params_hash", hash)
      .maybeSingle();
    if (cached && new Date(cached.expires_at) > new Date()) {
      return json({ data: cached.payload, cached: true });
    }

    // AOD-12 (separate task) gates the provider fetch here by tier: read the entitlements row,
    // serverTier(row), and mayUserTriggerFetch(...) to enforce the Free 900s refresh floor (serve
    // stale cache instead of refetching). Entitlement ENFORCEMENT is out of scope for AOD-44; the
    // pure functions exist and are unit-tested. cacheTtlSeconds bounds the cache write below.

    // Inline (lazy) refresh if the access token has expired between scheduled runs (AOD-9 §8.3).
    if (conn.auth_class === "oauth2" && conn.expires_at && new Date(conn.expires_at) <= new Date()) {
      const outcome = await refreshConnection(conn.id, { graceSeconds: 0 });
      if (outcome === "reauth_required") return needsReconnect();
    }

    // Resolve the secret: Vault for credentialed classes; platform_key reads the key from env and
    // performs no Vault read (AOD-9 §9 step 4).
    let secret: string;
    if (backend.authClass === "platform_key") {
      secret = requireEnv(backend.platformKeyEnv ?? "");
    } else {
      if (!conn.access_secret_id) throw new HttpError(500, "no_secret", "connection has no access secret");
      const loaded = await readSecret(conn.access_secret_id);
      if (!loaded) throw new HttpError(500, "secret_missing", "access secret not found in Vault");
      secret = loaded;
    }

    // platform_key passes the user's stored location (config) as query params (AOD-9 §9 step 5).
    const query = { ...(conn.config as Record<string, unknown> | null ?? {}), ...(body.params ?? {}) };
    const result = await callProviderApi(backend, endpoint, { secret, query, body: body.params });

    // Map provider failure to a typed result so the widget shows a clear state (AOD-9 §9, AOD-10 §6.4).
    if (result.status === 429) {
      return json({ error: "rate_limited", retryAfterSeconds: result.retryAfterSeconds ?? null }, 429);
    }
    if (!result.ok) {
      return json({ error: "upstream_unavailable", status: result.status }, 502);
    }

    // Per-widget normalization is wired per integration (AOD-10 owns the data contracts); the payload
    // is provider data and carries no credentials (AOD-5 C2).
    const payload = result.json;
    const ttlSeconds = cacheTtlSeconds({ defaultRefresh: { seconds: 300 } });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const { error: cacheErr } = await svc.from("proxy_cache").upsert({
      user_id: user.id,
      service: body.service,
      widget_type: body.widget,
      params_hash: hash,
      payload,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: "user_id,service,widget_type,params_hash" });
    if (cacheErr) throw new HttpError(500, "cache_write_failed", cacheErr.message);

    return json({ data: payload, cached: false });
  } catch (e) {
    return errorResponse(e);
  }
}
