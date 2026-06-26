// The add-widget mutation: derive a default placement for a WidgetDefinition and insert it into the
// user's current dashboard under RLS, then invalidate the dashboard query so the board repaints and the
// AOD-47 host begins driving the new instance through the proxy. The current dashboard (id + instances)
// is read from the TanStack Query cache (dashboardQueryKey) that useDashboard already populates, so the
// picker needs only the WidgetDefinition. Registry-free at the data layer: the caller passes the def and
// placement.ts derives size/rect/config. This is the writer side of the connect -> add -> arrange ->
// render loop (data-model §8: the client is the natural writer of layout state).
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { WidgetDefinition } from '../registry/types';
import { addWidgetInstance, type LoadedDashboard } from './dashboardRepo';
import { defaultSeedFor } from './placement';
import { dashboardQueryKey } from './useDashboard';

export interface UseAddWidgetResult {
  /** Insert `def` into the current dashboard with a default placement, then repaint. Throws on failure
   *  (also surfaced via `error`) so the caller can keep the picker open. `config` overrides the schema
   *  defaults when the configure-on-add form collected values (AOD-10 §4); omit for add-with-defaults. */
  addWidget(def: WidgetDefinition, config?: Record<string, unknown>): Promise<void>;
  pending: boolean;
  error: Error | null;
}

export function useAddWidget(): UseAddWidgetResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addWidget = useCallback(
    async (def: WidgetDefinition, config?: Record<string, unknown>) => {
      if (!userId) throw new Error('Not signed in');
      const key = dashboardQueryKey(userId);
      const dashboard = queryClient.getQueryData<LoadedDashboard | null>(key);
      if (!dashboard) throw new Error('No dashboard loaded');

      setPending(true);
      setError(null);
      try {
        const seed = defaultSeedFor(def, dashboard.instances, config);
        await addWidgetInstance(dashboard.dashboardId, userId, seed);
        // Repaint and let the host drive the new instance. The host reacts to the proxy, not the
        // connections table (AOD-47), so a fresh dashboard load is what mounts and fetches the new row.
        await queryClient.invalidateQueries({ queryKey: key });
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [queryClient, userId],
  );

  return { addWidget, pending, error };
}
