// The free-form layout engine (AOD-7): a generic surface that places WidgetInstances absolutely and,
// in arrange mode, lets each be dragged and resized. It is generic over WidgetInstance/LayoutRect and
// imports NO service (AOD-8 §10 seam): adding an integration never touches this file. The parent
// (Dashboard) owns the arranging flag and drives it with the AOD-142 Glance | Arrange dial; a long-press
// on any card (AOD-49) is a shortcut INTO arrange, and the tap-empty-canvas catcher below is a convenience
// exit (onExitArrange) that sits alongside the dial. The wall callers (KioskWall / WallPreview) pass a noop
// exit and never arrange, so the catcher is inert there.
//
// AOD-140 (resolves AOD-98): the canvas ORCHESTRATES the live slot reflow. It holds every instance, so it
// owns the arrange session (useArrangeReflow): while a card is dragged/resized it draws a HAIRLINE SLOT
// where the card will land and hands every OTHER card its reflowed (uncommitted) rect to animate toward,
// then commits the moved cards on drop. Each PlacedInstance only reports its own gesture up. All of this
// is gated on `arranging`, and the wall passes arranging=false and never fires a gesture, so the wall
// render path is structurally unchanged (no hairline, no preview, inert session).
//
// AOD-196 (design §9 "scrollable"): off the wall the app is NOT immersive, so the Android nav bar occludes
// the bottom band and a below-fold card is unreachable. The HANDHELD canvas (cellPx given) becomes a VERTICAL
// scroll container whose content carries an EXPLICIT layout height = contentRows x cellPx (the VISUAL height
// after the fit-to-width scale — a transform scales visually but does NOT change layout height, so a naive
// ScrollView would compute the nominal, too-tall extent). It is floored at the measured viewport height so a
// short/empty board never collapses, plus the bottom safe-area inset so the last row clears the nav bar. The
// scroll is react-native-gesture-handler's ScrollView so it COMPOSES with each card's Pan: a card drag/resize
// blocks the scroll (blocksExternalGesture, wired in PlacedInstance), so a vertical pan STARTING on a card
// drags it while a pan on empty space scrolls. The WALL (cellPx absent) stays the non-scrolling flex:1 View —
// byte-identical, no ScrollView, no inset, no scrollRef handed to its cards (design §7, the wall never scrolls).
import React from 'react';
import { Pressable, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetInstance } from '../registry/types';
import type { LayoutPatch } from './mapper';
import { nominalGutter, UNIT_PX } from './geometry';
import { slotToPixels } from './grid';
import { PlacedInstance } from './PlacedInstance';
import { useArrangeReflow } from './useArrangeReflow';

export interface LayoutCanvasProps {
  instances: WidgetInstance[];
  arranging: boolean;
  onEnterArrange(): void;
  onExitArrange(): void;
  onCommit(instanceId: string, patch: LayoutPatch): void;
  /** Open the config form for one instance (AOD-10 §4); the dashboard owns the modal. */
  onRequestConfigure(instance: WidgetInstance): void;
  /** Delete one instance (AOD-141); the dashboard owns the mutation. Fired from the arrange-mode
   *  in-place "Remove?" confirm AND (AOD-195) the calm menu-driven confirm. The wall callers pass a noop
   *  (they never arrange or menu). */
  onRemove(instanceId: string): void;
  /** AOD-195: a long-press on a calm card reports the instance + an on-screen anchor so the dashboard can
   *  open the quick-actions menu. When present (the calm handheld surface) it REPLACES the long-press's
   *  enter-arrange role. Absent (the wall / the arrange surface, where long-press is disabled) the card
   *  falls back to onEnterArrange, which the wall passes as a noop — so the wall stays inert + byte-identical. */
  onLongPressCard?(instance: WidgetInstance, anchor: { x: number; y: number }): void;
  /** AOD-195 (sub-decision 6b): the instance whose menu-driven delete is being confirmed (dashboard-owned),
   *  so the matching calm card shows the AOD-141 tile-face confirm WITHOUT entering Arrange. */
  confirmingRemoveId?: string | null;
  /** AOD-195: Keep on the calm menu-confirm clears the dashboard's confirmingRemoveId. */
  onCancelRemove?(): void;
  /** AOD-146 (Many Skies §1d): a held card was carried to a screen edge ('left'/'right') or off it (null)
   *  while dragging. The dashboard arms the cross-sky carry dwell. Optional and forwarded straight to each
   *  card: the wall / read-only pager callers never arrange, so they simply omit it (the seam is untouched). */
  onCarryEdge?(instanceId: string, edge: 'left' | 'right' | null): void;
  /** AOD-197 (S4): the ON-SCREEN pixels per grid cell (cellPxFor(columns, viewportW), from the CALLER). When
   *  present (handheld Glance / Arrange) the cards + hairline are wrapped in a fit-to-width scale layer
   *  (scale = cellPx / UNIT_PX, top-left anchored) so they fill the screen width additively — UNIT_PX and the
   *  card internals are untouched. When ABSENT (the wall: KioskWall / WallPreview) the canvas renders EXACTLY
   *  as pre-AOD-197 — no wrapper, no scale — and the wall applies its own wallFitScale layer around it, so the
   *  kiosk path stays byte-identical. */
  cellPx?: number;
  /** AOD-198 (item 1): the outer margin in SCREEN px applied as a translate on the fit-to-width scale layer
   *  (translateX + a matching translateY), so the grid is inset from the screen edges and the margin balances
   *  both sides instead of all falling to the right (cellPx already reserves 2*margin of width). Absent (the
   *  wall, which renders no scale layer) leaves the canvas byte-identical. Handheld only. */
  gridInsetPx?: number;
  /** AOD-198 (item 2): the inter-cell gutter in SCREEN px. Threaded to every card (its position + size are
   *  gutter-augmented) and used for the landing hairline, so the whole arrange grid gaps consistently. Absent
   *  (the wall) is 0 = edge-to-edge, byte-identical. Handheld only. */
  gutterPx?: number;
  /** AOD-197 (S4): the active orientation's column count (landscape 6 / portrait 4), threaded to the arrange
   *  session + every card so a drag/resize clamps against the grid the user is touching. Defaults (absent)
   *  to the landscape GRID_COLUMNS via the hook/card, which is the wall's orientation. */
  columns?: number;
}

export function LayoutCanvas({
  instances,
  arranging,
  onEnterArrange,
  onExitArrange,
  onCommit,
  onRequestConfigure,
  onRemove,
  onLongPressCard,
  confirmingRemoveId,
  onCancelRemove,
  onCarryEdge,
  cellPx,
  gridInsetPx = 0,
  gutterPx = 0,
  columns,
}: LayoutCanvasProps) {
  const { theme, rt } = useUnistyles();
  // AOD-198 (item 2): the nominal gutter for THIS handheld scale (0 on the wall / when there is no gutter),
  // so the landing hairline sits a gutter apart exactly like the gutter-augmented cards (PlacedInstance).
  const ng = nominalGutter(gutterPx, cellPx ?? UNIT_PX);
  // The live arrange session: the active target (for the nearest-free hairline) + the gesture reporters
  // PlacedInstance drives. Inert (target: null) until a gesture fires, so on the wall / in Glance it costs a
  // useState + a noop and changes nothing (see the header note). `columns` scopes nearest-free to the active
  // orientation; absent (wall) it defaults to landscape.
  const reflow = useArrangeReflow(instances, onCommit, columns);

  // AOD-196: the handheld scroll container + its measured viewport height. `scrollRef` is handed to each
  // card's Pan (via `grid` below) ONLY on the handheld (cellPx given) so a card drag/resize blocks the scroll;
  // the wall passes no scrollRef and renders no ScrollView, so its cards' gestures are byte-identical.
  // `viewportH` floors the content height so a short/empty board fills the screen and never collapses; it stays
  // 0 until onLayout fires (and on the wall, which never reads it).
  const scrollRef = React.useRef(null);
  const [viewportH, setViewportH] = React.useState(0);

  // AOD-197 (S4): the hairline + the cards, laid out on the NOMINAL UNIT_PX grid. On the handheld (cellPx
  // given) the grid is wrapped in the fit-to-width scale layer below so it fills the screen width; on the
  // wall (cellPx absent) it renders directly — structurally byte-identical to pre-AOD-197 — and KioskWall
  // scales the whole canvas with its own wallFitScale layer.
  const grid = (
    <>
      {/* AOD-140: the hairline slot — a thin outline at the nearest-free slot the held/resized card will land
          on (AOD-197 place-don't-pack), visible only while a gesture is active in arrange. Behind the cards
          (drawn before them) and non-interactive, so it never intercepts the gesture it is illustrating. */}
      {arranging && reflow.activeSlot ? (
        <View
          pointerEvents="none"
          testID="arrange-hairline-slot"
          style={[
            styles.hairlineSlot,
            pxStyle(reflow.activeSlot, ng),
            { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.md },
          ]}
        />
      ) : null}
      {instances.map((instance) => (
        <PlacedInstance
          key={instance.instanceId}
          instance={instance}
          arranging={arranging}
          // AOD-195: a calm long-press opens the quick-actions menu (onLongPressCard, given the instance +
          // an anchor). The wall / arrange surface pass no onLongPressCard, so the card falls back to the
          // nullary onEnterArrange — a noop on the wall (byte-identical), inert in arrange (long-press off).
          onLongPress={onLongPressCard ?? (() => onEnterArrange())}
          // AOD-195: the dashboard-driven menu-confirm shows the AOD-141 tile face on this card without
          // entering Arrange. Only the matching id (calm surface) confirms; the wall passes neither.
          menuConfirmingRemove={confirmingRemoveId != null && confirmingRemoveId === instance.instanceId}
          onCancelMenuRemove={onCancelRemove}
          // Place-don't-pack (AOD-197 S4): previewFor is always null (neighbours never move), so a card only
          // ever rests at its committed rect. Kept gated on `arranging` for symmetry with the hairline above.
          previewRect={arranging ? reflow.previewFor(instance.instanceId) : null}
          onArrangeMove={reflow.onArrangeMove}
          onArrangeEnd={reflow.onArrangeEnd}
          onArrangeCancel={reflow.onArrangeCancel}
          onRequestConfigure={onRequestConfigure}
          onRemove={onRemove}
          onCarryEdge={onCarryEdge}
          cellPx={cellPx}
          gutterPx={gutterPx}
          columns={columns}
          // AOD-196: only the handheld (scrollable) canvas hands its cards the scroll ref so a card drag/resize
          // blocks the vertical scroll (place-on-card wins). The wall renders no ScrollView, so it passes none
          // and PlacedInstance's gesture config stays byte-identical.
          scrollRef={cellPx != null ? scrollRef : undefined}
        />
      ))}
    </>
  );

  // AOD-197 (S4) fit-to-width: scale the nominal grid so cells fill the screen width, anchored at the top-left
  // (the grid grows from the corner). box-none so this layer is NEVER a touch target: a card subview still
  // receives its drag/long-press, and a tap on empty space falls THROUGH to the exitCatcher behind (the "tap
  // empty to exit arrange" affordance). The wall never takes this branch.
  // AOD-197: the fit-to-width scale (cellPx / UNIT_PX) grows the nominal grid from the top-left. AOD-198
  // (item 1): when an outer margin is given, translate by it on BOTH axes FIRST so it is OUTERMOST — it then
  // shifts the whole scaled grid by gridInsetPx SCREEN px, balancing the margin cellPx already reserved off
  // both sides (was all falling right). No inset -> the bare scale (byte-identical to pre-AOD-198).
  const scale = (cellPx ?? UNIT_PX) / UNIT_PX;
  const scaleTransform = gridInsetPx
    ? [{ translateX: gridInsetPx }, { translateY: gridInsetPx }, { scale }]
    : [{ scale }];
  const scaleLayer = (
    <View
      pointerEvents="box-none"
      style={[styles.scaleLayer, { transform: scaleTransform }]}
      testID="layout-scale-layer"
    >
      {grid}
    </View>
  );
  // Behind the cards: a full-bleed catcher so a tap on empty space leaves arrange mode (inert on the wall,
  // which passes a noop exit and never arranges).
  const exitCatcher = arranging ? (
    <Pressable style={styles.exitCatcher} onPress={onExitArrange} accessibilityLabel="Done arranging" />
  ) : null;

  if (cellPx != null) {
    // AOD-196 the HANDHELD scroll container. The scroll content carries an EXPLICIT layout height equal to the
    // VISUAL height (contentRows x cellPx) — a transform scales the grid visually but never changes its layout
    // height, so this is what makes the ScrollView's extent match what is on screen — floored at the measured
    // viewport height (so a short/empty board fills the screen, never collapses) plus the bottom safe-area
    // inset (so the deepest row clears the Android nav bar). GestureScrollView (react-native-gesture-handler)
    // composes with each card's Pan: a card drag/resize blocks it (PlacedInstance.blocksExternalGesture), so a
    // vertical pan on a card drags and a pan on empty space scrolls. Horizontal sky paging stays the SkyPager
    // FlatList above this (AOD-144). The wall never takes this branch (design §7: the wall does not scroll).
    const contentRows = Math.max(1, ...instances.map((i) => i.rect.y + i.rect.h));
    // AOD-198: each unit-row occupies a cell PLUS its gutter (the pitch cellPx + gutterPx), and the grid is
    // inset from the top by gridInsetPx (item 1). Reserve both, plus the bottom safe-area inset, so the
    // deepest gapped row still clears the Android nav bar. Both insets default to 0, so a no-gutter / no-inset
    // caller keeps the pre-AOD-198 contentRows x cellPx (+ bottom inset) extent.
    const contentHeight = Math.max(viewportH, contentRows * (cellPx + gutterPx) + gridInsetPx + rt.insets.bottom);
    return (
      <GestureScrollView
        ref={scrollRef}
        style={styles.canvas}
        showsVerticalScrollIndicator={false}
        onLayout={(e: LayoutChangeEvent) => setViewportH(e.nativeEvent.layout.height)}
        testID="layout-scroll"
      >
        <View style={[styles.scrollBody, { height: contentHeight }]} testID="layout-scroll-content">
          {exitCatcher}
          {scaleLayer}
        </View>
      </GestureScrollView>
    );
  }

  // The WALL (cellPx absent): the non-scrolling flex:1 canvas exactly as pre-AOD-196 — no ScrollView, no inset,
  // the bare nominal grid (KioskWall scales the whole canvas with its own wallFitScale layer). Byte-identical.
  return (
    <View style={styles.canvas}>
      {exitCatcher}
      {grid}
    </View>
  );
}

/** The absolute box (px) for a landing slot on the handheld gutter-augmented grid: the shared nominal
 *  slot<->pixel mapping (grid.slotToPixels, byte-consistent with the cards' geometry.toPixels) PLUS the
 *  nominal gutter `ng`, matching PlacedInstance's gutter-augmented card box so the hairline lands where the
 *  card will. ng is 0 on the wall / when there is no gutter, so this reduces to the bare slotToPixels. */
function pxStyle(slot: Parameters<typeof slotToPixels>[0], ng: number) {
  const p = slotToPixels(slot);
  return {
    left: slot.x * ng + p.left,
    top: slot.y * ng + p.top,
    width: p.width + (slot.w - 1) * ng,
    height: p.height + (slot.h - 1) * ng,
  };
}

const styles = StyleSheet.create(() => ({
  canvas: {
    flex: 1,
    position: 'relative',
  },
  // AOD-196 the scroll content body: an explicit-height (contentRows x cellPx, floored at the viewport +
  // bottom inset — applied inline) relative box the absolute cards + hairline + exitCatcher position within,
  // so the ScrollView's scroll extent equals the on-screen (scaled) height. Handheld only; never on the wall.
  scrollBody: {
    position: 'relative',
  },
  exitCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // AOD-197 (S4) the handheld fit-to-width layer: fills the canvas and grows the nominal UNIT_PX grid from
  // the top-left (transformOrigin) by scale = cellPx / UNIT_PX, exactly like KioskWall's wallFitScale layer.
  // The dynamic transform is applied inline; box-none (set on the element) keeps it out of hit-testing.
  scaleLayer: {
    flex: 1,
    transformOrigin: 'left top',
  },
  // AOD-140 the landing-slot hairline: a 1.5px dashed accent outline over a faint accent wash (colours +
  // radius applied inline, resolved from the theme like the arrange affordances). Position rides pxStyle.
  hairlineSlot: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
}));
