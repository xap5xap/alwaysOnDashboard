// Pure unit coverage for applyPathParams (integration-calendar.md §6.3c): the REST path-token
// substitution the proxy uses to honor the chosen calendar. No stack: it is a pure path -> path map.
// The provider HTTP boundary itself (callProviderApi, refresh, revoke) is exercised by the integration
// suite (proxy.test.ts) where globalThis.fetch is faked (testing-strategy.md §6).

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { applyPathParams } from "./providers.ts";
import { HttpError } from "./http.ts";

describe("applyPathParams (integration-calendar.md §6.3c)", () => {
  it("substitutes a {token} from params into the path", () => {
    assertEquals(
      applyPathParams("/calendar/v3/calendars/{calendarId}/events", { calendarId: "primary" }),
      "/calendar/v3/calendars/primary/events",
    );
  });

  it("URL-encodes the value so it stays inside its single path segment (no traversal / no query injection)", () => {
    // A real calendar id is an email; encodeURIComponent escapes the @ so it can't break the segment.
    assertEquals(
      applyPathParams("/calendar/v3/calendars/{calendarId}/events", { calendarId: "me@example.com" }),
      "/calendar/v3/calendars/me%40example.com/events",
    );
    // A hostile id with slashes / query chars is fully neutralized (kept in one segment).
    assertEquals(applyPathParams("/c/{id}/x", { id: "a/b?z=1#f" }), "/c/a%2Fb%3Fz%3D1%23f/x");
  });

  it("leaves a token-free path unchanged (Linear / Weather / Anthropic untouched)", () => {
    assertEquals(applyPathParams("/graphql", { calendarId: "ignored" }), "/graphql");
    assertEquals(applyPathParams("/v1/forecast", {}), "/v1/forecast");
  });

  it("fills only declared {token} slots, ignoring extra params", () => {
    assertEquals(applyPathParams("/c/{id}", { id: "x", filter: "open" }), "/c/x");
  });

  it("substitutes multiple distinct tokens", () => {
    assertEquals(applyPathParams("/{a}/{b}", { a: "1", b: "2" }), "/1/2");
  });

  it("throws 400 missing_path_param when a declared token has no value (no silent literal {token})", () => {
    for (const params of [{}, { calendarId: null }, { calendarId: undefined }]) {
      try {
        applyPathParams("/c/{calendarId}/events", params as Record<string, unknown>);
        throw new Error("expected applyPathParams to throw");
      } catch (e) {
        assert(e instanceof HttpError, "is an HttpError");
        assertEquals((e as HttpError).status, 400);
        assertEquals((e as HttpError).code, "missing_path_param");
      }
    }
  });
});
