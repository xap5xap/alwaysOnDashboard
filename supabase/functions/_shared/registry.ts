// The server half of the service registry (AOD-8 §5.2, AOD-9 §6.1). Code, never a table
// (data-model.md §2). Adding a service is a registry entry plus its Edge env secret; no broker code
// changes (the broker has one path per auth class, AOD-9 §4). Provider URLs are illustrative and
// confirmed per-provider at wiring (AOD-9 §11); the broker tests fake the provider HTTP boundary.

import { HttpError } from "./http.ts";
import type { EndpointDef, ServiceBackendConfig } from "./types.ts";

export const BACKEND_REGISTRY: Record<string, ServiceBackendConfig> = {
  linear: {
    id: "linear",
    authClass: "oauth2",
    oauth: {
      authorizeUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      revokeUrl: "https://api.linear.app/oauth/revoke",
      defaultScopes: ["read"],
      supportsPkce: true,
    },
    apiBase: "https://api.linear.app",
    authHeaderStyle: "bearer",
    endpoints: {
      // Linear is GraphQL: every widget endpoint is the same path; the operation is held
      // server-side keyed by widget type, so the client never supplies a query (AOD-8 §5.2).
      my_issues: { method: "POST", path: "/graphql" },
      current_cycle: { method: "POST", path: "/graphql" },
    },
  },
  google_calendar: {
    id: "google_calendar",
    authClass: "oauth2",
    oauth: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revokeUrl: "https://oauth2.googleapis.com/revoke",
      defaultScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      supportsPkce: true,
      // Required for Google to reliably return a refresh token (AOD-9 §4).
      extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    },
    apiBase: "https://www.googleapis.com",
    authHeaderStyle: "bearer",
    endpoints: {
      // Both widgets read events.list; the chosen calendar is a {calendarId} path token filled from the
      // instance config at call time (integration-calendar.md §6.3c, §8), not the hard-coded `primary`
      // placeholder. The operation (operations.ts) builds the time-derived query and normalizes the body.
      next_event: { method: "GET", path: "/calendar/v3/calendars/{calendarId}/events" },
      agenda: { method: "GET", path: "/calendar/v3/calendars/{calendarId}/events" },
    },
  },
  anthropic_usage: {
    id: "anthropic_usage",
    authClass: "admin_key",
    apiBase: "https://api.anthropic.com",
    authHeaderStyle: "anthropic-admin",
    endpoints: {
      // The only two endpoints the high-sensitivity Admin key is ever attached to (AOD-9 §4).
      usage: { method: "GET", path: "/v1/organizations/usage_report/messages" },
      cost: { method: "GET", path: "/v1/organizations/cost_report" },
    },
  },
  weather: {
    id: "weather",
    authClass: "platform_key",
    apiBase: "https://api.open-meteo.com",
    // The platform key is VESTIGIAL for the keyless Open-Meteo free tier and reserved for the commercial
    // tier (integration-weather.md §3.2). resolveCallSecret still requireEnv(WEATHER_PROVIDER_KEY), so the
    // env var is a non-empty placeholder. authHeaderStyle is "bearer", NOT "x-api-key": re-verified live
    // on 2026-06-28 (AOD-58 build), the keyless /v1/forecast 303-redirects any request carrying an
    // `x-api-key` header into the commercial flow (which then 400s), but it IGNORES an `Authorization:
    // Bearer` header (HTTP 200). So the vestigial placeholder rides as a genuinely-ignored bearer header,
    // which is the spec's stated intent (§3.2) realized against the live API. The real commercial tier uses
    // an `apikey` QUERY PARAM on customer-api.open-meteo.com (a named future seam, §3.2/§10), not a header.
    // apiBase / authClass / platformKeyEnv are unchanged from the AOD-13 placeholder.
    authHeaderStyle: "bearer",
    platformKeyEnv: "WEATHER_PROVIDER_KEY",
    endpoints: {
      // Both widgets read the same /v1/forecast; they differ only in the operation (operations.ts):
      // the buildQuery selectors (current=... vs daily=...) and the normalize (integration-weather.md
      // §4, §6, §8). The location is a query param, so there is no {path token} (§6.2).
      current: { method: "GET", path: "/v1/forecast" },
      forecast: { method: "GET", path: "/v1/forecast" },
    },
  },
  // App-shell walking-skeleton stub (AOD-47), mirroring the client `stub` service (apps/app). No real
  // provider: the client host drives it through this proxy, and with no connection row the proxy's
  // connection gate returns 409 needs_reconnect, which the host renders as the disconnected state.
  // This is the server half of the AOD-8 seam for the stub; remove or replace when real integrations
  // land in PS-M3. The platform key/base are never reached (the connection gate short-circuits first).
  stub: {
    id: "stub",
    authClass: "platform_key",
    apiBase: "https://stub.invalid",
    authHeaderStyle: "x-api-key",
    platformKeyEnv: "STUB_PROVIDER_KEY",
    endpoints: {
      placeholder: { method: "GET", path: "/" },
      // AOD-53 remote-options vehicle: its client half (placeholder_remote) resolves choices via the
      // option-source path, not this data endpoint; the entry keeps both registry halves matched.
      placeholder_remote: { method: "GET", path: "/" },
    },
  },
};

export function getBackend(serviceId: string): ServiceBackendConfig {
  const backend = BACKEND_REGISTRY[serviceId];
  if (!backend) throw new HttpError(400, "unknown_service", `no backend registered for "${serviceId}"`);
  return backend;
}

export function getEndpoint(backend: ServiceBackendConfig, widgetType: string): EndpointDef {
  const endpoint = backend.endpoints[widgetType];
  if (!endpoint) {
    throw new HttpError(400, "unknown_widget", `"${widgetType}" is not an allow-listed widget for "${backend.id}"`);
  }
  return endpoint;
}
