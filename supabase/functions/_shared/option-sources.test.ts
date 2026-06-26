// Pure unit coverage for the option-source registry + the shared provider-error mapping (AOD-10
// §4.3 / §6.4). No stack: the registry is code, providerBackedSource maps a faked provider response,
// and providerErrorResponse is a pure ProviderApiResult -> Response mapping shared with the proxy.

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import {
  getOptionSource,
  type OptionSourceContext,
  providerBackedSource,
  STUB_OPTION_CHOICES,
} from "./option-sources.ts";
import { providerErrorResponse } from "./providers.ts";
import { HttpError } from "./http.ts";

const failingCaller: OptionSourceContext["callProvider"] = () => {
  throw new Error("a static option source must not call the provider");
};

describe("option-source registry (AOD-10 §4.3)", () => {
  it("resolves the stub static source to its fixed choices without touching the provider", async () => {
    const resolver = getOptionSource("stub", "stub_options");
    const choices = await resolver({ params: {}, callProvider: failingCaller });
    assertEquals(choices, STUB_OPTION_CHOICES);
  });

  it("throws a 400 unknown_option_source for an unregistered id", () => {
    try {
      getOptionSource("stub", "not_a_source");
      throw new Error("expected getOptionSource to throw");
    } catch (e) {
      assert(e instanceof HttpError, "is an HttpError");
      assertEquals((e as HttpError).status, 400);
      assertEquals((e as HttpError).code, "unknown_option_source");
    }
  });

  it("providerBackedSource calls the allow-listed endpoint with the field params and maps to Choice[]", async () => {
    const seen: { query?: unknown }[] = [];
    const resolver = providerBackedSource(
      { method: "POST", path: "/graphql" },
      (raw) => (raw as { items: { id: string; name: string }[] }).items.map((i) => ({ value: i.id, label: i.name })),
    );
    const ctx: OptionSourceContext = {
      params: { teamId: "T1" },
      callProvider: (_endpoint, opts) => {
        seen.push({ query: opts?.query });
        return Promise.resolve({ items: [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }] });
      },
    };
    const choices = await resolver(ctx);
    assertEquals(choices, [{ value: "p1", label: "One" }, { value: "p2", label: "Two" }]);
    assertEquals(seen, [{ query: { teamId: "T1" } }]); // the stable id is stored, params flow through
  });
});

describe("providerErrorResponse (shared proxy / option-source mapping, AOD-10 §6.4)", () => {
  it("returns null on a 2xx", () => {
    assertEquals(providerErrorResponse({ status: 200, ok: true, json: {} }), null);
  });

  it("maps 429 to a rate_limited 429 carrying Retry-After", async () => {
    const res = providerErrorResponse({ status: 429, ok: false, retryAfterSeconds: 30, json: {} });
    assert(res, "a Response is returned");
    assertEquals(res.status, 429);
    const body = await res.json();
    assertEquals(body.error, "rate_limited");
    assertEquals(body.retryAfterSeconds, 30);
  });

  it("maps any other non-2xx to upstream_unavailable 502", async () => {
    const res = providerErrorResponse({ status: 503, ok: false, json: {} });
    assert(res, "a Response is returned");
    assertEquals(res.status, 502);
    assertEquals((await res.json()).error, "upstream_unavailable");
  });

  // Linear returns HTTP 400 with a RATELIMITED code, not 429 (integration-linear.md §7.3).
  it("maps a Linear 400 with a RATELIMITED code to rate_limited, using the reset window", async () => {
    const res = providerErrorResponse({
      status: 400,
      ok: false,
      rateLimitResetSeconds: 42,
      json: { errors: [{ message: "rate limited", extensions: { code: "RATELIMITED" } }] },
    });
    assert(res, "a Response is returned");
    assertEquals(res.status, 429);
    const body = await res.json();
    assertEquals(body.error, "rate_limited");
    assertEquals(body.retryAfterSeconds, 42); // from X-RateLimit-Requests-Reset, not Retry-After
  });

  it("leaves a non-RATELIMITED 400 as upstream_unavailable (only the rate-limit code is special)", async () => {
    const res = providerErrorResponse({ status: 400, ok: false, json: { errors: [{ message: "bad query" }] } });
    assert(res, "a Response is returned");
    assertEquals(res.status, 502);
    assertEquals((await res.json()).error, "upstream_unavailable");
  });
});
