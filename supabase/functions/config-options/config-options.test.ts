// config-options (config-time option-source resolution, AOD-10 §4.3). Mirrors proxy.test.ts: the
// handler gates the connection (409 when reauth_required / no connection), invokes the allow-listed
// resolver, caches the Choice[] on the proxy_cache TTL, and returns. The stub option source is
// STATIC (fixed choices, no provider, no secret), the verification vehicle exactly as the stub
// exercised host/add/config in AOD-47/51/52. The provider-backed branch (the lazy secret + typed
// error mapping) is proved generically through makeProviderCaller against the weather backend.

import { afterAll, afterEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { handler } from "./handler.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import { makeConnection } from "../../../test/fixtures/factories.ts";
import { userPost } from "../../../test/fixtures/edge.ts";
import { jsonResponse, mockProvider, type ProviderMock, route } from "../../../test/fixtures/mockProvider.ts";
import { makeProviderCaller, type ConnectionRow } from "../_shared/connection.ts";
import { ResponseError } from "../_shared/http.ts";
import { STUB_OPTION_CHOICES } from "../_shared/option-sources.ts";
import { getBackend } from "../_shared/registry.ts";

const created: string[] = [];
let mock: ProviderMock | undefined;

async function freshUser(): Promise<TestUser> {
  const u = await createUser();
  created.push(u.id);
  return u;
}

/** A connected platform_key stub connection (no Vault secret), so the option-source gate passes. */
function connectedStub(userId: string) {
  return makeConnection(userId, {
    service: "stub",
    auth_class: "platform_key",
    status: "connected",
    access_secret_id: null,
    refresh_secret_id: null,
    config: {},
  });
}

afterEach(() => {
  mock?.restore();
  mock = undefined;
});
afterAll(async () => {
  for (const id of created) await deleteUser(id).catch(() => {});
  await closeDb();
  await closeBrokerDb();
});

describe("config-options handler (AOD-10 §4.3)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("connected stub resolves the static option source to its fixed Choice[] with NO provider call", async () => {
    const user = await freshUser();
    await connectedStub(user.id);
    // The static resolver never calls the provider; a mocked stub endpoint proves it is never hit.
    mock = mockProvider([route("stub.invalid", () => jsonResponse({ shouldNotBeCalled: true }))]);

    const res = await handler(
      await userPost("config-options", user, { service: "stub", optionSource: "stub_options" }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.choices, STUB_OPTION_CHOICES);
    assertEquals(body.cached, false);
    assertEquals(mock.countMatching("stub.invalid"), 0);

    // The option set was cached under the namespaced widget_type key (data-model §5.8).
    const sql = db();
    const [cache] = await sql`
      select widget_type from public.proxy_cache
      where user_id = ${user.id} and service = 'stub'
    `;
    assertEquals(cache?.widget_type, "@opt:stub_options");
  });

  it("a second call within the TTL is served from cache", async () => {
    const user = await freshUser();
    await connectedStub(user.id);

    const first = await handler(await userPost("config-options", user, { service: "stub", optionSource: "stub_options" }));
    assertEquals((await first.json()).cached, false);
    const second = await handler(await userPost("config-options", user, { service: "stub", optionSource: "stub_options" }));
    const body = await second.json();
    assertEquals(body.cached, true);
    assertEquals(body.choices, STUB_OPTION_CHOICES);
  });

  it("no connection returns 409 needs_reconnect", async () => {
    const user = await freshUser();
    const res = await handler(await userPost("config-options", user, { service: "stub", optionSource: "stub_options" }));
    assertEquals(res.status, 409);
    assertEquals((await res.json()).error, "needs_reconnect");
  });

  it("a reauth_required connection returns 409 needs_reconnect", async () => {
    const user = await freshUser();
    await makeConnection(user.id, {
      service: "stub",
      auth_class: "platform_key",
      status: "reauth_required",
      access_secret_id: null,
      refresh_secret_id: null,
      config: {},
    });
    const res = await handler(await userPost("config-options", user, { service: "stub", optionSource: "stub_options" }));
    assertEquals(res.status, 409);
    assertEquals((await res.json()).error, "needs_reconnect");
  });

  it("an unknown option source returns 400 unknown_option_source", async () => {
    const user = await freshUser();
    await connectedStub(user.id);
    const res = await handler(await userPost("config-options", user, { service: "stub", optionSource: "nope" }));
    assertEquals(res.status, 400);
    assertEquals((await res.json()).error, "unknown_option_source");
  });
});

// The provider-backed branch (the lazy secret + the typed-error mapping a real source rides) proved
// generically via the weather platform_key backend, without shipping a real provider integration.
describe("makeProviderCaller (provider-backed option source, AOD-10 §4.3 / §6.4)", () => {
  const weatherConn: ConnectionRow = {
    id: "conn-1",
    service: "weather",
    auth_class: "platform_key",
    status: "connected",
    access_secret_id: null,
    expires_at: null,
    config: null,
  };

  it("attaches the env key and returns the provider JSON on success", async () => {
    Deno.env.set("WEATHER_PROVIDER_KEY", "test-weather-key");
    let seenAuth: string | null = null;
    mock = mockProvider([
      route("api.open-meteo.com/v1/forecast", (call) => {
        seenAuth = call.headers.get("authorization");
        return jsonResponse({ temperature: 21 });
      }),
    ]);
    const call = makeProviderCaller(weatherConn, getBackend("weather"));
    const raw = await call({ method: "GET", path: "/v1/forecast" }, { query: { lat: 1 } });
    assertEquals(raw, { temperature: 21 });
    // weather rides the bearer style: the vestigial key as an ignored Authorization header (AOD-58, registry.ts).
    assertEquals(seenAuth, "Bearer test-weather-key");
  });

  it("throws a ResponseError carrying the mirrored rate_limited 429", async () => {
    Deno.env.set("WEATHER_PROVIDER_KEY", "test-weather-key");
    mock = mockProvider([
      route("api.open-meteo.com/v1/forecast", () => jsonResponse({}, 429, { "retry-after": "12" })),
    ]);
    const call = makeProviderCaller(weatherConn, getBackend("weather"));
    let thrown: unknown;
    try {
      await call({ method: "GET", path: "/v1/forecast" });
    } catch (e) {
      thrown = e;
    }
    assert(thrown instanceof ResponseError, "throws a ResponseError");
    const res = (thrown as ResponseError).response;
    assertEquals(res.status, 429);
    const body = await res.json();
    assertEquals(body.error, "rate_limited");
    assertEquals(body.retryAfterSeconds, 12);
  });

  it("throws a ResponseError carrying upstream_unavailable 502 on a 5xx", async () => {
    Deno.env.set("WEATHER_PROVIDER_KEY", "test-weather-key");
    mock = mockProvider([route("api.open-meteo.com/v1/forecast", () => jsonResponse({}, 503))]);
    const call = makeProviderCaller(weatherConn, getBackend("weather"));
    let thrown: unknown;
    try {
      await call({ method: "GET", path: "/v1/forecast" });
    } catch (e) {
      thrown = e;
    }
    assert(thrown instanceof ResponseError, "throws a ResponseError");
    assertEquals((thrown as ResponseError).response.status, 502);
  });
});
