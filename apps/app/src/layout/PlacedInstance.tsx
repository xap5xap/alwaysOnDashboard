// One placed widget instance: it positions an AOD-8 WidgetInstance in free-form space and, in arrange
// mode, makes it draggable and resizable. Live geometry runs on the UI thread via reanimated shared
// values (no React re-render while dragging, which the always-on hot path wants, AOD-25); on gesture
// end it converts the total pixel translation back to nominal units through the pure, tested geometry
// helpers and commits. Resize recomputes the size class via reconcileSize (AOD-10 §5.2, rect is
// authoritative). It renders the instance through the generic WidgetHost and imports no service: the
// AOD-8 §10 seam holds (it knows WidgetInstance/LayoutRect, not which service this is).
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
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
}

export function PlacedInstance({
  instance,
  arranging,
  onLongPress,
  onCommit,
  onRequestConfigure,
}: PlacedInstanceProps) {
  const registry = useRegistry();
  const def = registry.getWidgetDef(instance.serviceId, instance.widgetType);
  const supportedSizes = def?.supportedSizes ?? [instance.size];

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
    .enabled(arranging)
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
    .enabled(arranging)
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
          <View style={[styles.body, arranging && styles.bodyArranging]}>
            {/* Wire the previously-unwired host onReconfigure seam to the dashboard's config form. */}
            <WidgetHost instance={instance} onReconfigure={() => onRequestConfigure(instance)} />
          </View>
        </GestureDetector>
        {arranging ? (
          <>
            {/* A generic arrange-mode affordance to configure any widget, not only a needs_config one
                (AOD-52 cut). A sibling of the drag detector, so a tap never starts a drag. */}
            <Pressable
              onPress={() => onRequestConfigure(instance)}
              style={styles.configurePill}
              accessibilityRole="button"
              accessibilityLabel="Configure widget"
              testID={`configure-${instance.instanceId}`}
            >
              <Text style={styles.configureText}>Configure</Text>
            </Pressable>
            <GestureDetector gesture={resize}>
              <View style={styles.handleHit} accessibilityLabel="Resize widget" accessibilityRole="adjustable">
                <View style={styles.handleDot} />
              </View>
            </GestureDetector>
          </>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

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
  bodyArranging: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surfaceAlt,
  },
  // The arrange-mode configure affordance, top-left so it never overlaps the bottom-right resize dot.
  configurePill: {
    position: 'absolute',
    top: -12,
    left: -8,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(2.5),
    paddingVertical: theme.spacing(1),
  },
  configureText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  // A 44pt touch target (the dot is 24pt, centered): comfortable on touch and reliably hittable.
  handleHit: {
    position: 'absolute',
    right: -16,
    bottom: -16,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
}));
