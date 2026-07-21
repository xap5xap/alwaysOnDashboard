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
import React from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetInstance } from '../registry/types';
import type { LayoutPatch } from './mapper';
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
   *  in-place "Remove?" confirm. The wall callers pass a noop (they never arrange). */
  onRemove(instanceId: string): void;
  /** AOD-146 (Many Skies §1d): a held card was carried to a screen edge ('left'/'right') or off it (null)
   *  while dragging. The dashboard arms the cross-sky carry dwell. Optional and forwarded straight to each
   *  card: the wall / read-only pager callers never arrange, so they simply omit it (the seam is untouched). */
  onCarryEdge?(instanceId: string, edge: 'left' | 'right' | null): void;
}

export function LayoutCanvas({
  instances,
  arranging,
  onEnterArrange,
  onExitArrange,
  onCommit,
  onRequestConfigure,
  onRemove,
  onCarryEdge,
}: LayoutCanvasProps) {
  const { theme } = useUnistyles();
  // The live arrange session: the active target (for the hairline), the per-card reflow preview, and the
  // three gesture reporters PlacedInstance drives. Inert (target: null) until a gesture fires, so on the
  // wall / in Glance it costs a useState + a noop and changes nothing (see the header note).
  const reflow = useArrangeReflow(instances, onCommit);

  return (
    <View style={styles.canvas}>
      {/* Behind the cards: a full-bleed catcher so a tap on empty space leaves arrange mode. */}
      {arranging ? (
        <Pressable style={styles.exitCatcher} onPress={onExitArrange} accessibilityLabel="Done arranging" />
      ) : null}
      {/* AOD-140: the hairline slot — a thin outline at the slot the held/resized card will land on,
          visible only while a gesture is active in arrange. Behind the cards (drawn before them) and
          non-interactive, so it never intercepts the gesture it is illustrating. */}
      {arranging && reflow.activeSlot ? (
        <View
          pointerEvents="none"
          testID="arrange-hairline-slot"
          style={[
            styles.hairlineSlot,
            pxStyle(reflow.activeSlot),
            { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.md },
          ]}
        />
      ) : null}
      {instances.map((instance) => (
        <PlacedInstance
          key={instance.instanceId}
          instance={instance}
          arranging={arranging}
          onLongPress={onEnterArrange}
          // Gate the preview on `arranging` so a stale session (an orphaned target that outlived arrange,
          // e.g. an unmount path that skipped onFinalize) can never drive a neighbour in Glance — belt to
          // the reflow's own pinnedIndex<0 self-heal. The hairline above is already arranging-gated.
          previewRect={arranging ? reflow.previewFor(instance.instanceId) : null}
          onArrangeMove={reflow.onArrangeMove}
          onArrangeEnd={reflow.onArrangeEnd}
          onArrangeCancel={reflow.onArrangeCancel}
          onRequestConfigure={onRequestConfigure}
          onRemove={onRemove}
          onCarryEdge={onCarryEdge}
        />
      ))}
    </View>
  );
}

/** The absolute box (px) for a landing slot, from the shared slot<->pixel mapping (grid.slotToPixels,
 *  byte-consistent with the cards' geometry.toPixels). */
function pxStyle(slot: Parameters<typeof slotToPixels>[0]) {
  const p = slotToPixels(slot);
  return { left: p.left, top: p.top, width: p.width, height: p.height };
}

const styles = StyleSheet.create(() => ({
  canvas: {
    flex: 1,
    position: 'relative',
  },
  exitCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // AOD-140 the landing-slot hairline: a 1.5px dashed accent outline over a faint accent wash (colours +
  // radius applied inline, resolved from the theme like the arrange affordances). Position rides pxStyle.
  hairlineSlot: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
}));
