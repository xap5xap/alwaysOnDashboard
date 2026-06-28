// Pure unit coverage for the widget-operation registry (integration-linear.md §6). No stack: the
// registry is code; buildBody is a pure config -> GraphQL body map; normalize is a pure raw -> payload
// map. The Linear my_issues filter table (§4.1) and the MyIssuesData normalization are pinned here.

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import {
  type AgendaData,
  type CurrentCycleData,
  type CurrentWeatherData,
  type ForecastData,
  getOperation,
  type MyIssuesData,
  type NextEventData,
} from "./operations.ts";

const myIssues = () => {
  const op = getOperation("linear", "my_issues");
  assert(op, "linear my_issues operation is registered");
  return op;
};

function bodyFor(params: Record<string, unknown>) {
  // buildBody is OPTIONAL since the REST refinement (integration-calendar.md §6.3a); every Linear op
  // still provides it, so the non-null assertion is honest here.
  return myIssues().buildBody!(params) as {
    query: string;
    variables: { filter: { project?: unknown; state?: unknown } };
  };
}

describe("operation registry (integration-linear.md §6)", () => {
  it("returns undefined for a service/widget with no operation (the stub keeps pass-through)", () => {
    assertEquals(getOperation("stub", "placeholder"), undefined);
    assertEquals(getOperation("linear", "not_a_widget"), undefined);
    // Weather now has current/forecast operations (below), but an unknown weather widget is still undefined.
    assertEquals(getOperation("weather", "not_a_widget"), undefined);
  });

  it("resolves the linear my_issues operation", () => {
    assert(getOperation("linear", "my_issues"), "registered");
  });
});

describe("my_issues buildBody: filter -> IssueFilter (§4.1 table)", () => {
  it("holds the query server-side and always scopes to the projectId", () => {
    const b = bodyFor({ projectId: "p1", filter: "open" });
    assert(b.query.includes("assignedIssues"), "the GraphQL query is server-side, not from the client");
    assertEquals(b.variables.filter.project, { id: { eq: "p1" } });
  });

  it("open -> state.type nin [completed, canceled]", () => {
    assertEquals(bodyFor({ projectId: "p1", filter: "open" }).variables.filter.state, {
      type: { nin: ["completed", "canceled"] },
    });
  });

  it("defaults to open when filter is absent", () => {
    assertEquals(bodyFor({ projectId: "p1" }).variables.filter.state, {
      type: { nin: ["completed", "canceled"] },
    });
  });

  it("in_progress -> state.type eq started", () => {
    assertEquals(bodyFor({ projectId: "p1", filter: "in_progress" }).variables.filter.state, {
      type: { eq: "started" },
    });
  });

  it("all -> no state clause (every assigned issue)", () => {
    assertEquals(bodyFor({ projectId: "p1", filter: "all" }).variables.filter.state, undefined);
  });

  it("an unexpected filter value falls back to open (non-terminal)", () => {
    assertEquals(bodyFor({ projectId: "p1", filter: "bogus" }).variables.filter.state, {
      type: { nin: ["completed", "canceled"] },
    });
  });
});

describe("my_issues normalize: raw -> MyIssuesData (§4.1)", () => {
  it("maps viewer.assignedIssues.nodes to MyIssue[] + totalCount", () => {
    const raw = {
      data: {
        viewer: {
          assignedIssues: {
            nodes: [
              {
                id: "i1",
                identifier: "AOD-1",
                title: "One",
                url: "https://linear.app/x/issue/AOD-1",
                priority: 2,
                priorityLabel: "High",
                dueDate: "2026-07-01",
                state: { name: "In Progress", type: "started" },
                project: { id: "p1", name: "Platform" },
              },
            ],
          },
        },
      },
    };
    const data = myIssues().normalize(raw) as MyIssuesData;
    assertEquals(data.totalCount, 1);
    assertEquals(data.issues[0], {
      id: "i1",
      identifier: "AOD-1",
      title: "One",
      url: "https://linear.app/x/issue/AOD-1",
      stateName: "In Progress",
      stateType: "started",
      priority: 2,
      priorityLabel: "High",
      dueDate: "2026-07-01",
    });
  });

  it("is defensive: a missing viewer / empty response yields an empty list, not a throw", () => {
    assertEquals(myIssues().normalize({ data: {} }), { issues: [], totalCount: 0 });
    assertEquals(myIssues().normalize({}), { issues: [], totalCount: 0 });
    assertEquals(myIssues().normalize({ errors: [{ message: "bad" }] }), { issues: [], totalCount: 0 });
  });

  it("defaults a null dueDate and a missing priority to 0", () => {
    const raw = {
      data: {
        viewer: {
          assignedIssues: {
            nodes: [
              { id: "i2", identifier: "AOD-2", title: "Two", url: "u2", priorityLabel: "No priority", state: { name: "Todo", type: "unstarted" } },
            ],
          },
        },
      },
    };
    const data = myIssues().normalize(raw) as MyIssuesData;
    assertEquals(data.issues[0].dueDate, null);
    assertEquals(data.issues[0].priority, 0);
    assertEquals(data.issues[0].stateType, "unstarted");
  });
});

const currentCycle = () => {
  const op = getOperation("linear", "current_cycle");
  assert(op, "linear current_cycle operation is registered");
  return op;
};

describe("current_cycle buildBody + normalize (§4.2)", () => {
  it("buildBody holds the query server-side and passes the teamId variable", () => {
    const b = currentCycle().buildBody!({ teamId: "t1" }) as { query: string; variables: { teamId: string } };
    assert(b.query.includes("activeCycle"), "the GraphQL query is server-side");
    assertEquals(b.variables.teamId, "t1");
  });

  it("normalize maps an active cycle, taking the last element of each count history", () => {
    const raw = {
      data: {
        team: {
          activeCycle: {
            number: 1,
            name: null,
            startsAt: "2026-06-22",
            endsAt: "2026-06-29",
            progress: 0.5,
            issueCountHistory: [3, 5, 8],
            completedIssueCountHistory: [1, 2, 4],
          },
        },
      },
    };
    const data = currentCycle().normalize(raw) as Extract<CurrentCycleData, { active: true }>;
    assertEquals(data.active, true);
    assertEquals(data.number, 1);
    assertEquals(data.totalCount, 8); // last(issueCountHistory)
    assertEquals(data.completedCount, 4); // last(completedIssueCountHistory)
    assertEquals(data.progress, 0.5);
    assertEquals(data.endsAt, "2026-06-29");
  });

  it("normalize returns active:false when the team has no active cycle (a normal state)", () => {
    assertEquals(currentCycle().normalize({ data: { team: { activeCycle: null } } }), { active: false });
    assertEquals(currentCycle().normalize({ data: {} }), { active: false });
    assertEquals(currentCycle().normalize({}), { active: false });
  });
});

// --- Google Calendar (integration-calendar.md §4, §6.2): the first REST operations ----------------

const calOp = (widget: string) => {
  const op = getOperation("google_calendar", widget);
  assert(op, `google_calendar ${widget} operation is registered`);
  return op;
};

describe("google_calendar buildQuery: server-built, time-derived, calendarId is a path token (§6.2)", () => {
  it("next_event: singleEvents + orderBy=startTime + maxResults=1, timeMin ~now, no timeMax", () => {
    const q = calOp("next_event").buildQuery!({ calendarId: "me@example.com" });
    assertEquals(q.singleEvents, true);
    assertEquals(q.orderBy, "startTime");
    assertEquals(q.maxResults, 1);
    assertEquals(q.timeMax, undefined);
    const t = new Date(q.timeMin as string).getTime();
    assert(Number.isFinite(t), "timeMin is a parseable RFC3339 instant");
    assert(Math.abs(Date.now() - t) < 5000, "timeMin is derived at call time (~now)");
  });

  it("agenda: adds a coarse ~36h timeMax window and maxResults=10", () => {
    const q = calOp("agenda").buildQuery!({ calendarId: "me@example.com" });
    assertEquals(q.singleEvents, true);
    assertEquals(q.orderBy, "startTime");
    assertEquals(q.maxResults, 10);
    const min = new Date(q.timeMin as string).getTime();
    const max = new Date(q.timeMax as string).getTime();
    const hours = (max - min) / 3_600_000;
    assert(Math.abs(hours - 36) < 0.01, `agenda window is ~36h (got ${hours}h)`);
  });

  it("timeMin is DERIVED, not cache-keyed: the query shape is params-independent and calendarId-free", () => {
    // The proxy hashes body.params (here { calendarId }); buildQuery builds the time bound from `now`,
    // never from params, and never echoes calendarId into the query (it is a path token, §6.3c). So the
    // params-hash stays stable across polls while timeMin floats with the clock and never enters the key.
    const ka = Object.keys(calOp("next_event").buildQuery!({ calendarId: "a" })).sort();
    const kb = Object.keys(calOp("next_event").buildQuery!({ calendarId: "b", filter: "x" })).sort();
    assertEquals(ka, kb); // identical query shape regardless of params
    assertEquals(ka.includes("calendarId"), false); // calendarId travels as a path token, not the query
    assert(ka.includes("timeMin"), "timeMin is in the provider query, but not in the params the proxy keys on");
  });
});

describe("google_calendar normalize: events.list -> NextEventData / AgendaData (§4, §12)", () => {
  const TIMED = {
    id: "e1",
    summary: "Standup",
    location: "Zoom",
    htmlLink: "https://calendar.google.com/e1",
    start: { dateTime: "2026-06-26T14:00:00-05:00" },
    end: { dateTime: "2026-06-26T14:30:00-05:00" },
  };
  const ALL_DAY = {
    id: "e2",
    summary: "Holiday",
    htmlLink: "https://calendar.google.com/e2",
    start: { date: "2026-06-27" },
    end: { date: "2026-06-28" },
  };

  it("next_event maps items[0] to a timed CalendarEvent (allDay false, absolute dateTime carried)", () => {
    const d = calOp("next_event").normalize({ items: [TIMED] }) as Extract<NextEventData, { hasEvent: true }>;
    assertEquals(d.hasEvent, true);
    assertEquals(d.event, {
      id: "e1",
      summary: "Standup",
      location: "Zoom",
      start: "2026-06-26T14:00:00-05:00",
      end: "2026-06-26T14:30:00-05:00",
      allDay: false,
      htmlLink: "https://calendar.google.com/e1",
    });
  });

  it("next_event derives allDay from start.date (no dateTime) and defaults a missing location to null", () => {
    const d = calOp("next_event").normalize({ items: [ALL_DAY] }) as Extract<NextEventData, { hasEvent: true }>;
    assertEquals(d.event.allDay, true);
    assertEquals(d.event.start, "2026-06-27");
    assertEquals(d.event.end, "2026-06-28");
    assertEquals(d.event.location, null);
  });

  it("next_event returns hasEvent:false on an empty window or a missing items array (a normal state)", () => {
    assertEquals(calOp("next_event").normalize({ items: [] }), { hasEvent: false });
    assertEquals(calOp("next_event").normalize({}), { hasEvent: false });
    assertEquals(calOp("next_event").normalize({ summary: "ignored" }), { hasEvent: false });
  });

  it("agenda maps every item to CalendarEvent[], preserving Google's start-ascending order", () => {
    const d = calOp("agenda").normalize({ items: [TIMED, ALL_DAY] }) as AgendaData;
    assertEquals(d.events.length, 2);
    assertEquals(d.events[0].id, "e1");
    assertEquals(d.events[0].allDay, false);
    assertEquals(d.events[1].id, "e2");
    assertEquals(d.events[1].allDay, true);
  });

  it("agenda returns an empty array for an empty/absent items list (nothing left today)", () => {
    assertEquals(calOp("agenda").normalize({ items: [] }), { events: [] });
    assertEquals(calOp("agenda").normalize({}), { events: [] });
  });

  it("normalizes an untitled event to summary '' (Google omits summary on a no-title event)", () => {
    const raw = { items: [{ id: "e3", start: { dateTime: "2026-06-26T10:00:00-05:00" }, end: { dateTime: "2026-06-26T10:15:00-05:00" } }] };
    const d = calOp("next_event").normalize(raw) as Extract<NextEventData, { hasEvent: true }>;
    assertEquals(d.event.summary, "");
    assertEquals(d.event.allDay, false);
  });
});

// --- Weather (integration-weather.md §4, §6.1): the first platform_key REST operations, no path token --

const weatherOp = (widget: string) => {
  const op = getOperation("weather", widget);
  assert(op, `weather ${widget} operation is registered`);
  return op;
};

// A real /v1/forecast body (current + daily), verified against the live keyless API on 2026-06-27
// (integration-weather.md §12). The daily block is the COLUMNAR parallel-array shape normalize zips.
const FORECAST_BODY = {
  latitude: -0.17574693,
  longitude: -78.486755,
  timezone: "America/Guayaquil",
  utc_offset_seconds: -18000,
  current_units: {
    time: "iso8601", interval: "seconds", temperature_2m: "°C", relative_humidity_2m: "%",
    apparent_temperature: "°C", is_day: "", weather_code: "wmo code", wind_speed_10m: "km/h",
    wind_direction_10m: "°",
  },
  current: {
    time: "2026-06-27T21:45", interval: 900, temperature_2m: 10.3, relative_humidity_2m: 83,
    apparent_temperature: 9.0, is_day: 0, weather_code: 3, wind_speed_10m: 4.4, wind_direction_10m: 210,
  },
  daily_units: {
    time: "iso8601", weather_code: "wmo code", temperature_2m_max: "°C", temperature_2m_min: "°C",
    precipitation_probability_max: "%", sunrise: "iso8601", sunset: "iso8601",
  },
  daily: {
    time: ["2026-06-27", "2026-06-28", "2026-06-29"],
    weather_code: [51, 3, 80], // drizzle, cloudy (overcast), showers
    temperature_2m_max: [17.4, 17.6, 18.3],
    temperature_2m_min: [9.1, 9.7, 9.7],
    precipitation_probability_max: [16, 2, 4],
    sunrise: ["2026-06-27T06:13", "2026-06-28T06:13", "2026-06-29T06:14"],
    sunset: ["2026-06-27T18:20", "2026-06-28T18:20", "2026-06-29T18:20"],
  },
};

const QUITO = { latitude: -0.1807, longitude: -78.4678, timezone: "America/Guayaquil", name: "Quito, Ecuador" };

describe("weather buildQuery: location (from params) + static selectors, no path token (§6.1)", () => {
  it("current: carries the seeded location + the static current= selector, never the daily block", () => {
    const q = weatherOp("current").buildQuery!(QUITO);
    assertEquals(q.latitude, -0.1807);
    assertEquals(q.longitude, -78.4678);
    assertEquals(q.timezone, "America/Guayaquil");
    assert(typeof q.current === "string" && q.current.includes("temperature_2m"), "static current selector");
    assert((q.current as string).includes("weather_code"), "weather_code is requested");
    assertEquals(q.daily, undefined);
    assertEquals(q.forecast_days, undefined);
  });

  it("forecast: carries the location + the static daily= selector + a fixed 7-day horizon, no current", () => {
    const q = weatherOp("forecast").buildQuery!(QUITO);
    assertEquals(q.latitude, -0.1807);
    assert(typeof q.daily === "string" && q.daily.includes("temperature_2m_max"), "static daily selector");
    assert((q.daily as string).includes("precipitation_probability_max"), "precip is requested");
    assertEquals(q.forecast_days, 7);
    assertEquals(q.current, undefined);
  });

  it("defaults timezone to 'auto' when the connection omitted it, and never forwards the display name", () => {
    const q = weatherOp("current").buildQuery!({ latitude: 1, longitude: 2 });
    assertEquals(q.timezone, "auto");
    assertEquals(q.name, undefined); // `name` is display-only; it is not a provider query param (§6.1)
  });

  it("the selector is static; only the location varies with params (so the location keys the cache, §6.3)", () => {
    const a = weatherOp("current").buildQuery!({ latitude: 1, longitude: 2, timezone: "auto" });
    const b = weatherOp("current").buildQuery!({ latitude: 9, longitude: 8, timezone: "auto" });
    assertEquals(a.current, b.current); // identical static selector regardless of location
    assert(a.latitude !== b.latitude, "the location is what differs between the two queries");
  });
});

describe("weather normalize current: current{}+current_units{} -> CurrentWeatherData (§4.1, §12)", () => {
  it("maps the scalars, the WMO condition, is_day, and echoes the unit strings", () => {
    const d = weatherOp("current").normalize(FORECAST_BODY) as CurrentWeatherData;
    assertEquals(d.observedAt, "2026-06-27T21:45");
    assertEquals(d.temperature, 10.3);
    assertEquals(d.apparentTemperature, 9.0);
    assertEquals(d.humidityPct, 83);
    assertEquals(d.windSpeed, 4.4);
    assertEquals(d.windDirectionDeg, 210);
    assertEquals(d.condition, { code: 3, label: "Overcast", group: "cloudy", isDay: false }); // is_day 0
    assertEquals(d.units, { temperature: "°C", windSpeed: "km/h", humidity: "%" });
  });

  it("maps is_day 1 to isDay true (the daytime icon)", () => {
    const raw = { current: { time: "2026-06-27T12:00", is_day: 1, weather_code: 0, temperature_2m: 21 } };
    const d = weatherOp("current").normalize(raw) as CurrentWeatherData;
    assertEquals(d.condition, { code: 0, label: "Clear sky", group: "clear", isDay: true });
  });

  it("is defensive: a missing current block defaults rather than throwing (no empty state, §4.1)", () => {
    const d = weatherOp("current").normalize({}) as CurrentWeatherData;
    assertEquals(d.temperature, 0);
    assertEquals(d.observedAt, "");
    assertEquals(d.condition.group, "cloudy"); // unknown code -> neutral bucket
    assertEquals(d.condition.code, -1);
    assertEquals(d.units, { temperature: "°C", windSpeed: "km/h", humidity: "%" }); // metric v1 defaults
  });
});

describe("weather normalize forecast: columnar daily[] -> ForecastDay[] (the zip is the value-add, §4.2)", () => {
  it("zips the parallel arrays into index-aligned rows, today first, all using the day icon", () => {
    const d = weatherOp("forecast").normalize(FORECAST_BODY) as ForecastData;
    assertEquals(d.days.length, 3);
    assertEquals(d.days[0], {
      date: "2026-06-27",
      condition: { code: 51, label: "Light drizzle", group: "drizzle", isDay: true },
      tempMax: 17.4,
      tempMin: 9.1,
      precipProbabilityPct: 16,
      sunrise: "2026-06-27T06:13",
      sunset: "2026-06-27T18:20",
    });
    assertEquals(d.days[1].condition.group, "cloudy"); // code 3
    assertEquals(d.days[2].condition.group, "showers"); // code 80
    assert(d.days.every((day) => day.condition.isDay === true), "forecast days use the daytime icon");
    assertEquals(d.units, { temperature: "°C" });
  });

  it("maps representative WMO codes to the right groups (§4.0/§12)", () => {
    const groupFor = (code: number) =>
      (weatherOp("forecast").normalize({ daily: { time: ["2026-06-27"], weather_code: [code] } }) as ForecastData)
        .days[0].condition.group;
    assertEquals(groupFor(0), "clear");
    assertEquals(groupFor(2), "cloudy");
    assertEquals(groupFor(48), "fog");
    assertEquals(groupFor(53), "drizzle");
    assertEquals(groupFor(65), "rain");
    assertEquals(groupFor(75), "snow");
    assertEquals(groupFor(81), "showers");
    assertEquals(groupFor(86), "snow"); // snow showers bucket to snow (§12)
    assertEquals(groupFor(99), "thunderstorm");
  });

  it("is defensive: a missing daily block yields days: [] (the host shows an empty card, never a crash)", () => {
    assertEquals(weatherOp("forecast").normalize({}), { days: [], units: { temperature: "°C" } });
    assertEquals(weatherOp("forecast").normalize({ daily: { time: "not-an-array" } }), {
      days: [],
      units: { temperature: "°C" },
    });
  });

  it("is defensive over a ragged response: a short/absent column degrades only its own cell", () => {
    // time has 2 days; weather_code has 1; precipitation is absent entirely. Anchored on time, the
    // second row still renders with a neutral condition and a null precip, never a throw (§4.2).
    const d = weatherOp("forecast").normalize({
      daily: {
        time: ["2026-06-27", "2026-06-28"],
        weather_code: [3],
        temperature_2m_max: [17.4, 17.6],
      },
    }) as ForecastData;
    assertEquals(d.days.length, 2);
    assertEquals(d.days[0].condition.group, "cloudy");
    assertEquals(d.days[1].condition, { code: -1, label: "Unknown", group: "cloudy", isDay: true });
    assertEquals(d.days[1].precipProbabilityPct, null);
    assertEquals(d.days[1].tempMin, 0); // absent column cell -> numeric default
    assertEquals(d.days[1].sunrise, "");
  });
});
