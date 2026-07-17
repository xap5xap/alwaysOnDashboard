// The widget render lifecycle (AOD-10 §7, reconciled to the design's six states in AOD-125; claude-design/
// "Vela - Many Skies" §1c, "Vela - Holding Course"). Pure: a snapshot in, one view state out. The generic
// host (WidgetHost) feeds it the TanStack Query snapshot and renders the result; the widget's own renderer
// is reached only on data-bearing states (§7.3). ProxyError mirrors the AOD-9 §9 typed result; AOD-10
// reacts to it.
//
// AOD-125 — the SIX single-card states from Many Skies §1c ("SIX STATES, ONE TILE"):
//   ghost      — the not-yet-lit tile: an inert, host-drawn placeholder ("an invitation, not a card
//                pretending to be lit"). See the ghost derivation + the DESIGN FLAG below.
//   connecting — the first-fetch skeleton (was `loading`). "skeletons only where nothing has ever lived"
//                (Holding Course): a live tile fetching its first data, nothing cached yet.
//   live       — a fresh render (was `fresh`).
//   stale      — a render past its freshness window; last-known data is still shown, honestly aged.
//   error      — a failed fetch. With last-known data the leaf keeps drawing it under an error mark; with
//                none it falls to the host error placeholder.
//   empty      — a data-bearing fetch whose CONTENT is legitimately empty (AOD-125: promoted from the
//                leaf-drawn EmptyBody to a first-class, host-drawn lifecycle phase). See `isEmpty` below.
// Plus two ACTION-STATES that sit alongside the six (they drive a user prompt, not a data view):
//   needs_config  — the render-time config check failed (§4.4): a Reconfigure prompt.
//   disconnected  — a broken sign-in (409 needs_reconnect / reauth_required): a Connect prompt. This is
//                   Holding Course's "reconnecting a broken service", the credential-died case — distinct
//                   from `ghost` (see the DESIGN FLAG).
import type { ConnectionStatus } from '../registry/types';

export type ProxyError =
  | { kind: 'rate_limited'; retryAfterSeconds?: number } // 429
  | { kind: 'provider_unavailable' } // 5xx / timeout
  | { kind: 'needs_reconnect' }; // 409: credential dead / no connection

// The six design states (Many Skies §1c) + the two action-states. `ghost`, `connecting` and `empty` are
// HOST-DRAWN (no leaf); `live`, `stale` and error-with-data reach the leaf renderer (§7.3, invokesRenderer).
export type WidgetViewState =
  | { phase: 'ghost' } // NEW (AOD-125): the not-yet-lit placeholder; host-drawn, no leaf, no data
  | { phase: 'connecting' } // was 'loading': the first-fetch skeleton
  | { phase: 'live'; data: unknown; fetchedAt: number } // was 'fresh'
  | { phase: 'stale'; data: unknown; fetchedAt: number }
  | { phase: 'error'; error: ProxyError; data?: unknown; fetchedAt?: number }
  | { phase: 'empty'; data: unknown; fetchedAt: number } // NEW (AOD-125): first-class, host-drawn empty
  | { phase: 'needs_config' } // action-state
  | { phase: 'disconnected'; status: ConnectionStatus }; // action-state

/**
 * AOD-10 §7.3 / AOD-125: the leaf renderer is invoked only when there is real data to draw. `connecting`,
 * `empty` and `ghost` are host-drawn (a skeleton, the shared EmptyBody, and the not-yet-lit placeholder),
 * so they NEVER reach the leaf — which is why a leaf no longer needs to self-draw its own "nothing" state.
 */
export function invokesRenderer(s: WidgetViewState): boolean {
  return (
    s.phase === 'live' ||
    s.phase === 'stale' ||
    (s.phase === 'error' && s.data !== undefined)
  );
}

/** A successful proxy fetch result the host caches as last-known data. */
export interface ProxyResult {
  data: unknown;
  fetchedAt: number; // epoch ms
}

// The host's snapshot of one instance's fetch, mapped from TanStack Query state plus the §4.4 render-time
// config membership re-check. `idle` (AOD-125) is the not-yet-lit case: the query is enabled but its first
// fetch has not begun (TanStack fetchStatus 'idle' with no data) — the trigger for the `ghost` state.
export type WidgetQuerySnapshot =
  | { status: 'idle' } // NEW (AOD-125): first fetch not begun / not-yet-initialized -> ghost
  | { status: 'pending' } // fetching the first data (nothing cached) -> connecting
  | { status: 'success'; data: unknown; fetchedAt: number }
  | { status: 'error'; error: ProxyError; lastData?: ProxyResult };

/**
 * Map a snapshot to a view state (AOD-10 §7.2, AOD-125). Freshness is "now - fetchedAt < staleAfterSeconds";
 * pass Infinity for a "manual" widget so it never auto-stales (§6.6). needs_config short-circuits before the
 * data lifecycle because there is no valid request to make (§4.4). An `idle` snapshot yields `ghost` (the
 * not-yet-lit tile). A 409 needs_reconnect maps to `disconnected` (the reauth_required form). Other typed
 * errors keep last-known data on screen if present, otherwise fall to the host error placeholder.
 *
 * AOD-125 empty promotion: `isEmpty` is the per-widget emptiness predicate (WidgetDefinition.isEmpty). When
 * a successful fetch's content is empty it yields the host-drawn `empty` phase, which SUPERSEDES live/stale
 * — the freshness of "nothing" is not shown. An error's empty last-known data is NOT handed back to the leaf
 * (which no longer self-draws empty); it falls to the data-less error placeholder instead.
 *
 * DESIGN FLAG (AOD-125, ghost trigger). Many Skies §1c draws the ghost as "GHOST — NOT CONNECTED", a dim
 * transparent tile with a Connect action. In THIS codebase the host reacts to the proxy's 409 for the
 * connected<->disconnected flip and deliberately does NOT read the connection map for the lifecycle
 * (useConnections.ts / AOD-47; the whole test corpus drives cards to life through the fetch with an EMPTY
 * connection map). So the literal "not connected" tile is surfaced by the 409 -> `disconnected` action-state
 * (Holding Course's "reconnecting a broken service"), and `ghost` is taken as the OTHER reading the AOD-125
 * brief offers: the not-yet-lit / not-yet-initialized tile (an enabled query whose first fetch has not
 * begun). This keeps deriveViewState pure and off the connection map. It is rare at runtime (queries
 * auto-fetch), and is primarily the explicit state the future Add-a-card preview passes to show an unlit
 * tile (Many Skies v2: "an unconnected card sits on the sky as the dim ghost it would be").
 */
export function deriveViewState(input: {
  needsConfig: boolean;
  query: WidgetQuerySnapshot;
  staleAfterSeconds: number;
  now: number;
  /** The per-widget emptiness predicate (WidgetDefinition.isEmpty); absent = the widget is never empty. */
  isEmpty?: (data: unknown, now: number) => boolean;
}): WidgetViewState {
  if (input.needsConfig) return { phase: 'needs_config' };

  const q = input.query;
  if (q.status === 'idle') return { phase: 'ghost' }; // not yet lit
  if (q.status === 'pending') return { phase: 'connecting' }; // first-fetch skeleton

  if (q.status === 'success') {
    // §5.1 empty promotion: an empty payload is the host-drawn `empty` phase, not the leaf. Empty supersedes
    // fresh/stale — a card with nothing to show has no meaningful age.
    if (input.isEmpty?.(q.data, input.now)) {
      return { phase: 'empty', data: q.data, fetchedAt: q.fetchedAt };
    }
    const isStale = input.now - q.fetchedAt >= input.staleAfterSeconds * 1000;
    return isStale
      ? { phase: 'stale', data: q.data, fetchedAt: q.fetchedAt }
      : { phase: 'live', data: q.data, fetchedAt: q.fetchedAt };
  }

  // q.status === 'error'
  if (q.error.kind === 'needs_reconnect') {
    return { phase: 'disconnected', status: 'reauth_required' };
  }
  if (q.lastData) {
    // Keep last-known data under an error mark — UNLESS it is empty: the leaf no longer self-draws empty, so
    // empty last-known data falls to the data-less error placeholder rather than being handed to the leaf.
    if (input.isEmpty?.(q.lastData.data, input.now)) {
      return { phase: 'error', error: q.error };
    }
    return { phase: 'error', error: q.error, data: q.lastData.data, fetchedAt: q.lastData.fetchedAt };
  }
  return { phase: 'error', error: q.error };
}
