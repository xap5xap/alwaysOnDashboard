// The per-sky read query (AOD-144). These lock the pager's read contract: a page reads its OWN sky by id
// under a ['sky', userId, skyId] key that is SEPARATE from the active-sky ['dashboard', userId] cache (so
// Glance never collides with the active-sky / mutation / wall cache), and the seedSkyFromActive hand-off
// copies the just-edited active-sky layout into that per-sky cache when Arrange is left, so the pager repaints
// the edit with no refetch and no debounced-write race. The repo is mocked (this proves the HOOK's wiring,
// not the DB).
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../dashboardRepo', () => ({ loadDashboardById: jest.fn() }));

import { loadDashboardById } from '../dashboardRepo';
import { dashboardQueryKey } from '../useDashboard';
import { skyQueryKey, useSkyInstances, seedSkyFromActive, seedActiveFromSky } from '../useSkyInstances';
import type { Orientation } from '../../widgets/sizes';

const D2 = { dashboardId: 'd2', name: 'Travel', instances: [{ instanceId: 'i1' }, { instanceId: 'i2' }] };

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

function renderSky(skyId: string, orientation: Orientation = 'landscape', client = makeClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useSkyInstances(skyId, orientation), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadDashboardById as jest.Mock).mockImplementation(async (id: string) => (id === 'd2' ? D2 : null));
});

describe('useSkyInstances (AOD-144)', () => {
  it('loads a specific sky by id via loadDashboardById (landscape by default)', async () => {
    const { result } = renderSky('d2');
    await waitFor(() => expect(result.current.instances).toHaveLength(2));
    expect(loadDashboardById).toHaveBeenCalledWith('d2', 'landscape');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('keys by orientation: a portrait read lands under the portrait key and requests portrait (AOD-197)', async () => {
    const { client, result } = renderSky('d2', 'portrait');
    await waitFor(() => expect(result.current.instances).toHaveLength(2));
    expect(loadDashboardById).toHaveBeenCalledWith('d2', 'portrait');
    expect(client.getQueryData(skyQueryKey('u1', 'd2', 'portrait'))).toEqual(D2);
    // The landscape key is a SEPARATE cache entry — the portrait read never writes it.
    expect(client.getQueryData(skyQueryKey('u1', 'd2', 'landscape'))).toBeUndefined();
  });

  it('reads under a per-sky key SEPARATE from the active-sky key', async () => {
    const { client, result } = renderSky('d2');
    await waitFor(() => expect(result.current.instances).toHaveLength(2));
    // The data landed under ['sky', 'u1', 'd2'] and NOT under the active-sky ['dashboard', 'u1'] key.
    expect(client.getQueryData(skyQueryKey('u1', 'd2'))).toEqual(D2);
    expect(client.getQueryData(dashboardQueryKey('u1'))).toBeUndefined();
  });

  it('surfaces an empty list for a sky that does not resolve', async () => {
    const { result } = renderSky('ghost');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.instances).toEqual([]);
  });

  it('surfaces the error when the read throws', async () => {
    (loadDashboardById as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    const { result } = renderSky('d2');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.instances).toEqual([]);
  });
});

describe('seedSkyFromActive (the arrange-exit hand-off)', () => {
  it('copies the active-sky cache into the per-sky cache (so the pager repaints the edit)', () => {
    const client = makeClient();
    const edited = { dashboardId: 'd2', name: 'Travel', instances: [{ instanceId: 'moved' }] };
    client.setQueryData(dashboardQueryKey('u1'), edited);

    seedSkyFromActive(client, 'u1', 'd2');

    expect(client.getQueryData(skyQueryKey('u1', 'd2'))).toEqual(edited);
  });

  it('is a no-op when the active-sky cache is empty', () => {
    const client = makeClient();
    seedSkyFromActive(client, 'u1', 'd2');
    expect(client.getQueryData(skyQueryKey('u1', 'd2'))).toBeUndefined();
  });

  it('seeds WITHIN one orientation: portrait active -> portrait per-sky, landscape untouched (AOD-197)', () => {
    const client = makeClient();
    const editedP = { dashboardId: 'd2', name: 'Travel', instances: [{ instanceId: 'p-moved' }] };
    client.setQueryData(dashboardQueryKey('u1', 'portrait'), editedP);

    seedSkyFromActive(client, 'u1', 'd2', 'portrait');

    expect(client.getQueryData(skyQueryKey('u1', 'd2', 'portrait'))).toEqual(editedP);
    // Orientations never cross-seed: the landscape per-sky cache stays empty.
    expect(client.getQueryData(skyQueryKey('u1', 'd2', 'landscape'))).toBeUndefined();
  });
});

describe('seedActiveFromSky (the swipe-then-Arrange hand-off)', () => {
  it('copies the per-sky cache into the active-sky cache (so Arrange paints the swiped-to sky at once)', () => {
    const client = makeClient();
    client.setQueryData(skyQueryKey('u1', 'd2'), D2);

    seedActiveFromSky(client, 'u1', 'd2');

    // ['dashboard'] now holds d2, so a commit in the setActive-lag window persists to d2, not the old sky.
    expect(client.getQueryData(dashboardQueryKey('u1'))).toEqual(D2);
  });

  it('is a no-op when the pager has not loaded that sky yet', () => {
    const client = makeClient();
    seedActiveFromSky(client, 'u1', 'd2');
    expect(client.getQueryData(dashboardQueryKey('u1'))).toBeUndefined();
  });

  it('seeds WITHIN one orientation: portrait per-sky -> portrait active, landscape untouched (AOD-197)', () => {
    const client = makeClient();
    client.setQueryData(skyQueryKey('u1', 'd2', 'portrait'), D2);

    seedActiveFromSky(client, 'u1', 'd2', 'portrait');

    expect(client.getQueryData(dashboardQueryKey('u1', 'portrait'))).toEqual(D2);
    // The landscape active cache is a separate entry, never written by a portrait seed.
    expect(client.getQueryData(dashboardQueryKey('u1', 'landscape'))).toBeUndefined();
  });
});
