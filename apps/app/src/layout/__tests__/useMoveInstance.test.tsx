// The cross-sky move mutation (AOD-146, Many Skies §1d): re-parents ONE widget_instances row to another sky
// client-direct under RLS, optimistically dropping it from the CURRENT sky's cache and invalidating the
// DESTINATION sky's read cache on success, rolling back on failure. The repo + auth are mocked; this proves
// (1) the card leaves the current sky's cache BEFORE the network resolves (true optimism), the re-parent
// targets the right id + destination, and the destination sky is invalidated afterwards so it re-reads WITH
// the moved card, and (2) a failed move restores the exact pre-move cache (order preserved), rethrows so the
// caller can react, and never invalidates the destination. The follow (setActive to the neighbour sky) is the
// caller's edge-hold concern (Dashboard), not this hook's, so it is not exercised here.
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WidgetInstance } from '../../registry/types';
import type { LoadedDashboard } from '../dashboardRepo';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../dashboardRepo', () => ({ moveInstanceToDashboard: jest.fn() }));

import { moveInstanceToDashboard } from '../dashboardRepo';
import { useMoveInstance } from '../useMoveInstance';
import { dashboardQueryKey } from '../useDashboard';
import { skyQueryKey } from '../useSkyInstances';

const instance = (id: string): WidgetInstance => ({
  instanceId: id,
  serviceId: 'clock',
  widgetType: 'clock',
  config: {},
  size: 'W',
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
});

function seededClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData<LoadedDashboard>(dashboardQueryKey('u1'), {
    dashboardId: 'dash-1',
    name: 'Wall',
    instances: [instance('a'), instance('b')],
  });
  return client;
}

const idsInCache = (client: QueryClient) =>
  (client.getQueryData<LoadedDashboard>(dashboardQueryKey('u1'))?.instances ?? []).map((i) => i.instanceId);

function renderMove(client: QueryClient) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMoveInstance(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  (moveInstanceToDashboard as jest.Mock).mockResolvedValue(undefined);
});

describe('useMoveInstance', () => {
  it('drops the card from the current sky before the move resolves (optimistic), re-parents by id, and invalidates BOTH the source and destination skies', async () => {
    // A deferred move so we can observe the cache mid-flight.
    let resolveMove!: () => void;
    (moveInstanceToDashboard as jest.Mock).mockReturnValue(new Promise<void>((res) => (resolveMove = res)));

    const client = seededClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderMove(client);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.moveInstance('a', 'd-dest');
    });

    // The card is already gone from THIS sky though the network call has NOT resolved; 'b' survives untouched.
    expect(idsInCache(client)).toEqual(['b']);
    expect(moveInstanceToDashboard).toHaveBeenCalledWith('a', 'd-dest');
    // The destination is invalidated only AFTER the write resolves, never during the optimistic phase.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: skyQueryKey('u1', 'd-dest') });

    await act(async () => {
      resolveMove();
      await pending;
    });

    // Still gone here (it moved away); the destination sky's read cache is invalidated so it re-reads with it.
    expect(idsInCache(client)).toEqual(['b']);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: skyQueryKey('u1', 'd-dest') });
    // AND the SOURCE sky ('dash-1') is invalidated too, so its ['sky'] read cache doesn't ghost the moved card
    // (the pager keeps every page mounted at staleTime:Infinity — without this the card duplicates across skies).
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: skyQueryKey('u1', 'dash-1') });
    expect(result.current.error).toBeNull();
  });

  it('rolls the card back into the current sky (order preserved), rethrows, and never invalidates the destination on failure', async () => {
    (moveInstanceToDashboard as jest.Mock).mockRejectedValue(new Error('rls denied'));
    const client = seededClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderMove(client);

    await act(async () => {
      await expect(result.current.moveInstance('a', 'd-dest')).rejects.toThrow('rls denied');
    });

    // Restored exactly: the moved card is back on this sky, in its original position, and the failed move
    // never touched the destination sky's cache.
    expect(idsInCache(client)).toEqual(['a', 'b']);
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: skyQueryKey('u1', 'd-dest') });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: skyQueryKey('u1', 'dash-1') }); // no source invalidate either — the move never happened
    await waitFor(() => expect(result.current.error?.message).toBe('rls denied'));
  });

  // AOD-197 (Pass B2): a cross-sky move while holding portrait drops from the PORTRAIT active-sky cache
  // instantly (so the surface repaints without a rotate) and reconciles the OTHER orientation; the per-sky
  // read caches are still invalidated so neither sky ghosts the moved card.
  it('in portrait: drops from the PORTRAIT cache optimistically, invalidates the other (landscape) orientation, and still invalidates the destination + source skies', async () => {
    let resolveMove!: () => void;
    (moveInstanceToDashboard as jest.Mock).mockReturnValue(new Promise<void>((res) => (resolveMove = res)));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const seed = () =>
      ({ dashboardId: 'dash-1', name: 'Wall', instances: [instance('a'), instance('b')] }) as LoadedDashboard;
    client.setQueryData<LoadedDashboard>(dashboardQueryKey('u1', 'landscape'), seed());
    client.setQueryData<LoadedDashboard>(dashboardQueryKey('u1', 'portrait'), seed());
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMoveInstance('portrait'), { wrapper });

    const idsIn = (o: 'landscape' | 'portrait') =>
      (client.getQueryData<LoadedDashboard>(dashboardQueryKey('u1', o))?.instances ?? []).map((i) => i.instanceId);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.moveInstance('a', 'd-dest');
    });

    // Optimism hits ONLY the portrait cache; landscape is untouched until the reconcile below.
    expect(idsIn('portrait')).toEqual(['b']);
    expect(idsIn('landscape')).toEqual(['a', 'b']);

    await act(async () => {
      resolveMove();
      await pending;
    });

    expect(idsIn('portrait')).toEqual(['b']);
    // The OTHER orientation (landscape) active-sky cache is invalidated (exact) so it drops the card too.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardQueryKey('u1', 'landscape'), exact: true });
    // The destination + source per-sky read caches are still invalidated (unchanged behavior).
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: skyQueryKey('u1', 'd-dest') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: skyQueryKey('u1', 'dash-1') });
    expect(result.current.error).toBeNull();
  });
});
