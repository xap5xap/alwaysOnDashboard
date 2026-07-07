// HTTP helpers shared by every broker function: a typed error, JSON responses, the 409
// needs_reconnect path (AOD-9 §9), method/JSON guards, and Zod body parsing to a 400.

import type { ZodType } from "zod";

/** A handled error that maps to a specific HTTP status. Anything else becomes a 500. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

/**
 * Carries a fully-built Response so a deep callee can short-circuit the handler with an exact
 * response (e.g. the typed provider-error / 409 a resolver hits inside a nested provider call) and
 * the top-level errorResponse renders it verbatim. Lets the proxy and config-options share one
 * provider-call boundary without each re-deciding the error body.
 */
export class ResponseError extends Error {
  constructor(public response: Response) {
    super("response_error");
    this.name = "ResponseError";
  }
}

const JSON_HEADERS = { "content-type": "application/json" } as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** The AOD-9 §9 reauth_required / disconnected path: a widget renders a reconnect prompt. */
export function needsReconnect(): Response {
  return json({ error: "needs_reconnect" }, 409);
}

/** Map any thrown value to a Response. ResponseError carries its own; HttpError keeps its status;
 *  everything else is a 500. */
export function errorResponse(e: unknown): Response {
  if (e instanceof ResponseError) return e.response;
  if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
  console.error("unhandled broker error:", e);
  return json({ error: "internal_error" }, 500);
}

export function methodGuard(req: Request, ...allowed: string[]): void {
  if (!allowed.includes(req.method)) throw new HttpError(405, "method_not_allowed", `expected ${allowed.join("/")}`);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

/** Parse an unknown body with a Zod schema, throwing a 400 on failure. */
export function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, "invalid_request", result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

// CORS for browser clients (Expo web, and any future web dashboard). Native clients (iOS/Android)
// issue no preflight, so this is inert for them; without it a cross-origin browser call preflights
// with OPTIONS, which methodGuard would 405, and the actual response would lack
// Access-Control-Allow-Origin so the browser would block reading it. The functions gateway forwards
// OPTIONS to the function even when verify_jwt = true (a preflight carries no Authorization header),
// so answering the preflight here is both reachable and correct. Auth is header-based (no cookies),
// so a wildcard origin is safe and needs no Access-Control-Allow-Credentials.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Wrap a handler so the OPTIONS preflight is answered with a 204 and every response carries the CORS
 * headers. Applied only at the Deno.serve entrypoint (index.ts), never around the handler under test,
 * so handler unit tests keep asserting the bare method/status behaviour.
 */
export function withCors(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
