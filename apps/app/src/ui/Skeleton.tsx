// Skeleton (design-component-library.md §10). Bars in the `skeleton` colour role, SHAPED to the real
// layout (a heading bar + list rows), not a single bar, with a slow shimmer sweep (no spinner). Reuses the
// widget loading-skeleton pattern (design-widget-system §5). It replaces the ActivityIndicator loading
// placeholders (§13 drift 8). The sweep is a §14 motion refinement (exact rate is a build detail); it uses
// reanimated, which is mocked to a static render under jest, so the shaped bars are what tests assert.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor, roleRadius } from './theme';

/** One skeleton bar in the `skeleton` role at skeleton.barRadius. */
export function SkeletonBar({ width = '100%', height = 12 }: { width?: DimensionValue; height?: number }) {
  const { theme } = useUnistyles();
  const t = theme.skeleton;
  return <View testID="skeleton-bar" style={{ width, height, borderRadius: roleRadius(theme, t.barRadius), backgroundColor: roleColor(theme, t.color) }} />;
}

/** The shimmer sweep: a soft band translating across the shaped bars (clipped by the container). */
function Shimmer({ width }: { width: number }) {
  const { theme } = useUnistyles();
  const bandWidth = Math.max(48, width * 0.4);
  const x = useSharedValue(-bandWidth);
  useEffect(() => {
    x.value = withRepeat(withTiming(width, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [width, x]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      testID="skeleton-shimmer"
      style={[{ position: 'absolute', top: 0, bottom: 0, width: bandWidth, backgroundColor: theme.colors.textMuted, opacity: theme.skeleton.shimmerOpacity }, anim]}
    />
  );
}

/** §10 the shaped skeleton: a heading bar over `rows` list rows, with the shimmer sweeping across. */
export function Skeleton({ rows = 3, testID }: { rows?: number; testID?: string }) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);
  return (
    <View
      testID={testID ?? 'skeleton'}
      accessibilityLabel="Loading"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ gap: theme.spacing(3), overflow: 'hidden' }}
    >
      <SkeletonBar width="42%" height={14} />
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
          <SkeletonBar width={32} height={32} />
          <View style={{ flexGrow: 1, gap: theme.spacing(1.5) }}>
            <SkeletonBar width="60%" height={12} />
            <SkeletonBar width="38%" height={10} />
          </View>
        </View>
      ))}
      {width > 0 ? <Shimmer width={width} /> : null}
    </View>
  );
}
