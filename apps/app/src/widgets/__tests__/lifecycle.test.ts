// AOD-10 §7 lifecycle mapping units (testing-strategy.md §4.1 / §9 pure half).
import { deriveViewState, invokesRenderer } from '../lifecycle';

const NOW = 1_000_000;

describe('deriveViewState (AOD-10 §7.2)', () => {
  it('loading: a pending query with no data', () => {
    expect(deriveViewState({ needsConfig: false, query: { status: 'pending' }, staleAfterSeconds: 300, now: NOW })).toEqual({ phase: 'loading' });
  });

  it('fresh: a success within the freshness window', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW - 10_000 }, staleAfterSeconds: 300, now: NOW });
    expect(s).toEqual({ phase: 'fresh', data: { x: 1 }, fetchedAt: NOW - 10_000 });
  });

  it('stale: a success past the freshness window keeps the last data', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW - 400_000 }, staleAfterSeconds: 300, now: NOW });
    expect(s.phase).toBe('stale');
  });

  it('manual never auto-stales (staleAfterSeconds = Infinity)', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW - 10_000_000 }, staleAfterSeconds: Infinity, now: NOW });
    expect(s.phase).toBe('fresh');
  });

  it('disconnected: a needs_reconnect error', () => {
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

  it('error without data routes to the host error placeholder', () => {
    const s = deriveViewState({ needsConfig: false, query: { status: 'error', error: { kind: 'provider_unavailable' } }, staleAfterSeconds: 300, now: NOW });
    expect(s).toEqual({ phase: 'error', error: { kind: 'provider_unavailable' } });
  });

  it('needs_config short-circuits before the query (§4.4)', () => {
    const s = deriveViewState({ needsConfig: true, query: { status: 'success', data: { x: 1 }, fetchedAt: NOW }, staleAfterSeconds: 300, now: NOW });
    expect(s).toEqual({ phase: 'needs_config' });
  });
});

describe('invokesRenderer (AOD-10 §7.3)', () => {
  it('reaches the widget renderer only on data-bearing states', () => {
    expect(invokesRenderer({ phase: 'fresh', data: {}, fetchedAt: NOW })).toBe(true);
    expect(invokesRenderer({ phase: 'stale', data: {}, fetchedAt: NOW })).toBe(true);
    expect(invokesRenderer({ phase: 'error', error: { kind: 'provider_unavailable' }, data: {} })).toBe(true);
    expect(invokesRenderer({ phase: 'error', error: { kind: 'provider_unavailable' } })).toBe(false);
    expect(invokesRenderer({ phase: 'loading' })).toBe(false);
    expect(invokesRenderer({ phase: 'needs_config' })).toBe(false);
    expect(invokesRenderer({ phase: 'disconnected', status: 'reauth_required' })).toBe(false);
  });
});
