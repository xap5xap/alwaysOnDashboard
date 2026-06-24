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

const JSON_HEADERS = { "content-type": "application/json" } as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** The AOD-9 §9 reauth_required / disconnected path: a widget renders a reconnect prompt. */
export function needsReconnect(): Response {
  return json({ error: "needs_reconnect" }, 409);
}

/** Map any thrown value to a Response. HttpError keeps its status; everything else is a 500. */
export function errorResponse(e: unknown): Response {
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
