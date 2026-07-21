// The multi-dashboard ("skies") hook (AOD-143, Many Skies §1b/§1e/§1g). A SUPERSET of useDashboard: it keeps
// the active sky's live surface (composed from useDashboard, so KioskWall / Dashboard and this hook all read
// the SAME ['dashboard', userId] cache and can never diverge on what the active sky shows) and adds the
// page-altitude concerns — the list of skies, the active pointer, and create / rename / reorder / delete.
//
// The kiosk-boundary decision (AOD-143): useDashboard and dashboardQueryKey are left intact and are NOT
// re-keyed by sky id. Switching the active sky flips WHICH sky the single ['dashboard', userId] key holds (by
// persisting the pointer + invalidating that key), not the key itself, so the untouchable wall render path
// (kiosk/KioskWall.tsx, which calls useDashboard()) keeps working with zero edits.
import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  createDashboard as createDashboardRow,
  deleteDashboard as deleteDashboardRow,
  loadDashboards,
  renameDashboard as renameDashboardRow,
  reorderDashboards as reorderDashboardRows,
  type DashboardSummary,
} from './dashboardRepo';
import { setActiveDashboardId } from './activeDashboardStore';
import { dashboardQueryKey, useDashboard, type UseDashboardResult } from './useDashboard';

// §1e: the last remaining sky can be emptied but never deleted — the policy the hook enforces (the repo is
// the raw mechanism). Surfaced as an Error so a caller that wires delete can show it, though the switcher's
// UX never offers delete on a single-sky account.
const LAST_SKY_MESSAGE = 'The last sky can’t be deleted, only emptied.';

/** The skies-LIST query key — the page-altitude list (Many Skies §1b), kept SEPARATE from the active-sky
 *  ['dashboard', userId] key so flipping the active sky never refetches the list, and a list edit (create /
 *  rename / reorder / delete) never refetches the active sky unless it actually changed. */
export function dashboardsQueryKey(userId: string | undefined) {
  return ['dashboards', userId ?? 'anon'] as const;
}

export interface UseDashboardsResult extends UseDashboardResult {
  /** All the user's skies as summaries, ordered by position (§1e: this order is the dots' order). */
  dashboards: DashboardSummary[];
  /** The RESOLVED active-sky id (equals `dashboardId`; the sky whose live data this hook also returns). Note:
   *  it LAGS `setActive` until the active-sky refetch settles, so a pager must track its own scroll position
   *  for page dots rather than read this synchronously right after a swipe-driven setActive. */
  activeId: string | null;
  /** Flip the active sky: persist the pointer + refetch the active-sky query so every reader repaints it. */
  setActive(id: string): void;
  /** Create an EMPTY sky (§1g), set it active (the view descends into it), and return its id. */
  createDashboard(name?: string): Promise<string>;
  /** Rename a sky; '' returns it to nameless (§1e). */
  renameDashboard(id: string, name: string): Promise<void>;
  /** Persist a new sky order (§1e: this order is the swipe/dot order). */
  reorderDashboards(orderedIds: string[]): Promise<void>;
  /** Delete a sky. Refuses the LAST sky (§1e); if the active sky is deleted, moves active to a neighbor first. */
  deleteDashboard(id: string): Promise<void>;
}

export function useDashboards(): UseDashboardsResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  // The active sky's live surface (instances / dashboardId / dashboardName / commit / ...) — the SAME cache
  // (and the SAME resolution: persisted pointer -> first -> bootstrap) KioskWall and Dashboard read.
  const active = useDashboard();

  const listQuery = useQuery<DashboardSummary[]>({
    queryKey: dashboardsQueryKey(userId),
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: () => loadDashboards(),
  });
  const dashboards = listQuery.data ?? [];
  const activeId = active.dashboardId;

  const refetchList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: dashboardsQueryKey(userId) }),
    [queryClient, userId],
  );

  // AOD-144 coherence heal. The sky LIST and the active-sky query are independent, so a brand-new user can
  // resolve the list to [] (one SELECT) BEFORE the active-sky query's bootstrapDashboard commits its INSERTs
  // — and with staleTime:Infinity that empty list would stick for the whole session, blanking the Glance
  // pager AND (worse) fooling the second-sky Pro gate into thinking 0 dashboards exist. When the resolved
  // active sky is absent from a RESOLVED list, refetch the list ONCE. Loop-safe: the active-sky query awaits
  // the bootstrap before it publishes activeId, so by the time this fires the row is committed and the
  // refetch returns it — the `!some(...)` condition then goes false and never re-arms; invalidateQueries also
  // dedups concurrent refetches. Covers any missing-active case (e.g. a cross-device create), not just
  // bootstrap.
  useEffect(() => {
    if (activeId && listQuery.isSuccess && !dashboards.some((d) => d.id === activeId)) {
      void refetchList();
    }
  }, [activeId, dashboards, listQuery.isSuccess, refetchList]);

  const setActive = useCallback(
    (id: string) => {
      // Persist the pointer, then invalidate the active-sky key so useDashboard's queryFn re-resolves to `id`
      // and KioskWall / Dashboard / this hook all repaint the chosen sky. The key is NOT re-keyed (kiosk-safe).
      setActiveDashboardId(id);
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId) });
    },
    [queryClient, userId],
  );

  const createDashboard = useCallback(
    async (name?: string) => {
      if (!userId) throw new Error('Not signed in');
      const created = await createDashboardRow(userId, name);
      await refetchList();
      // §1g: descend into the new EMPTY sky.
      setActive(created.id);
      return created.id;
    },
    [userId, refetchList, setActive],
  );

  const renameDashboard = useCallback(
    async (id: string, name: string) => {
      await renameDashboardRow(id, name);
      await refetchList();
      // The active sky's name is ALSO cached under the active-sky key (useDashboard exposes dashboardName from
      // it); renaming the active sky must refresh that key too, or dashboardName goes stale until the next
      // setActive/restart (M5 page-altitude binds a header to it).
      if (id === activeId) void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId) });
    },
    [refetchList, activeId, queryClient, userId],
  );

  const reorderDashboards = useCallback(
    async (orderedIds: string[]) => {
      await reorderDashboardRows(orderedIds);
      await refetchList();
    },
    [refetchList],
  );

  const deleteDashboard = useCallback(
    async (id: string) => {
      // §1e last-sky rule: the last remaining sky can only be emptied, never deleted.
      if (dashboards.length <= 1) throw new Error(LAST_SKY_MESSAGE);
      // If deleting the ACTIVE sky, move active to a neighbor FIRST so no reader is ever pointed at a dead id
      // (the active-sky query re-resolves to the neighbor while the row still exists).
      if (id === activeId) {
        const neighbor = dashboards.find((d) => d.id !== id);
        if (neighbor) setActive(neighbor.id);
      }
      await deleteDashboardRow(id);
      await refetchList();
    },
    [dashboards, activeId, setActive, refetchList],
  );

  return {
    ...active,
    // isLoading / isError / error / refetch combine BOTH queries: consumers (the switcher now, the pager in
    // M4/M5) render the sky LIST and the active sky together, so "ready" means both resolved and "retry"
    // refetches both. The active-sky-only fields (instances / dashboardId / commit) pass through from `active`.
    isLoading: active.isLoading || listQuery.isLoading,
    isError: active.isError || listQuery.isError,
    error: active.error ?? ((listQuery.error as Error | null) ?? null),
    refetch: () => {
      active.refetch();
      void listQuery.refetch();
    },
    dashboards,
    activeId,
    setActive,
    createDashboard,
    renameDashboard,
    reorderDashboards,
    deleteDashboard,
  };
}
