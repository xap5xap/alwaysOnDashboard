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
};

/** Resolve a widget's server-side operation, or undefined for a pass-through (REST/stub) widget. */
export function getOperation(serviceId: string, widgetType: string): WidgetOperation | undefined {
  return OPERATION_REGISTRY[serviceId]?.[widgetType];
}
