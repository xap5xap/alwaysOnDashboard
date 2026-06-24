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
  persistInstanceLayout,
  type LoadedDashboard,
} from './dashboardRepo';
import type { LayoutPatch } from './mapper';

const PERSIST_DEBOUNCE_MS = 500;

export function dashboardQueryKey(userId: string | undefined) {
  return ['dashboard', userId ?? 'anon'] as const;
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
  dashboardName: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
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
    queryFn: async () => (await loadDashboard()) ?? (await bootstrapDashboard(userId as string)),
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
    dashboardName: query.data?.name ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    commit,
  };
}
