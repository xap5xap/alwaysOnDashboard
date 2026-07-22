// The remove-widget mutation (AOD-141, resolves AOD-104): delete ONE widget_instances row client-direct
// under RLS, optimistically dropping it from the dashboard query cache so the tile vanishes at once (and
// the cold-start persister snapshots the board without it). It mirrors the disconnect-time delete (AOD-49:
// disconnect eager-deletes a service's instances) but for a SINGLE instance, and the useAddWidget
// pending/error shape. Unlike add/configure (persist-then-invalidate) it writes the cache OPTIMISTICALLY,
// like useDashboard.commit, and rolls the tile back on failure so a denied delete restores it. The cache
// value is an array-shaped LoadedDashboard, so the JSON persister Map gotcha never applies here. Connections
// survive — they belong to the account, not the card. Registry-free at the data layer: it targets by id.
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { Orientation } from '../widgets/sizes';
import { deleteWidgetInstance, type LoadedDashboard } from './dashboardRepo';
import { dashboardQueryKey } from './useDashboard';

export interface UseRemoveWidgetResult {
  /** Delete `instanceId` from the current dashboard, optimistically repainting without it. Throws on
   *  failure (also surfaced via `error`) after rolling the tile back into the cache so it reappears. */
  removeWidget(instanceId: string): Promise<void>;
  pending: boolean;
  error: Error | null;
}

export function useRemoveWidget(orientation: Orientation = 'landscape'): UseRemoveWidgetResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const removeWidget = useCallback(
    async (instanceId: string) => {
      if (!userId) throw new Error('Not signed in');
      // AOD-197 (Pass B2): drop from the ACTIVE orientation's cache so the tile vanishes on the sky you are
      // holding. Defaults to landscape, so the wall + every no-arg path stay byte-identical.
      const key = dashboardQueryKey(userId, orientation);
      const previous = queryClient.getQueryData<LoadedDashboard | null>(key);

      // Optimistic: drop the instance now so the tile disappears immediately and the persisted (cold
      // start) cache matches. Keeps the same object identity for untouched instances.
      queryClient.setQueryData<LoadedDashboard | null>(key, (prev) =>
        prev
          ? { ...prev, instances: prev.instances.filter((instance) => instance.instanceId !== instanceId) }
          : prev,
      );

      setPending(true);
      setError(null);
      try {
        await deleteWidgetInstance(instanceId);
        // AOD-197 (Pass B2): the delete strips the row in EVERY orientation, so the OTHER orientation's cache
        // (populated if the user rotated this session) must drop the tile too — invalidate it (exact) to
        // reconcile. The current orientation already dropped it optimistically above.
        const other: Orientation = orientation === 'landscape' ? 'portrait' : 'landscape';
        void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId, other), exact: true });
      } catch (err) {
        // Roll back to the pre-delete cache so the tile reappears; the row is still there.
        queryClient.setQueryData<LoadedDashboard | null>(key, previous);
        setError(err as Error);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [queryClient, userId, orientation],
  );

  return { removeWidget, pending, error };
}
