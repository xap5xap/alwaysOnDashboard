// Proxied call flow (testing-strategy.md §5.2): the proxy loads the connection, reads the access
// secret from Vault (or, for platform_key, takes the key from env and reads no Vault), calls the
// faked provider, normalizes, and writes proxy_cache; reauth_required returns 409; an expired token
// triggers inline refresh first; a second call within the TTL is served from cache (one provider
// hit); 429 / 5xx map to typed results.

import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { handler } from "./handler.ts";
import { createUser, deleteUser, type TestUser } from "../../../test/fixtures/clients.ts";
import { closeDb, db } from "../../../test/fixtures/db.ts";
import { closeDb as closeBrokerDb } from "../_shared/db.ts";
import {
  makeConnection,
  makeEntitlement,
  makeNearExpiryConnection,
  makeReauthRequiredConnection,
} from "../../../test/fixtures/factories.ts";
import { readSecret } from "../../../test/fixtures/vault.ts";
import { userPost } from "../../../test/fixtures/edge.ts";
import { jsonResponse, mockProvider, type ProviderMock, route } from "../../../test/fixtures/mockProvider.ts";
import { paramsHash } from "../_shared/crypto.ts";

/**
 * Seed a STALE proxy_cache row (already expired) with a chosen age, so the proxy reaches the AOD-12
 * §6.4 fetch-floor gate. params_hash matches an empty-params request. The 900s CHECK holds:
 * expires_at - fetched_at = ttlSeconds (<= 900) and > 0.
 */
async function seedStaleCache(
  userId: string,
  opts: { service: string; widget: string; ageSeconds: number; ttlSeconds: number; payload: unknown },
): Promise<void> {
  const sql = db();
  const fetchedAt = new Date(Date.now() - opts.ageSeconds * 1000);
  const expiresAt = new Date(fetchedAt.getTime() + opts.ttlSeconds * 1000);
  const hash = await paramsHash({});
  await sql`
    insert into public.proxy_cache (user_id, service, widget_type, params_hash, payload, fetched_at, expires_at)
    values (${userId}, ${opts.service}, ${opts.widget}, ${hash},
            ${sql.json(opts.payload as Parameters<typeof sql.json>[0])}, ${fetchedAt}, ${expiresAt})
  `;
}

const created: string[] = [];
let mock: ProviderMock | undefined;

async function freshUser(): Promise<TestUser> {
  const u = await createUser();
  created.push(u.id);
  return u;
}

/** A connected oauth2 linear connection with real Vault secrets and a far-future expiry. */
function connectedLinear(userId: string) {
  return makeConnection(userId, {
    service: "linear",
    auth_class: "oauth2",
    status: "connected",
    expires_at: new Date(Date.now() + 3_600_000),
    secrets: { access: "live-access", refresh: "live-refresh" },
  });
}

/**
 * A real Linear `viewer.assignedIssues` GraphQL response (integration-linear.md §4.1). The proxy's
 * operation seam (operations.ts) normalizes this to MyIssuesData before returning/caching, so the
 * widget mocks must use the live node shape, not a placeholder.
 */
function myIssuesResponse(nodes: Array<Record<string, unknown>> = []) {
  return { data: { viewer: { assignedIssues: { nodes } } } };
}
const SAMPLE_ISSUE = {
  id: "i1",
  identifier: "AOD-1",
  title: "Wire Linear My Issues",
  url: "https://linear.app/thexap/issue/AOD-1",
  priority: 2,
  priorityLabel: "High",
  dueDate: null,
  state: { name: "In Progress", type: "started" },
  project: { id: "p1", name: "Platform & App Shell" },
};

/** A connected oauth2 google_calendar connection with real Vault secrets and a far-future expiry. */
function connectedGoogleCalendar(userId: string) {
  return makeConnection(userId, {
    service: "google_calendar",
    auth_class: "oauth2",
    status: "connected",
    expires_at: new Date(Date.now() + 3_600_000),
    secrets: { access: "live-access", refresh: "live-refresh" },
  });
}

/**
 * A real Google Calendar events.list body (integration-calendar.md §4, §12). The proxy's REST operation
 * (operations.ts) normalizes this to NextEventData / AgendaData before returning/caching, so the mock
 * must use the live item shape (start.dateTime for a timed event), not a placeholder.
 */
function eventsListResponse(items: Array<Record<string, unknown>> = []) {
  return { kind: "calendar#events", summary: "me@example.com", items };
}
const SAMPLE_EVENT = {
  id: "ev1",
  summary: "Standup",
  location: "Zoom",
  htmlLink: "https://calendar.google.com/event?eid=ev1",
  start: { dateTime: "2026-06-26T14:00:00-05:00" },
  end: { dateTime: "2026-06-26T14:30:00-05:00" },
};

/** A connected admin_key anthropic_usage connection with a REAL Vault secret (the Admin key). */
function connectedAnthropicUsage(userId: string) {
  return makeConnection(userId, {
    service: "anthropic_usage",
    auth_class: "admin_key",
    status: "connected",
    secrets: { access: "sk-ant-admin-live" },
  });
}

/**
 * A real /v1/organizations/cost_report body (integration-claude.md §12 sample shape): daily buckets,
 * each results[].amount a decimal string in MINOR units (cents). 150.00 + 250.00 cents = $4.00 MTD. The
 * proxy's operation (operations.ts) normalizes this to SpendMtdData / DailySpendData before caching.
 */
function costReportResponse() {
  return {
    data: [
      { starting_at: "2026-06-01T00:00:00Z", ending_at: "2026-06-02T00:00:00Z", results: [{ amount: "150.00", currency: "USD" }] },
      { starting_at: "2026-06-02T00:00:00Z", ending_at: "2026-06-03T00:00:00Z", results: [{ amount: "250.00", currency: "USD" }] },
    ],
    has_more: false,
    next_page: null,
  };
}

/** Anthropic's error envelope for a revoked/invalid Admin key (integration-claude.md §12): HTTP 401. */
const ANTHROPIC_401 = { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } };

/** Read a connection's current status straight from the DB (to assert the 401 detector flipped it). */
async function connectionStatus(userId: string, service: string): Promise<string | undefined> {
  const sql = db();
  const [row] = await sql`select status from public.connections where user_id = ${userId} and service = ${service}`;
  return row?.status as string | undefined;
}

beforeAll(() => {});
afterEach(() => {
  mock?.restore();
  mock = undefined;
});
afterAll(async () => {
  for (const id of created) await deleteUser(id).catch(() => {});
  await closeDb();
  await closeBrokerDb();
});

describe("proxy (proxied call, AOD-9 §9)", { sanitizeResources: false, sanitizeOps: false }, () => {
  it("the AOD-126-removed stub service fails closed (400 unknown_service) — stale clients still ask", async () => {
    const user = await freshUser();
    const res = await handler(await userPost("proxy", user, { service: "stub", widget: "placeholder", params: {} }));
    assertEquals(res.status, 400);
    assertEquals((await res.json()).error, "unknown_service");
  });

  it("cache miss: builds the GraphQL body, normalizes, returns data, writes proxy_cache within the 900s ceiling", async () => {
    const user = await freshUser();
    await connectedLinear(user.id);
    let seenBody = "";
    mock = mockProvider([route("api.linear.app/graphql", (call) => {
      seenBody = call.body ?? "";
      return jsonResponse(myIssuesResponse([SAMPLE_ISSUE]));
    })]);

    const res = await handler(await userPost("proxy", user, {
      service: "linear",
      widget: "my_issues",
      params: { projectId: "p1", filter: "open" },
    }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.cached, false);
    assertEquals(mock.countMatching("graphql"), 1);

    // The operation seam built the provider body server-side: the client sent only {projectId, filter},
    // the broker injected the held GraphQL query + the IssueFilter variables (integration-linear.md §6).
    assert(seenBody.includes("assignedIssues"), "the server-side GraphQL query was sent as the body");
    const sent = JSON.parse(seenBody) as { variables: { filter: Record<string, unknown> } };
    assertEquals(sent.variables.filter.project, { id: { eq: "p1" } });
    assertEquals(sent.variables.filter.state, { type: { nin: ["completed", "canceled"] } });

    // ...and normalized the raw response to MyIssuesData before returning/caching (AOD-8 §6.1).
    assertEquals(body.data.totalCount, 1);
    assertEquals(body.data.issues[0].identifier, "AOD-1");
    assertEquals(body.data.issues[0].stateType, "started");

    const sql = db();
    const [cache] = await sql`
      select fetched_at, expires_at from public.proxy_cache
      where user_id = ${user.id} and service = 'linear' and widget_type = 'my_issues'
    `;
    assert(cache, "a proxy_cache row was written");
    const ttl = (new Date(cache.expires_at).getTime() - new Date(cache.fetched_at).getTime()) / 1000;
    assert(ttl > 0 && ttl <= 900, `cache TTL ${ttl}s is within the 900s ceiling`);
  });

  it("cache hit within TTL: served from cache, the provider is hit only once", async () => {
    const user = await freshUser();
    await connectedLinear(user.id);
    mock = mockProvider([route("api.linear.app/graphql", () => jsonResponse(myIssuesResponse([SAMPLE_ISSUE])))]);

    const first = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues", params: {} }));
    assertEquals((await first.json()).cached, false);
    const second = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues", params: {} }));
    assertEquals((await second.json()).cached, true);
    assertEquals(mock.countMatching("graphql"), 1);
  });

  it("reauth_required connection returns 409 needs_reconnect with no provider call", async () => {
    const user = await freshUser();
    await makeReauthRequiredConnection(user.id);
    mock = mockProvider([route("api.linear.app/graphql", () => jsonResponse({}))]);

    const res = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues" }));
    assertEquals(res.status, 409);
    assertEquals((await res.json()).error, "needs_reconnect");
    assertEquals(mock.countMatching("graphql"), 0);
  });

  it("expired token triggers inline refresh before the provider call", async () => {
    const user = await freshUser();
    const conn = await makeNearExpiryConnection(user.id, { expires_at: new Date(Date.now() - 1000) });
    mock = mockProvider([
      route("api.linear.app/oauth/token", () =>
        jsonResponse({ access_token: "refreshed-access", refresh_token: "refreshed-refresh", expires_in: 3600 })),
      route("api.linear.app/graphql", () => jsonResponse(myIssuesResponse([SAMPLE_ISSUE]))),
    ]);

    const res = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues" }));
    assertEquals(res.status, 200);
    assertEquals(mock.countMatching("oauth/token"), 1);
    assertEquals(mock.countMatching("graphql"), 1);
    assertEquals(await readSecret(conn.access_secret_id!), "refreshed-access");
  });

  it("platform_key (weather): no Vault, attaches the env key, buildQuery carries the host-seeded location, normalizes", async () => {
    Deno.env.set("WEATHER_PROVIDER_KEY", "test-weather-key");
    const user = await freshUser();
    // The connection holds the location; the client host seeds it into body.params for platform_key
    // services (integration-weather.md §6.3), so the proxy's conn.config pass-through merge does NOT run
    // on the buildQuery branch. The location below is what the seeded params carry.
    const location = { latitude: -0.18, longitude: -78.47, timezone: "America/Guayaquil", name: "Quito, Ecuador" };
    await makeConnection(user.id, {
      service: "weather",
      auth_class: "platform_key",
      status: "connected",
      config: location,
      access_secret_id: null,
      refresh_secret_id: null,
    });
    let seenAuth: string | null = null;
    let seenUrl = "";
    mock = mockProvider([
      route("api.open-meteo.com/v1/forecast", (call) => {
        seenAuth = call.headers.get("authorization");
        seenUrl = call.url;
        // A real /v1/forecast current body (integration-weather.md §12); the proxy normalizes it.
        return jsonResponse({
          current_units: { temperature_2m: "°C", wind_speed_10m: "km/h", relative_humidity_2m: "%" },
          current: {
            time: "2026-06-27T11:15", is_day: 1, weather_code: 2, temperature_2m: 18.2,
            apparent_temperature: 17.5, relative_humidity_2m: 60, wind_speed_10m: 7.1, wind_direction_10m: 120,
          },
        });
      }),
    ]);

    const res = await handler(
      await userPost("proxy", user, { service: "weather", widget: "current", params: location }),
    );
    assertEquals(res.status, 200);
    assertEquals(mock.countMatching("forecast"), 1);
    // platform_key: the env key rides as an IGNORED bearer header. Re-verified live 2026-06-28 (AOD-58):
    // the keyless tier 303-redirects an x-api-key header but ignores Authorization: Bearer, so the registry
    // uses the bearer style for the vestigial placeholder; no Vault read happens for a platform_key class.
    assertEquals(seenAuth, "Bearer test-weather-key");
    // buildQuery composed the seeded location + the static current= selector server-side (§6.1).
    assert(seenUrl.includes("latitude=-0.18") && seenUrl.includes("longitude=-78.47"), `location in query: ${seenUrl}`);
    assert(seenUrl.includes("current=temperature_2m"), "server-built current selector");
    assert(!seenUrl.includes("name="), "the display name is not forwarded to the provider");
    // ...and normalized to CurrentWeatherData before returning/caching (AOD-8 §6.1), not raw provider JSON.
    const body = await res.json();
    assertEquals(body.data.temperature, 18.2);
    assertEquals(body.data.condition, { code: 2, label: "Partly cloudy", group: "cloudy", isDay: true });
    assertEquals(body.data.units.temperature, "°C");
  });

  it("provider 429 maps to a typed rate_limited result carrying Retry-After", async () => {
    const user = await freshUser();
    await connectedLinear(user.id);
    mock = mockProvider([
      route("api.linear.app/graphql", () => jsonResponse({ error: "slow down" }, 429, { "retry-after": "30" })),
    ]);

    const res = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues" }));
    assertEquals(res.status, 429);
    const body = await res.json();
    assertEquals(body.error, "rate_limited");
    assertEquals(body.retryAfterSeconds, 30);
  });

  it("provider 5xx maps to upstream_unavailable", async () => {
    const user = await freshUser();
    await connectedLinear(user.id);
    mock = mockProvider([route("api.linear.app/graphql", () => jsonResponse({}, 503))]);

    const res = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues" }));
    assertEquals(res.status, 502);
    assertEquals((await res.json()).error, "upstream_unavailable");
  });

  it("fetch-floor (AOD-12 §6.4): a Free user inside the 900s floor is served the stale cache, no provider hit", async () => {
    const user = await freshUser(); // no entitlements row -> Free, 900s floor
    await connectedLinear(user.id);
    // Cache is 400s old with a 300s TTL: expired (so not a fresh hit) but well inside the 900s floor.
    await seedStaleCache(user.id, { service: "linear", widget: "my_issues", ageSeconds: 400, ttlSeconds: 300, payload: { fromCache: true } });
    mock = mockProvider([route("api.linear.app/graphql", () => jsonResponse({ data: { fresh: true } }))]);

    const res = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues", params: {} }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.cached, true);
    assertEquals(body.stale, true);
    assertEquals(body.data.fromCache, true); // the stale cached value, not a fresh fetch
    assertEquals(mock.countMatching("graphql"), 0); // the provider was NOT hit
  });

  it("fetch-floor: a Pro user refetches once past the widget TTL (floor is the widget TTL only)", async () => {
    const user = await freshUser();
    await makeEntitlement(user.id, { tier: "pro", status: "active" });
    await connectedLinear(user.id);
    // Same 400s-old / 300s-TTL stale cache; Pro's floor is max(300, 0) = 300, so 400s >= 300s refetches.
    await seedStaleCache(user.id, { service: "linear", widget: "my_issues", ageSeconds: 400, ttlSeconds: 300, payload: { fromCache: true } });
    mock = mockProvider([route("api.linear.app/graphql", () => jsonResponse(myIssuesResponse([SAMPLE_ISSUE])))]);

    const res = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues", params: {} }));
    assertEquals(res.status, 200);
    assertEquals((await res.json()).cached, false); // refetched
    assertEquals(mock.countMatching("graphql"), 1);
  });

  // --- Google Calendar: the REST buildQuery / {calendarId} path-token branch (integration-calendar.md §6.3) ---

  it("google_calendar next_event: substitutes {calendarId} into the path, builds the time query server-side, normalizes to NextEventData", async () => {
    const user = await freshUser();
    await connectedGoogleCalendar(user.id);
    let seenUrl = "";
    mock = mockProvider([route("www.googleapis.com/calendar/v3/calendars", (call) => {
      seenUrl = call.url;
      return jsonResponse(eventsListResponse([SAMPLE_EVENT]));
    })]);

    const res = await handler(await userPost("proxy", user, {
      service: "google_calendar",
      widget: "next_event",
      params: { calendarId: "me@example.com" },
    }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.cached, false);
    assertEquals(mock.countMatching("/events"), 1);

    // The chosen calendarId reached Google's PATH, URL-encoded, not the literal token or a hard-coded primary.
    assert(seenUrl.includes("/calendars/me%40example.com/events"), `calendarId substituted into the path: ${seenUrl}`);
    assert(!seenUrl.includes("{calendarId}") && !seenUrl.includes("/calendars/primary/"), "no placeholder, no hard-coded primary");
    // The query was built server-side (the client sent only { calendarId }).
    assert(seenUrl.includes("singleEvents=true") && seenUrl.includes("orderBy=startTime"), "server-built base query");
    assert(seenUrl.includes("maxResults=1"), "next_event asks for one event");
    assert(seenUrl.includes("timeMin="), "timeMin derived server-side");
    assert(!seenUrl.includes("calendarId="), "calendarId is a path token, NOT a query param");

    // ...and normalized to NextEventData before returning/caching (AOD-8 §6.1).
    assertEquals(body.data.hasEvent, true);
    assertEquals(body.data.event.summary, "Standup");
    assertEquals(body.data.event.allDay, false);
    assertEquals(body.data.event.start, "2026-06-26T14:00:00-05:00");
  });

  it("google_calendar agenda: builds the now -> now+~36h window and normalizes to AgendaData", async () => {
    const user = await freshUser();
    await connectedGoogleCalendar(user.id);
    let seenUrl = "";
    mock = mockProvider([route("www.googleapis.com/calendar/v3/calendars", (call) => {
      seenUrl = call.url;
      return jsonResponse(eventsListResponse([SAMPLE_EVENT, { ...SAMPLE_EVENT, id: "ev2", summary: "Review" }]));
    })]);

    const res = await handler(await userPost("proxy", user, {
      service: "google_calendar",
      widget: "agenda",
      params: { calendarId: "me@example.com" },
    }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assert(seenUrl.includes("/calendars/me%40example.com/events"), "calendarId in path");
    assert(seenUrl.includes("timeMin=") && seenUrl.includes("timeMax="), "agenda carries a bounded window");
    assert(seenUrl.includes("maxResults=10"), "agenda asks for up to 10");
    assertEquals(body.data.events.length, 2);
    assertEquals(body.data.events[1].summary, "Review");
  });

  it("cache-key: repeated next_event polls within the TTL hit cache once (timeMin is derived, never in the key)", async () => {
    const user = await freshUser();
    await connectedGoogleCalendar(user.id);
    mock = mockProvider([route("www.googleapis.com/calendar/v3/calendars", () => jsonResponse(eventsListResponse([SAMPLE_EVENT])))]);

    const p = { service: "google_calendar", widget: "next_event", params: { calendarId: "me@example.com" } };
    const first = await handler(await userPost("proxy", user, p));
    assertEquals((await first.json()).cached, false);
    const second = await handler(await userPost("proxy", user, p));
    assertEquals((await second.json()).cached, true);
    // timeMin changes between calls, but the params-hash ({ calendarId }) is identical, so the second
    // poll is served from cache and Google is hit exactly once (integration-calendar.md §6.2).
    assertEquals(mock.countMatching("/events"), 1);
  });

  // --- Claude usage: the first admin_key data path + the 401 -> reauth credential-death detector
  // (integration-claude.md §3.3, §6.1). The load-bearing proofs: a NORMALIZED payload through the proxy
  // (cents -> dollars /100), and that a 401 on a credentialed-class call flips the connection to
  // reauth_required and returns 409, generically per auth class. -----------------------------------------

  it("anthropic_usage spend_mtd: builds the MTD Cost Report query server-side, attaches the Admin key, normalizes to SpendMtdData ($ /100), caches", async () => {
    const user = await freshUser();
    await connectedAnthropicUsage(user.id);
    let seenUrl = "";
    let seenKey: string | null = null;
    let seenVersion: string | null = null;
    mock = mockProvider([route("api.anthropic.com/v1/organizations/cost_report", (call) => {
      seenUrl = call.url;
      seenKey = call.headers.get("x-api-key");
      seenVersion = call.headers.get("anthropic-version");
      return jsonResponse(costReportResponse());
    })]);

    const res = await handler(await userPost("proxy", user, { service: "anthropic_usage", widget: "spend_mtd", params: {} }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.cached, false);
    assertEquals(mock.countMatching("cost_report"), 1);

    // The Admin key rode server-side via the anthropic-admin header style (x-api-key + anthropic-version).
    assertEquals(seenKey, "sk-ant-admin-live");
    assertEquals(seenVersion, "2023-06-01");
    // buildQuery built the MTD window server-side: bucket_width=1d, limit=31, a derived starting/ending.
    assert(seenUrl.includes("bucket_width=1d"), `bucket_width in query: ${seenUrl}`);
    assert(seenUrl.includes("limit=31"), "one-page month window");
    assert(seenUrl.includes("starting_at=") && seenUrl.includes("ending_at="), "the MTD window is server-built");

    // ...and normalized to SpendMtdData before returning/caching: 150.00 + 250.00 cents = $4.00, NOT $400.
    assertEquals(body.data.amount, 4);
    assertEquals(body.data.currency, "USD");
    assertEquals(body.data.daysElapsed, 2);

    // A normalized payload was cached, within the 900s ceiling (AOD-5 normalized-only).
    const sql = db();
    const [cache] = await sql`
      select payload, fetched_at, expires_at from public.proxy_cache
      where user_id = ${user.id} and service = 'anthropic_usage' and widget_type = 'spend_mtd'
    `;
    assert(cache, "a proxy_cache row was written");
    assertEquals((cache.payload as { amount: number }).amount, 4); // the normalized $ figure, not raw cost_report JSON
    const ttl = (new Date(cache.expires_at).getTime() - new Date(cache.fetched_at).getTime()) / 1000;
    assert(ttl > 0 && ttl <= 900, `cache TTL ${ttl}s is within the 900s ceiling`);
  });

  it("anthropic_usage daily_spend: the same Cost Report query normalizes to a DailySpendData series, oldest-first", async () => {
    const user = await freshUser();
    await connectedAnthropicUsage(user.id);
    mock = mockProvider([route("api.anthropic.com/v1/organizations/cost_report", () => jsonResponse(costReportResponse()))]);

    const res = await handler(await userPost("proxy", user, { service: "anthropic_usage", widget: "daily_spend", params: {} }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.data.days, [
      { date: "2026-06-01", amount: 1.5 },
      { date: "2026-06-02", amount: 2.5 },
    ]);
    assertEquals(body.data.total, 4);
    assertEquals(body.data.currency, "USD");
  });

  it("cache-key: repeated spend_mtd polls within the TTL hit cache once (the MTD window is derived, never in the key)", async () => {
    const user = await freshUser();
    await connectedAnthropicUsage(user.id);
    mock = mockProvider([route("api.anthropic.com/v1/organizations/cost_report", () => jsonResponse(costReportResponse()))]);

    const p = { service: "anthropic_usage", widget: "spend_mtd", params: {} };
    const first = await handler(await userPost("proxy", user, p));
    assertEquals((await first.json()).cached, false);
    const second = await handler(await userPost("proxy", user, p));
    assertEquals((await second.json()).cached, true);
    // starting_at/ending_at change between calls, but params is empty, so the params-hash is identical and
    // Anthropic is hit exactly once (integration-claude.md §6.1 cache-key property).
    assertEquals(mock.countMatching("cost_report"), 1);
  });

  it("401 on an admin_key data call flips the connection to reauth_required and returns 409 needs_reconnect (§3.3)", async () => {
    const user = await freshUser();
    await connectedAnthropicUsage(user.id);
    mock = mockProvider([route("api.anthropic.com/v1/organizations/cost_report", () => jsonResponse(ANTHROPIC_401, 401))]);

    const res = await handler(await userPost("proxy", user, { service: "anthropic_usage", widget: "spend_mtd", params: {} }));
    assertEquals(res.status, 409);
    assertEquals((await res.json()).error, "needs_reconnect");
    assertEquals(mock.countMatching("cost_report"), 1); // the dead key was tried once, then short-circuited
    // The detector flipped the connection so subsequent calls hit the connection gate and short-circuit.
    assertEquals(await connectionStatus(user.id, "anthropic_usage"), "reauth_required");

    // A second call now hits the gate (isConnectionUsable false) and 409s WITHOUT a provider call.
    const again = await handler(await userPost("proxy", user, { service: "anthropic_usage", widget: "spend_mtd", params: {} }));
    assertEquals(again.status, 409);
    assertEquals(mock.countMatching("cost_report"), 1); // still 1: the gate short-circuited before any call
  });

  it("401 on an oauth2 (linear) data call is UNCHANGED: upstream_unavailable, status NOT flipped (the detector is per auth class)", async () => {
    const user = await freshUser();
    await connectedLinear(user.id);
    mock = mockProvider([route("api.linear.app/graphql", () => jsonResponse({ error: "unauthorized" }, 401))]);

    const res = await handler(await userPost("proxy", user, { service: "linear", widget: "my_issues", params: {} }));
    // oauth2 takes the generic mapping (a 401 is the rare mid-life-revocation edge the OAuth specs named,
    // deliberately NOT auto-reauth here), so it stays upstream_unavailable and the connection is untouched.
    assertEquals(res.status, 502);
    assertEquals((await res.json()).error, "upstream_unavailable");
    assertEquals(await connectionStatus(user.id, "linear"), "connected");
  });

  it("429 on an admin_key data call still maps to rate_limited (the 401 detector does not disturb the 429 path)", async () => {
    const user = await freshUser();
    await connectedAnthropicUsage(user.id);
    mock = mockProvider([route("api.anthropic.com/v1/organizations/cost_report", () => jsonResponse({ error: "slow down" }, 429, { "retry-after": "30" }))]);

    const res = await handler(await userPost("proxy", user, { service: "anthropic_usage", widget: "spend_mtd", params: {} }));
    assertEquals(res.status, 429);
    assertEquals((await res.json()).error, "rate_limited");
    assertEquals(await connectionStatus(user.id, "anthropic_usage"), "connected"); // a 429 is transient, not credential death
  });
});
