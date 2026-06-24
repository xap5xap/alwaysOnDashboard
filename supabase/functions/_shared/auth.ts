// Derive the authenticated user_id from the Supabase session JWT (AOD-9 §6: "every function
// authenticates the caller from the Supabase session JWT first"). oauth-callback is the one
// exception (reached by a provider redirect) and authenticates by validating `state` instead.

import { callerClient } from "./supabase.ts";
import { HttpError } from "./http.ts";
import { timingSafeEqual } from "./crypto.ts";

export interface AuthedUser {
  id: string;
}

export async function deriveUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new HttpError(401, "unauthorized", "missing Authorization header");

  const { data, error } = await callerClient(authHeader).auth.getUser();
  if (error || !data.user) throw new HttpError(401, "unauthorized", "invalid session");
  return { id: data.user.id };
}

/**
 * Authorize a service-to-service call (the pg_cron token-refresh invocation, AOD-9 §8.2). The cron
 * passes the service token from Vault as a bearer; we require it to equal the service-role key.
 */
export function authorizeServiceCall(req: Request): void {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!expected || !timingSafeEqual(token, expected)) {
    throw new HttpError(401, "unauthorized", "invalid service token");
  }
}
