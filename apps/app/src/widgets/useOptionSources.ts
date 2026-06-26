// The client-side remote-options resolver (AOD-10 §4.3). For each remote-options field in a schema
// it runs one query through the WidgetDataSource seam (the config-options Edge Function) and returns
// per-field state plus the ready choice sets keyed by field key. Generic over the registry: it reads
// only the schema's RemoteOptionsSource ids, never a service. Used by the config form (to render the
// picker and feed validateConfig membership) and by the host (the render-time membership re-check,
// §4.2 rule 2 / §4.4). One TanStack query per field, keyed by service + option source + params, so
// the form and the host share one cache entry and the provider is hit at most once per TTL (§6.1).
import { useQueries } from '@tanstack/react-query';
import { useWidgetDataSource } from '../host/WidgetDataSource';
import type { Choice, WidgetConfigField, WidgetConfigSchema } from '../registry/types';
import type { ProxyError } from './lifecycle';

export type ResolvedOptionsState =
  | { status: 'loading' }
  | { status: 'ready'; choices: Choice[] }
  | { status: 'error'; retry: () => void } // a typed provider error: offer a retry affordance
  | { status: 'needs_reconnect'; retry: () => void }; // 409: the credential died, route to reconnect

export interface OptionSourcesResult {
  /** Per-field resolution state, keyed by field key. Only remote-options fields appear. */
  byField: Record<string, ResolvedOptionsState>;
  /** The ready choice sets keyed by field key, for validateConfig membership (AOD-10 §4.2). */
  resolved: Record<string, Choice[]>;
  /** True while any remote-options field is still loading (first resolve). */
  isLoading: boolean;
}

interface RemoteField {
  key: string;
  optionSource: string;
  params: Record<string, unknown>;
}

function remoteOptionFields(schema: WidgetConfigSchema): RemoteField[] {
  return schema.fields
    .filter((f): f is Extract<WidgetConfigField, { kind: 'remote-options' }> => f.kind === 'remote-options')
    .map((f) => ({ key: f.key, optionSource: f.source.optionSource, params: f.source.params ?? {} }));
}

/** Stable JSON for the query key so {a,b} and {b,a} hash equal (mirrors the proxy requestKey, §6.3). */
function stableParams(params: Record<string, unknown>): string {
  return JSON.stringify(params, Object.keys(params).sort());
}

export function useOptionSources(
  schema: WidgetConfigSchema,
  serviceId: string,
  opts?: { enabled?: boolean; staleTime?: number },
): OptionSourcesResult {
  const dataSource = useWidgetDataSource();
  const fields = remoteOptionFields(schema);
  const enabled = opts?.enabled ?? true;

  const results = useQueries({
    queries: fields.map((field) => ({
      queryKey: ['option-source', serviceId, field.optionSource, stableParams(field.params)],
      queryFn: () =>
        dataSource.resolveOptions({ serviceId, optionSource: field.optionSource, params: field.params }),
      enabled,
      // Ride the cache (§4.3 step 3 / §6.1): the host re-check and the form reuse one resolution per TTL.
      staleTime: opts?.staleTime ?? 5 * 60 * 1000,
      // Do not retry a dead credential (409); a transient provider error is retried a couple of times.
      retry: (count: number, error: unknown) =>
        (error as ProxyError | null)?.kind !== 'needs_reconnect' && count < 2,
    })),
  });

  const byField: Record<string, ResolvedOptionsState> = {};
  const resolved: Record<string, Choice[]> = {};
  let isLoading = false;

  fields.forEach((field, i) => {
    const q = results[i];
    const retry = () => {
      void q.refetch();
    };
    let state: ResolvedOptionsState;
    if (q.isSuccess) {
      state = { status: 'ready', choices: q.data };
      resolved[field.key] = q.data;
    } else if (q.isError) {
      const err = q.error as unknown as ProxyError | null;
      state = err?.kind === 'needs_reconnect' ? { status: 'needs_reconnect', retry } : { status: 'error', retry };
    } else {
      state = { status: 'loading' };
      isLoading = true;
    }
    byField[field.key] = state;
  });

  return { byField, resolved, isLoading };
}
