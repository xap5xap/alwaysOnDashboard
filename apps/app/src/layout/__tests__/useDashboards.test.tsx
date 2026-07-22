// The multi-dashboard hook (AOD-143, Many Skies §1b/§1e/§1g). useDashboards is the SUPERSET surface every
// downstream milestone (M4/M5/M6 pager, page-altitude) builds on, so these lock its contract: the ordered
// list, the active pointer (default/fallback/persist+refetch), create-descends-into-empty, and the last-sky
// rule + active-on-delete reassignment. The repo + the active-sky store are mocked (this proves the HOOK's
// policy, not the DB); the store mock is STATEFUL so a setActive write is visible to the next active-sky
// resolve, exactly as the real store behaves. useDashboard's own resolution runs real (composed here), so
// the kiosk-critical "persisted pointer -> first -> bootstrap, then heal" path is covered too.
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../dashboardRepo', () => ({
  loadDashboards: jest.fn(),
  loadDashboardById: jest.fn(),
  loadDashboard: jest.fn(),
  bootstrapDashboard: jest.fn(),
  createDashboard: jest.fn(),
  renameDashboard: jest.fn(),
  reorderDashboards: jest.fn(),
  deleteDashboard: jest.fn(),
  persistInstanceLayout: jest.fn(), // imported by useDashboard.commit (unused in these tests)
}));
jest.mock('../activeDashboardStore', () => ({
  getActiveDashboardId: jest.fn(),
  setActiveDashboardId: jest.fn(),
}));

import {
  loadDashboards,
  loadDashboardById,
  loadDashboard,
  bootstrapDashboard,
  createDashboard as createDashboardRow,
  deleteDashboard as deleteDashboardRow,
} from '../dashboardRepo';
import { getActiveDashboardId, setActiveDashboardId } from '../activeDashboardStore';
import { useDashboards } from '../useDashboards';

// The persisted pointer, as a stateful mock: getActiveDashboardId reads it, setActiveDashboardId writes it,
// so a setActive() flip is seen by the next active-sky resolve (the real store's behavior).
let activePointer: string | null;

const SUMMARIES = [
  { id: 'd1', name: 'Wall', position: 0 },
  { id: 'd2', name: '', position: 1 },
];

const SKY: Record<string, { dashboardId: string; name: string; instances: [] }> = {
  d1: { dashboardId: 'd1', name: 'Wall', instances: [] },
  d2: { dashboardId: 'd2', name: '', instances: [] },
  d3: { dashboardId: 'd3', name: '', instances: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  activePointer = 'd1';
  (getActiveDashboardId as jest.Mock).mockImplementation(() => activePointer);
  (setActiveDashboardId as jest.Mock).mockImplementation((id: string) => {
    activePointer = id;
  });
  (loadDashboards as jest.Mock).mockResolvedValue(SUMMARIES);
  (loadDashboardById as jest.Mock).mockImplementation(async (id: string) => SKY[id] ?? null);
  (loadDashboard as jest.Mock).mockResolvedValue(SKY.d1); // "first by position"
  (bootstrapDashboard as jest.Mock).mockResolvedValue(SKY.d1);
});

function renderDashboards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useDashboards(), { wrapper }) };
}

describe('useDashboards (AOD-143)', () => {
  it('exposes the ordered sky list and the resolved active id', async () => {
    const { result } = renderDashboards();
    await waitFor(() => expect(result.current.dashboards).toHaveLength(2));
    expect(result.current.dashboards.map((d) => d.id)).toEqual(['d1', 'd2']);
    await waitFor(() => expect(result.current.activeId).toBe('d1'));
    expect(result.current.dashboardId).toBe('d1'); // activeId === dashboardId
    expect(result.current.isLoading).toBe(false);
  });

  it('setActive persists the pointer and refetches the active sky', async () => {
    const { result } = renderDashboards();
    await waitFor(() => expect(result.current.activeId).toBe('d1'));

    act(() => {
      result.current.setActive('d2');
    });

    expect(setActiveDashboardId).toHaveBeenCalledWith('d2');
    // The active-sky key re-resolved to d2 (persisted pointer read by useDashboard's queryFn). AOD-197: the
    // hook default-mounts landscape, so the resolve requests the landscape rect list.
    await waitFor(() => expect(result.current.activeId).toBe('d2'));
    expect(loadDashboardById).toHaveBeenCalledWith('d2', 'landscape');
    expect(result.current.dashboardName).toBe(''); // d2 is nameless
  });

  it('setActive invalidates BOTH orientations via the ["dashboard"] prefix (AOD-197)', async () => {
    const { result, client } = renderDashboards();
    await waitFor(() => expect(result.current.activeId).toBe('d1'));
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    act(() => {
      result.current.setActive('d2');
    });

    // The PREFIX (no orientation) is a partial match, so it invalidates ['dashboard','u1','landscape'] AND
    // ['dashboard','u1','portrait'] — the active sky is orientation-independent, so both caches must re-resolve.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'u1'] });
  });

  it('createDashboard makes a sky, sets it active (descends into the empty sky), and returns its id', async () => {
    (createDashboardRow as jest.Mock).mockResolvedValue({ id: 'd3', name: '', position: 2 });
    const { result } = renderDashboards();
    await waitFor(() => expect(result.current.activeId).toBe('d1'));

    let createdId: string | undefined;
    await act(async () => {
      createdId = await result.current.createDashboard();
    });

    expect(createDashboardRow).toHaveBeenCalledWith('u1', undefined);
    expect(createdId).toBe('d3');
    expect(setActiveDashboardId).toHaveBeenCalledWith('d3');
    await waitFor(() => expect(result.current.activeId).toBe('d3'));
    expect(result.current.instances).toEqual([]); // §1g: the new sky is empty
  });

  it('deleteDashboard refuses the LAST sky (§1e: emptied, never deleted)', async () => {
    (loadDashboards as jest.Mock).mockResolvedValue([{ id: 'd1', name: 'Wall', position: 0 }]);
    const { result } = renderDashboards();
    await waitFor(() => expect(result.current.dashboards).toHaveLength(1));

    await act(async () => {
      await expect(result.current.deleteDashboard('d1')).rejects.toThrow(/last sky/i);
    });

    expect(deleteDashboardRow).not.toHaveBeenCalled();
    expect(setActiveDashboardId).not.toHaveBeenCalled(); // active 'd1' resolved cleanly, no heal fired
  });

  it('deleting the ACTIVE sky moves active to a neighbor FIRST, then deletes', async () => {
    const { result } = renderDashboards();
    await waitFor(() => expect(result.current.dashboards).toHaveLength(2));
    await waitFor(() => expect(result.current.activeId).toBe('d1'));

    await act(async () => {
      await result.current.deleteDashboard('d1');
    });

    expect(setActiveDashboardId).toHaveBeenCalledWith('d2'); // moved to the neighbor
    expect(deleteDashboardRow).toHaveBeenCalledWith('d1');
    // Order: the neighbor move happened BEFORE the row was deleted (no reader ever points at a dead id).
    const movedAt = (setActiveDashboardId as jest.Mock).mock.invocationCallOrder[0];
    const deletedAt = (deleteDashboardRow as jest.Mock).mock.invocationCallOrder[0];
    expect(movedAt).toBeLessThan(deletedAt);
    await waitFor(() => expect(result.current.activeId).toBe('d2'));
  });

  it('defaults the active sky to the first by position when the pointer is unset, and HEALS it', async () => {
    activePointer = null; // no sky chosen yet
    const { result } = renderDashboards();

    await waitFor(() => expect(result.current.activeId).toBe('d1'));
    expect(loadDashboardById).not.toHaveBeenCalled(); // nothing to load by id
    expect(loadDashboard).toHaveBeenCalled(); // fell to "first by position"
    expect(setActiveDashboardId).toHaveBeenCalledWith('d1'); // pointer healed to a real sky
  });

  it('falls back to the first sky when the pointer names a deleted sky, and HEALS it', async () => {
    activePointer = 'ghost'; // a sky that no longer exists
    const { result } = renderDashboards();

    await waitFor(() => expect(result.current.activeId).toBe('d1'));
    expect(loadDashboardById).toHaveBeenCalledWith('ghost', 'landscape'); // tried the stale id (landscape)
    expect(loadDashboard).toHaveBeenCalled(); // then fell to first
    expect(setActiveDashboardId).toHaveBeenCalledWith('d1'); // healed
  });

  // AOD-144 coherence heal: the LIST and the active-sky query are independent, so a new user's list SELECT can
  // resolve [] before the active-sky query's bootstrap INSERTs are visible. staleTime:Infinity would freeze
  // that [] — blanking the pager AND fooling the second-sky Pro gate (0 < 1 reads as "create is free"). The
  // hook must refetch the list back into coherence.
  it('heals the new-user list race: refetches the list when the bootstrapped active sky is missing from it', async () => {
    activePointer = null; // brand-new user, no pointer
    (loadDashboard as jest.Mock).mockResolvedValue(null); // no first sky yet
    (bootstrapDashboard as jest.Mock).mockResolvedValue({ dashboardId: 'boot', name: 'Wall', instances: [] });
    // The list SELECT resolves [] before bootstrap's INSERTs are visible, then includes the sky on refetch.
    (loadDashboards as jest.Mock).mockReset();
    (loadDashboards as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'boot', name: 'Wall', position: 0 }]);

    const { result } = renderDashboards();

    // Active resolves to the bootstrapped sky, missing from the [] list...
    await waitFor(() => expect(result.current.activeId).toBe('boot'));
    // ...so the coherence effect refetched the list into coherence (the pager sees its sky; the gate sees 1).
    await waitFor(() => expect(result.current.dashboards.map((d) => d.id)).toEqual(['boot']));
    expect((loadDashboards as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT refetch the list when the active sky is already in it (the heal never loops)', async () => {
    const { result } = renderDashboards(); // activePointer 'd1', list [d1, d2] — coherent
    await waitFor(() => expect(result.current.activeId).toBe('d1'));
    await waitFor(() => expect(result.current.dashboards).toHaveLength(2));
    // 'd1' is in [d1, d2], so the coherence effect stays idle — a single list load, no heal refetch.
    expect((loadDashboards as jest.Mock).mock.calls.length).toBe(1);
  });
});
