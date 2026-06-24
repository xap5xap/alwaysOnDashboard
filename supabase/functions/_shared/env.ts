// Edge env access (AOD-9 §5.4: secrets live in Deno.env). Read at call time, never at import,
// so importing a handler under `deno test` has no side effects. Core platform vars are required;
// provider client creds and platform keys default to test placeholders (the provider HTTP boundary
// is faked in tests, AOD-9 confirms real values at wiring).

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name) ?? fallback;
}

export interface BrokerEnv {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  /** Privileged Postgres URL for the FOR UPDATE lock + Vault SQL (AOD-25). */
  dbUrl: string;
  /** Base the provider redirect URI is built against; defaults to the local functions URL. */
  callbackBaseUrl: string;
  /** The app deep-link scheme the callback 302s back to (AOD-9 §7.1). */
  deepLinkScheme: string;
}

export function loadEnv(): BrokerEnv {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  return {
    supabaseUrl,
    anonKey: requireEnv("SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    dbUrl: requireEnv("SUPABASE_DB_URL"),
    callbackBaseUrl: optionalEnv("OAUTH_CALLBACK_BASE_URL", `${supabaseUrl}/functions/v1`),
    deepLinkScheme: optionalEnv("APP_DEEP_LINK_SCHEME", "alwaysondashboard"),
  };
}

/** OAuth client credentials for a service, e.g. LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET. */
export function oauthClientCreds(serviceId: string): { clientId: string; clientSecret: string } {
  const prefix = serviceId.toUpperCase();
  return {
    clientId: optionalEnv(`${prefix}_CLIENT_ID`, "test-client-id"),
    clientSecret: optionalEnv(`${prefix}_CLIENT_SECRET`, "test-client-secret"),
  };
}
