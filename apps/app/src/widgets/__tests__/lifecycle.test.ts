// AOD-10 §7 / AOD-125 lifecycle mapping units (testing-strategy.md §4.1 / §9 pure half). Reconciled to the
// design's six states (Many Skies §1c): ghost / connecting / live / stale / error / empty, plus the
// needs_config + disconnected action-states.
import { deriveViewState, invokesRenderer } from '../lifecycle';

const NOW = 1_000_000;

describe('deriveViewState (AOD-10 §7.2, AOD-125 six states)', () => {
  it('ghost: an idle query (first fetch not begun) is the not-yet-lit tile (AOD-125)', () => {
    expect(deriveViewState({ needsConfig: false, query: { status: 'idle' }, staleAfterSeconds: 300, now: NOW })).toEqual({ phase: 'ghost' });
  });

  it('connecting: a pending query with no data (was `loading`)', () => {
    expect(deriveViewState({ needsConfig: false, query: { status: 'pending' }, staleAfterSeconds: 300, now: NOW })).toEqual({ phase: 'connecting' });
  });

  it('live: a success within the freshness window (was `fresh`)', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW - 10_000 }, staleAfterSeconds: 300, now: NOW });
    expect(s).toEqual({ phase: 'live', data: { x: 1 }, fetchedAt: NOW - 10_000 });
  });

  it('stale: a success past the freshness window keeps the last data', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW - 400_000 }, staleAfterSeconds: 300, now: NOW });
    expect(s.phase).toBe('stale');
  });

  it('manual never auto-stales (staleAfterSeconds = Infinity)', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW - 10_000_000 }, staleAfterSeconds: Infinity, now: NOW });
    expect(s.phase).toBe('live');
  });

  it('empty: a success whose content is empty (per isEmpty) is the host-drawn empty phase (AOD-125)', () => {
    const s = deriveViewState({
      needsConfig: false,
      query: { status: 'success', data: { items: [] }, fetchedAt: NOW - 10_000 },
      staleAfterSeconds: 300,
      now: NOW,
      isEmpty: (d) => (d as { items: unknown[] }).items.length === 0,
    });
    expect(s).toEqual({ phase: 'empty', data: { items: [] }, fetchedAt: NOW - 10_000 });
  });

  it('empty supersedes stale: an aged-but-empty success is still `empty`, not `stale` (AOD-125)', () => {
    const s = deriveViewState({
      needsConfig: false,
      query: { status: 'success', data: { items: [] }, fetchedAt: NOW - 400_000 }, // well past the window
      staleAfterSeconds: 300,
      now: NOW,
      isEmpty: () => true,
    });
    expect(s.phase).toBe('empty');
  });

  it('non-empty content with a predicate present still resolves live/stale (predicate returns false)', () => {
    const s = deriveViewState({
      needsConfig: false,
      query: { status: 'success', data: { items: [1] }, fetchedAt: NOW - 10_000 },
      staleAfterSeconds: 300,
      now: NOW,
      isEmpty: (d) => (d as { items: unknown[] }).items.length === 0,
    });
    expect(s.phase).toBe('live');
  });

  it('disconnected: a needs_reconnect error (the reauth action-state)', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'error', error: { kind: 'needs_reconnect' } }, staleAfterSeconds: 300, now: NOW });
    expect(s).toEqual({ phase: 'disconnected', status: 'reauth_required' });
  });

  it('error with last-known data retains it (host overlays an error indicator)', () => {
    const s = deriveViewState({
      needsConfig: false,
      query: { status: 'error', error: { kind: 'rate_limited', retryAfterSeconds: 30 }, lastData: { data: { x: 1 }, fetchedAt: NOW - 1000 } },
      staleAfterSeconds: 300,
      now: NOW,
    });
    expect(s.phase).toBe('error');
    expect(s.phase === 'error' && s.data).toEqual({ x: 1 });
  });

  it('error with EMPTY last-known data falls to the data-less placeholder, never the leaf (AOD-125)', () => {
    // The leaf no longer self-draws empty, so empty last-known data must not be handed back to it: the host
    // shows the data-less error prompt (Retry) instead of an empty card behind an error mark.
    const s = deriveViewState({
      needsConfig: false,
      query: { status: 'error', error: { kind: 'provider_unavailable' }, lastData: { data: { items: [] }, fetchedAt: NOW - 1000 } },
      staleAfterSeconds: 300,
      now: NOW,
      isEmpty: (d) => (d as { items: unknown[] }).items.length === 0,
    });
    expect(s).toEqual({ phase: 'error', error: { kind: 'provider_unavailable' } });
  });

  it('error without data routes to the host error placeholder', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'error', error: { kind: 'provider_unavailable' } }, staleAfterSeconds: 300, now: NOW });
    expect(s).toEqual({ phase: 'error', error: { kind: 'provider_unavailable' } });
  });

  it('needs_config short-circuits before the query (§4.4)', () => {
    const s = deriveViewState({ needsConfig: true, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW }, staleAfterSeconds: 300, now: NOW });
    expect(s).toEqual({ phase: 'needs_config' });
  });
});

describe('invokesRenderer (AOD-10 §7.3, AOD-125)', () => {
  it('reaches the widget renderer only on data-bearing states (live / stale / error-with-data)', () => {
    expect(invokesRenderer({ phase: 'live', data: {}, fetchedAt: NOW })).toBe(true);
    expect(invokesRenderer({ phase: 'stale', data: {}, fetchedAt: NOW })).toBe(true);
    expect(invokesRenderer({ phase: 'error', error: { kind: 'provider_unavailable' }, data: {} })).toBe(true);
    expect(invokesRenderer({ phase: 'error', error: { kind: 'provider_unavailable' } })).toBe(false);
    // host-drawn states never reach the leaf
    expect(invokesRenderer({ phase: 'connecting' })).toBe(false);
    expect(invokesRenderer({ phase: 'ghost' })).toBe(false);
    expect(invokesRenderer({ phase: 'empty', data: {}, fetchedAt: NOW })).toBe(false);
    expect(invokesRenderer({ phase: 'needs_config' })).toBe(false);
    expect(invokesRenderer({ phase: 'disconnected', status: 'reauth_required' })).toBe(false);
  });
});
