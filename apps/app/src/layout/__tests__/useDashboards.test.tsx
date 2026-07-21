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
  return renderHook(() => useDashboards(), { wrapper });
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
    // The active-sky key re-resolved to d2 (persisted pointer read by useDashboard's queryFn).
    await waitFor(() => expect(result.current.activeId).toBe('d2'));
    expect(loadDashboardById).toHaveBeenCalledWith('d2');
    expect(result.current.dashboardName).toBe(''); // d2 is nameless
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
    expect(loadDashboardById).toHaveBeenCalledWith('ghost'); // tried the stale id
    expect(loadDashboard).toHaveBeenCalled(); // then fell to first
    expect(setActiveDashboardId).toHaveBeenCalledWith('d1'); // healed
  });
});
