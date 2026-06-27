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

  it("platform_key (weather) reads no Vault and attaches the env key + the stored location", async () => {
    Deno.env.set("WEATHER_PROVIDER_KEY", "test-weather-key");
    const user = await freshUser();
    await makeConnection(user.id, {
      service: "weather",
      auth_class: "platform_key",
      status: "connected",
      config: { lat: 0.11, lon: 0.22 },
      access_secret_id: null,
      refresh_secret_id: null,
    });
    let seenKey: string | null = null;
    let seenUrl = "";
    mock = mockProvider([
      route("api.open-meteo.com/v1/forecast", (call) => {
        seenKey = call.headers.get("x-api-key");
        seenUrl = call.url;
        return jsonResponse({ temperature: 20 });
      }),
    ]);

    const res = await handler(await userPost("proxy", user, { service: "weather", widget: "current" }));
    assertEquals(res.status, 200);
    assertEquals(mock.countMatching("forecast"), 1);
    assertEquals(seenKey, "test-weather-key");
    assert(seenUrl.includes("lat=0.11") && seenUrl.includes("lon=0.22"), "location passed as query params");
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
});
