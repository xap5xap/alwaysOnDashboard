// The remove-widget mutation (AOD-141, resolves AOD-104): deletes ONE widget_instances row client-direct
// under RLS, optimistically dropping it from the dashboard query cache so the tile vanishes at once, and
// rolling back on failure. The repo + auth are mocked; this proves (1) the tile is gone from the cache
// BEFORE the network resolves (true optimism) and the delete targets the right id, (2) a failed delete
// restores the exact pre-delete cache (order preserved) and rethrows so the caller can react. The other
// instances and the service connection are never touched — removing a card is not a disconnect.
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WidgetInstance } from '../../registry/types';
import type { LoadedDashboard } from '../dashboardRepo';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../dashboardRepo', () => ({ deleteWidgetInstance: jest.fn() }));

import { deleteWidgetInstance } from '../dashboardRepo';
import { useRemoveWidget } from '../useRemoveWidget';
import { dashboardQueryKey } from '../useDashboard';

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

function renderRemove(client: QueryClient) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRemoveWidget(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  (deleteWidgetInstance as jest.Mock).mockResolvedValue(undefined);
});

describe('useRemoveWidget', () => {
  it('drops the instance from the cache before the delete resolves (optimistic), and deletes by id', async () => {
    // A deferred delete so we can observe the cache mid-flight.
    let resolveDelete!: () => void;
    (deleteWidgetInstance as jest.Mock).mockReturnValue(new Promise<void>((res) => (resolveDelete = res)));

    const client = seededClient();
    const { result } = renderRemove(client);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.removeWidget('a');
    });

    // The tile is already gone though the network call has NOT resolved; 'b' survives untouched.
    expect(idsInCache(client)).toEqual(['b']);
    expect(deleteWidgetInstance).toHaveBeenCalledWith('a');

    await act(async () => {
      resolveDelete();
      await pending;
    });

    expect(idsInCache(client)).toEqual(['b']);
    expect(result.current.error).toBeNull();
  });

  it('rolls the tile back into the cache (order preserved) and rethrows when the delete fails', async () => {
    (deleteWidgetInstance as jest.Mock).mockRejectedValue(new Error('rls denied'));
    const client = seededClient();
    const { result } = renderRemove(client);

    await act(async () => {
      await expect(result.current.removeWidget('a')).rejects.toThrow('rls denied');
    });

    // Restored exactly: the removed tile is back, in its original position.
    expect(idsInCache(client)).toEqual(['a', 'b']);
    await waitFor(() => expect(result.current.error?.message).toBe('rls denied'));
  });
});
