// The reconfigure mutation (AOD-10 §4): persists one instance's config under RLS, then invalidates the
// dashboard query so the host re-derives needsConfig (AOD-10 §4.4). The repo + auth are mocked; this
// proves the hook calls persistInstanceConfig with the validated values and repaints by invalidating
// exactly the dashboard query key (testing-strategy §9).
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../dashboardRepo', () => ({ persistInstanceConfig: jest.fn() }));

import { persistInstanceConfig } from '../dashboardRepo';
import { useConfigureInstance } from '../useConfigureInstance';
import { dashboardQueryKey, dashboardQueryPrefix } from '../useDashboard';

function renderConfigure() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useConfigureInstance(), { wrapper });
  return { result, invalidate, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  (persistInstanceConfig as jest.Mock).mockResolvedValue(undefined);
});

describe('useConfigureInstance', () => {
  // AOD-197 (Pass B2): config is orientation-INDEPENDENT, so the repaint invalidates the dashboard PREFIX
  // (both orientations), not one orientation key. Seeding both caches proves the prefix covers landscape AND
  // portrait (S3/pre-B2 asserted the single landscape key here).
  it('persists the config by instance id, then invalidates BOTH orientations via the dashboard prefix', async () => {
    const { result, invalidate, client } = renderConfigure();
    client.setQueryData(dashboardQueryKey('u1', 'landscape'), { dashboardId: 'dash-1', name: 'Wall', instances: [] });
    client.setQueryData(dashboardQueryKey('u1', 'portrait'), { dashboardId: 'dash-1', name: 'Wall', instances: [] });

    await act(async () => {
      await result.current.configure('inst-1', { density: 'compact' });
    });

    expect(persistInstanceConfig).toHaveBeenCalledWith('inst-1', { density: 'compact' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardQueryPrefix('u1') });
    // The prefix is a PARTIAL match, so it invalidates BOTH orientation caches.
    expect(client.getQueryState(dashboardQueryKey('u1', 'landscape'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(dashboardQueryKey('u1', 'portrait'))?.isInvalidated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a persist failure via error and rethrows so the form stays open', async () => {
    (persistInstanceConfig as jest.Mock).mockRejectedValue(new Error('rls denied'));
    const { result, invalidate } = renderConfigure();

    await act(async () => {
      await expect(result.current.configure('inst-1', { density: 'compact' })).rejects.toThrow('rls denied');
    });

    expect(invalidate).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error?.message).toBe('rls denied'));
  });
});
