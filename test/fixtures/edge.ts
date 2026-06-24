// Helpers to invoke an Edge Function handler directly under `deno test` (testing-strategy.md §5.2,
// §11: the handler-import pattern). Builds Requests carrying a real user JWT or the service token.

import { env } from "./env.ts";
import type { TestUser } from "./clients.ts";

/** The signed-in user's access token (held in the client's memory; no network call). */
export async function userJwt(user: TestUser): Promise<string> {
  const { data, error } = await user.client.auth.getSession();
  if (error || !data.session) throw new Error(`no session for test user: ${error?.message ?? "missing"}`);
  return data.session.access_token;
}

/** A POST Request authenticated as a user (Bearer JWT) with a JSON body. */
export async function userPost(path: string, user: TestUser, body: unknown): Promise<Request> {
  return new Request(`http://localhost/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${await userJwt(user)}` },
    body: JSON.stringify(body),
  });
}

/** A POST Request authenticated as the service role (the token-refresh cron path, AOD-9 §8.2). */
export function servicePost(path: string, body: unknown): Request {
  return new Request(`http://localhost/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body),
  });
}
