// The active-sky load + commit hook, keyed PER ORIENTATION (AOD-197, design §6/§9). These lock: the no-arg
// call resolves LANDSCAPE (the wall/default path, byte-identical to pre-AOD-197); an explicit orientation
// resolves + keys THAT orientation; and a commit writes the current orientation optimistically, persists it,
// and on success invalidates the OTHER orientation's cache (targeted, exact) so its derived/stored view
// re-derives from the fresh DB (a resize re-validates it; materialize stamps it). The repo + the active-sky
// store are mocked (this proves the HOOK's wiring, not the DB).
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../dashboardRepo', () => ({
  loadDashboardById: jest.fn(),
  loadDashboard: jest.fn(),
  bootstrapDashboard: jest.fn(),
  persistInstanceLayout: jest.fn(),
}));
jest.mock('../activeDashboardStore', () => ({
  getActiveDashboardId: jest.fn(() => 'd1'),
  setActiveDashboardId: jest.fn(),
}));

import { loadDashboardById, persistInstanceLayout, type LoadedDashboard } from '../dashboardRepo';
import { dashboardQueryKey, useDashboard } from '../useDashboard';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
}

function renderDashboard(orientation?: 'landscape' | 'portrait', client = makeClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => (orientation ? useDashboard(orientation) : useDashboard()), { wrapper }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadDashboardById as jest.Mock).mockImplementation(async (id: string) => ({
    dashboardId: id,
    name: 'Wall',
    instances: [],
  }));
});

describe('useDashboard — orientation-keyed resolution (AOD-197)', () => {
  it('the no-arg call resolves LANDSCAPE and keys the landscape cache (the wall/default path)', async () => {
    const { client, result } = renderDashboard();
    await waitFor(() => expect(result.current.dashboardId).toBe('d1'));
    // Requested landscape, and the resolved board landed under ['dashboard','u1','landscape'].
    expect(loadDashboardById).toHaveBeenCalledWith('d1', 'landscape');
    expect(client.getQueryData(dashboardQueryKey('u1', 'landscape'))).toBeTruthy();
    expect(client.getQueryData(dashboardQueryKey('u1', 'portrait'))).toBeUndefined();
  });

  it('an explicit portrait resolves + keys the SEPARATE portrait cache', async () => {
    const { client, result } = renderDashboard('portrait');
    await waitFor(() => expect(result.current.dashboardId).toBe('d1'));
    expect(loadDashboardById).toHaveBeenCalledWith('d1', 'portrait');
    expect(client.getQueryData(dashboardQueryKey('u1', 'portrait'))).toBeTruthy();
    expect(client.getQueryData(dashboardQueryKey('u1', 'landscape'))).toBeUndefined();
  });
});

describe('useDashboard — commit writes the active orientation + invalidates the other (AOD-197)', () => {
  const seeded: LoadedDashboard = {
    dashboardId: 'd1',
    name: 'Wall',
    instances: [
      { instanceId: 'i1', serviceId: 'clock', widgetType: 'clock', config: {}, rect: { x: 0, y: 0, w: 1, h: 1, z: 0 }, size: 'S' },
    ],
  };

  it('commits portrait: optimistic on the portrait key, persists portrait, invalidates the landscape key (exact)', async () => {
    jest.useFakeTimers();
    try {
      (persistInstanceLayout as jest.Mock).mockResolvedValue(undefined);
      const client = makeClient();
      // Pre-seed the portrait cache so the query is fresh (no queryFn) and the optimistic update has a prev.
      client.setQueryData(dashboardQueryKey('u1', 'portrait'), seeded);
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderDashboard('portrait', client);

      act(() => {
        result.current.commit('i1', { rect: { x: 2, y: 1, w: 1, h: 1, z: 0 }, size: 'S' });
      });

      // Optimistic: the PORTRAIT cache repainted immediately with the new rect.
      const optimistic = client.getQueryData<LoadedDashboard>(dashboardQueryKey('u1', 'portrait'));
      expect(optimistic?.instances[0].rect).toEqual({ x: 2, y: 1, w: 1, h: 1, z: 0 });
      // ...and the landscape cache was NOT written by the optimistic update.
      expect(client.getQueryData(dashboardQueryKey('u1', 'landscape'))).toBeUndefined();

      // Flush the 500ms debounce and the persist promise.
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Durable write carried the orientation.
      expect(persistInstanceLayout).toHaveBeenCalledWith('i1', expect.objectContaining({ size: 'S' }), 'portrait');
      // On success, the OTHER orientation (landscape) is invalidated — targeted + exact — so it re-derives.
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: dashboardQueryKey('u1', 'landscape'),
        exact: true,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('a no-arg (landscape) commit invalidates the PORTRAIT key on success (the symmetric other)', async () => {
    jest.useFakeTimers();
    try {
      (persistInstanceLayout as jest.Mock).mockResolvedValue(undefined);
      const client = makeClient();
      client.setQueryData(dashboardQueryKey('u1', 'landscape'), seeded);
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderDashboard(undefined, client);

      act(() => {
        result.current.commit('i1', { rect: { x: 1, y: 0, w: 1, h: 1, z: 0 }, size: 'S' });
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(persistInstanceLayout).toHaveBeenCalledWith('i1', expect.anything(), 'landscape');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: dashboardQueryKey('u1', 'portrait'),
        exact: true,
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
