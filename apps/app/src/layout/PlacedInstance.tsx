// One placed widget instance: it positions an AOD-8 WidgetInstance in slot space and, in arrange mode,
// makes it draggable and resizable with LIVE snapping (AOD-140, resolves AOD-98). Live geometry runs on
// the UI thread via reanimated shared values (no React re-render while dragging, the always-on hot path
// wants that, AOD-25). The felt "snap on release" is gone:
//   - DRAG: the held card lifts one step and follows the finger; on every grid boundary it crosses it
//     reports its snapped TARGET slot up (runOnJS at slot-change granularity, not per frame), so the
//     LayoutCanvas hairline + the neighbour reflow track it live. On drop it settles into that slot and
//     commits via the pure snapDrag (AOD-138 commit math).
//   - RESIZE: the footprint flips DISCRETELY under the finger to the nearest SUPPORTED slot (S/M/W/L
//     constrained to the widget's declared sizes), so what you drag is what you get and what commits.
// A neighbour (a card whose sibling is being dragged) animates toward the reflowed rect LayoutCanvas hands
// it via `previewRect`, and back to its committed rect when the gesture ends or cancels. The multi-card
// commit is owned by LayoutCanvas/useArrangeReflow (it holds every instance); this card only reports its
// own gesture. It still imports no service: the AOD-8 §10 seam holds (it knows WidgetInstance/LayoutRect,
// not which service this is), and every AOD-141 affordance (Configure/Remove pills, the 44pt resize
// handle, the two-step "Remove?" confirm face) is preserved.
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { WidgetHost } from '../host/WidgetHost';
import { useRegistry } from '../registry/RegistryProvider';
import { GRID_COLUMNS, MAX_SLOT_H, MAX_SLOT_W, SIZE_CATALOGUE } from '../widgets/sizes';
import type { LayoutRect, WidgetInstance } from '../registry/types';
import { snapDrag, UNIT_PX } from './geometry';
import type { GridRect } from './grid';

// Motion timings (ms). The gesture FEEL — lift depth, reflow smoothness, live-snap latency on the low-DPI
// Fire HD 8 — is a device concern (AOD-190); these are the tunable seeds.
const LIFT = { duration: 140 } as const; // the held card raising / settling back
const REFLOW = { duration: 190 } as const; // a neighbour easing into its reflowed slot
const SETTLE = { duration: 160 } as const; // the dropped card settling onto its snapped slot
const LIFT_SCALE = 0.03; // the "one step up" scale while held (surface-step model, not a heavy shadow)
// AOD-146 (Many Skies §1d): how near the screen edge (px) the finger must carry a held card before the
// dashboard arms the cross-sky "hold" dwell. Screen-space, not slot-space — the true edge of the display.
// A device-tuned seed (AOD-190), like the motion timings above.
const EDGE_BAND_PX = 28;

export interface PlacedInstanceProps {
  instance: WidgetInstance;
  arranging: boolean;
  /** AOD-195: long-press anywhere on the calm card reports the instance + an on-screen anchor (the touch
   *  point, from the gesture's absoluteX/absoluteY) so the dashboard can open the iPad-style quick-actions
   *  menu near this card. Enabled only OUTSIDE arrange (inside Arrange the card is draggable). The wall's
   *  LayoutCanvas passes a nullary fallback (its onEnterArrange noop) so a wall long-press stays inert. */
  onLongPress(instance: WidgetInstance, anchor: { x: number; y: number }): void;
  /** The reflowed (uncommitted) rect this card should animate to while a SIBLING is being dragged/resized
   *  (AOD-140). Null = rest at the committed rect (this is the active card, or nothing is being dragged).
   *  LayoutCanvas/useArrangeReflow computes it; this card just eases toward it. */
  previewRect: LayoutRect | null;
  /** The live gesture crossed a grid boundary (drag) or flipped size (resize): report the new target slot
   *  so LayoutCanvas can move the hairline and reflow the neighbours. Slot-change granularity. */
  onArrangeMove(instanceId: string, slot: GridRect): void;
  /** The gesture ended: LayoutCanvas commits this card at its nearest-free landing and RETURNS that landing
   *  (design §8) so this card settles exactly where the hairline showed — never resting on the neighbour it
   *  was dropped onto, and animating back to its own origin on a no-op drop. */
  onArrangeEnd(instanceId: string, slot: GridRect): GridRect;
  /** The gesture was cancelled (not completed): LayoutCanvas drops the preview and commits nothing. */
  onArrangeCancel(): void;
  /** Open the per-instance config form (AOD-10 §4). Generic over the registry; the dashboard owns the
   *  modal. Reached two ways: the arrange-mode "Configure" affordance and the host's needs_config
   *  "Reconfigure" prompt (the previously unwired WidgetHost onReconfigure seam). */
  onRequestConfigure(instance: WidgetInstance): void;
  /** Delete this instance (AOD-141, resolves AOD-104). Fired from the in-place "Remove?" confirm; the
   *  dashboard owns the mutation (useRemoveWidget: client-direct RLS delete + optimistic cache update).
   *  Connections survive — removing a card never disconnects its service. */
  onRemove(instanceId: string): void;
  /** AOD-195 (sub-decision 6b): a MENU-driven delete from the calm long-press menu shows the AOD-141
   *  "Remove?" tile-face confirm WITHOUT entering Arrange. When the dashboard is confirming THIS card's
   *  removal (confirmingRemoveId === instanceId), it passes true and the same confirm face renders in calm
   *  mode; Confirm fires onRemove, Keep fires onCancelMenuRemove. Absent (the wall, and the in-arrange
   *  Remove-pill path, which uses the card's OWN local confirm state) leaves the render byte-identical. */
  menuConfirmingRemove?: boolean;
  /** AOD-195: Keep on the menu-driven confirm clears the dashboard-owned confirmingRemoveId. */
  onCancelMenuRemove?(): void;
  /** AOD-146 (Many Skies §1d): while dragging in arrange, the finger reached a SCREEN edge ('left'/'right')
   *  or left it (null). The dashboard arms a short "hold" dwell on a non-null edge to carry THIS card to the
   *  neighbour sky (the dwell disambiguates it from a normal near-edge reposition). Optional: this card stays
   *  sky-agnostic (AOD-8 §10 seam) and the wall / read-only callers never arrange, so they never wire it. */
  onCarryEdge?(instanceId: string, edge: 'left' | 'right' | null): void;
  /** AOD-197 (S4): the ON-SCREEN pixels per grid cell under the LayoutCanvas fit-to-width scale. The drag/
   *  resize worklets convert finger px -> slot units by dividing by THIS (not the nominal UNIT_PX), because
   *  one on-screen cell is cellPx wide once the parent scales the nominal canvas. The RENDER still uses
   *  UNIT_PX (the parent scale sizes the card on screen). Defaults to UNIT_PX so the wall — which never
   *  arranges and passes no cellPx — is byte-identical. */
  cellPx?: number;
  /** AOD-197 (S4): the active orientation's column count (landscape 6 / portrait 4). Clamps a dragged or
   *  resized footprint on-grid (x + w <= columns). Defaults to the landscape GRID_COLUMNS. */
  columns?: number;
  /** AOD-196: the handheld canvas's vertical ScrollView (react-native-gesture-handler). When present the
   *  drag + resize Pans BLOCK it (blocksExternalGesture), so a vertical pan that STARTS on this card drags/
   *  resizes it while a pan on empty space scrolls the canvas. Absent (the wall, which renders no ScrollView
   *  and never scrolls) leaves the gesture config byte-identical to pre-AOD-196. */
  scrollRef?: React.RefObject<React.ComponentType | undefined | null>;
}

export function PlacedInstance({
  instance,
  arranging,
  onLongPress,
  previewRect,
  onArrangeMove,
  onArrangeEnd,
  onArrangeCancel,
  onRequestConfigure,
  onRemove,
  menuConfirmingRemove = false,
  onCancelMenuRemove,
  onCarryEdge,
  cellPx = UNIT_PX,
  columns = GRID_COLUMNS,
  scrollRef,
}: PlacedInstanceProps) {
  const registry = useRegistry();
  const def = registry.getWidgetDef(instance.serviceId, instance.widgetType);
  // Every widget declares 1-4 sizes, but an empty supportedSizes is type-possible; guard it so
  // supportedSlotFor's supportedW[0]/supportedH[0] can never be undefined -> a NaN slot. Fall back to the
  // instance's own size (AOD-192 hardening; no behaviour change for the normal, non-empty case).
  const declaredSizes = def?.supportedSizes ?? [instance.size];
  const supportedSizes = declaredSizes.length > 0 ? declaredSizes : [instance.size];

  // The widget's declared footprints as parallel number arrays, so the resize worklet can snap to the
  // nearest SUPPORTED slot on the UI thread (a captured array is workletizable; SIZE_CATALOGUE maps each
  // slot id to its nominal w/h). This is what keeps a restricted widget (e.g. Calendar ['S','W']) from
  // ever showing — or committing — a size it does not support.
  const { supportedW, supportedH } = useMemo(() => {
    const ws: number[] = [];
    const hs: number[] = [];
    for (const s of supportedSizes) {
      ws.push(SIZE_CATALOGUE[s].nominalW);
      hs.push(SIZE_CATALOGUE[s].nominalH);
    }
    return { supportedW: ws, supportedH: hs };
  }, [supportedSizes]);

  // Resolve the AOD-27 §10 `arrange` role-name aliases at the call site (the AOD-67 pattern for token
  // groups): the Unistyles babel plugin does not trace a computed `theme.colors[role]` through
  // StyleSheet.create, so the arrange colours + geometry are applied inline here, not in the sheet below.
  const { theme } = useUnistyles();
  const a = theme.arrange;
  const arrangeColor = (role: string) => (theme.colors as Record<string, string>)[role];

  // AOD-141: the two-step in-place delete. Tapping Remove flips the tile's own face into a "Remove?"
  // confirm (no modal); confirming fires onRemove, Keep reverts. Leaving arrange mode always resets it so
  // a re-entry never opens on a stale confirm.
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  useEffect(() => {
    if (!arranging) setConfirmingRemove(false);
  }, [arranging]);

  // AOD-195 (sub-decision 6b): the confirm face shows for EITHER the in-arrange Remove pill (local
  // confirmingRemove) OR a menu-driven delete on the calm surface (menuConfirmingRemove, dashboard-owned).
  // In the menu case Keep clears the dashboard's confirmingRemoveId; the in-arrange case keeps its local
  // reset. (menuConfirmingRemove only arrives in calm mode, so it never collides with the arrange pills.)
  const showConfirm = menuConfirmingRemove || (arranging && confirmingRemove);
  const onKeep = menuConfirmingRemove ? onCancelMenuRemove ?? (() => {}) : () => setConfirmingRemove(false);

  // Live geometry (nominal slot units) owned by the UI thread.
  const x = useSharedValue(instance.rect.x);
  const y = useSharedValue(instance.rect.y);
  const w = useSharedValue(instance.rect.w);
  const h = useSharedValue(instance.rect.h);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);
  const startRx = useSharedValue(0); // the committed origin a resize re-clamps from as the footprint grows
  const lift = useSharedValue(0); // 0..1: the "held" elevation (drives scale + z + a restrained shadow)
  // Slot-change throttles so the worklets cross to JS only when the SNAPPED target actually changes, not
  // every frame. Drag tracks its snapped ORIGIN; resize tracks its RAW slot (JS then maps that to the
  // nearest SUPPORTED footprint — see applyResizeSlot). Both keep runOnJS at slot granularity.
  const lastDx = useSharedValue(instance.rect.x);
  const lastDy = useSharedValue(instance.rect.y);
  const lastRw = useSharedValue(instance.rect.w);
  const lastRh = useSharedValue(instance.rect.h);
  // AOD-146: the last reported screen-edge state (-1 left / 0 none / 1 right), so the drag worklet crosses to
  // JS only when the edge actually changes — the same throttle discipline as the slot reporters above.
  const edgeState = useSharedValue(0);
  // The display width (px) captured for the edge test in the drag worklet (a plain number, workletizable like
  // the module constants the gestures already close over). Arrange is portrait; AOD-190 device-tunes the band.
  const screenWidth = Dimensions.get('window').width;

  // The rect this card should be showing: the reflow PREVIEW while a sibling gesture is active, else its
  // committed rect. Driving the shared values here (short timing) is how a neighbour eases into its
  // reflowed slot during a drag/resize and eases back if the gesture cancels. The ACTIVE card gets a null
  // previewRect and a stable committed rect through its own gesture, so these deps do not change mid-drag
  // and this effect never fights the finger. On mount / cold reload the target equals the current value,
  // so withTiming is a no-op (no spurious animation).
  const target = previewRect ?? instance.rect;
  useEffect(() => {
    x.value = withTiming(target.x, REFLOW);
    y.value = withTiming(target.y, REFLOW);
    w.value = withTiming(target.w, REFLOW);
    h.value = withTiming(target.h, REFLOW);
  }, [target.x, target.y, target.w, target.h, x, y, w, h]);

  // JS-thread reporters. Defined in render so they close over the latest props; the gestures are recreated
  // each render (below), so the worklets always capture the current reporters.
  const reportMove = (sx: number, sy: number, sw: number, sh: number) =>
    onArrangeMove(instance.instanceId, { x: sx, y: sy, w: sw, h: sh });
  const finishDrag = (dxPx: number, dyPx: number) => {
    const s = snapDrag(instance.rect, dxPx, dyPx, cellPx, columns);
    const landing = onArrangeEnd(instance.instanceId, { x: s.x, y: s.y, w: s.w, h: s.h });
    // AOD-190 (C2): settle DIRECTLY onto the authoritative nearest-free landing (design §8), unconditionally.
    // A free drop lands where the finger is (landing == the raw snapDrag slot, feel unchanged); an occupied
    // drop lands at the nearest free slot with NO transient overlap on the card it was dropped onto (the tall-M
    // "landed overlapping" retune). The committed move self-corrects via the instance.rect effect, which targets
    // the same landing, so the two never fight; a no-op drop settles back to its own origin.
    x.value = withTiming(landing.x, SETTLE);
    y.value = withTiming(landing.y, SETTLE);
  };
  // AOD-146: forward a screen-edge crossing to the dashboard's carry-to-neighbour dwell. Maps the worklet's
  // numeric edge (-1/0/1) to the direction the dashboard reasons about; null clears any armed dwell.
  const reportEdge = (edge: number) =>
    onCarryEdge?.(instance.instanceId, edge < 0 ? 'left' : edge > 0 ? 'right' : null);
  // Resize is snapped on the JS thread (not the worklet) so the "nearest supported footprint" search never
  // has to run over a captured array on the UI thread: the worklet only does inline number math (the RAW
  // round-to-slot, like drag) and hands the raw slot here at footprint-change granularity. supportedSlotFor
  // maps a raw {1,2} slot to the nearest footprint the widget actually declares (so a restricted widget —
  // e.g. Calendar ['S','W'] — never shows or commits an unsupported size) and re-clamps the origin column.
  const supportedSlotFor = (rw: number, rh: number): GridRect => {
    let bw = supportedW[0];
    let bh = supportedH[0];
    let bd = Infinity;
    for (let i = 0; i < supportedW.length; i++) {
      const dw = rw - supportedW[i];
      const dh = rh - supportedH[i];
      const d = dw * dw + dh * dh; // squared distance over the declared footprints
      if (d < bd) {
        bd = d;
        bw = supportedW[i];
        bh = supportedH[i];
      }
    }
    const tx = Math.min(columns - bw, Math.max(0, startRx.value)); // shift left at the right edge when full-width
    return { x: tx, y: instance.rect.y, w: bw, h: bh };
  };
  // Live resize step: snap the raw slot to a supported footprint, flip the VISIBLE size to it (setting the
  // shared values from JS marshals to the UI thread — a ~1-frame lag is imperceptible for a discrete flip),
  // and report the target so the hairline + neighbours reflow. What flips is what commits (WYSIWYG).
  const applyResizeSlot = (rw: number, rh: number) => {
    const s = supportedSlotFor(rw, rh);
    w.value = s.w;
    h.value = s.h;
    x.value = s.x;
    onArrangeMove(instance.instanceId, s);
  };
  const finishResize = (rw: number, rh: number) => {
    // Re-derive the supported slot deterministically (independent of whether the last live step landed), so
    // the committed footprint equals the visible one even if a frame was dropped; settle the visible size.
    const s = supportedSlotFor(rw, rh);
    w.value = s.w;
    h.value = s.h;
    x.value = s.x;
    // Unlike a drag, resize does not redirect its settle to onArrangeEnd's returned landing: a resize only ever
    // changes the FOOTPRINT (its origin stays put, right-edge-clamped), so if the grown footprint had to nudge
    // off a neighbour the size changed too — activeCommit fires and the instance.rect effect corrects the
    // origin. A same-size, same-place resize is a true no-op whose landing IS this origin, so nothing strands.
    onArrangeEnd(instance.instanceId, s);
  };
  const cancelGesture = () => onArrangeCancel();

  // AOD-195: report the long-press UP with the touch point (absoluteX/absoluteY, window coords) so the
  // dashboard can anchor the quick-actions menu near this card. Enabled only in calm mode (inside Arrange
  // the card is dragged, not menued) and never while its own menu-confirm face is showing.
  const reportLongPress = (ax: number, ay: number) => onLongPress(instance, { x: ax, y: ay });
  const longPress = Gesture.LongPress()
    .enabled(!arranging && !menuConfirmingRemove)
    .minDuration(350)
    .onStart((e) => {
      'worklet';
      runOnJS(reportLongPress)(e.absoluteX, e.absoluteY);
    });

  const drag = Gesture.Pan()
    // While confirming a remove, the tile face IS the question: freeze drag so a stray pan on the
    // confirm scrim never moves the card mid-decision.
    .enabled(arranging && !confirmingRemove)
    .onStart(() => {
      'worklet';
      startX.value = x.value;
      startY.value = y.value;
      lift.value = withTiming(1, LIFT);
      // Open the hairline at the current slot immediately (a "slot opens where it will land").
      const tw = w.value;
      const tx = Math.min(columns - tw, Math.max(0, Math.round(x.value)));
      const ty = Math.max(0, Math.round(y.value));
      lastDx.value = tx;
      lastDy.value = ty;
      runOnJS(reportMove)(tx, ty, tw, h.value);
    })
    .onUpdate((e) => {
      'worklet';
      // The held card follows the finger (continuous, lifted); the hairline snaps. AOD-197: finger px ->
      // slot units divides by the ON-SCREEN cell (cellPx), and the column clamp uses the active count.
      const contX = Math.max(0, startX.value + e.translationX / cellPx);
      const contY = Math.max(0, startY.value + e.translationY / cellPx);
      x.value = contX;
      y.value = contY;
      const tw = w.value; // footprint is unchanged during a move
      const tx = Math.min(columns - tw, Math.max(0, Math.round(contX)));
      const ty = Math.max(0, Math.round(contY));
      if (tx !== lastDx.value || ty !== lastDy.value) {
        lastDx.value = tx;
        lastDy.value = ty;
        runOnJS(reportMove)(tx, ty, tw, h.value);
      }
      // AOD-146 (Many Skies §1d): additively report when the FINGER is carried to a screen edge, so the
      // dashboard can arm the hold dwell that carries this card to the neighbour sky. Screen-space
      // (absoluteX), independent of the slot snap above; edge-change granularity, like the slot report.
      const edge = e.absoluteX <= EDGE_BAND_PX ? -1 : e.absoluteX >= screenWidth - EDGE_BAND_PX ? 1 : 0;
      if (edge !== edgeState.value) {
        edgeState.value = edge;
        runOnJS(reportEdge)(edge);
      }
    })
    .onEnd((e) => {
      'worklet';
      // AOD-190 (C2): do NOT snap to the raw finger slot here — it can sit ON an occupied neighbour (e.g. a
      // tall M's lower cell), a visible transient overlap before finishDrag redirects. Hold the lifted finger
      // position; finishDrag settles DIRECTLY onto the authoritative nearest-free landing (design §8), which
      // equals the card's own origin on a true drop-in-place, so nothing strands.
      runOnJS(finishDrag)(e.translationX, e.translationY);
    })
    .onFinalize((_e, success) => {
      'worklet';
      lift.value = withTiming(0, LIFT);
      // AOD-146: the finger is lifting (or the gesture cancelled) — clear any armed edge-hold so a pending
      // carry never fires after the drag ends. A no-op report unless an edge was actually held.
      if (edgeState.value !== 0) {
        edgeState.value = 0;
        runOnJS(reportEdge)(0);
      }
      if (!success) {
        // Cancelled (not completed): restore to the committed rect, drop the preview, commit nothing.
        x.value = withTiming(instance.rect.x, SETTLE);
        y.value = withTiming(instance.rect.y, SETTLE);
        runOnJS(cancelGesture)();
      }
    });

  const resize = Gesture.Pan()
    .enabled(arranging && !confirmingRemove)
    .onStart(() => {
      'worklet';
      startW.value = w.value;
      startH.value = h.value;
      startRx.value = x.value;
      lift.value = withTiming(1, LIFT);
      lastRw.value = Math.round(w.value);
      lastRh.value = Math.round(h.value);
      // Open the hairline at the current slot; applyResizeSlot snaps it to the widget's own footprint.
      runOnJS(applyResizeSlot)(w.value, h.value);
    })
    .onUpdate((e) => {
      'worklet';
      // Only inline number math on the UI thread: grow the extents and round to a RAW slot ({1,2}). The
      // supported-footprint choice + the visible flip happen in applyResizeSlot (JS), fired only when the
      // raw slot changes — so what you drag flips discretely and never lands on an unsupported size.
      const rw = Math.min(MAX_SLOT_W, Math.max(1, Math.round(startW.value + e.translationX / cellPx)));
      const rh = Math.min(MAX_SLOT_H, Math.max(1, Math.round(startH.value + e.translationY / cellPx)));
      if (rw !== lastRw.value || rh !== lastRh.value) {
        lastRw.value = rw;
        lastRh.value = rh;
        runOnJS(applyResizeSlot)(rw, rh);
      }
    })
    .onEnd((e) => {
      'worklet';
      // Re-derive the raw slot from the total translation and commit it (finishResize maps raw -> supported
      // deterministically), so the drop is correct even if the final onUpdate frame was coalesced.
      const rw = Math.min(MAX_SLOT_W, Math.max(1, Math.round(startW.value + e.translationX / cellPx)));
      const rh = Math.min(MAX_SLOT_H, Math.max(1, Math.round(startH.value + e.translationY / cellPx)));
      runOnJS(finishResize)(rw, rh);
    })
    .onFinalize((_e, success) => {
      'worklet';
      lift.value = withTiming(0, LIFT);
      if (!success) {
        w.value = withTiming(instance.rect.w, SETTLE);
        h.value = withTiming(instance.rect.h, SETTLE);
        x.value = withTiming(instance.rect.x, SETTLE);
        runOnJS(cancelGesture)();
      }
    });

  // AOD-196: on the handheld canvas (a vertical ScrollView is present) the drag + resize BLOCK the scroll, so a
  // vertical pan that starts on this card drags/resizes it instead of scrolling; a pan on empty space still
  // scrolls (no card gesture blocks it there). The wall renders no ScrollView and passes no scrollRef, so this
  // is skipped and the gesture config stays byte-identical (blocksExternalGesture mutates + returns the gesture,
  // so calling it in place needs no reassignment).
  if (scrollRef) {
    drag.blocksExternalGesture(scrollRef);
    resize.blocksExternalGesture(scrollRef);
  }

  const animatedStyle = useAnimatedStyle(() => ({
    left: x.value * UNIT_PX,
    top: y.value * UNIT_PX,
    width: w.value * UNIT_PX,
    height: h.value * UNIT_PX,
    // The "held" lift: a small scale up + raise above the neighbours. The design's elevation model is
    // surface-STEP (a drop shadow reads as glare on the emissive night panel), so the shadow is kept
    // restrained and exists only while lifted (0 at rest, and the wall never lifts). AOD-190 tunes it.
    transform: [{ scale: 1 + lift.value * LIFT_SCALE }],
    zIndex: lift.value > 0 ? 50 : 0,
    shadowOpacity: lift.value * 0.18,
    shadowRadius: lift.value * 12,
    shadowOffset: { width: 0, height: lift.value * 4 },
    elevation: lift.value * 6,
  }));

  // Long-press (enter arrange) wraps the whole card; drag is a nested detector on the body. The resize
  // handle is a SIBLING of the drag detector (not nested inside it) so the two Pans never contend, and
  // it carries a 44pt hit target so it is reliably grabbable.
  return (
    <GestureDetector gesture={longPress}>
      <Animated.View style={[styles.positioned, animatedStyle]}>
        <GestureDetector gesture={drag}>
          <View
            testID={`card-face-${instance.instanceId}`}
            style={[
              styles.body,
              arranging && { borderColor: arrangeColor(a.selectBorder), backgroundColor: arrangeColor(a.selectFill) },
            ]}
          >
            {/* Wire the previously-unwired host onReconfigure seam to the dashboard's config form. */}
            <WidgetHost instance={instance} onReconfigure={() => onRequestConfigure(instance)} />
          </View>
        </GestureDetector>
        {arranging && !confirmingRemove ? (
          <>
            {/* A generic arrange-mode affordance to configure any widget, not only a needs_config one
                (AOD-52 cut). A sibling of the drag detector, so a tap never starts a drag. */}
            <Pressable
              onPress={() => onRequestConfigure(instance)}
              style={[styles.configurePill, { backgroundColor: arrangeColor(a.configurePill.bg) }]}
              accessibilityRole="button"
              accessibilityLabel="Configure widget"
              testID={`configure-${instance.instanceId}`}
            >
              <Text style={[styles.configureText, { color: arrangeColor(a.configurePill.label) }]}>Configure</Text>
            </Pressable>
            {/* AOD-141: the Remove pill, top-right so it clears the top-left Configure pill and the
                bottom-right resize dot. Tapping it does NOT delete — it flips the tile face into the
                "Remove?" confirm below, so the destructive step is always two-tap. */}
            <Pressable
              onPress={() => setConfirmingRemove(true)}
              style={[styles.removePill, { backgroundColor: arrangeColor(a.removePill.bg) }]}
              accessibilityRole="button"
              accessibilityLabel="Remove widget"
              testID={`remove-${instance.instanceId}`}
            >
              <Text style={[styles.configureText, { color: arrangeColor(a.removePill.label) }]}>Remove</Text>
            </Pressable>
            <GestureDetector gesture={resize}>
              <View
                style={[styles.handleHit, { width: a.handle.hit, height: a.handle.hit }]}
                accessibilityLabel="Resize widget"
                accessibilityRole="adjustable"
              >
                <View
                  style={[
                    styles.handleDot,
                    { width: a.handle.dot, height: a.handle.dot, borderRadius: a.handle.dot / 2, borderColor: arrangeColor(a.handle.ring) },
                  ]}
                />
              </View>
            </GestureDetector>
          </>
        ) : null}
        {showConfirm ? (
          // AOD-141 (resolves AOD-104): the tile's OWN face becomes the question — a scrim over the dimmed
          // card, no modal. A sibling of the drag detector (which is frozen while confirming), so its
          // buttons never start a drag. Confirm fires onRemove; Keep reverts (to the arrange affordances in
          // arrange, or clears the dashboard's menu-confirm on the calm surface — onKeep, AOD-195).
          <View
            style={[styles.confirmFace, { backgroundColor: arrangeColor(a.confirm.scrim), borderRadius: theme.radius.md }]}
            testID={`remove-confirm-face-${instance.instanceId}`}
          >
            <Text style={[styles.confirmQuestion, { color: arrangeColor(a.confirm.label) }]}>Remove?</Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => onRemove(instance.instanceId)}
                style={[styles.confirmButton, { backgroundColor: arrangeColor(a.removePill.bg) }]}
                accessibilityRole="button"
                accessibilityLabel="Confirm remove widget"
                testID={`remove-confirm-${instance.instanceId}`}
              >
                <Text style={[styles.confirmButtonText, { color: arrangeColor(a.removePill.label) }]}>Remove</Text>
              </Pressable>
              <Pressable
                onPress={onKeep}
                style={styles.keepButton}
                accessibilityRole="button"
                accessibilityLabel="Keep widget"
                testID={`remove-keep-${instance.instanceId}`}
              >
                <Text style={[styles.confirmButtonText, { color: arrangeColor(a.confirm.label) }]}>Keep</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

// AOD-27 §4 / §10: the STATIC arrange-mode layout. The `arrange` token group's colours + geometry (dot 24 /
// hit 44 / the selection + configurePill roles) are applied INLINE in the component above, resolved from the
// theme at the call site (§11 drift 3 lands there: the pill label themes against onAccent, not
// colors.background) -- the Unistyles babel plugin cannot trace a computed `theme.colors[role]` through
// StyleSheet.create, so only static values live here.
const styles = StyleSheet.create((theme) => ({
  positioned: {
    position: 'absolute',
    // The lift shadow colour (opacity/radius/offset ride the animated `lift`, 0 at rest so this is inert
    // until a card is held). iOS reads shadowColor; Android reads the animated `elevation`.
    shadowColor: '#000',
  },
  body: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    // AOD-195 (C3, from the AOD-190 device pass round 2): a near-invisible but HITTABLE fill so the whole calm
    // card face is one long-press target.
    // On Android a fully transparent container is not a touch target, so the outer Gesture.LongPress only
    // fired on the opaque leaf views (the card's text/glyphs) — empty card space did not open the menu. A
    // 1%-alpha fill is imperceptible over the card surface AND over a transparent ghost tile (so ghost stays
    // transparent) and the wall (pointerEvents:'none') is unaffected. In Arrange the inline selectFill
    // overrides this; the render is otherwise unchanged.
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  // §4 the Configure affordance, top-left so it never overlaps the bottom-right resize dot (bg is inline).
  configurePill: {
    position: 'absolute',
    top: -12,
    left: -8,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(2.5),
    paddingVertical: theme.spacing(1),
  },
  configureText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // AOD-141 the Remove pill, top-right (mirror of the top-left Configure pill) so it never overlaps
  // Configure or the bottom-right resize dot. Destructive bg is applied inline (the removePill role).
  removePill: {
    position: 'absolute',
    top: -12,
    right: -8,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(2.5),
    paddingVertical: theme.spacing(1),
  },
  // §4 the resize handle: an accent dot ringed in `background`, centered in the hit target (sizes inline).
  handleHit: {
    position: 'absolute',
    right: -16,
    bottom: -16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    backgroundColor: theme.colors.accent,
    borderWidth: 2,
  },
  // AOD-141 the in-place "Remove?" confirm face: fills the card (scrim + radius inline), centering the
  // question over the two actions. A plain View (not a gesture target); the drag beneath is frozen while
  // it shows, so a stray press does nothing destructive.
  confirmFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  },
  confirmQuestion: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  confirmButton: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Keep is the low-weight sibling (no fill): just the label over the scrim.
  keepButton: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
  },
}));
