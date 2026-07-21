// The cross-sky move mutation (AOD-146, Many Skies §1d: "a card can move between skies without ever leaving
// your finger"). Re-parents ONE widget_instances row to another sky the user owns (moveInstanceToDashboard,
// client-direct under RLS) and, mirroring useRemoveWidget, optimistically DROPS the card from the CURRENT
// active sky's ['dashboard', userId] cache so it leaves this surface at once, rolling back on failure. Unlike
// remove, the card does not vanish — it lands on the DESTINATION sky, so on success this also invalidates that
// sky's read cache (['sky', userId, toDashboardId]) so the next read of it (the Glance pager page, or Arrange
// after setActive) reloads with the moved card present. The active-sky FOLLOW (setActive to the neighbour) is
// the caller's edge-hold concern, not this hook's: this stays the pure re-parent + optimistic-move core.
// The cache value is an array-shaped LoadedDashboard, so the JSON persister Map gotcha never applies here.
// Registry-free at the data layer: it targets by id.
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { moveInstanceToDashboard, type LoadedDashboard } from './dashboardRepo';
import { dashboardQueryKey } from './useDashboard';
import { skyQueryKey } from './useSkyInstances';

export interface UseMoveInstanceResult {
  /** Move `instanceId` from the current active sky to `toDashboardId`, optimistically dropping the card from
   *  this sky and invalidating the destination sky's read cache on success. Throws on failure (also surfaced
   *  via `error`) after rolling the card back into the current sky so a denied move restores it. */
  moveInstance(instanceId: string, toDashboardId: string): Promise<void>;
  pending: boolean;
  error: Error | null;
}

export function useMoveInstance(): UseMoveInstanceResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const moveInstance = useCallback(
    async (instanceId: string, toDashboardId: string) => {
      if (!userId) throw new Error('Not signed in');
      const key = dashboardQueryKey(userId);
      const previous = queryClient.getQueryData<LoadedDashboard | null>(key);

      // Optimistic: drop the card from the CURRENT sky now so it leaves this surface immediately (and the
      // persisted cold-start cache matches). The row is not deleted — it is re-parented — so on success the
      // destination invalidate below repopulates it there; on failure the rollback restores it here.
      queryClient.setQueryData<LoadedDashboard | null>(key, (prev) =>
        prev
          ? { ...prev, instances: prev.instances.filter((instance) => instance.instanceId !== instanceId) }
          : prev,
      );

      setPending(true);
      setError(null);
      try {
        await moveInstanceToDashboard(instanceId, toDashboardId);
        // Repopulate BOTH per-sky read caches so neither GHOSTS the card. The DESTINATION never saw it (it now
        // has it). The SOURCE sky's ['sky', sourceId] cache still LISTS it — and since the pager keeps every
        // page mounted at staleTime:Infinity (useSkyInstances), without this the moved card duplicates across
        // both skies (Glance pages + the page-altitude thumbnails) until a cold start. `previous` is the source
        // sky's ['dashboard'] snapshot, so previous.dashboardId is the sky to refresh.
        await queryClient.invalidateQueries({ queryKey: skyQueryKey(userId, toDashboardId) });
        if (previous) {
          await queryClient.invalidateQueries({ queryKey: skyQueryKey(userId, previous.dashboardId) });
        }
      } catch (err) {
        // Roll back to the pre-move cache so the card reappears on the current sky; the row never moved.
        queryClient.setQueryData<LoadedDashboard | null>(key, previous);
        setError(err as Error);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [queryClient, userId],
  );

  return { moveInstance, pending, error };
}
