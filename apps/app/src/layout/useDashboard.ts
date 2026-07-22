// The dashboard load + persist hook. Server state lives in TanStack Query (AOD-25); the query result
// is what the MMKV/localStorage persister snapshots, so the last layout paints on cold start. A commit
// (fired at the end of a drag/resize) updates the cached layout optimistically for an instant repaint,
// then debounce-persists the geometry to widget_instances under RLS. staleTime is Infinity because the
// only writer of a user's layout is the user's own commits, which keep the cache and the row in sync;
// a failed write invalidates so the next load reconciles from the server (the source of truth).
import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { WidgetInstance } from '../registry/types';
import {
  bootstrapDashboard,
  loadDashboard,
  loadDashboardById,
  persistInstanceLayout,
  type LoadedDashboard,
} from './dashboardRepo';
import { getActiveDashboardId, setActiveDashboardId } from './activeDashboardStore';
import type { LayoutPatch } from './mapper';
import type { Orientation } from '../widgets/sizes';

const PERSIST_DEBOUNCE_MS = 500;

// AOD-197: the active-sky cache is keyed PER ORIENTATION — landscape and portrait hold independently-resolved
// rect lists (design §6). `orientation` DEFAULTS to 'landscape' so every existing no-arg caller (KioskWall,
// AddGallery, the mutation hooks) and the wall stay byte-identical: they read/write ['dashboard', userId,
// 'landscape'] exactly as they read ['dashboard', userId] before. The handheld surfaces (via useOrientation)
// request the device orientation, adding a SEPARATE ['dashboard', userId, 'portrait'] cache.
export function dashboardQueryKey(userId: string | undefined, orientation: Orientation = 'landscape') {
  return ['dashboard', userId ?? 'anon', orientation] as const;
}

/** The active-sky cache PREFIX (both orientations). For invalidations that must hit landscape AND portrait —
 *  a sky flip, a rename, anything orientation-independent — pass this to invalidateQueries (a partial match,
 *  exact:false, so it invalidates ['dashboard', userId, 'landscape'] and ['dashboard', userId, 'portrait']). */
export function dashboardQueryPrefix(userId: string | undefined) {
  return ['dashboard', userId ?? 'anon'] as const;
}

// Resolve the ACTIVE sky's data (AOD-143, Many Skies §1b). The query KEY stays ['dashboard', userId] (NOT
// re-keyed by sky id) so KioskWall / Dashboard / the mutation hooks that read this cache keep working
// untouched (the kiosk-boundary decision); only WHICH sky this key holds now follows the persisted active
// pointer. Order: (1) the persisted active id, if it still names one of the user's skies; (2) else the first
// sky by position; (3) else bootstrap the first-run sky. Cases 2/3 HEAL the pointer to the resolved id, so a
// stale/unset pointer self-repairs to a real sky and every reader agrees on the active sky.
async function loadActiveDashboard(
  userId: string,
  orientation: Orientation = 'landscape',
): Promise<LoadedDashboard> {
  const activeId = getActiveDashboardId();
  if (activeId) {
    const active = await loadDashboardById(activeId, orientation);
    if (active) return active;
    // The stored id no longer resolves (sky deleted, possibly on another device): fall through to first.
  }
  const first = await loadDashboard(orientation);
  const resolved = first ?? (await bootstrapDashboard(userId));
  // Heal the pointer to the resolved sky — but only if no concurrent setActive changed it while we awaited.
  // The queryFn is not abortable, so a heal invocation React Query has already discarded must NOT clobber a
  // newer selection and silently revert the persisted active sky on the next cold start. Compare-and-set is
  // safe here: JS is single-threaded and the MMKV read/write are synchronous, so nothing interleaves between
  // the read and the write below.
  if (getActiveDashboardId() === activeId) setActiveDashboardId(resolved.dashboardId);
  return resolved;
}

function applyPatch(instance: WidgetInstance, patch: LayoutPatch): WidgetInstance {
  const next: WidgetInstance = { ...instance, rect: patch.rect, size: patch.size };
  if ('refresh' in patch) {
    if (patch.refresh == null) delete next.refresh;
    else next.refresh = patch.refresh;
  }
  return next;
}

export interface UseDashboardResult {
  instances: WidgetInstance[];
  /** The active dashboard's id (AOD-27 switcher active mark; app-ia §10). Null until the query resolves. */
  dashboardId: string | null;
  dashboardName: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Re-run the dashboard query (AOD-68: the shell screen-level ErrorState "Retry"). */
  refetch(): void;
  /** Commit a geometry/size change for one instance: optimistic cache update + debounced RLS write. */
  commit(instanceId: string, patch: LayoutPatch): void;
}

export function useDashboard(orientation: Orientation = 'landscape'): UseDashboardResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const query = useQuery<LoadedDashboard | null>({
    // AOD-197: keyed by orientation (default landscape). KioskWall calls useDashboard() -> landscape, so its
    // key + resolved output are byte-identical; the handheld surfaces pass the device orientation for a
    // separate portrait cache. setActive flips WHICH sky the key holds by invalidating it (useDashboards).
    queryKey: dashboardQueryKey(userId, orientation),
    enabled: !!userId,
    staleTime: Infinity,
    // Resolve the active sky (persisted pointer -> first -> bootstrap), NOT hard position-0, so setActive can
    // flip which sky this key holds by invalidating it (useDashboards). Resolved FOR this orientation (design §6).
    queryFn: async () => loadActiveDashboard(userId as string, orientation),
  });

  // One debounce timer per instance so rapid drag/resize end-events coalesce into a single write.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const commit = useCallback(
    (instanceId: string, patch: LayoutPatch) => {
      // AOD-197: a commit writes the CURRENT orientation (design §9: you edit the orientation you're holding).
      const key = dashboardQueryKey(userId, orientation);
      // Optimistic: repaint immediately and keep the persisted query cache (cold start) consistent.
      queryClient.setQueryData<LoadedDashboard | null>(key, (prev) =>
        prev
          ? {
              ...prev,
              instances: prev.instances.map((instance) =>
                instance.instanceId === instanceId ? applyPatch(instance, patch) : instance,
              ),
            }
          : prev,
      );
      // Durable: debounced client-direct write under RLS, for THIS orientation.
      const map = timers.current;
      const pending = map.get(instanceId);
      if (pending) clearTimeout(pending);
      map.set(
        instanceId,
        setTimeout(() => {
          map.delete(instanceId);
          persistInstanceLayout(instanceId, patch, orientation)
            .then(() => {
              // AOD-197: the write may have re-shaped the OTHER orientation's stored positions — a resize
              // re-validates the other orientation (design §6.2), and materialize-on-first-edit stamps this
              // one. Invalidate the OTHER orientation's cache (targeted, exact) so its derived/stored view
              // re-derives from the fresh DB on next read; the current orientation is already optimistic.
              const other: Orientation = orientation === 'landscape' ? 'portrait' : 'landscape';
              queryClient.invalidateQueries({
                queryKey: dashboardQueryKey(userId, other),
                exact: true,
              });
            })
            .catch((err) => {
              console.warn('[layout] persist failed; will reconcile from server', err);
              queryClient.invalidateQueries({ queryKey: key });
            });
        }, PERSIST_DEBOUNCE_MS),
      );
    },
    [queryClient, userId, orientation],
  );

  return {
    instances: query.data?.instances ?? [],
    // AOD-27: exposed for the dashboards switcher's active-selection mark (additive; no existing consumer
    // changes). The multi-dashboard list + active-selection persistence stay the build's seam (app-ia §10).
    dashboardId: query.data?.dashboardId ?? null,
    dashboardName: query.data?.name ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    // AOD-68: exposed for the shell screen-level ErrorState "Retry" (design-core-navigation §8). Additive;
    // no existing consumer changes. The editor / switcher wiring stays AOD-27's.
    refetch: query.refetch,
    commit,
  };
}
