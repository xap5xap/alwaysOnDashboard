// The AOD-15 on-demand refresh control as generic host chrome (design-widget-system.md §6). Pure and
// presentational: it draws the circular-arrow glyph in one of three visual states and reports taps. It
// is the same control for every fetching widget; the renderer never sees it. The host decides WHETHER to
// show it (hidden for an authClass 'none' / never-fetching widget, the Clock) and WHICH state it is in
// (via useManualRefresh). The in-flight spin is the one place a card animates on demand; motion timing is
// a build refinement (§10), not fixed by the design.
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CheckGlyph, RefreshGlyph } from '../widgets/glyphs';

export type RefreshControlState = 'idle' | 'in-flight' | 'within-floor';

export interface RefreshControlProps {
  state: RefreshControlState;
  onPress: () => void;
}

export function RefreshControl({ state, onPress }: RefreshControlProps) {
  const { theme } = useUnistyles();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (state === 'in-flight') {
      rotation.value = 0;
      rotation.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [state, rotation]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  // idle/within-floor: muted (within-floor dims further); in-flight: accent.
  const glyphColor = state === 'in-flight' ? theme.colors.accent : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      accessibilityRole="button"
      accessibilityLabel="Refresh"
      accessibilityState={{ busy: state === 'in-flight' }}
      testID="widget-refresh"
    >
      <View style={styles.box}>
        <Animated.View style={[spin, state === 'within-floor' && styles.dimmed]}>
          <RefreshGlyph size={15} color={glyphColor} strokeWidth={state === 'in-flight' ? 1.9 : 1.7} />
        </Animated.View>
        {state === 'within-floor' ? (
          <View style={styles.check} pointerEvents="none">
            <CheckGlyph size={9} color={theme.colors.success} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create(() => ({
  box: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.5,
  },
  // The within-floor "up to date" check, tucked at the top-right of the glyph.
  check: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
}));
