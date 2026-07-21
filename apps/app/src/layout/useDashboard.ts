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

const PERSIST_DEBOUNCE_MS = 500;

export function dashboardQueryKey(userId: string | undefined) {
  return ['dashboard', userId ?? 'anon'] as const;
}

// Resolve the ACTIVE sky's data (AOD-143, Many Skies §1b). The query KEY stays ['dashboard', userId] (NOT
// re-keyed by sky id) so KioskWall / Dashboard / the mutation hooks that read this cache keep working
// untouched (the kiosk-boundary decision); only WHICH sky this key holds now follows the persisted active
// pointer. Order: (1) the persisted active id, if it still names one of the user's skies; (2) else the first
// sky by position; (3) else bootstrap the first-run sky. Cases 2/3 HEAL the pointer to the resolved id, so a
// stale/unset pointer self-repairs to a real sky and every reader agrees on the active sky.
async function loadActiveDashboard(userId: string): Promise<LoadedDashboard> {
  const activeId = getActiveDashboardId();
  if (activeId) {
    const active = await loadDashboardById(activeId);
    if (active) return active;
    // The stored id no longer resolves (sky deleted, possibly on another device): fall through to first.
  }
  const first = await loadDashboard();
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

export function useDashboard(): UseDashboardResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const query = useQuery<LoadedDashboard | null>({
    queryKey: dashboardQueryKey(userId),
    enabled: !!userId,
    staleTime: Infinity,
    // Resolve the active sky (persisted pointer -> first -> bootstrap), NOT hard position-0, so setActive can
    // flip which sky this key holds by invalidating it (useDashboards). Shape + key are unchanged.
    queryFn: async () => loadActiveDashboard(userId as string),
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
      const key = dashboardQueryKey(userId);
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
      // Durable: debounced client-direct write under RLS.
      const map = timers.current;
      const pending = map.get(instanceId);
      if (pending) clearTimeout(pending);
      map.set(
        instanceId,
        setTimeout(() => {
          map.delete(instanceId);
          persistInstanceLayout(instanceId, patch).catch((err) => {
            console.warn('[layout] persist failed; will reconcile from server', err);
            queryClient.invalidateQueries({ queryKey: key });
          });
        }, PERSIST_DEBOUNCE_MS),
      );
    },
    [queryClient, userId],
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
