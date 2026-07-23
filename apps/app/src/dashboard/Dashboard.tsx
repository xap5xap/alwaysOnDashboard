// The dashboard screen (AOD-8 §8 DashboardLayout, rendered). It loads the signed-in user's real skies from
// Supabase under RLS (useDashboards: the active sky's live surface + the ordered sky list + create) and shows
// ONE of two surfaces: the calm GLANCE pager (SkyPager) with one read-only page per sky, or the ARRANGE
// LayoutCanvas (the free-form layout engine) once you enter Edit Screen. The screen owns the arrange-mode flag
// and the pager's current page; it never names a service (the AOD-8 seam holds end to end).
//
// AOD-195 (supersedes the AOD-142 dial): the surface IS the app — no mode label, no dial. A long-press on a
// card opens an anchored quick-actions menu (CardQuickActions), each item a NEW ENTRY POINT to an action that
// already exists: Edit Widget -> the config sheet, Edit Screen -> Arrange, Delete -> the AOD-141 tile-face
// confirm (rendered on the calm card, sub-decision 6b), and an S/M/W/L row -> the AOD-140 resize/persist path.
// A long-press on an EMPTY sky enters Edit Screen directly. Edit Screen shows a Done button (top-right) that
// exits. The AOD-142 mode SEPARATION (calm read-only vs edit, "swipe never edits", the arrange interior)
// stays; only the dial CONTROL is gone.
//
// AOD-144 (design "Many Skies" §1a/§1f): the Glance surface is a pager over the skies, so "swipe never edits"
// is structural (a page turn can never reach an edit) and the swipe-vs-card-drag conflict is dodged (no
// horizontal paging while arranging). Entering Arrange from page K sets that sky active so Arrange edits the
// sky you are viewing; leaving Arrange hands the edited layout back to the pager's per-sky cache
// (seedSkyFromActive) and returns to the pager at page K. The page dots + the Pro gate live inside SkyPager.
//
// AOD-68 canonicalization (design-core-navigation §3, §5, §8, §12 drift 1-2): the inline header is the shell
// HUB AppBar (the vela wordmark + Add + Settings + — while arranging — Preview + Done), sign out is RELOCATED
// to Account, and the ad-hoc load / error become the shell screen-level states. AOD-69 fills the AOD-27
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
import { cellPxFor, GRID_GUTTER, GRID_MARGIN } from '../layout/geometry';
import { nearestFreeSlot } from '../layout/grid';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import { useDashboards } from '../layout/useDashboards';
import { useMoveInstance } from '../layout/useMoveInstance';
import { useOrientation } from '../layout/useOrientation';
import { useRemoveWidget } from '../layout/useRemoveWidget';
import { columnsFor, SIZE_CATALOGUE } from '../widgets/sizes';
import { seedActiveFromSky, seedSkyFromActive } from '../layout/useSkyInstances';
import { WallPreview } from '../kiosk/WallPreview';
import type { WidgetInstance, WidgetSize } from '../registry/types';
import { AppBar, ErrorState, LoadingState, Screen } from '../shell';
import { Button } from '../ui/Button';
import { CardQuickActions } from './CardQuickActions';
import { PageAltitude } from './PageAltitude';
import { PageCapsule } from './PageCapsule';
import { SkyPager } from './SkyPager';
import { useChromeAwake } from './useChromeAwake';

// AOD-146 (Many Skies §1d): how long a held card must DWELL at a screen edge before it carries to the
// neighbour sky. The hold is what separates a deliberate cross-sky move from a normal near-edge reposition.
// A device-tuned seed (AOD-190), like PlacedInstance's motion timings + edge band.
const EDGE_HOLD_DWELL_MS = 600;

// AOD-195: the anchored quick-actions menu's live target — the long-pressed card, the sky it sits on, and the
// on-screen anchor (the touch point). Null = no menu open.
interface CardMenu {
  skyId: string;
  instance: WidgetInstance;
  anchor: { x: number; y: number };
}

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
  // AOD-198: cellPx reserves the outer margin (GRID_MARGIN, both sides) AND the inter-cell gutters
  // (GRID_GUTTER, C-1 of them) off the width (design §4: cellPx = (viewportW - 2*margin - (C-1)*gutter)/C), so
  // the grid sits inside a balanced margin (gridInsetPx, item 1) with real gaps between cells (gutterPx, item
  // 2). Both are handheld-only screen-px tunables threaded to the canvas; the wall passes none and stays
  // edge-to-edge / byte-identical.
  const { width: viewportW } = useWindowDimensions();
  const columns = columnsFor(orientation);
  const cellPx = cellPxFor(columns, viewportW, GRID_MARGIN, GRID_GUTTER);
  const gridInsetPx = GRID_MARGIN;
  const gutterPx = GRID_GUTTER;
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
  // meaningful while arranging; every path OUT of Arrange (Done) also resets it.
  const [atPageAltitude, setAtPageAltitude] = useState(false);
  // AOD-144: the pager's current page (a mirror of SkyPager's local scroll position, reported via
  // onPageChange). It is the sky on screen (AOD-143 warns activeId lags setActive). Persists across the
  // arrange round-trip (SkyPager unmounts in Arrange), and SkyPager re-seeds it to the active sky on remount.
  const [currentPage, setCurrentPage] = useState(0);
  // AOD-142: the single "chrome awake" idle state. `wake` is wired to the surface touch callbacks below;
  // `awake` drives the page dots + the page-altitude capsule. One timer, reset on any touch.
  const { awake, wake } = useChromeAwake();
  const [picking, setPicking] = useState(false);
  // AOD-81 §6: the wall preview peek. Owned here like `picking`/`arranging` (the app-ia locked fact: a
  // surface carrying a live object stays in-screen, never a router route), mounted as an overlay below.
  const [previewing, setPreviewing] = useState(false);
  // The instance whose config form is open (AOD-10 §4). Owned here like `picking`/`arranging` so all three
  // reconfigure entries (the menu's Edit Widget, arrange-mode "Configure", and the host's needs_config
  // prompt) route through it.
  const [configuring, setConfiguring] = useState<WidgetInstance | null>(null);
  // AOD-195: the open quick-actions menu (a long-pressed card + its anchor), null when closed.
  const [menu, setMenu] = useState<CardMenu | null>(null);
  // AOD-195 (sub-decision 6b): the instance whose menu-driven delete is being confirmed on the CALM surface
  // (the AOD-141 tile-face confirm rendered without entering Arrange). Threaded to SkyPager -> the matching card.
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
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
  // sky's LayoutCanvas) edits the sky you were viewing — the menu's Edit Screen, an empty-canvas long-press,
  // and tapping a thumbnail at page altitude all land here. The `!== activeId` guard skips a redundant
  // setActive (and its ['dashboard'] invalidate/refetch) when the on-screen sky is already active — the common
  // single-sky case, where entering Arrange must NOT reload the board. Leaving Arrange is exitArrange below.
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
    // AOD-195: an Edit Screen transition must never carry a pending CALM menu-confirm (armed on another sky
    // before the transition) — clear it so a stale "Remove?" can't re-appear on returning to that sky.
    setConfirmingRemoveId(null);
  };

  // AOD-195: leave Edit Screen (the Done button, and the tap-empty-canvas exit). Mirrors the old dial-to-Glance
  // path: drop BOTH altitudes and hand the just-edited active-sky layout back to the pager's per-sky cache so
  // the page repaints the edit immediately (no refetch, no debounced-write race).
  const exitArrange = () => {
    setArranging(false);
    setAtPageAltitude(false);
    // AOD-195: leaving Edit Screen also drops any pending calm menu-confirm (belt-and-suspenders with the
    // enter-side clear), so an arrange round-trip can never leave a stale "Remove?" armed.
    setConfirmingRemoveId(null);
    // AOD-197: hand the edited layout back within the CURRENT orientation's per-sky cache.
    if (activeId) seedSkyFromActive(queryClient, userId, activeId, orientation);
  };

  // AOD-144: an empty page's "Add a card". For the active sky (the single-sky common case, and any freshly
  // created sky) the picker already targets it via the ['dashboard'] cache, so open it directly — no
  // setActive lag. For a non-active sky, enter Arrange (setActive + arranging) so the add flow there targets
  // the right sky without racing the active-sky refetch.
  const onAddCard = (skyId: string) => {
    if (skyId === activeId) setPicking(true);
    else enterArrange(skyId);
  };

  // AOD-195: a long-press on a card opens the quick-actions menu. Make the card's sky active FIRST (seed +
  // setActive, mirroring enterArrange) so the menu's actions operate on the sky the card is on — Size / Delete
  // go through the ACTIVE-sky commit / removeWidget, and Edit Screen enters Arrange on it. The `!== activeId`
  // guard no-ops on the active sky (the common single-sky case), so a menu on the sky you're already on never
  // reloads; on a non-active page this makes the viewed sky active, exactly as the pre-AOD-195 long-press did.
  const openCardMenu = (skyId: string, instance: WidgetInstance, anchor: { x: number; y: number }) => {
    if (skyId !== activeId) {
      seedActiveFromSky(queryClient, userId, skyId, orientation);
      setActive(skyId);
    }
    setConfirmingRemoveId(null); // a fresh menu clears any stale calm confirm
    setMenu({ skyId, instance, anchor });
  };
  const closeMenu = () => setMenu(null);

  // The menu items, each routing to an EXISTING action (an entry-point rewire, not new behavior):
  const menuEditWidget = () => {
    if (menu) setConfiguring(menu.instance); // -> ConfigureInstanceModal (NOT an inline card-flip config)
    closeMenu();
  };
  const menuEditScreen = () => {
    if (menu) enterArrange(menu.skyId); // enter Arrange on this card's sky, current orientation (design §9)
    closeMenu();
  };
  const menuDeleteWidget = () => {
    if (menu) setConfirmingRemoveId(menu.instance.instanceId); // the calm tile-face confirm (sub-decision 6b)
    closeMenu();
  };
  // AOD-195: pick a size in the menu -> re-snap the card's footprint IMMEDIATELY through the same commit /
  // persist path the Arrange corner-drag uses (AOD-140 activeCommit): the new footprint from SIZE_CATALOGUE,
  // placed at the NEAREST FREE fitting slot (AOD-197 re-validation, so a grown footprint never overlaps),
  // then commit. Uses the LIVE instance (its rect/size may have changed from a prior pick this session) and
  // keeps the menu open so the segmented reflects the applied size. No need to enter Edit Screen.
  const menuSelectSize = (size: WidgetSize) => {
    if (!menu) return;
    const live = instances.find((i) => i.instanceId === menu.instance.instanceId) ?? menu.instance;
    const spec = SIZE_CATALOGUE[size];
    const occupied = instances
      .filter((i) => i.instanceId !== live.instanceId)
      .map((i) => ({ x: i.rect.x, y: i.rect.y, w: i.rect.w, h: i.rect.h }));
    const slot = nearestFreeSlot({ w: spec.nominalW, h: spec.nominalH }, occupied, { x: live.rect.x, y: live.rect.y }, columns);
    commit(live.instanceId, { rect: { x: slot.x, y: slot.y, w: slot.w, h: slot.h, z: live.rect.z }, size });
  };

  // AOD-195 (sub-decision 6b): the calm menu-confirm's Confirm — clear the confirm + remove (optimistic, the
  // active-sky useRemoveWidget); Keep just clears it. Both operate on the sky openCardMenu made active.
  const confirmRemoveFromMenu = (instanceId: string) => {
    setConfirmingRemoveId(null);
    void removeWidget(instanceId);
  };
  const cancelRemoveFromMenu = () => setConfirmingRemoveId(null);

  // The LIVE instance behind the open menu, so the size row re-marks after a re-snap (the stored menu.instance
  // is a snapshot; instances updates optimistically on commit).
  const menuInstance = menu ? instances.find((i) => i.instanceId === menu.instance.instanceId) ?? menu.instance : null;

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

  // AOD-195: the hub trailing cluster. In CALM the surface is wordless (no dial) — just Add + Settings (the
  // AOD-68 dashboards-switcher chevron is retired: the pager + page altitude replace the /dashboards modal). In
  // EDIT SCREEN (Arrange) it is Preview (AOD-81 §6, card altitude only) + Done (sub-decision 1: the exit,
  // re-adding the pill AOD-142 folded into the dial). Add hides while the board loads (nothing to arrange yet);
  // Settings always stays.
  const canArrange = !isLoading && !isError;
  const headerRight = (
    <>
      {arranging ? (
        <>
          {atPageAltitude ? null : (
            <Button label="Preview" variant="ghost" size="sm" pill onPress={() => setPreviewing(true)} testID="dashboard-preview" />
          )}
          <Button label="Done" variant="ghost" size="sm" onPress={exitArrange} testID="dashboard-done" />
        </>
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
            paging gestures. Wrapping the whole hub means a touch on a card, the pager, or empty space wakes it. */}
        <View style={styles.surface} onTouchStart={wake} onTouchMove={wake} testID="dashboard-surface">
          <AppBar variant="hub" right={headerRight} testID="dashboard-header" />

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState line="Could not load your dashboard." detail={error?.message} onRetry={() => void refetch()} />
          ) : arranging && atPageAltitude ? (
            // AOD-145: PAGE altitude — the skies as thumbnail tiles (reorder / label / delete / +). It retires
            // the /dashboards switcher modal; Done (above) still exits from here, and tapping a tile descends
            // into that sky's cards. Data + mutations come from useDashboards; the descend + the post-create
            // drop are Dashboard's altitude concerns.
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
                {/* AOD-195: the arrange-only hint. Glance stays wordless and calm; Done finishes. */}
                <Text style={styles.hint}>Drag to move. Drag a corner to resize. Tap Done to finish.</Text>
                <LayoutCanvas
                  instances={instances}
                  arranging
                  onEnterArrange={() => setArranging(true)}
                  onExitArrange={exitArrange}
                  onCommit={commit}
                  onRequestConfigure={setConfiguring}
                  onRemove={(instanceId) => void removeWidget(instanceId)}
                  onCarryEdge={onCarryCardToEdge}
                  // AOD-197 (S4): the arrange canvas fills the screen width in the active orientation.
                  cellPx={cellPx}
                  columns={columns}
                  // AOD-198: balanced outer margin (item 1) + real inter-cell gutters (item 2).
                  gridInsetPx={gridInsetPx}
                  gutterPx={gutterPx}
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
            // AOD-144: GLANCE (the calm default) is a horizontal pager over the skies. Each page renders its
            // sky read-only; the dots + the second-sky Pro gate live inside. A single bootstrapped sky is the
            // common case and renders as a one-page pager (no dots). AOD-195: a long-press on a card opens the
            // quick-actions menu; a long-press on an empty sky enters Edit Screen.
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
                // AOD-198: Glance gaps + insets identically to Arrange (WYSIWYG).
                gridInsetPx={gridInsetPx}
                gutterPx={gutterPx}
                onEnterArrange={enterArrange}
                // AOD-195: a card long-press opens the quick-actions menu; delete confirms on the calm card.
                onLongPressCard={openCardMenu}
                confirmingRemoveId={confirmingRemoveId}
                onRemove={confirmRemoveFromMenu}
                onCancelRemove={cancelRemoveFromMenu}
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
      {/* AOD-195: the anchored quick-actions menu, mounted OVER the whole route container (a sibling of Screen)
          so its absolute-fill overlay's coord space matches the gesture's window absoluteX/absoluteY. Only
          reachable from the calm surface (long-press is disabled in Arrange); an outside tap dismisses. The
          LIVE instance drives the size row so a re-snap re-marks it. */}
      {menu && menuInstance ? (
        <CardQuickActions
          instance={menuInstance}
          anchor={menu.anchor}
          onEditWidget={menuEditWidget}
          onEditScreen={menuEditScreen}
          onDeleteWidget={menuDeleteWidget}
          onSelectSize={menuSelectSize}
          onDismiss={closeMenu}
        />
      ) : null}
      {/* AOD-81 §6: the wall preview, mounted OVER the whole route container (a sibling of Screen, above the
          shell chrome) so the peek is edge to edge like the wall. Reachable only while arranging (via the
          menu's Edit Screen or an empty-canvas long-press); WallPreview renders an empty draft fine. Tap
          anywhere / OS back returns. */}
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
