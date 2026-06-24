// The widget render lifecycle (AOD-10 §7). Pure: a snapshot in, one view state out. The generic
// host (WidgetHost) feeds it the TanStack Query snapshot and renders the result; the widget's own
// renderer is reached only on data-bearing states (§7.3). ProxyError mirrors the AOD-9 §9 typed
// result; AOD-10 reacts to it.
import type { ConnectionStatus } from '../registry/types';

export type ProxyError =
  | { kind: 'rate_limited'; retryAfterSeconds?: number } // 429
  | { kind: 'provider_unavailable' } // 5xx / timeout
  | { kind: 'needs_reconnect' }; // 409: credential dead / no connection

// AOD-10 §7.1 the five required states plus needs_config (§4.4).
export type WidgetViewState =
  | { phase: 'loading' }
  | { phase: 'fresh'; data: unknown; fetchedAt: number }
  | { phase: 'stale'; data: unknown; fetchedAt: number }
  | { phase: 'error'; error: ProxyError; data?: unknown; fetchedAt?: number }
  | { phase: 'needs_config' }
  | { phase: 'disconnected'; status: ConnectionStatus };

/** AOD-10 §7.3: the renderer is invoked only when there is data to draw. */
export function invokesRenderer(s: WidgetViewState): boolean {
  return (
    s.phase === 'fresh' ||
    s.phase === 'stale' ||
    (s.phase === 'error' && s.data !== undefined)
  );
}

/** A successful proxy fetch result the host caches as last-known data. */
export interface ProxyResult {
  data: unknown;
  fetchedAt: number; // epoch ms
}

// The host's snapshot of one instance's fetch, mapped from TanStack Query state plus the §4.4
// render-time config membership re-check.
export type WidgetQuerySnapshot =
  | { status: 'pending' }
  | { status: 'success'; data: unknown; fetchedAt: number }
  | { status: 'error'; error: ProxyError; lastData?: ProxyResult };

/**
 * Map a snapshot to a view state (AOD-10 §7.2). Freshness is "now - fetchedAt < staleAfterSeconds";
 * pass Infinity for a "manual" widget so it never auto-stales (§6.6). needs_config short-circuits
 * before the data lifecycle because there is no valid request to make (§4.4). A 409 needs_reconnect
 * maps to disconnected (the steady-state reauth_required form). Other typed errors keep last-known
 * data on screen if present, otherwise fall to the host error placeholder.
 */
export function deriveViewState(input: {
  needsConfig: boolean;
  query: WidgetQuerySnapshot;
  staleAfterSeconds: number;
  now: number;
}): WidgetViewState {
  if (input.needsConfig) return { phase: 'needs_config' };

  const q = input.query;
  if (q.status === 'pending') return { phase: 'loading' };

  if (q.status === 'success') {
    const isStale = input.now - q.fetchedAt >= input.staleAfterSeconds * 1000;
    return isStale
      ? { phase: 'stale', data: q.data, fetchedAt: q.fetchedAt }
      : { phase: 'fresh', data: q.data, fetchedAt: q.fetchedAt };
  }

  // q.status === 'error'
  if (q.error.kind === 'needs_reconnect') {
    return { phase: 'disconnected', status: 'reauth_required' };
  }
  if (q.lastData) {
    return { phase: 'error', error: q.error, data: q.lastData.data, fetchedAt: q.lastData.fetchedAt };
  }
  return { phase: 'error', error: q.error };
}
