// Pure unit coverage for the widget-operation registry (integration-linear.md §6). No stack: the
// registry is code; buildBody is a pure config -> GraphQL body map; normalize is a pure raw -> payload
// map. The Linear my_issues filter table (§4.1) and the MyIssuesData normalization are pinned here.

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import {
  type AgendaData,
  type CurrentCycleData,
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
  it("returns undefined for a service/widget with no operation (REST/stub keep pass-through)", () => {
    assertEquals(getOperation("weather", "current"), undefined);
    assertEquals(getOperation("stub", "placeholder"), undefined);
    assertEquals(getOperation("linear", "not_a_widget"), undefined);
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
