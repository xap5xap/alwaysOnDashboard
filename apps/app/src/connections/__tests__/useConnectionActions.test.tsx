// The connection mutations' cache invalidation (AOD-44/AOD-47/AOD-49). Each action invokes an Edge Function
// then invalidates the three things a credential change moves: the connections list, the dashboard membership
// (a disconnect deletes the service's widget_instances), and the widget-host proxy results. The API + auth are
// mocked; this proves the dashboard membership is reconciled across BOTH orientations (AOD-197 Pass B2: the
// membership is orientation-INDEPENDENT, so the invalidation targets the dashboard PREFIX, not one key).
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../connectionsApi', () => ({
  startOAuth: jest.fn(),
  openExternalUrl: jest.fn(),
  storeCredentials: jest.fn(),
  disconnectConnection: jest.fn(),
}));

import { disconnectConnection, openExternalUrl, startOAuth, storeCredentials } from '../connectionsApi';
import { useConnectionActions } from '../useConnectionActions';
import { connectionsQueryKey } from '../useConnections';
import { dashboardQueryKey, dashboardQueryPrefix } from '../../layout/useDashboard';

function renderActions() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useConnectionActions(), { wrapper });
  return { result, invalidate, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  (disconnectConnection as jest.Mock).mockResolvedValue({ ok: true });
  (startOAuth as jest.Mock).mockResolvedValue({ authorizeUrl: 'https://example.test/auth' });
  (openExternalUrl as jest.Mock).mockResolvedValue(undefined);
  (storeCredentials as jest.Mock).mockResolvedValue(undefined);
});

describe('useConnectionActions cache invalidation (AOD-197 Pass B2)', () => {
  it('a disconnect invalidates connections, the dashboard PREFIX (both orientations), and the widget-host queries', async () => {
    const { result, invalidate, client } = renderActions();
    // Seed both dashboard orientation caches + a widget-host query (a ":"-keyed proxy result) to prove coverage.
    client.setQueryData(dashboardQueryKey('u1', 'landscape'), { dashboardId: 'd1', name: 'Wall', instances: [] });
    client.setQueryData(dashboardQueryKey('u1', 'portrait'), { dashboardId: 'd1', name: 'Wall', instances: [] });
    client.setQueryData(['linear:issues:{}'], { data: {} });

    await act(async () => {
      await result.current.disconnect('c-1');
    });

    expect(disconnectConnection).toHaveBeenCalledWith('c-1');
    // The connections list (this surface) is invalidated.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: connectionsQueryKey('u1') });
    // Dashboard membership is orientation-INDEPENDENT → invalidate the PREFIX (both orientations), not one key.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardQueryPrefix('u1') });
    // The prefix is a PARTIAL match, so it invalidates BOTH orientation caches.
    expect(client.getQueryState(dashboardQueryKey('u1', 'landscape'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(dashboardQueryKey('u1', 'portrait'))?.isInvalidated).toBe(true);
    // The widget-host queries (":"-keyed) are invalidated via the predicate, flipping cards out of the 409 state.
    expect(client.getQueryState(['linear:issues:{}'])?.isInvalidated).toBe(true);
  });

  it('submitCredentials also invalidates the dashboard prefix (both orientations)', async () => {
    const { result, invalidate } = renderActions();

    await act(async () => {
      await result.current.submitCredentials('linear', { apiKey: 'sk-x' });
    });

    expect(storeCredentials).toHaveBeenCalledWith({ service: 'linear', apiKey: 'sk-x' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardQueryPrefix('u1') });
  });
});
