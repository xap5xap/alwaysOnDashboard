// The provider HTTP boundary (AOD-9 §7-§10). This is the ONLY thing the integration tests fake
// (testing-strategy.md §6: stub globalThis.fetch for token_url / api_base / revoke). Uses Deno-native
// fetch; no axios, no SDK (AOD-25).

import { HttpError } from "./http.ts";
import type { AuthHeaderStyle, EndpointDef, ServiceBackendConfig, TokenResponse } from "./types.ts";

/** Build the provider authorize URL (AOD-9 §7.1). */
export function buildAuthorizeUrl(
  backend: ServiceBackendConfig,
  opts: { clientId: string; state: string; codeChallenge: string | null; redirectUri: string },
): string {
  if (!backend.oauth) throw new HttpError(400, "not_oauth2", `${backend.id} is not an oauth2 service`);
  const url = new URL(backend.oauth.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", backend.oauth.defaultScopes.join(" "));
  url.searchParams.set("state", opts.state);
  if (opts.codeChallenge) {
    url.searchParams.set("code_challenge", opts.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  for (const [k, v] of Object.entries(backend.oauth.extraAuthorizeParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

function parseTokenResponse(raw: unknown): TokenResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.access_token !== "string") throw new HttpError(502, "bad_token_response", "no access_token");
  return {
    access_token: r.access_token,
    refresh_token: typeof r.refresh_token === "string" ? r.refresh_token : undefined,
    expires_in: typeof r.expires_in === "number" ? r.expires_in : undefined,
    scope: typeof r.scope === "string" ? r.scope : undefined,
  };
}

/** Server-side authorization-code exchange (AOD-9 §7.1 step 4): client secret never on device. */
export async function exchangeCode(
  backend: ServiceBackendConfig,
  opts: { code: string; codeVerifier: string | null; redirectUri: string; clientId: string; clientSecret: string },
): Promise<TokenResponse> {
  if (!backend.oauth) throw new HttpError(400, "not_oauth2");
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
  if (opts.codeVerifier) form.set("code_verifier", opts.codeVerifier);
  const res = await fetch(backend.oauth.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form,
  });
  if (!res.ok) throw new HttpError(502, "token_exchange_failed", `token endpoint returned ${res.status}`);
  return parseTokenResponse(await res.json());
}

export type RefreshResult = { ok: true; token: TokenResponse } | { ok: false; invalidGrant: true };

/**
 * Refresh an access token (AOD-9 §8.2). On `invalid_grant` (refresh token revoked/expired) returns
 * a typed marker so the caller sets reauth_required; any other non-2xx throws.
 */
export async function refreshAccessToken(
  backend: ServiceBackendConfig,
  opts: { refreshToken: string; clientId: string; clientSecret: string },
): Promise<RefreshResult> {
  if (!backend.oauth) throw new HttpError(400, "not_oauth2");
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
  const res = await fetch(backend.oauth.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form,
  });
  if (res.ok) return { ok: true, token: parseTokenResponse(await res.json()) };

  if (res.status === 400) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (body.error === "invalid_grant") return { ok: false, invalidGrant: true };
  }
  throw new HttpError(502, "refresh_failed", `refresh endpoint returned ${res.status}`);
}

/** Best-effort provider revoke (AOD-9 §10 step 3): never blocks the local purge. */
export async function revokeToken(backend: ServiceBackendConfig, token: string): Promise<boolean> {
  if (!backend.oauth?.revokeUrl) return false;
  try {
    const res = await fetch(backend.oauth.revokeUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function authHeaders(style: AuthHeaderStyle | undefined, secret: string): Record<string, string> {
  switch (style) {
    case "x-api-key":
      return { "x-api-key": secret };
    case "anthropic-admin":
      return { "x-api-key": secret, "anthropic-version": "2023-06-01" };
    case "bearer":
    default:
      return { Authorization: `Bearer ${secret}` };
  }
}

export interface ProviderApiResult {
  status: number;
  ok: boolean;
  retryAfterSeconds?: number;
  json: unknown;
}

/**
 * Call an allow-listed provider endpoint (AOD-9 §9 step 5), attaching the secret server-side in the
 * registry's header style. Returns the raw status + body; the proxy maps 429/5xx to typed results.
 */
export async function callProviderApi(
  backend: ServiceBackendConfig,
  endpoint: EndpointDef,
  opts: { secret: string; query?: Record<string, unknown>; body?: unknown },
): Promise<ProviderApiResult> {
  if (!backend.apiBase) throw new HttpError(500, "no_api_base", `${backend.id} has no apiBase`);
  const url = new URL(backend.apiBase + endpoint.path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const headers = authHeaders(backend.authHeaderStyle, opts.secret);
  const init: RequestInit = { method: endpoint.method, headers };
  if (endpoint.method !== "GET" && endpoint.method !== "DELETE") {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body ?? {});
  }
  const res = await fetch(url.toString(), init);
  const retryAfter = res.headers.get("retry-after");
  const json = await res.json().catch(() => null);
  return {
    status: res.status,
    ok: res.ok,
    retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
    json,
  };
}
