// The server-side per-widget operation registry (AOD-8 §5.2, integration-linear.md §6, refined for
// REST by integration-calendar.md §6.3). A sibling to BACKEND_REGISTRY (registry.ts) and
// OPTION_SOURCE_REGISTRY (option-sources.ts), keyed by serviceId + widgetType. Server-side ONLY,
// never shipped to the client.
//
// It holds what a normalized widget data path needs that the registry's endpoint allow-list does not,
// all OPTIONAL except normalize so each service supplies only what its transport requires:
//   1. buildBody  - the provider request BODY (a GraphQL POST). For Linear this is the held
//      { query, variables }; the client never supplies a query (AOD-8 §5.2). A REST GET omits it.
//   2. buildQuery - the provider URL QUERY built server-side (a REST GET). For Calendar this is the
//      time-derived timeMin/timeMax/singleEvents/orderBy, computed at call time so `now` never enters
//      the cache key (integration-calendar.md §6.2). A GraphQL service omits it and the proxy passes
//      the merged config/params through as the query, exactly as before.
//   3. normalize  - the raw-provider -> normalized-payload mapping the renderer receives (AOD-8 §6.1),
//      so the proxy caches small clean payloads (AOD-5: normalized data only). Required.
//
// Services with no operation (the stub, Weather's pass-through) keep the proxy's pass-through query and
// raw body. This seam is additive and backward compatible: one generic lookup in the proxy
// (proxy/handler.ts), no per-service engine edits (integration-linear.md §6.3, integration-calendar.md §6.3).

export interface WidgetOperation {
  /** Build the provider request BODY (a GraphQL POST). Optional: a REST GET carries no body (§6.3a). */
  buildBody?(params: Record<string, unknown>): unknown; // Linear: { query, variables }
  /** Build the provider URL QUERY server-side (a REST GET). Optional: GraphQL services build a body. */
  buildQuery?(params: Record<string, unknown>): Record<string, unknown>; // Calendar: timeMin/timeMax/... (§6.2)
  /** Map the raw provider response to the normalized payload the renderer receives (AOD-8 §6.1). */
  normalize(raw: unknown): unknown;
}

export type WidgetOperationRegistry = Record<string, Record<string, WidgetOperation>>;

// ---------------------------------------------------------------------------------------------------
// Linear: My Issues (integration-linear.md §4.1). The PS-M3 flagship widget.
// ---------------------------------------------------------------------------------------------------

// Held server-side, keyed by widget type; the client never sees it (AOD-8 §5.2). Verified against the
// live Linear API on 2026-06-26 (integration-linear.md §12): scalar `priority` (0..4) + `priorityLabel`
// string, `state { name type }`, `project { id name }`.
const MY_ISSUES_QUERY = `query MyIssues($filter: IssueFilter) {
  viewer {
    assignedIssues(first: 50, filter: $filter, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        url
        priority
        priorityLabel
        dueDate
        state { name type }
        project { id name }
      }
    }
  }
}`;

/** The config `filter` enum -> the IssueFilter `state` clause (integration-linear.md §4.1 table). */
function toIssueFilter(projectId: string | undefined, filter: string): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  // projectId is required (§5.1); when present always scope to it by the stable project id.
  if (projectId) f.project = { id: { eq: projectId } };
  if (filter === "in_progress") {
    f.state = { type: { eq: "started" } };
  } else if (filter === "all") {
    // no state clause: every assigned issue, any state.
  } else {
    // "open" (default) and any unexpected value: all non-terminal assigned issues.
    f.state = { type: { nin: ["completed", "canceled"] } };
  }
  return f;
}

function buildMyIssuesBody(params: Record<string, unknown>): unknown {
  const projectId = typeof params.projectId === "string" ? params.projectId : undefined;
  const filter = typeof params.filter === "string" ? params.filter : "open";
  return { query: MY_ISSUES_QUERY, variables: { filter: toIssueFilter(projectId, filter) } };
}

/** One normalized assigned issue the renderer receives (integration-linear.md §4.1 MyIssue). */
export interface MyIssue {
  id: string;
  identifier: string; // "AOD-53"
  title: string;
  url: string; // deep link into Linear
  stateName: string; // "In Progress"
  stateType: string; // a WorkflowState.type value, for grouping/color
  priority: number; // 0 none, 1 urgent, 2 high, 3 medium, 4 low
  priorityLabel: string; // "High"
  dueDate: string | null; // ISO date or null
}

export interface MyIssuesData {
  issues: MyIssue[];
  totalCount: number;
}

/** The raw `state { name type }` shape Linear returns on an issue node. */
interface RawWorkflowState {
  name?: unknown;
  type?: unknown;
}
interface RawIssueNode {
  id?: unknown;
  identifier?: unknown;
  title?: unknown;
  url?: unknown;
  priority?: unknown;
  priorityLabel?: unknown;
  dueDate?: unknown;
  state?: RawWorkflowState | null;
}

/**
 * Map `data.viewer.assignedIssues.nodes` to MyIssuesData. Defensive against a partial response (a
 * GraphQL error returns HTTP 200 with `errors` and no `viewer`): a missing path yields an empty list
 * rather than throwing, so the host shows an empty card, never a crash.
 */
function normalizeMyIssues(raw: unknown): MyIssuesData {
  const nodes = (raw as { data?: { viewer?: { assignedIssues?: { nodes?: unknown } } } })
    ?.data?.viewer?.assignedIssues?.nodes;
  const list: RawIssueNode[] = Array.isArray(nodes) ? nodes : [];
  const issues: MyIssue[] = list.map((n) => ({
    id: typeof n?.id === "string" ? n.id : "",
    identifier: typeof n?.identifier === "string" ? n.identifier : "",
    title: typeof n?.title === "string" ? n.title : "",
    url: typeof n?.url === "string" ? n.url : "",
    stateName: typeof n?.state?.name === "string" ? n.state.name : "",
    stateType: typeof n?.state?.type === "string" ? n.state.type : "",
    priority: typeof n?.priority === "number" ? n.priority : 0,
    priorityLabel: typeof n?.priorityLabel === "string" ? n.priorityLabel : "",
    dueDate: typeof n?.dueDate === "string" ? n.dueDate : null,
  }));
  return { issues, totalCount: issues.length };
}

// ---------------------------------------------------------------------------------------------------
// Linear: Current Cycle (integration-linear.md §4.2). The fast-follow widget; registration once the
// seam exists. The widget tracks the chosen team's LIVE active cycle (the user picks the team, §5.2).
// ---------------------------------------------------------------------------------------------------

const CURRENT_CYCLE_QUERY = `query CurrentCycle($teamId: String!) {
  team(id: $teamId) {
    id
    name
    activeCycle {
      id
      number
      name
      startsAt
      endsAt
      progress
      issueCountHistory
      completedIssueCountHistory
    }
  }
}`;

function buildCurrentCycleBody(params: Record<string, unknown>): unknown {
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  return { query: CURRENT_CYCLE_QUERY, variables: { teamId } };
}

/**
 * The normalized active-cycle payload (integration-linear.md §4.2). `active: false` is a normal,
 * data-bearing state (the team has no active cycle right now), not an error or needs-config.
 */
export type CurrentCycleData =
  | { active: false }
  | {
    active: true;
    number: number;
    name: string | null;
    startsAt: string; // ISO
    endsAt: string; // ISO
    progress: number; // 0..1, drives the ring
    completedCount: number; // last(completedIssueCountHistory)
    totalCount: number; // last(issueCountHistory)
  };

/** Last element of a Linear count-history array (the current value), or 0 if absent (§4.2). */
function lastCount(history: unknown): number {
  if (!Array.isArray(history) || history.length === 0) return 0;
  const last = Number(history[history.length - 1]);
  return Number.isFinite(last) ? last : 0;
}

interface RawActiveCycle {
  number?: unknown;
  name?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  progress?: unknown;
  issueCountHistory?: unknown;
  completedIssueCountHistory?: unknown;
}

/** Map `data.team.activeCycle` to CurrentCycleData; a null active cycle is the `active: false` state. */
function normalizeCurrentCycle(raw: unknown): CurrentCycleData {
  const cycle = (raw as { data?: { team?: { activeCycle?: RawActiveCycle | null } } })
    ?.data?.team?.activeCycle;
  if (!cycle) return { active: false };
  return {
    active: true,
    number: typeof cycle.number === "number" ? cycle.number : 0,
    name: typeof cycle.name === "string" ? cycle.name : null,
    startsAt: typeof cycle.startsAt === "string" ? cycle.startsAt : "",
    endsAt: typeof cycle.endsAt === "string" ? cycle.endsAt : "",
    progress: typeof cycle.progress === "number" ? cycle.progress : 0,
    completedCount: lastCount(cycle.completedIssueCountHistory),
    totalCount: lastCount(cycle.issueCountHistory),
  };
}

// ---------------------------------------------------------------------------------------------------
// Google Calendar: Next Event + Today's Agenda (integration-calendar.md §4, §6.2). The first REST
// operations on the refined seam: a server-built, time-derived buildQuery (no buildBody, a GET carries
// no body) plus a normalize over a shared CalendarEvent. The {calendarId} is a PATH token (§6.3c), not
// a query param, so it is deliberately absent from buildQuery's output.
// ---------------------------------------------------------------------------------------------------

// orderBy=startTime REQUIRES singleEvents=true (it expands recurring series into concrete instances);
// verified 2026-06-26 (integration-calendar.md §12). Shared by both widgets' queries.
const EVENTS_BASE = { singleEvents: true, orderBy: "startTime" } as const;
// A coarse server-side look-ahead for the agenda. The precise "today" boundary is a render concern
// (the device clock + timezone, integration-calendar.md §4.2), so the server stays timezone-free and
// the cache key stays stable. A configurable horizon is a named seam (§10), not a v1 need.
const AGENDA_HORIZON_MS = 36 * 60 * 60 * 1000;

/**
 * Next Event query (§4.1): the current-or-next single event. timeMin=now is Google's lower bound
 * (exclusive) on an event's END time, so an event already in progress is included and, ordered by
 * start time, sorts first; maxResults=1 returns the current-or-next. `now` is read at call time so it
 * never enters the cache key (the proxy hashes body.params = { calendarId }; §6.2).
 */
function buildNextEventQuery(_params: Record<string, unknown>): Record<string, unknown> {
  return { ...EVENTS_BASE, timeMin: new Date().toISOString(), maxResults: 1 };
}

/** Today's Agenda query (§4.2): a coarse now -> now+~36h window; the renderer scopes "today" on-device. */
function buildAgendaQuery(_params: Record<string, unknown>): Record<string, unknown> {
  const now = new Date();
  return {
    ...EVENTS_BASE,
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + AGENDA_HORIZON_MS).toISOString(),
    maxResults: 10,
  };
}

/** One normalized calendar event the renderers receive (integration-calendar.md §4). */
export interface CalendarEvent {
  id: string;
  summary: string; // event title; "" when Google omits it (an untitled event)
  location: string | null; // free-form text or null
  start: string; // ISO: the dateTime (timed) or the date "YYYY-MM-DD" (all-day)
  end: string; // ISO: the dateTime or the date
  allDay: boolean; // true when Google used start.date (no dateTime)
  htmlLink: string; // deep link into the Google Calendar web UI
}

/** `hasEvent: false` is a normal empty-window state (§4.1), not an error or needs-config. */
export type NextEventData =
  | { hasEvent: false }
  | { hasEvent: true; event: CalendarEvent };

/** An empty `events` array is the normal "nothing left today" state (§4.2). */
export interface AgendaData {
  events: CalendarEvent[];
}

/** The raw start/end object Google returns: `date` (all-day) XOR `dateTime` (timed) (§12). */
interface RawEventDate {
  date?: unknown;
  dateTime?: unknown;
}
interface RawEvent {
  id?: unknown;
  summary?: unknown;
  location?: unknown;
  htmlLink?: unknown;
  start?: RawEventDate | null;
  end?: RawEventDate | null;
}

/**
 * Map one raw events.list item to a CalendarEvent. allDay is derived from the shape Google returns: an
 * all-day event carries start.date ("YYYY-MM-DD") and no dateTime; a timed event carries start.dateTime
 * (RFC3339). start/end carry whichever was present as an absolute string, so the renderer formats
 * relative times against the device clock without another fetch (integration-calendar.md §4, §12).
 */
function toCalendarEvent(raw: RawEvent): CalendarEvent {
  const startDateTime = typeof raw.start?.dateTime === "string" ? raw.start.dateTime : null;
  const startDate = typeof raw.start?.date === "string" ? raw.start.date : null;
  const endDateTime = typeof raw.end?.dateTime === "string" ? raw.end.dateTime : null;
  const endDate = typeof raw.end?.date === "string" ? raw.end.date : null;
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    location: typeof raw.location === "string" ? raw.location : null,
    start: startDateTime ?? startDate ?? "",
    end: endDateTime ?? endDate ?? "",
    allDay: startDateTime == null && startDate != null,
    htmlLink: typeof raw.htmlLink === "string" ? raw.htmlLink : "",
  };
}

/** Pull the items[] array from an events.list body, defensive against a missing array (§6.2). */
function eventItems(raw: unknown): RawEvent[] {
  const items = (raw as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as RawEvent[]) : [];
}

/** items[0] -> the current-or-next event, else hasEvent:false (a normal empty-window state, §4.1). */
function normalizeNextEvent(raw: unknown): NextEventData {
  const items = eventItems(raw);
  if (items.length === 0) return { hasEvent: false };
  return { hasEvent: true, event: toCalendarEvent(items[0]) };
}

/** items -> CalendarEvent[]; an empty array is the normal "nothing left today" state (§4.2). */
function normalizeAgenda(raw: unknown): AgendaData {
  return { events: eventItems(raw).map(toCalendarEvent) };
}

// ---------------------------------------------------------------------------------------------------
// Weather: Current + Forecast (integration-weather.md §4, §6.1). The first platform_key REST operations
// and the first with NO path token: the location is a query param the host seeds into params from the
// connection config (§6.3), so buildQuery composes it with the per-widget static selectors. normalize
// maps the WMO weather_code to a shared WeatherCondition and zips the columnar daily[] arrays into rows.
// Verified against the live keyless Open-Meteo API on 2026-06-27 (integration-weather.md §12).
// ---------------------------------------------------------------------------------------------------

/** The coarse condition bucket the renderer (AOD-35) maps to an icon, never the ~28 raw WMO codes. */
export type WeatherGroup =
  | "clear"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "showers"
  | "thunderstorm";

/** A WMO weather_code resolved to a renderable condition (integration-weather.md §4.0). */
export interface WeatherCondition {
  code: number; // the raw WMO weather_code, preserved for completeness
  label: string; // human string from the verified WMO map (§12), e.g. "Partly cloudy"
  group: WeatherGroup; // the coarse bucket the renderer maps to an icon
  isDay: boolean; // current: from is_day (1/0); forecast days: true (daytime icon)
}

/** Echoed provider unit strings so the renderer labels values without hard-coding a unit (§4.0). */
export interface WeatherUnits {
  temperature: string; // "°C"
  windSpeed?: string; // "km/h" (Current only)
  humidity?: string; // "%"   (Current only)
}

/** Normalized Current Weather payload the renderer receives (integration-weather.md §4.1). */
export interface CurrentWeatherData {
  observedAt: string; // current.time (local ISO); the connection tz gives the offset
  condition: WeatherCondition;
  temperature: number;
  apparentTemperature: number;
  humidityPct: number;
  windSpeed: number;
  windDirectionDeg: number; // 0-360
  units: WeatherUnits;
}

/** One normalized forecast day (integration-weather.md §4.2), zipped from the columnar daily arrays. */
export interface ForecastDay {
  date: string; // daily.time[i] ("YYYY-MM-DD")
  condition: WeatherCondition; // from daily.weather_code[i]; isDay true (day icon)
  tempMax: number;
  tempMin: number;
  precipProbabilityPct: number | null; // daily.precipitation_probability_max[i] (null if absent)
  sunrise: string; // local ISO
  sunset: string; // local ISO
}

export interface ForecastData {
  days: ForecastDay[]; // forecast_days entries, today first, index-aligned from the columnar arrays
  units: WeatherUnits; // echoed from daily_units (temperature)
}

// The per-widget static selectors: which Open-Meteo blocks each widget requests. Held server-side so the
// client never carries Open-Meteo's field vocabulary (the operation seam's purpose, §6.4).
const CURRENT_FIELDS =
  "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m";
const DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset";
const FORECAST_DAYS = 7;

// The verified WMO weather_code interpretation (integration-weather.md §4.0 / §12): code -> human label
// + the coarse group the renderer maps to an icon. The group buckets follow the spec exactly (1/2/3 are
// `cloudy`). An unknown code degrades to a neutral `cloudy` bucket, never a throw.
const WMO_BY_CODE: Record<number, { label: string; group: WeatherGroup }> = {
  0: { label: "Clear sky", group: "clear" },
  1: { label: "Mainly clear", group: "cloudy" },
  2: { label: "Partly cloudy", group: "cloudy" },
  3: { label: "Overcast", group: "cloudy" },
  45: { label: "Fog", group: "fog" },
  48: { label: "Depositing rime fog", group: "fog" },
  51: { label: "Light drizzle", group: "drizzle" },
  53: { label: "Moderate drizzle", group: "drizzle" },
  55: { label: "Dense drizzle", group: "drizzle" },
  56: { label: "Light freezing drizzle", group: "drizzle" },
  57: { label: "Dense freezing drizzle", group: "drizzle" },
  61: { label: "Slight rain", group: "rain" },
  63: { label: "Moderate rain", group: "rain" },
  65: { label: "Heavy rain", group: "rain" },
  66: { label: "Light freezing rain", group: "rain" },
  67: { label: "Heavy freezing rain", group: "rain" },
  71: { label: "Slight snowfall", group: "snow" },
  73: { label: "Moderate snowfall", group: "snow" },
  75: { label: "Heavy snowfall", group: "snow" },
  77: { label: "Snow grains", group: "snow" },
  80: { label: "Slight rain showers", group: "showers" },
  81: { label: "Moderate rain showers", group: "showers" },
  82: { label: "Violent rain showers", group: "showers" },
  85: { label: "Slight snow showers", group: "snow" },
  86: { label: "Heavy snow showers", group: "snow" },
  95: { label: "Thunderstorm", group: "thunderstorm" },
  96: { label: "Thunderstorm with slight hail", group: "thunderstorm" },
  99: { label: "Thunderstorm with heavy hail", group: "thunderstorm" },
};

/** A finite number from an unknown, else the fallback (defensive against a partial provider body). */
function wNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** A finite number or null (for an optional field like precipitation probability, §4.2). */
function wNumOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A string from an unknown, else "" (defensive against a missing ISO field). */
function wStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Map a raw weather_code + day flag to a WeatherCondition; an unknown code degrades, never throws. */
function toCondition(code: unknown, isDay: boolean): WeatherCondition {
  const c = typeof code === "number" && Number.isFinite(code) ? code : -1;
  const entry = WMO_BY_CODE[c] ?? { label: "Unknown", group: "cloudy" as WeatherGroup };
  return { code: c, label: entry.label, group: entry.group, isDay };
}

/**
 * The connection location, delivered into params by the platform_key host seeding (§6.3): latitude /
 * longitude (required) + timezone (IANA name or "auto"). The display-only `name` is NOT forwarded to the
 * provider. The per-widget selectors are added below; they never enter params or the cache key (§6.3).
 */
function locationQuery(params: Record<string, unknown>): Record<string, unknown> {
  return {
    latitude: params.latitude,
    longitude: params.longitude,
    timezone: params.timezone ?? "auto",
  };
}

/** Current Weather query (§4.1): the location + the static `current=` selector. */
function buildCurrentQuery(params: Record<string, unknown>): Record<string, unknown> {
  return { ...locationQuery(params), current: CURRENT_FIELDS };
}

/** Forecast query (§4.2): the location + the static `daily=` selector + a fixed 7-day horizon. */
function buildForecastQuery(params: Record<string, unknown>): Record<string, unknown> {
  return { ...locationQuery(params), daily: DAILY_FIELDS, forecast_days: FORECAST_DAYS };
}

/** The raw current{} block Open-Meteo returns (integration-weather.md §12). */
interface RawCurrent {
  time?: unknown;
  is_day?: unknown;
  weather_code?: unknown;
  temperature_2m?: unknown;
  apparent_temperature?: unknown;
  relative_humidity_2m?: unknown;
  wind_speed_10m?: unknown;
  wind_direction_10m?: unknown;
}

/**
 * current{} + current_units{} -> CurrentWeatherData (§4.1). A connected location always has current
 * conditions, so there is no empty state; a missing field defaults (never throws). Units echo the
 * provider's strings, defaulting to the metric v1 units when absent.
 */
function normalizeCurrent(raw: unknown): CurrentWeatherData {
  const body = (raw ?? {}) as { current?: RawCurrent | null; current_units?: Record<string, unknown> | null };
  const c = body.current ?? {};
  const u = body.current_units ?? {};
  return {
    observedAt: wStr(c.time),
    condition: toCondition(c.weather_code, wNum(c.is_day) === 1),
    temperature: wNum(c.temperature_2m),
    apparentTemperature: wNum(c.apparent_temperature),
    humidityPct: wNum(c.relative_humidity_2m),
    windSpeed: wNum(c.wind_speed_10m),
    windDirectionDeg: wNum(c.wind_direction_10m),
    units: {
      temperature: typeof u.temperature_2m === "string" ? u.temperature_2m : "°C",
      windSpeed: typeof u.wind_speed_10m === "string" ? u.wind_speed_10m : "km/h",
      humidity: typeof u.relative_humidity_2m === "string" ? u.relative_humidity_2m : "%",
    },
  };
}

/** A columnar daily array by key, or [] if absent. The zip below is index-aligned on daily.time (§4.2). */
function dailyColumn(daily: Record<string, unknown> | null | undefined, key: string): unknown[] {
  const col = daily?.[key];
  return Array.isArray(col) ? col : [];
}

/**
 * daily{} columns -> ForecastData (§4.2): the columnar parallel arrays are zipped into ForecastDay rows.
 * Anchored on daily.time (the row count), so a missing daily.time yields days: []; a short or ragged
 * column degrades only its own cell (the host shows an empty/partial card, never a crash), the way
 * Calendar's and Linear's normalizers guard their inputs.
 */
function normalizeForecast(raw: unknown): ForecastData {
  const body = (raw ?? {}) as { daily?: Record<string, unknown> | null; daily_units?: Record<string, unknown> | null };
  const daily = body.daily ?? {};
  const u = body.daily_units ?? {};
  const times = dailyColumn(daily, "time");
  const codes = dailyColumn(daily, "weather_code");
  const maxes = dailyColumn(daily, "temperature_2m_max");
  const mins = dailyColumn(daily, "temperature_2m_min");
  const precips = dailyColumn(daily, "precipitation_probability_max");
  const sunrises = dailyColumn(daily, "sunrise");
  const sunsets = dailyColumn(daily, "sunset");
  const days: ForecastDay[] = times.map((t, i) => ({
    date: wStr(t),
    condition: toCondition(codes[i], true), // forecast days use the daytime icon (§4.0)
    tempMax: wNum(maxes[i]),
    tempMin: wNum(mins[i]),
    precipProbabilityPct: wNumOrNull(precips[i]),
    sunrise: wStr(sunrises[i]),
    sunset: wStr(sunsets[i]),
  }));
  return {
    days,
    units: { temperature: typeof u.temperature_2m_max === "string" ? u.temperature_2m_max : "°C" },
  };
}

// ---------------------------------------------------------------------------------------------------
// Claude usage: Spend MTD + Daily Spend Sparkline (integration-claude.md §4, §6.1). The first admin_key
// REST operations and the first credentialed, org-wide service. Both widgets read the SAME Cost Report
// (/v1/organizations/cost_report) over a shared, TIME-DERIVED month-to-date window, so they share one
// buildQuery and differ only in normalize (a single MTD sum vs the daily series). No buildBody (a GET),
// no path token (the window is a query param, §6.2). The Cost Report's `amount` is a decimal string in
// MINOR units (cents): "123.45" in USD is $1.23, so the normalizers sum in cents and divide by 100 (the
// single load-bearing conversion, §4.0a / §12). Defensive against a missing data[]/results[] (amount 0 /
// days []). Doc-verified 2026-06-28 (no live Admin key at build); re-verify live and update spec §12.
// ---------------------------------------------------------------------------------------------------

/** One day's normalized spend (integration-claude.md §4.0a). The shared element both widgets reduce. */
export interface DailyCost {
  date: string; // the bucket's calendar day, "YYYY-MM-DD" (UTC; the API snaps buckets to UTC day starts)
  amount: number; // that day's total spend in MAJOR units (USD dollars): sum of results[].amount, / 100
}

/** Normalized Spend MTD payload (integration-claude.md §4.1): the month-to-date headline glance. */
export interface SpendMtdData {
  amount: number; // month-to-date total spend, major units (sum of all buckets' results, / 100)
  currency: string; // "USD" (echoed from results[].currency)
  windowStart: string; // the MTD window start, "YYYY-MM-DD" (1st of the current UTC month)
  asOf: string; // the last covered day, "YYYY-MM-DD" (today, UTC)
  daysElapsed: number; // count of daily buckets covered, so the renderer can derive a run-rate/projection
}

/** Normalized Daily Spend payload (integration-claude.md §4.2): the daily series for the sparkline. */
export interface DailySpendData {
  days: DailyCost[]; // one entry per daily bucket, oldest-first (month-to-date)
  currency: string; // "USD" (echoed from results[].currency)
  total: number; // convenience: sum of days[].amount; equals SpendMtdData.amount over the same window
}

/** First of `now`'s UTC month at 00:00:00Z: the MTD window anchor (integration-claude.md §6.1). */
function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** A Date -> "YYYY-MM-DD" in UTC (the API's native day bucketing). */
function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** An RFC-3339 bucket timestamp ("2025-08-01T00:00:00Z") -> its UTC calendar day "YYYY-MM-DD", else "". */
function ymdFromIso(v: unknown): string {
  return typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : "";
}

/**
 * The month-to-date Cost Report query (integration-claude.md §6.1). The window is TIME-DERIVED (it
 * depends on `now`), so like Calendar's timeMin it is computed at call time and never enters the cache
 * key: the proxy hashes body.params, which is EMPTY for these zero-config widgets (§5.1), so the key is
 * the stable empty params and the window is recomputed each fetch. starting_at is the 1st of the current
 * UTC month at 00:00:00Z; ending_at is now; bucket_width=1d (the only granularity the Cost Report
 * supports); limit=31 covers a whole month in one page (a month has <=31 daily buckets, §7).
 */
function buildCostMtdQuery(_params: Record<string, unknown>): Record<string, unknown> {
  const now = new Date();
  return {
    starting_at: monthStartUtc(now).toISOString(),
    ending_at: now.toISOString(),
    bucket_width: "1d",
    limit: 31,
  };
}

/** A daily Cost Report bucket: `starting_at` (the UTC day) + `results[]` (one total per day, no group_by). */
interface RawCostBucket {
  starting_at?: unknown;
  ending_at?: unknown;
  results?: unknown;
}
/** A Cost Report result line: `amount` is a decimal string in MINOR units (cents), `currency` a string. */
interface RawCostResult {
  amount?: unknown;
  currency?: unknown;
}

/** Pull the data[] daily buckets from a cost_report body, defensive against a missing array (§4.0a). */
function costBuckets(raw: unknown): RawCostBucket[] {
  const data = (raw as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as RawCostBucket[]) : [];
}

/** Pull a bucket's results[] line items, defensive against a missing array. */
function bucketResults(bucket: RawCostBucket): RawCostResult[] {
  return Array.isArray(bucket.results) ? (bucket.results as RawCostResult[]) : [];
}

/**
 * Parse an `amount` to MINOR units (cents) as a number. The Cost Report sends a decimal STRING in cents
 * ("123.78912"); a non-numeric or absent value degrades to 0 (a missing line is no spend, never a throw).
 * The caller divides the cents SUM by 100 once for major units (§4.0a: sum in minor units, then / 100).
 */
function amountCents(amount: unknown): number {
  const n = typeof amount === "string" || typeof amount === "number" ? parseFloat(String(amount)) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** Sum one bucket's results[].amount in cents, and surface the last non-empty currency seen. */
function sumBucketCents(bucket: RawCostBucket): { cents: number; currency: string | null } {
  let cents = 0;
  let currency: string | null = null;
  for (const r of bucketResults(bucket)) {
    cents += amountCents(r.amount);
    if (typeof r.currency === "string" && r.currency) currency = r.currency;
  }
  return { cents, currency };
}

/**
 * Sum ALL buckets' results[].amount (cents) and divide by 100 for the MTD dollar total (§4.1). With no
 * group_by each daily bucket carries a single org-wide total result, so this is the org's month-to-date
 * spend. The window anchors are derived from `now` (mirroring buildCostMtdQuery) so they hold even for a
 * zero-bucket month (a new org with no spend yet -> amount 0, daysElapsed 0, a valid figure, not empty).
 */
function normalizeSpendMtd(raw: unknown): SpendMtdData {
  const buckets = costBuckets(raw);
  let totalCents = 0;
  let currency = "USD";
  for (const b of buckets) {
    const { cents, currency: c } = sumBucketCents(b);
    totalCents += cents;
    if (c) currency = c;
  }
  const now = new Date();
  return {
    amount: totalCents / 100, // cents -> dollars (the single load-bearing conversion, §4.0a / §12)
    currency,
    windowStart: ymdUtc(monthStartUtc(now)),
    asOf: ymdUtc(now),
    daysElapsed: buckets.length,
  };
}

/**
 * Map each daily bucket to a DailyCost row (its results[].amount summed in cents, / 100), oldest-first
 * (§4.2). The series is sorted ascending by the bucket's UTC day so the contract holds regardless of the
 * provider's page order; an empty days[] is the normal "no spend yet this month" state (a flat sparkline),
 * never a crash.
 */
function normalizeDailySpend(raw: unknown): DailySpendData {
  let currency = "USD";
  const days: DailyCost[] = costBuckets(raw).map((b) => {
    const { cents, currency: c } = sumBucketCents(b);
    if (c) currency = c;
    return { date: ymdFromIso(b.starting_at), amount: cents / 100 };
  });
  days.sort((a, b) => a.date.localeCompare(b.date)); // oldest-first, lexicographic == chronological on YYYY-MM-DD
  const total = days.reduce((sum, d) => sum + d.amount, 0);
  return { days, currency, total };
}

// ---------------------------------------------------------------------------------------------------
// The registry + lookup (mirrors getEndpoint / getOptionSource).
// ---------------------------------------------------------------------------------------------------

export const OPERATION_REGISTRY: WidgetOperationRegistry = {
  linear: {
    my_issues: { buildBody: buildMyIssuesBody, normalize: normalizeMyIssues },
    current_cycle: { buildBody: buildCurrentCycleBody, normalize: normalizeCurrentCycle },
  },
  // Google Calendar: REST operations on the refined seam (buildQuery + normalize, no buildBody, §6.2).
  google_calendar: {
    next_event: { buildQuery: buildNextEventQuery, normalize: normalizeNextEvent },
    agenda: { buildQuery: buildAgendaQuery, normalize: normalizeAgenda },
  },
  // Weather: REST operations on the same seam, with ZERO seam edits (integration-weather.md §6, §8).
  // No buildBody (a GET), no path token (the location is a query param the host seeds from the
  // connection config, §6.3); buildQuery composes that location with the per-widget static selectors.
  weather: {
    current: { buildQuery: buildCurrentQuery, normalize: normalizeCurrent },
    forecast: { buildQuery: buildForecastQuery, normalize: normalizeForecast },
  },
  // Claude usage: the first admin_key REST operations, ZERO seam edits (integration-claude.md §6, §8).
  // Both widgets share one time-derived MTD query (buildCostMtdQuery) over the Cost Report and differ
  // only in normalize; no buildBody (a GET), no path token (the window is a query param, §6.2).
  anthropic_usage: {
    spend_mtd: { buildQuery: buildCostMtdQuery, normalize: normalizeSpendMtd },
    daily_spend: { buildQuery: buildCostMtdQuery, normalize: normalizeDailySpend },
  },
};

/** Resolve a widget's server-side operation, or undefined for a pass-through (REST/stub) widget. */
export function getOperation(serviceId: string, widgetType: string): WidgetOperation | undefined {
  return OPERATION_REGISTRY[serviceId]?.[widgetType];
}
