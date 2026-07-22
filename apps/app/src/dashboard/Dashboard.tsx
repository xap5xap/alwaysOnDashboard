// The dashboard screen (AOD-8 §8 DashboardLayout, rendered). It loads the signed-in user's real skies from
// Supabase under RLS (useDashboards: the active sky's live surface + the ordered sky list + create) and, per
// the AOD-142 dial, shows ONE of two surfaces: in GLANCE a horizontal sky pager (SkyPager) with one
// read-only page per sky; in ARRANGE the single active-sky LayoutCanvas (the free-form layout engine). The
// screen owns the arrange-mode flag and the pager's current page; it never names a service (the AOD-8 seam
// holds end to end).
//
// AOD-144 (design "Many Skies" §1a/§1f): the Glance surface becomes a pager over the skies. The dial GATES
// the surface, which makes "swipe never edits" structural (a page turn can never reach an edit) and dodges
// the swipe-vs-card-drag gesture conflict (there is no horizontal paging while arranging). Entering Arrange
// from page K sets that sky active so Arrange edits the sky you are viewing; leaving Arrange hands the edited
// layout back to the pager's per-sky cache (seedSkyFromActive) and returns to the pager at page K. The page
// dots + the Pro gate on the second sky live inside SkyPager.
//
// AOD-142 (design "The sky fills in" §1e): the arranging Done pill is REPLACED by the persistent Glance |
// Arrange dial in the hub header; the wall Preview pill stays (AOD-81). The dial AND the page dots ride a
// single "chrome awake" idle state (useChromeAwake) wired to the surface's touch callbacks, so the hub chrome
// sinks when idle (calm Glance) and wakes on any touch — one mechanism.
//
// AOD-68 canonicalization (design-core-navigation §3, §5, §8, §12 drift 1-2): the inline header is the shell
// HUB AppBar (the vela wordmark + Add + Settings + the dashboards-switcher chevron), sign out is RELOCATED to
// Account, and the ad-hoc load / error become the shell screen-level states. AOD-69 fills the AOD-27
// dashboard INTERIOR: the arranging header shows the Preview pill, the per-sky empty branch composes the
// shell EmptyState (now inside SkyPager's pages), and the canvas / picker / config sheet are the polished
// editor surfaces.
import React, { useEffect, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../auth/AuthProvider';
import { AddGallery } from '../layout/AddGallery';
import { ConfigureInstanceModal } from '../layout/ConfigureInstanceModal';
import { cellPxFor, GRID_MARGIN } from '../layout/geometry';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import { useDashboards } from '../layout/useDashboards';
import { useMoveInstance } from '../layout/useMoveInstance';
import { useOrientation } from '../layout/useOrientation';
import { useRemoveWidget } from '../layout/useRemoveWidget';
import { columnsFor } from '../widgets/sizes';
import { seedActiveFromSky, seedSkyFromActive } from '../layout/useSkyInstances';
import { WallPreview } from '../kiosk/WallPreview';
import type { WidgetInstance } from '../registry/types';
import { AppBar, ErrorState, LoadingState, Screen } from '../shell';
import { Button } from '../ui/Button';
import { ModeDial } from './ModeDial';
import { PageAltitude } from './PageAltitude';
import { PageCapsule } from './PageCapsule';
import { SkyPager } from './SkyPager';
import { useChromeAwake } from './useChromeAwake';

// AOD-146 (Many Skies §1d): how long a held card must DWELL at a screen edge before it carries to the
// neighbour sky. The hold is what separates a deliberate cross-sky move from a normal near-edge reposition.
// A device-tuned seed (AOD-190), like PlacedInstance's motion timings + edge band.
const EDGE_HOLD_DWELL_MS = 600;

export function Dashboard() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  // AOD-196: the bottom safe-area inset (Unistyles rt.insets, reactive — re-reads on rotation). Off the wall
  // the app is not immersive, so the floating page-dots capsule must clear the Android nav bar; applied inline
  // (the capsuleBar style is static). The dashboard scroll content reserves the same inset inside LayoutCanvas.
  const { rt } = useUnistyles();
  // AOD-197: the device orientation drives which per-orientation layout the handheld surfaces request + commit
  // (design §9: you edit the orientation you're holding). Reactive — a rotation re-resolves the whole surface.
  const orientation = useOrientation();
  // AOD-197 (S4): the fit-to-width placement scale for THIS device + orientation. The handheld canvas renders
  // the nominal UNIT_PX grid scaled by cellPx/UNIT_PX so cells fill the screen width; the wall keeps UNIT_PX.
  // gutter 0 so cells fill the width and touch (card border-radius separates them); the inter-cell gutter is a
  // tunable deferral (design §4/§13). GRID_MARGIN keeps the grid off the screen edge.
  const { width: viewportW } = useWindowDimensions();
  const columns = columnsFor(orientation);
  const cellPx = cellPxFor(columns, viewportW, GRID_MARGIN, 0);
  const {
    instances,
    isLoading,
    isError,
    error,
    refetch,
    commit,
    dashboards,
    activeId,
    setActive,
    createDashboard,
    renameDashboard,
    reorderDashboards,
    deleteDashboard,
  } = useDashboards(orientation);
  // AOD-197 (Pass B2): thread the active orientation so an add/remove/move edits the orientation you are
  // holding — the hooks optimistically repaint THAT orientation and reconcile the other.
  const { removeWidget } = useRemoveWidget(orientation);
  const { moveInstance } = useMoveInstance(orientation);
  const [arranging, setArranging] = useState(false);
  // AOD-145: the SECOND Arrange altitude. `arranging` gates Glance vs Arrange; within Arrange this flag gates
  // card altitude (edit one sky, the shipped surface) vs page altitude (manage the skies as thumbnails). Only
  // meaningful while arranging; every path OUT of Arrange (the dial to Glance) also resets it.
  const [atPageAltitude, setAtPageAltitude] = useState(false);
  // AOD-144: the pager's current page (a mirror of SkyPager's local scroll position, reported via
  // onPageChange). It drives which sky the dial arranges — the sky on screen, NOT activeId (which lags
  // setActive, AOD-143). Persists across the arrange round-trip (SkyPager unmounts in Arrange), and SkyPager
  // re-seeds it to the active sky's index on remount.
  const [currentPage, setCurrentPage] = useState(0);
  // AOD-142: the single "chrome awake" idle state. `wake` is wired to the surface touch callbacks below;
  // `awake` drives the dial's fade AND the page dots. One timer, reset on any touch.
  const { awake, wake } = useChromeAwake();
  const [picking, setPicking] = useState(false);
  // AOD-81 §6: the wall preview peek. Owned here like `picking`/`arranging` (the app-ia locked fact: a
  // surface carrying a live object stays in-screen, never a router route), mounted as an overlay below.
  const [previewing, setPreviewing] = useState(false);
  // The instance whose config form is open (AOD-10 §4). Owned here like `picking`/`arranging` so both
  // reconfigure entries (arrange-mode "Configure" and the host's needs_config prompt) route through it.
  const [configuring, setConfiguring] = useState<WidgetInstance | null>(null);
  // AOD-146 (Many Skies §1d): the cross-sky "carry to the edge and hold" dwell timer. A held card reported at
  // a screen edge (onCarryCardToEdge) arms it; holding past the dwell carries the card to the neighbour sky.
  // Any edge change / drop cancels it, and it is cleared on unmount so a pending carry never fires after the
  // drag or the screen is gone.
  const edgeHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (edgeHoldTimer.current) clearTimeout(edgeHoldTimer.current);
    },
    [],
  );

  // AOD-144: enter Arrange on a specific sky. Setting it active first means Arrange (which renders the active
  // sky's LayoutCanvas) edits the sky you were viewing — the dial flip from page K, or a long-press on a card
  // on page K, both land here. The `!== activeId` guard skips a redundant setActive (and its ['dashboard']
  // invalidate/refetch) when the on-screen sky is already active — the common single-sky case, where flipping
  // to Arrange must NOT reload the board the way it did before AOD-144. Leaving Arrange is the else-branch below.
  const enterArrange = (skyId: string) => {
    if (skyId !== activeId) {
      // Paint the target sky NOW: copy its already-loaded pager instances (['sky', skyId]) into the active-sky
      // cache BEFORE setActive, whose refetch lags (AOD-143). Without this, Arrange would render the PREVIOUS
      // active sky for one round-trip and a commit in that window would persist to the wrong sky. The invalidate
      // that setActive fires then confirms the same data in the background. AOD-197: seed within the CURRENT
      // orientation so Arrange paints the per-orientation layout the pager was showing.
      seedActiveFromSky(queryClient, userId, skyId, orientation);
      setActive(skyId);
    }
    setArranging(true);
    // AOD-145: entering Arrange always lands at card altitude (edit this sky), never page altitude.
    setAtPageAltitude(false);
  };

  // AOD-144: an empty page's "Add a card". For the active sky (the single-sky common case, and any freshly
  // created sky) the picker already targets it via the ['dashboard'] cache, so open it directly — no
  // setActive lag. For a non-active sky, enter Arrange (setActive + arranging) so the add flow there targets
  // the right sky without racing the active-sky refetch.
  const onAddCard = (skyId: string) => {
    if (skyId === activeId) setPicking(true);
    else enterArrange(skyId);
  };

  // AOD-144: the dial flip. Arrange -> enter Arrange on the sky currently on screen (currentPage). Glance ->
  // leave Arrange AND hand the just-edited active-sky layout back to the pager's per-sky cache, so the page
  // repaints the edit immediately (no refetch, no debounced-write race).
  const onDialChange = (mode: 'glance' | 'arrange') => {
    if (mode === 'arrange') {
      const sky = dashboards[currentPage];
      if (sky) enterArrange(sky.id);
      else {
        setArranging(true);
        setAtPageAltitude(false);
      }
    } else {
      // AOD-145: the dial to Glance EXITS Arrange from EITHER altitude — drop the altitude too. Then hand the
      // just-edited active-sky layout back to the pager's per-sky cache so the page repaints the edit at once.
      setArranging(false);
      setAtPageAltitude(false);
      // AOD-197: hand the edited layout back within the CURRENT orientation's per-sky cache.
      if (activeId) seedSkyFromActive(queryClient, userId, activeId, orientation);
    }
  };

  // AOD-145: the card-altitude capsule press / a pinch-in RISES to page altitude (manage the skies).
  const rise = () => setAtPageAltitude(true);

  // AOD-145: tap a thumbnail at page altitude -> DESCEND into that sky's cards. enterArrange seeds + sets it
  // active and lands at card altitude (atPageAltitude=false), so the tapped sky paints from frame one.
  const descendToSky = (skyId: string) => enterArrange(skyId);

  // AOD-145: after a Pro create at page altitude, createDashboard has already set the new empty sky active
  // (§1g), so "descend into it" is just dropping back to card altitude.
  const onCreated = () => setAtPageAltitude(false);

  // AOD-146 (Many Skies §1d): re-parent a carried card to the neighbour sky, then FOLLOW. moveInstance
  // optimistically drops it from this sky (rolling back on failure); on success we seed the neighbour's
  // already-loaded instances into the active-sky cache and flip it active (the AOD-144 seed-before-setActive
  // pattern), so the active-sky surface re-resolves to the neighbour and the moved card lands there. A denied
  // move already restored the card on this sky, so we simply stay put.
  const carryCardToSky = async (instanceId: string, neighborId: string) => {
    try {
      await moveInstance(instanceId, neighborId);
    } catch {
      return;
    }
    seedActiveFromSky(queryClient, userId, neighborId, orientation);
    setActive(neighborId);
  };

  // AOD-146 (Many Skies §1d): a held card was carried to a screen edge ('left'/'right') or off it (null),
  // reported by PlacedInstance's drag. The DWELL (a deliberate hold, armed here) is what disambiguates a
  // cross-sky move from a normal near-edge reposition — any edge change or the drop (edge=null) cancels it
  // before it fires. Right edge -> next sky by position, left -> previous; clamp (no-op) at the ends and for
  // a single-sky account (no neighbour). The move + follow "without ever leaving your finger" runs mid-drag;
  // the seamless slide is device polish (AOD-190). Only reachable from card-altitude Arrange (the wall / Glance
  // pager never wire onCarryEdge), so no extra mode guard is needed.
  const onCarryCardToEdge = (instanceId: string, edge: 'left' | 'right' | null) => {
    if (edgeHoldTimer.current) {
      clearTimeout(edgeHoldTimer.current);
      edgeHoldTimer.current = null;
    }
    if (!edge) return;
    const from = dashboards.findIndex((d) => d.id === activeId);
    if (from < 0) return;
    const neighbor = edge === 'right' ? dashboards[from + 1] : dashboards[from - 1];
    if (!neighbor) return; // clamp: no sky beyond this edge (covers the single-sky case too)
    edgeHoldTimer.current = setTimeout(() => {
      edgeHoldTimer.current = null;
      void carryCardToSky(instanceId, neighbor.id);
    }, EDGE_HOLD_DWELL_MS);
  };

  // AOD-145: pinch-in on the card-altitude surface is the device fast-lane to page altitude (the capsule press
  // is the deliberate, testable entry). Inert under jest — gestures need the native event system — so the
  // capsule carries the unit contract; the scale threshold keeps a small accidental pinch from rising.
  const pinchToRise = Gesture.Pinch().onEnd((e, success) => {
    'worklet';
    if (success && e.scale < 0.85) runOnJS(rise)();
  });

  // The index of the sky being arranged (the resolved active sky) — the capsule's lit dot at card altitude.
  const arrangedIndex = Math.max(
    0,
    dashboards.findIndex((d) => d.id === activeId),
  );

  // AOD-142/145: the hub trailing cluster. The Glance | Arrange dial is the PERSISTENT mode control (present
  // in both modes AND both Arrange altitudes — flipping it to Glance is how you leave Arrange), riding the
  // chrome-awake state so it sinks when the surface is idle. Its siblings follow the surface: at CARD altitude
  // the wall Preview pill (AOD-81 §6); at PAGE altitude nothing but the dial (Preview previews one sky's wall,
  // which page altitude is above); in Glance, Add + Settings. The AOD-68 dashboards-switcher chevron is RETIRED
  // (AOD-145): the pager + page altitude replace the /dashboards modal, so there is no chevron and no route.
  const canArrange = !isLoading && !isError;
  const headerRight = (
    <>
      {canArrange ? (
        <ModeDial mode={arranging ? 'arrange' : 'glance'} awake={awake} onChange={onDialChange} />
      ) : null}
      {arranging ? (
        atPageAltitude ? null : (
          <Button label="Preview" variant="ghost" size="sm" pill onPress={() => setPreviewing(true)} testID="dashboard-preview" />
        )
      ) : (
        <>
          {canArrange ? (
            <Button label="Add" variant="ghost" size="sm" onPress={() => setPicking(true)} testID="dashboard-add-widget" />
          ) : null}
          <Button label="Settings" variant="ghost" size="sm" onPress={() => router.push('/settings')} testID="dashboard-settings" />
        </>
      )}
    </>
  );

  return (
    <>
      <Screen>
        {/* AOD-142 the wake surface: any touch re-arms the chrome-awake idle timer. onTouchStart/onTouchMove
            are PASSIVE responder callbacks (they never call setResponder), so they observe the touch without
            capturing it — they can't move a card ("waking ≠ editing") and never contend with the arrange or
            paging gestures. Wrapping the whole hub means a touch on the dial, a card, the pager, or empty
            space all wake it. */}
        <View style={styles.surface} onTouchStart={wake} onTouchMove={wake} testID="dashboard-surface">
          <AppBar variant="hub" right={headerRight} testID="dashboard-header" />

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState line="Could not load your dashboard." detail={error?.message} onRetry={() => void refetch()} />
          ) : arranging && atPageAltitude ? (
            // AOD-145: PAGE altitude — the skies as thumbnail tiles (reorder / label / delete / +). It retires
            // the /dashboards switcher modal; the dial (above) still exits to Glance from here, and tapping a
            // tile descends into that sky's cards. Data + mutations come from useDashboards; the descend + the
            // post-create drop are Dashboard's altitude concerns.
            <View style={styles.body}>
              <PageAltitude
                dashboards={dashboards}
                activeId={activeId}
                onTapSky={descendToSky}
                createDashboard={createDashboard}
                onCreated={onCreated}
                renameDashboard={renameDashboard}
                reorderDashboards={reorderDashboards}
                deleteDashboard={deleteDashboard}
              />
            </View>
          ) : arranging ? (
            // AOD-144/145: CARD altitude ARRANGE — the single active-sky LayoutCanvas (as before AOD-144), now
            // wrapped in a pinch-in gesture and carrying the page-dots CAPSULE (the door up to page altitude).
            // An empty board still renders the canvas. GestureDetector needs one child, so the body View is it.
            <GestureDetector gesture={pinchToRise}>
              <View style={styles.body}>
                {/* AOD-142: the arrange-only hint. The old Glance instruction is gone — the dial is the visible
                    control now. Glance stays wordless and calm. */}
                <Text style={styles.hint}>Drag to move. Drag a corner to resize. Flip to Glance to finish.</Text>
                <LayoutCanvas
                  instances={instances}
                  arranging
                  onEnterArrange={() => setArranging(true)}
                  onExitArrange={() => setArranging(false)}
                  onCommit={commit}
                  onRequestConfigure={setConfiguring}
                  onRemove={(instanceId) => void removeWidget(instanceId)}
                  onCarryEdge={onCarryCardToEdge}
                  // AOD-197 (S4): the arrange canvas fills the screen width in the active orientation.
                  cellPx={cellPx}
                  columns={columns}
                />
                {/* AOD-145: the grown page-dots capsule, floating at the bottom over the canvas and riding the
                    chrome-awake state (box-none so only the capsule captures; the canvas keeps the rest). Press
                    (or pinch-in) rises to page altitude. */}
                <View style={[styles.capsuleBar, { bottom: rt.insets.bottom }]} pointerEvents="box-none">
                  <PageCapsule count={dashboards.length} current={arrangedIndex} awake={awake} onRise={rise} />
                </View>
              </View>
            </GestureDetector>
          ) : (
            // AOD-144: GLANCE is a horizontal pager over the skies. Each page renders its sky read-only; the
            // dots + the second-sky Pro gate live inside. A single bootstrapped sky is the common case and
            // renders as a one-page pager (no dots).
            <View style={styles.body}>
              <SkyPager
                dashboards={dashboards}
                activeId={activeId}
                // AOD-194: the active page renders the ['dashboard'] cache (the same instances Arrange and the
                // wall read), not its own ['sky', activeId] cache, so Glance and Arrange can never diverge.
                activeInstances={instances}
                // AOD-197: the non-active pages read their per-sky cache in the CURRENT device orientation, so
                // every page shows the same per-orientation resolution the active page (activeInstances) does.
                orientation={orientation}
                // AOD-197 (S4): Glance fits to width with the SAME cellPx as Arrange (WYSIWYG, design §7).
                cellPx={cellPx}
                columns={columns}
                onEnterArrange={enterArrange}
                onAddCard={onAddCard}
                createDashboard={createDashboard}
                awake={awake}
                wake={wake}
                onPageChange={setCurrentPage}
              />
            </View>
          )}

          {picking && <AddGallery onClose={() => setPicking(false)} cellPx={cellPx} columns={columns} orientation={orientation} />}
          {configuring && <ConfigureInstanceModal instance={configuring} onClose={() => setConfiguring(null)} />}
        </View>
      </Screen>
      {/* AOD-81 §6: the wall preview, mounted OVER the whole route container (a sibling of Screen, above the
          shell chrome) so the peek is edge to edge like the wall. Reachable only while arranging (now entered
          via the AOD-142 dial or a long-press); WallPreview renders an empty draft fine, so the dial entering
          Arrange on an empty board is harmless. Tap anywhere / OS back returns. */}
      {previewing ? <WallPreview instances={instances} onClose={() => setPreviewing(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  // AOD-142 the wake surface: fills the frame so a touch anywhere in the hub re-arms the idle timer.
  surface: { flex: 1 },
  body: { flex: 1 },
  hint: {
    color: theme.colors.textMuted,
    ...theme.type.meta,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
  },
  // AOD-145 the capsule bar: the page-dots capsule floats at the bottom-center of the card-altitude surface
  // (like the Glance dots), over the canvas. box-none on the wrapper so only the capsule itself captures.
  capsuleBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingVertical: theme.spacing(4),
  },
}));
