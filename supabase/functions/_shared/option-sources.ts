// The server half of the option-source allow-list (AOD-10 §4.3). A parallel to BACKEND_REGISTRY's
// endpoint allow-list (registry.ts), keyed by ServiceId + optionSource id. Server-side ONLY, never
// shipped to the client (the client names an optionSource id, never a URL or query).
//
// Each option source is a RESOLVER FUNCTION (code, not a table, like the client `render` component):
// it receives a context exposing the static params and a bound provider caller, and returns Choice[].
// A static source (the stub) returns fixed choices and never touches the provider or a secret; a
// provider-backed source (PS-M3: Linear projects, etc.) calls the allow-listed endpoint and maps the
// response. The config-time handler invokes resolvers identically; there is no per-service branch.

import { HttpError } from "./http.ts";
import type { ProviderCaller } from "./connection.ts";
import type { EndpointDef } from "./types.ts";

/** A picker choice. Mirrors the client `Choice` (registry/types.ts); the value is the stable id. */
export type Choice = { value: string; label: string };

export interface OptionSourceContext {
  /** The field's static params (RemoteOptionsSource.params), e.g. a team filter. */
  params: Record<string, unknown>;
  /** Call the allow-listed provider endpoint with the user's secret attached (lazy). Static sources never call it. */
  callProvider: ProviderCaller;
}

export type OptionSourceResolver = (ctx: OptionSourceContext) => Promise<Choice[]>;

export type OptionSourceRegistry = Record<string, Record<string, OptionSourceResolver>>;

/**
 * The fixed choice set the stub option source returns. The stub has no real provider (apiBase
 * stub.invalid), so a STATIC resolver is the only way it can resolve real choices end to end, exactly
 * as the stub exercised host/add/config in AOD-47/51/52. Exported so the deno test asserts the
 * round-trip without faking a provider.
 */
export const STUB_OPTION_CHOICES: Choice[] = [
  { value: "alpha", label: "Alpha Source" },
  { value: "bravo", label: "Bravo Source" },
  { value: "charlie", label: "Charlie Source" },
];

// --- Linear option sources (integration-linear.md §5.3 / §5.4) -----------------------------------
// Direct GraphQL resolvers, not providerBackedSource: the shipped helper maps the field's params to
// URL query params, which fits a REST option source but not GraphQL variables (§5.3 note). The client
// names only the optionSource id; the query and the response mapping live here, server-side. The
// stored value is the stable Linear id (project / team), so a rename never invalidates the instance.

const LINEAR_GRAPHQL: EndpointDef = { method: "POST", path: "/graphql" };

const LINEAR_PROJECTS_QUERY = `query LinearProjects {
  projects(first: 250) {
    nodes { id name }
  }
}`;

const LINEAR_TEAMS_QUERY = `query LinearTeams {
  teams(first: 100) {
    nodes { id name key }
  }
}`;

/** Map a Linear `{ nodes: { id, name } }` connection to Choice[] with the stable id as the value. */
function linearNodesToChoices(nodes: unknown): Choice[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n): n is { id: string; name: string } =>
      typeof (n as { id?: unknown })?.id === "string" && typeof (n as { name?: unknown })?.name === "string"
    )
    .map((n) => ({ value: n.id, label: n.name }));
}

const linear_projects: OptionSourceResolver = async (ctx) => {
  const raw = await ctx.callProvider(LINEAR_GRAPHQL, { body: { query: LINEAR_PROJECTS_QUERY } });
  return linearNodesToChoices((raw as { data?: { projects?: { nodes?: unknown } } })?.data?.projects?.nodes);
};

const linear_teams: OptionSourceResolver = async (ctx) => {
  const raw = await ctx.callProvider(LINEAR_GRAPHQL, { body: { query: LINEAR_TEAMS_QUERY } });
  return linearNodesToChoices((raw as { data?: { teams?: { nodes?: unknown } } })?.data?.teams?.nodes);
};

// --- Google Calendar option source (integration-calendar.md §5.3) --------------------------------
// The FIRST real consumer of the shipped providerBackedSource helper: calendarList.list is a plain REST
// GET with no params and no body (unlike Linear's GraphQL sources, which needed the direct-resolver
// form). The client names only the optionSource id "google_calendars"; the endpoint and the mapping
// live here, server-side. The stored value is the stable calendar id, so a rename never invalidates the
// instance. This endpoint is supplied by the resolver and is NOT in the registry endpoints map (which
// is the widget-data allow-list); option sources carry their own allow-listed endpoint (§5.3).

interface RawCalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
}

/** Map a calendarList.list response to Choice[]: stable id as value, primary first then alphabetical. */
function calendarListToChoices(raw: unknown): Choice[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const label = (c: RawCalendarListEntry) => c.summaryOverride ?? c.summary ?? c.id; // user's custom name, else the calendar name, else the id
  return items
    .filter((c): c is RawCalendarListEntry => typeof (c as { id?: unknown })?.id === "string")
    .sort((a, b) => (b.primary === true ? 1 : 0) - (a.primary === true ? 1 : 0) || label(a).localeCompare(label(b)))
    .map((c) => ({ value: c.id, label: label(c) }));
}

// providerBackedSource calls ctx.callProvider(endpoint, { query: ctx.params, body: undefined }); for
// calendarList.list ctx.params is empty, so it is a clean GET (§5.3). The helper attaches the user's
// secret, maps typed errors, and returns the raw JSON.
const google_calendars: OptionSourceResolver = providerBackedSource(
  { method: "GET", path: "/calendar/v3/users/me/calendarList" },
  calendarListToChoices,
);

export const OPTION_SOURCE_REGISTRY: OptionSourceRegistry = {
  // App-shell walking-skeleton stub (AOD-53), mirroring the client `stub` service. A STATIC source:
  // no provider, no secret. Remove or replace when real provider-backed sources land in PS-M3.
  stub: {
    stub_options: () => Promise.resolve(STUB_OPTION_CHOICES),
  },
  // Linear: provider-backed GraphQL resolvers (§5.3 / §5.4). The projectId / teamId pickers.
  linear: {
    linear_projects,
    linear_teams,
  },
  // Google Calendar: the calendarId picker, the first providerBackedSource consumer (§5.3).
  google_calendar: {
    google_calendars,
  },
};

/** Resolve an allow-listed option source, mirroring getEndpoint() (registry.ts). */
export function getOptionSource(serviceId: string, optionSource: string): OptionSourceResolver {
  const resolver = OPTION_SOURCE_REGISTRY[serviceId]?.[optionSource];
  if (!resolver) {
    throw new HttpError(
      400,
      "unknown_option_source",
      `"${optionSource}" is not an allow-listed option source for "${serviceId}"`,
    );
  }
  return resolver;
}

/**
 * Build a provider-backed resolver (the PS-M3 pattern): call the allow-listed endpoint with the
 * field's params, then map the provider response to Choice[]. The provider call attaches the user's
 * secret and maps typed errors server-side via the bound caller. The client never sees the query.
 */
export function providerBackedSource(
  endpoint: EndpointDef,
  toChoices: (raw: unknown) => Choice[],
  opts?: { body?: unknown },
): OptionSourceResolver {
  return async (ctx) => {
    const raw = await ctx.callProvider(endpoint, { query: ctx.params, body: opts?.body });
    return toChoices(raw);
  };
}
