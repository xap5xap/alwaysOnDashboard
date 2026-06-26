// The connection-gate + secret pipeline shared by the widget proxy (proxy/handler.ts) and the
// config-time option-source path (config-options/handler.ts). One place attaches the user's stored
// secret to a provider call, so the AOD-9 §9 trust boundary is not duplicated. Pure orchestration
// over the existing primitives (vault, refresh, env, providers); no new policy.

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.ts";
import { HttpError, needsReconnect, ResponseError } from "./http.ts";
import { callProviderApi, providerErrorResponse } from "./providers.ts";
import { refreshConnection } from "./refresh.ts";
import type { EndpointDef, ServiceBackendConfig } from "./types.ts";
import { readSecret } from "./vault.ts";

/** The connection columns the proxy and option-source paths read (a `select *` row). */
export interface ConnectionRow {
  id: string;
  service: string;
  auth_class: string;
  status: string;
  access_secret_id: string | null;
  expires_at: string | Date | null;
  config: Record<string, unknown> | null;
}

/** Load the user's connection for a service (RLS-equivalent: scoped to user_id on the service role). */
export async function loadConnection(
  svc: SupabaseClient,
  userId: string,
  service: string,
): Promise<ConnectionRow | null> {
  const { data } = await svc.from("connections").select("*")
    .eq("user_id", userId).eq("service", service).maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/** The AOD-9 §9 connection gate: a usable connection exists and is not reauth_required/disconnected. */
export function isConnectionUsable(conn: ConnectionRow | null): conn is ConnectionRow {
  return !!conn && conn.status !== "reauth_required" && conn.status !== "disconnected";
}

/**
 * Resolve the per-call secret (AOD-9 §9 step 4), refreshing an expired oauth2 token inline first
 * (§8.3). platform_key reads the platform key from env and performs no Vault read. Throws a
 * ResponseError carrying the 409 needs_reconnect when an inline refresh finds the credential dead,
 * so the caller renders the exact same 409 body as the gate.
 */
export async function resolveCallSecret(
  conn: ConnectionRow,
  backend: ServiceBackendConfig,
): Promise<string> {
  if (conn.auth_class === "oauth2" && conn.expires_at && new Date(conn.expires_at) <= new Date()) {
    const outcome = await refreshConnection(conn.id, { graceSeconds: 0 });
    if (outcome === "reauth_required") throw new ResponseError(needsReconnect());
  }
  if (backend.authClass === "platform_key") {
    return requireEnv(backend.platformKeyEnv ?? "");
  }
  if (!conn.access_secret_id) throw new HttpError(500, "no_secret", "connection has no access secret");
  const loaded = await readSecret(conn.access_secret_id);
  if (!loaded) throw new HttpError(500, "secret_missing", "access secret not found in Vault");
  return loaded;
}

/** Options a provider-backed call carries: extra query params and/or a POST body. */
export interface ProviderCallOptions {
  query?: Record<string, unknown>;
  body?: unknown;
}

/** A bound provider caller: attaches the user's secret and maps typed errors. Returns the raw JSON. */
export type ProviderCaller = (endpoint: EndpointDef, opts?: ProviderCallOptions) => Promise<unknown>;

/**
 * Build a provider caller bound to a connection. The secret is resolved LAZILY on first call, so a
 * static option source (no provider call) never reads a secret or refreshes a token. A typed provider
 * error (429 / 5xx) is thrown as a ResponseError carrying the mirrored proxy response, so the option
 * source path and the widget proxy fail identically.
 */
export function makeProviderCaller(conn: ConnectionRow, backend: ServiceBackendConfig): ProviderCaller {
  return async (endpoint, opts) => {
    const secret = await resolveCallSecret(conn, backend);
    const result = await callProviderApi(backend, endpoint, { secret, query: opts?.query, body: opts?.body });
    const errResponse = providerErrorResponse(result);
    if (errResponse) throw new ResponseError(errResponse);
    return result.json;
  };
}
