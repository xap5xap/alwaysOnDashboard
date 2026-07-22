// The add-widget mutation: derive a default placement for a WidgetDefinition and insert it into the
// user's current dashboard under RLS, then reconcile the dashboard query so the board repaints and the
// AOD-47 host begins driving the new instance through the proxy. The current dashboard (id + instances)
// is read from the TanStack Query cache (dashboardQueryKey) that useDashboard already populates, so the
// picker needs only the WidgetDefinition. Registry-free at the data layer: the caller passes the def and
// placement.ts derives size/rect/config. This is the writer side of the connect -> add -> arrange ->
// render loop (data-model §8: the client is the natural writer of layout state).
//
// AOD-139 (resolves AOD-103): the write is now OPTIMISTIC, mirroring useRemoveWidget. Before awaiting the
// insert it synchronously appends a PROVISIONAL instance (the computed seed under a client-only
// placeholder id) into the cache. That closes the rapid-add overlap: a second addWidget fired before the
// first insert resolves reads the cache WITH the provisional, so placement.ts sees the new slot as taken
// and picks the NEXT free slot instead of the same stale one. On resolve it swaps the provisional for the
// returned real row; on failure it rolls the provisional back out (by id, so a concurrent add's own
// provisional survives) and rethrows.
//   Coupling worth naming (as useRemoveWidget also relies on): this optimism is safe because the dashboard
// query is staleTime:Infinity with no refetchInterval (useDashboard), so no background refetch lands during
// the insert window to wipe an in-flight provisional. Lowering staleTime or adding a poll here without a
// cancelQueries would silently reintroduce a lost-card race.
//
// AOD-197 (Pass B2): the hook now threads the ACTIVE orientation (from useOrientation, via AddGallery) into
// the read + write + reconcile path, so an add in portrait paints the portrait sky instantly. `orientation`
// DEFAULTS to 'landscape', so every no-arg path (tests) and the wall stay byte-identical. The insert stamps
// the card into every OTHER designed orientation (buildAddPos), so on success the OTHER orientation's cache
// is invalidated to re-derive, mirroring useDashboard.commit.
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { WidgetDefinition, WidgetInstance, WidgetSize } from '../registry/types';
import { columnsFor, type Orientation } from '../widgets/sizes';
import { addWidgetInstance, type LoadedDashboard } from './dashboardRepo';
import type { InstanceSeed } from './mapper';
import { defaultSeedFor } from './placement';
import { dashboardQueryKey } from './useDashboard';

export interface UseAddWidgetResult {
  /** Insert `def` into the current dashboard with a default placement, then repaint. Throws on failure
   *  (also surfaced via `error`) so the caller can keep the picker open. `config` overrides the schema
   *  defaults when the configure-on-add form collected values (AOD-10 §4); omit for add-with-defaults.
   *  `size` overrides the default placement size (AOD-148: the gallery lands the card at the selected
   *  S/M/W/L); omit to keep `defaultPlacementSize` — no behavior change for other callers. */
  addWidget(def: WidgetDefinition, config?: Record<string, unknown>, size?: WidgetSize): Promise<void>;
  pending: boolean;
  error: Error | null;
}

// A process-wide monotonic counter for placeholder ids. Uniqueness (not cryptographic randomness) is all
// the provisional needs — it lives only in the client cache until the swap and is never persisted (the DB
// owns the real id). The counter guarantees two adds in the same millisecond still get distinct ids; the
// `pending-`/timestamp parts just make a stray placeholder obvious in a cache dump.
let provisionalSeq = 0;
function nextProvisionalId(): string {
  provisionalSeq += 1;
  return `pending-${Date.now()}-${provisionalSeq}`;
}

/** A provisional WidgetInstance from a seed + placeholder id (the seed carries rect/size/config already). */
function provisionalInstance(seed: InstanceSeed, instanceId: string): WidgetInstance {
  return {
    instanceId,
    serviceId: seed.serviceId,
    widgetType: seed.widgetType,
    config: seed.config,
    rect: seed.rect,
    size: seed.size,
    ...(seed.refresh !== undefined ? { refresh: seed.refresh } : {}),
  };
}

export function useAddWidget(orientation: Orientation = 'landscape'): UseAddWidgetResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addWidget = useCallback(
    async (def: WidgetDefinition, config?: Record<string, unknown>, size?: WidgetSize) => {
      if (!userId) throw new Error('Not signed in');
      // AOD-197 (Pass B2): read + write the ACTIVE orientation's cache so an add in the orientation you are
      // holding paints THAT sky (design §9). Defaults to landscape, so the wall + every no-arg path stay
      // byte-identical to pre-AOD-197.
      const key = dashboardQueryKey(userId, orientation);
      const dashboard = queryClient.getQueryData<LoadedDashboard | null>(key);
      if (!dashboard) throw new Error('No dashboard loaded');

      // Derive placement from the CURRENT cache, then write the provisional SYNCHRONOUSLY (before any
      // await) so a concurrent second add sees this slot occupied. The provisional may briefly render as a
      // loading tile at its computed slot until the swap below replaces it with the real row. `size`, when
      // the gallery passes the selected S/M/W/L (AOD-148), lands the card at that size; omitted -> default.
      // Place the seed in the ACTIVE orientation's grid (landscape 6 / portrait 4 columns, columnsFor);
      // addWidgetInstance(…, orientation) then stamps the card into every OTHER designed orientation at its
      // own firstFreeSlot (buildAddPos), so every designed orientation stays complete.
      const seed = defaultSeedFor(def, dashboard.instances, config, size, columnsFor(orientation));
      const placeholderId = nextProvisionalId();
      const provisional = provisionalInstance(seed, placeholderId);
      queryClient.setQueryData<LoadedDashboard | null>(key, (prev) =>
        prev ? { ...prev, instances: [...prev.instances, provisional] } : prev,
      );

      setPending(true);
      setError(null);
      try {
        const inserted = await addWidgetInstance(dashboard.dashboardId, userId, seed, orientation);
        // Reconcile. Happy path: swap the provisional for the real row (real id + server-coerced rect),
        // keeping every other tile's object identity, so the host drives the true instance without a
        // refetch (like useRemoveWidget, no invalidate). If the row could not be mapped back
        // (inserted === null, the should-not-happen mapper drop), the row still landed server-side, so drop
        // the provisional and invalidate to reconcile the truth on the next load.
        if (inserted) {
          queryClient.setQueryData<LoadedDashboard | null>(key, (prev) =>
            prev
              ? {
                  ...prev,
                  instances: prev.instances.map((instance) =>
                    instance.instanceId === placeholderId ? inserted : instance,
                  ),
                }
              : prev,
          );
        } else {
          queryClient.setQueryData<LoadedDashboard | null>(key, (prev) =>
            prev
              ? { ...prev, instances: prev.instances.filter((i) => i.instanceId !== placeholderId) }
              : prev,
          );
          await queryClient.invalidateQueries({ queryKey: key });
        }
        // AOD-197 (Pass B2): the insert stamped a position into every OTHER designed orientation
        // (buildAddPos), so its cache must re-derive on next read. Invalidate the OTHER orientation (exact),
        // mirroring useDashboard.commit; the current orientation is already optimistic (swap) or reconciled.
        const other: Orientation = orientation === 'landscape' ? 'portrait' : 'landscape';
        void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId, other), exact: true });
      } catch (err) {
        // Roll the provisional back out by id (NOT a wholesale snapshot restore like useRemoveWidget: a
        // concurrent add may have added its own provisional we must not clobber). The picker keeps its form
        // open on the rethrow.
        queryClient.setQueryData<LoadedDashboard | null>(key, (prev) =>
          prev
            ? { ...prev, instances: prev.instances.filter((i) => i.instanceId !== placeholderId) }
            : prev,
        );
        setError(err as Error);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [queryClient, userId, orientation],
  );

  return { addWidget, pending, error };
}
