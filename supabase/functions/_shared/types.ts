// Server-side registry + provider types (AOD-8 §5.2 ServiceBackendConfig, AOD-9 §4 auth classes).
// This is the server half of the service registry: code, never a table (data-model.md §2).

export type AuthClass = "oauth2" | "api_key" | "admin_key" | "platform_key" | "none";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** How the proxy attaches the per-call secret to the provider request. */
export type AuthHeaderStyle = "bearer" | "x-api-key" | "anthropic-admin";

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  defaultScopes: string[];
  supportsPkce: boolean;
  /** Provider-specific authorize params, e.g. Google's access_type=offline & prompt=consent (AOD-9 §4). */
  extraAuthorizeParams?: Record<string, string>;
}

/** One allow-listed endpoint. The proxy only ever calls apiBase + an allow-listed path (AOD-9 goal 5). */
export interface EndpointDef {
  method: HttpMethod;
  path: string;
}

export interface ServiceBackendConfig {
  id: string;
  authClass: AuthClass;
  oauth?: OAuthConfig; // present only for authClass "oauth2"
  apiBase?: string; // proxy target base; present for every class except "none"
  authHeaderStyle?: AuthHeaderStyle;
  /** platform_key only: the Edge env var holding the platform provider key (AOD-9 §5.4). */
  platformKeyEnv?: string;
  /** The widget-to-endpoint allow-list (AOD-8 §5.2). */
  endpoints: Record<string, EndpointDef>;
}

/** A provider token endpoint response (connect exchange + refresh). */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // seconds
  scope?: string; // space- or comma-delimited
}
