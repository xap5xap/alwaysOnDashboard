// The per-sky read query for the Glance pager (AOD-144, Many Skies §1a "each sky keeps its own
// arrangement"). The pager renders every sky READ-ONLY, so each page reads its own instances under a
// per-sky key (['sky', userId, skyId] -> loadDashboardById) rather than the active-sky ['dashboard', userId]
// cache. That keeps Glance fully decoupled from the active-sky / mutation / KioskWall cache (AOD-143's
// kiosk boundary): swiping through skies never touches ['dashboard'], and "swipe never edits" is structural
// — this hook has no writer at all.
//
// staleTime is Infinity, mirroring the active-sky cache (useDashboard): a sky's arrangement only changes
// when the user ARRANGES it, and arrange writes through the ['dashboard'] cache, not here. When Dashboard
// leaves Arrange it HANDS that edited layout back into this cache (seedSkyFromActive below), so the pager's
// page repaints the edit with no DB round-trip and no debounced-write race. A sky that is not the active one
// can never be edited (you must make it active to arrange it), so it never goes stale; a cold start reads
// each sky fresh once.
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { WidgetInstance } from '../registry/types';
import { loadDashboardById, type LoadedDashboard } from './dashboardRepo';
import { dashboardQueryKey } from './useDashboard';
import type { Orientation } from '../widgets/sizes';

/** The per-sky read key — one cache entry per sky id AND orientation (AOD-197), kept SEPARATE from the
 *  active-sky ['dashboard', userId, orientation] key so the pager's read-only pages never collide with the
 *  active-sky / mutation cache the wall reads. `orientation` DEFAULTS to 'landscape' so existing no-arg
 *  callers (SkyThumbnail) stay landscape; the pager passes the device orientation for a portrait read. */
export function skyQueryKey(userId: string | undefined, skyId: string, orientation: Orientation = 'landscape') {
  return ['sky', userId ?? 'anon', skyId, orientation] as const;
}

/** The per-sky read PREFIX (BOTH orientations). For invalidations that must hit a sky's landscape AND portrait
 *  read caches — a re-parent (cross-sky move) is orientation-INDEPENDENT: the row's dashboard_id changed, so
 *  the card left/joined the sky in EVERY orientation. Pass this to invalidateQueries (a partial match,
 *  exact:false, so it invalidates ['sky', userId, skyId, 'landscape'] AND ['sky', userId, skyId, 'portrait']).
 *  Mirrors dashboardQueryPrefix; without it the 4-element skyQueryKey defaults to 'landscape' and the portrait
 *  pager page ghosts the moved card until a cold start. */
export function skyQueryPrefix(userId: string | undefined, skyId: string) {
  return ['sky', userId ?? 'anon', skyId] as const;
}

export interface UseSkyInstancesResult {
  /** The sky's placed instances (read-only; empty while loading, on error, or for a truly empty sky). */
  instances: WidgetInstance[];
  isLoading: boolean;
  isError: boolean;
  /** Re-run the per-sky read (the pager page's error-state Retry). */
  refetch(): void;
}

/** Read ONE sky's instances for a read-only pager page (AOD-144), resolved for `orientation` (AOD-197,
 *  default 'landscape'). Keyed by sky id AND orientation, independent of the active-sky cache; see the file
 *  header for the staleTime / hand-off contract. The pager threads the device orientation so a non-active
 *  page reflects the same per-orientation resolution the active page shows. */
export function useSkyInstances(skyId: string, orientation: Orientation = 'landscape'): UseSkyInstancesResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const query = useQuery<LoadedDashboard | null>({
    queryKey: skyQueryKey(userId, skyId, orientation),
    enabled: !!userId && !!skyId,
    staleTime: Infinity,
    queryFn: () => loadDashboardById(skyId, orientation),
  });
  return {
    instances: query.data?.instances ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Seed the per-sky read cache from the active-sky cache (AOD-144). Called when Dashboard leaves Arrange:
 *  the active sky's ['dashboard', userId] cache holds the just-committed (optimistic) layout, so copying it
 *  into ['sky', userId, skyId] lets the pager's page repaint the edit immediately — no refetch, and no race
 *  against the 500ms-debounced RLS write. A no-op when the active cache is empty (nothing was loaded). */
export function seedSkyFromActive(
  client: QueryClient,
  userId: string | undefined,
  skyId: string,
  orientation: Orientation = 'landscape',
): void {
  // AOD-197: seed WITHIN one orientation — the active ['dashboard',_,o] holds the just-edited layout for the
  // orientation being arranged, so it must land in that orientation's ['sky',_,id,o] page cache, not another.
  const active = client.getQueryData<LoadedDashboard | null>(dashboardQueryKey(userId, orientation));
  if (active) client.setQueryData<LoadedDashboard | null>(skyQueryKey(userId, skyId, orientation), active);
}

/** Seed the active-sky cache from a per-sky read cache (AOD-144; the symmetric partner of seedSkyFromActive).
 *  Called BEFORE setActive when entering Arrange on a sky you SWIPED to: setActive's active-sky refetch LAGS
 *  (the documented AOD-143 lag), so without this the Arrange LayoutCanvas would render the PREVIOUS active
 *  sky's instances for one round-trip — and a drag/commit in that window would patch ['dashboard'] while it
 *  still held the old sky, persisting the edit to the WRONG sky. The pager already loaded the target sky under
 *  ['sky', userId, skyId], so copying it into ['dashboard', userId] makes Arrange paint the correct sky from
 *  frame one; setActive's invalidate then confirms the same data in the background. A no-op if the pager had
 *  not loaded that sky yet (then setActive's refetch resolves it, the pre-fix behaviour). */
export function seedActiveFromSky(
  client: QueryClient,
  userId: string | undefined,
  skyId: string,
  orientation: Orientation = 'landscape',
): void {
  // AOD-197: seed WITHIN one orientation — the pager loaded ['sky',_,id,o] for the orientation on screen, so
  // it must land in that same orientation's active-sky cache so Arrange paints the correct per-orientation layout.
  const sky = client.getQueryData<LoadedDashboard | null>(skyQueryKey(userId, skyId, orientation));
  if (sky) client.setQueryData<LoadedDashboard | null>(dashboardQueryKey(userId, orientation), sky);
}
