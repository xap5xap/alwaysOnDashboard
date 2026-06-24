// supabase-js client factories. The service-role client does all server writes (it bypasses RLS
// and holds the §8.3 GRANTs); the caller-scoped client validates the session JWT to derive user_id
// (auth.ts). Ordinary table DML goes through these; Vault + FOR UPDATE go through db.ts (AOD-25).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.ts";

const NO_PERSIST = { auth: { autoRefreshToken: false, persistSession: false } } as const;

/** Service-role client: bypasses RLS, scoped by the broker to the authenticated user_id. */
export function serviceClient(): SupabaseClient {
  const env = loadEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, NO_PERSIST);
}

/** A client carrying the caller's Authorization header, used only to validate the JWT. */
export function callerClient(authHeader: string): SupabaseClient {
  const env = loadEnv();
  return createClient(env.supabaseUrl, env.anonKey, {
    ...NO_PERSIST,
    global: { headers: { Authorization: authHeader } },
  });
}
