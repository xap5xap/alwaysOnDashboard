// The provider HTTP boundary (AOD-9 §7-§10). This is the ONLY thing the integration tests fake
// (testing-strategy.md §6: stub globalThis.fetch for token_url / api_base / revoke). Uses Deno-native
// fetch; no axios, no SDK (AOD-25).

import { HttpError, json } from "./http.ts";
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
  retryAfterSeconds?: number; // from a Retry-After header (e.g. a standard 429)
  /** Seconds until the rate-limit window resets, from X-RateLimit-Requests-Reset (Linear's 400 path). */
  rateLimitResetSeconds?: number;
  json: unknown;
}

/**
 * Substitute {token} slots in an allow-listed registry path from the instance params, URL-encoded
 * (integration-calendar.md §6.3c). A path with no {token} is returned unchanged, so services without
 * path tokens (Linear, Weather, Anthropic) are untouched. The registry path template stays
 * the authoritative allow-list: only declared {token} slots are filled, and encodeURIComponent keeps a
 * hostile value inside its single path segment (no traversal, no query injection), preserving the
 * AOD-9 goal-5 allow-list. A token declared in the path but absent from params is a 400, not a silent
 * literal "{calendarId}" in the URL.
 */
export function applyPathParams(path: string, pathParams: Record<string, unknown>): string {
  return path.replace(/\{(\w+)\}/g, (_, key) => {
    const v = pathParams[key];
    if (v == null) throw new HttpError(400, "missing_path_param", `path token {${key}} has no value`);
    return encodeURIComponent(String(v));
  });
}

/**
 * Call an allow-listed provider endpoint (AOD-9 §9 step 5), attaching the secret server-side in the
 * registry's header style. Returns the raw status + body; the proxy maps 429/5xx to typed results.
 */
export async function callProviderApi(
  backend: ServiceBackendConfig,
  endpoint: EndpointDef,
  opts: { secret: string; query?: Record<string, unknown>; body?: unknown; pathParams?: Record<string, unknown> },
): Promise<ProviderApiResult> {
  if (!backend.apiBase) throw new HttpError(500, "no_api_base", `${backend.id} has no apiBase`);
  const url = new URL(backend.apiBase + applyPathParams(endpoint.path, opts.pathParams ?? {}));
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
  // Linear reports its rate-limit reset as a UTC epoch (ms) header rather than Retry-After (§7.1/§7.3).
  const rlReset = res.headers.get("x-ratelimit-requests-reset");
  const body = await res.json().catch(() => null);
  return {
    status: res.status,
    ok: res.ok,
    retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
    rateLimitResetSeconds: rlReset ? resetEpochMsToSeconds(Number(rlReset)) : undefined,
    json: body,
  };
}

/** Convert a UTC epoch-ms reset timestamp to whole seconds from now (never negative). */
function resetEpochMsToSeconds(resetEpochMs: number): number | undefined {
  if (!Number.isFinite(resetEpochMs)) return undefined;
  return Math.max(0, Math.ceil((resetEpochMs - Date.now()) / 1000));
}

/**
 * Whether a provider result is a rate limit. A standard 429 is one; two providers signal it off-band:
 * Linear returns HTTP 400 with a RATELIMITED code in the GraphQL top-level `errors`
 * (integration-linear.md §7.3), and Google returns HTTP 403 with a `usageLimits` domain (or a
 * `rateLimitExceeded` / `userRateLimitExceeded` reason) in `error.errors[]` (integration-calendar.md
 * §7.3). The check is on the signal (status + body code), never on the service id, so it stays generic:
 * a 403 WITHOUT that quota signal is a real auth error and still maps to upstream_unavailable.
 */
function isRateLimited(result: ProviderApiResult): boolean {
  if (result.status === 429) return true;
  // Linear: HTTP 400 + a RATELIMITED extension code in the GraphQL top-level errors array.
  if (result.status === 400) {
    const errors = (result.json as { errors?: unknown })?.errors;
    return Array.isArray(errors) && errors.some((e) => {
      const code = (e as { extensions?: { code?: unknown } })?.extensions?.code;
      return typeof code === "string" && code.toUpperCase() === "RATELIMITED";
    });
  }
  // Google: HTTP 403 + a usageLimits domain / rateLimitExceeded reason in error.errors[].
  if (result.status === 403) {
    const errors = (result.json as { error?: { errors?: unknown } })?.error?.errors;
    return Array.isArray(errors) && errors.some((e) => {
      const o = e as { domain?: unknown; reason?: unknown };
      return o?.domain === "usageLimits" || o?.reason === "rateLimitExceeded" ||
        o?.reason === "userRateLimitExceeded";
    });
  }
  return false;
}

/**
 * Map a provider call result to the typed-error Response the client lifecycle reacts to (AOD-9 §9,
 * AOD-10 §6.4): a rate limit -> rate_limited, any other non-2xx -> upstream_unavailable. Returns null
 * on success. A standard 429 carries Retry-After; Linear's 400/RATELIMITED carries the reset window
 * instead (§7.3). The widget proxy and the config-time option-source path share this one mapping so
 * their provider-error contract is identical.
 */
export function providerErrorResponse(result: ProviderApiResult): Response | null {
  if (isRateLimited(result)) {
    const retryAfterSeconds = result.retryAfterSeconds ?? result.rateLimitResetSeconds ?? null;
    return json({ error: "rate_limited", retryAfterSeconds }, 429);
  }
  if (!result.ok) return json({ error: "upstream_unavailable", status: result.status }, 502);
  return null;
}
