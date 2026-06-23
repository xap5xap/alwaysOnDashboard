// Supabase clients + per-user lifecycle for the RLS policy harness (testing-strategy.md §5.1).
// Users are created through the Auth admin API (service role); each is signed in to mint a real
// JWT, and the returned client carries that user's token so queries run as the `authenticated`
// role through PostgREST under RLS, exactly as the app issues them.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.ts";

/** Service-role client. Used only for the Auth admin API here; it bypasses RLS. */
export const admin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export interface TestUser {
  id: string;
  email: string;
  password: string;
  /** A supabase-js client authenticated as this user (the `authenticated` role). */
  client: SupabaseClient;
}

/** Create a confirmed auth user and return a client signed in as them. */
export async function createUser(): Promise<TestUser> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? "no user returned"}`);
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`signInWithPassword failed: ${signInError.message}`);
  }

  return { id: data.user.id, email, password, client };
}

/**
 * Hard-delete an auth user. The FK cascades wipe every application row the user owns
 * (data-model.md §11); this is also the mechanism the account-deletion cascade test asserts.
 */
export async function deleteUser(id: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
}
