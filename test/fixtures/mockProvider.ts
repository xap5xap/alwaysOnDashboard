// The provider HTTP stub (testing-strategy.md §6): replace globalThis.fetch so the registry's
// token_url / api_base / revoke endpoints return canned responses, while everything else (the
// local supabase API that supabase-js calls) falls through to the real fetch. This keeps Vault and
// Postgres real and fakes only the third-party boundary.

export interface MockCall {
  url: string;
  method: string;
  headers: Headers;
  body?: string;
}

export interface MockRoute {
  match: (url: string) => boolean;
  respond: (call: MockCall) => Response | Promise<Response>;
}

export interface ProviderMock {
  calls: MockCall[];
  /** Count recorded calls whose URL contains the substring (e.g. "oauth/token"). */
  countMatching: (substring: string) => number;
  restore: () => void;
}

export function mockProvider(routes: MockRoute[]): ProviderMock {
  const original = globalThis.fetch;
  const calls: MockCall[] = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    for (const r of routes) {
      if (r.match(url)) {
        const method = init?.method ?? (input instanceof Request ? input.method : "GET");
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        const body = typeof init?.body === "string" ? init.body : undefined;
        const call: MockCall = { url, method, headers, body };
        calls.push(call);
        return await r.respond(call);
      }
    }
    // Not a provider URL (e.g. the local supabase API): use the real fetch.
    return original(input as string | URL | Request, init);
  }) as typeof fetch;

  return {
    calls,
    countMatching: (substring) => calls.filter((c) => c.url.includes(substring)).length,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/** Build a fresh JSON Response (responders must return a new Response per call: bodies are single-use). */
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

/** A route matching any URL containing `urlSubstring`, served by `respond`. */
export function route(
  urlSubstring: string,
  respond: (call: MockCall) => Response | Promise<Response>,
): MockRoute {
  return { match: (url) => url.includes(urlSubstring), respond };
}
