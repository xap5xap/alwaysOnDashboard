// The server-side per-widget operation registry (AOD-8 §5.2, integration-linear.md §6). A sibling to
// BACKEND_REGISTRY (registry.ts) and OPTION_SOURCE_REGISTRY (option-sources.ts), keyed by serviceId +
// widgetType. Server-side ONLY, never shipped to the client.
//
// It holds the two things a GraphQL / normalized widget data path needs that the registry's endpoint
// allow-list does not:
//   1. buildBody  - the provider request BODY built server-side from the instance config. For Linear
//      this is the GraphQL { query, variables }; the client never supplies a query (AOD-8 §5.2).
//   2. normalize  - the raw-provider -> normalized-payload mapping the renderer receives (AOD-8 §6.1),
//      so the proxy caches small clean payloads (AOD-5: normalized data only).
//
// REST services (Calendar, Weather) and the stub register NO operation and keep the proxy's current
// pass-through. This seam is additive and backward compatible: one generic lookup in the proxy
// (proxy/handler.ts), no per-service engine edits (integration-linear.md §6.3).

export interface WidgetOperation {
  /** Build the provider request body from the instance config (untrusted params, bounded here). */
  buildBody(params: Record<string, unknown>): unknown; // Linear: { query, variables }
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
// The registry + lookup (mirrors getEndpoint / getOptionSource).
// ---------------------------------------------------------------------------------------------------

export const OPERATION_REGISTRY: WidgetOperationRegistry = {
  linear: {
    my_issues: { buildBody: buildMyIssuesBody, normalize: normalizeMyIssues },
    current_cycle: { buildBody: buildCurrentCycleBody, normalize: normalizeCurrentCycle },
  },
};

/** Resolve a widget's server-side operation, or undefined for a pass-through (REST/stub) widget. */
export function getOperation(serviceId: string, widgetType: string): WidgetOperation | undefined {
  return OPERATION_REGISTRY[serviceId]?.[widgetType];
}
