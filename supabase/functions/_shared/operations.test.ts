// Pure unit coverage for the widget-operation registry (integration-linear.md §6). No stack: the
// registry is code; buildBody is a pure config -> GraphQL body map; normalize is a pure raw -> payload
// map. The Linear my_issues filter table (§4.1) and the MyIssuesData normalization are pinned here.

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { type CurrentCycleData, getOperation, type MyIssuesData } from "./operations.ts";

const myIssues = () => {
  const op = getOperation("linear", "my_issues");
  assert(op, "linear my_issues operation is registered");
  return op;
};

function bodyFor(params: Record<string, unknown>) {
  return myIssues().buildBody(params) as {
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
    const b = currentCycle().buildBody({ teamId: "t1" }) as { query: string; variables: { teamId: string } };
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
