// One placed widget instance: it positions an AOD-8 WidgetInstance in free-form space and, in arrange
// mode, makes it draggable and resizable. Live geometry runs on the UI thread via reanimated shared
// values (no React re-render while dragging, which the always-on hot path wants, AOD-25); on gesture
// end it converts the total pixel translation back to nominal units through the pure, tested geometry
// helpers and commits. Resize recomputes the size class via reconcileSize (AOD-10 §5.2, rect is
// authoritative). It renders the instance through the generic WidgetHost and imports no service: the
// AOD-8 §10 seam holds (it knows WidgetInstance/LayoutRect, not which service this is).
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { WidgetHost } from '../host/WidgetHost';
import { useRegistry } from '../registry/RegistryProvider';
import { reconcileSize } from '../widgets/sizes';
import type { LayoutRect, WidgetInstance } from '../registry/types';
import { applyDrag, applyResize, MIN_H, MIN_W, UNIT_PX } from './geometry';
import type { LayoutPatch } from './mapper';

export interface PlacedInstanceProps {
  instance: WidgetInstance;
  arranging: boolean;
  /** Long-press anywhere on the card enters arrange mode (the iOS-style "jiggle" affordance). */
  onLongPress(): void;
  onCommit(instanceId: string, patch: LayoutPatch): void;
  /** Open the per-instance config form (AOD-10 §4). Generic over the registry; the dashboard owns the
   *  modal. Reached two ways: the arrange-mode "Configure" affordance and the host's needs_config
   *  "Reconfigure" prompt (the previously unwired WidgetHost onReconfigure seam). */
  onRequestConfigure(instance: WidgetInstance): void;
  /** Delete this instance (AOD-141, resolves AOD-104). Fired from the in-place "Remove?" confirm; the
   *  dashboard owns the mutation (useRemoveWidget: client-direct RLS delete + optimistic cache update).
   *  Connections survive — removing a card never disconnects its service. */
  onRemove(instanceId: string): void;
}

export function PlacedInstance({
  instance,
  arranging,
  onLongPress,
  onCommit,
  onRequestConfigure,
  onRemove,
}: PlacedInstanceProps) {
  const registry = useRegistry();
  const def = registry.getWidgetDef(instance.serviceId, instance.widgetType);
  const supportedSizes = def?.supportedSizes ?? [instance.size];

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

  // Live geometry (nominal units) owned by the UI thread.
  const x = useSharedValue(instance.rect.x);
  const y = useSharedValue(instance.rect.y);
  const w = useSharedValue(instance.rect.w);
  const h = useSharedValue(instance.rect.h);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);

  // Re-sync the shared values when the committed rect changes (e.g., the optimistic cache update
  // re-renders us, or a reload restores a persisted layout). Commits fire at gesture end, so this
  // never fights an in-progress gesture.
  useEffect(() => {
    x.value = instance.rect.x;
    y.value = instance.rect.y;
    w.value = instance.rect.w;
    h.value = instance.rect.h;
  }, [instance.rect.x, instance.rect.y, instance.rect.w, instance.rect.h, x, y, w, h]);

  // JS-thread commit helpers use the pure geometry functions, so the gesture math is the tested math.
  const finishDrag = (dxPx: number, dyPx: number) => {
    commitRect(applyDrag(instance.rect, dxPx, dyPx));
  };
  const finishResize = (dwPx: number, dhPx: number) => {
    commitRect(applyResize(instance.rect, dwPx, dhPx));
  };
  const commitRect = (rect: LayoutRect) => {
    const size = reconcileSize({ w: rect.w, h: rect.h }, supportedSizes);
    onCommit(instance.instanceId, { rect, size });
  };

  const longPress = Gesture.LongPress()
    .enabled(!arranging)
    .minDuration(350)
    .onStart(() => {
      'worklet';
      runOnJS(onLongPress)();
    });

  const drag = Gesture.Pan()
    // While confirming a remove, the tile face IS the question: freeze drag so a stray pan on the
    // confirm scrim never moves the card mid-decision.
    .enabled(arranging && !confirmingRemove)
    .onStart(() => {
      'worklet';
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      'worklet';
      x.value = Math.max(0, startX.value + e.translationX / UNIT_PX);
      y.value = Math.max(0, startY.value + e.translationY / UNIT_PX);
    })
    .onEnd((e) => {
      'worklet';
      runOnJS(finishDrag)(e.translationX, e.translationY);
    });

  const resize = Gesture.Pan()
    .enabled(arranging && !confirmingRemove)
    .onStart(() => {
      'worklet';
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      'worklet';
      w.value = Math.max(MIN_W, startW.value + e.translationX / UNIT_PX);
      h.value = Math.max(MIN_H, startH.value + e.translationY / UNIT_PX);
    })
    .onEnd((e) => {
      'worklet';
      runOnJS(finishResize)(e.translationX, e.translationY);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    left: x.value * UNIT_PX,
    top: y.value * UNIT_PX,
    width: w.value * UNIT_PX,
    height: h.value * UNIT_PX,
  }));

  // Long-press (enter arrange) wraps the whole card; drag is a nested detector on the body. The resize
  // handle is a SIBLING of the drag detector (not nested inside it) so the two Pans never contend, and
  // it carries a 44pt hit target so it is reliably grabbable.
  return (
    <GestureDetector gesture={longPress}>
      <Animated.View style={[styles.positioned, animatedStyle]}>
        <GestureDetector gesture={drag}>
          <View
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
        {arranging && confirmingRemove ? (
          // AOD-141 (resolves AOD-104): the tile's OWN face becomes the question — a scrim over the dimmed
          // card, no modal. A sibling of the drag detector (which is frozen while confirming), so its
          // buttons never start a drag. Confirm fires onRemove; Keep reverts to the arrange affordances.
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
                onPress={() => setConfirmingRemove(false)}
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
  },
  body: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
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
