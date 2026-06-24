// oauth-callback (AOD-9 §6, §7.1 steps 4-6): receive the provider redirect, validate `state`,
// exchange the code (with the client secret, server-side), store tokens in Vault, upsert the
// connection, delete the transaction, and 302 back to the app deep link with a success signal only
// (never a token). This is the one function reached by a provider redirect, not the app, so it
// authenticates by the `state` it looks up rather than a session JWT.

import { timingSafeEqual } from "../_shared/crypto.ts";
import { loadEnv, oauthClientCreds } from "../_shared/env.ts";
import { errorResponse, HttpError, methodGuard } from "../_shared/http.ts";
import { exchangeCode } from "../_shared/providers.ts";
import { getBackend } from "../_shared/registry.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { createSecret, deleteSecret } from "../_shared/vault.ts";
import type { BrokerEnv } from "../_shared/env.ts";

function deepLink(env: BrokerEnv, service: string | null, status: "ok" | "error"): Response {
  const params = new URLSearchParams({ status });
  if (service) params.set("service", service);
  return new Response(null, {
    status: 302,
    headers: { Location: `${env.deepLinkScheme}://oauth/done?${params.toString()}` },
  });
}

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "GET", "POST");
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new HttpError(400, "invalid_callback", "missing code or state");

    const env = loadEnv();
    const svc = serviceClient();

    const { data: txn } = await svc.from("oauth_transactions").select("*").eq("state", state).maybeSingle();
    // Unknown state: reject and write nothing (CSRF defense, AOD-9 §7.1).
    if (!txn || !timingSafeEqual(txn.state, state)) return deepLink(env, null, "error");
    // Expired in-flight authorization: drop it and reject.
    if (new Date(txn.expires_at) <= new Date()) {
      await svc.from("oauth_transactions").delete().eq("id", txn.id);
      return deepLink(env, txn.service, "error");
    }

    const backend = getBackend(txn.service);
    const creds = oauthClientCreds(txn.service);
    const token = await exchangeCode(backend, {
      code,
      codeVerifier: txn.code_verifier,
      redirectUri: `${env.callbackBaseUrl}/oauth-callback`,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });

    // Note any superseded secrets so we can purge them after the upsert (avoid orphaned Vault rows).
    const { data: existing } = await svc.from("connections")
      .select("access_secret_id, refresh_secret_id")
      .eq("user_id", txn.user_id).eq("service", txn.service).maybeSingle();

    const accessId = await createSecret(token.access_token, `${txn.service} access for ${txn.user_id}`);
    const refreshId = token.refresh_token
      ? await createSecret(token.refresh_token, `${txn.service} refresh for ${txn.user_id}`)
      : null;

    const scopes = token.scope ? token.scope.split(/[\s,]+/).filter(Boolean) : backend.oauth!.defaultScopes;
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;

    const { error: upsertErr } = await svc.from("connections").upsert({
      user_id: txn.user_id,
      service: txn.service,
      auth_class: "oauth2",
      status: "connected",
      scopes,
      access_secret_id: accessId,
      refresh_secret_id: refreshId,
      expires_at: expiresAt,
    }, { onConflict: "user_id,service" });
    if (upsertErr) throw new HttpError(500, "db_error", upsertErr.message);

    if (existing?.access_secret_id && existing.access_secret_id !== accessId) {
      await deleteSecret(existing.access_secret_id).catch(() => {});
    }
    if (existing?.refresh_secret_id && existing.refresh_secret_id !== refreshId) {
      await deleteSecret(existing.refresh_secret_id).catch(() => {});
    }

    await svc.from("oauth_transactions").delete().eq("id", txn.id);
    return deepLink(env, txn.service, "ok");
  } catch (e) {
    return errorResponse(e);
  }
}
