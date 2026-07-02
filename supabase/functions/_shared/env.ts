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
    // EDGE_DB_URL is a LOCAL-ONLY escape hatch (AOD-78): the local edge runtime's node-DNS cannot
    // resolve the db container hostname inside SUPABASE_DB_URL (supabase/postgres#1447), which kills
    // the raw-postgres paths (Vault, the refresh lock) while supabase-js still works. The gitignored
    // functions .env points it at the docker-network gateway IP literal (bypasses DNS); the var is
    // never set on hosted Supabase, where the CLI-injected SUPABASE_DB_URL keeps winning.
    dbUrl: optionalEnv("EDGE_DB_URL", "") || requireEnv("SUPABASE_DB_URL"),
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
