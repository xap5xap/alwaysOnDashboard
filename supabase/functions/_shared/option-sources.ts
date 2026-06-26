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

export const OPTION_SOURCE_REGISTRY: OptionSourceRegistry = {
  // App-shell walking-skeleton stub (AOD-53), mirroring the client `stub` service. A STATIC source:
  // no provider, no secret. Remove or replace when real provider-backed sources land in PS-M3.
  stub: {
    stub_options: () => Promise.resolve(STUB_OPTION_CHOICES),
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
