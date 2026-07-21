// The Glance page dots + add-sky control (AOD-144; design "Many Skies" §1a "dots wake with a touch and sink
// like the dial", §1e "Dots, not names — position is identity"). One dot per sky (the current one lit), plus
// a trailing + affordance. It RIDES the AOD-142 chrome-awake state exactly as the ModeDial does: awake ->
// visible + interactive; sunk (idle) -> faded out AND non-interactive + dropped from the a11y tree, so the
// calm looking surface carries no chrome (a touch wakes it ~5s, idle sinks it — both together with the dial).
//
// Two pointer facts matter over the swipe area: (1) the dots are INDICATORS, not targets (pressing them to
// reach page altitude is AOD-145), so the dot row is pointerEvents:none — a swipe that grazes a dot still
// pages; (2) the awake container is box-none, so only the + captures touches and the rest of the bar passes
// the swipe through to the pager. A single sky shows NO dots (position is meaningless with one page) but
// still shows the + so a solo user can reach the Pro moment / add a second sky. `awake -> pointerEvents` is
// the synchronous, test-reliable signal (the reanimated fade renders statically under the jest mock, exactly
// as the ModeDial notes).
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { PlusGlyph } from './glyphs';

// The wake/sink fade rate — the same feel as the ModeDial (device pass AOD-190 tunes it; the mechanism is
// the point). The dots and the dial fade on the same curve so the chrome moves as one.
const FADE_MS = 200;

export interface PageDotsProps {
  /** How many skies (pages). One or zero -> no dots (only the +). */
  count: number;
  /** The current page index (the pager's local scroll position, NOT activeId). */
  current: number;
  /** The shared chrome-awake state (useChromeAwake): visible + interactive when awake, sunk when idle. */
  awake: boolean;
  /** Tapped the trailing + : the caller forks on the entitlement (Pro create vs the §1f invite). */
  onAdd(): void;
  testID?: string;
}

export function PageDots({ count, current, awake, onAdd, testID = 'page-dots' }: PageDotsProps) {
  const { theme } = useUnistyles();
  const opacity = useSharedValue(awake ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(awake ? 1 : 0, { duration: FADE_MS, easing: Easing.inOut(Easing.ease) });
  }, [awake, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // box-none when awake: the container never captures (swipes pass to the pager), only the + does; `none`
    // when sunk drops the whole thing, so a waking touch pages/wakes and never mis-hits the +.
    <Animated.View
      style={[styles.row, fade]}
      pointerEvents={awake ? 'box-none' : 'none'}
      accessibilityElementsHidden={!awake}
      importantForAccessibility={awake ? 'auto' : 'no-hide-descendants'}
      testID={testID}
    >
      {count > 1 ? (
        // Indicators only — pointerEvents:none so a swipe over the dots still turns the page.
        <View style={styles.dots} pointerEvents="none" testID={`${testID}-dots`}>
          {Array.from({ length: count }).map((_, i) => (
            <View
              key={i}
              testID={`${testID}-dot-${i}`}
              accessibilityState={{ selected: i === current }}
              style={[
                styles.dot,
                i === current
                  ? { backgroundColor: theme.colors.accent }
                  : { backgroundColor: theme.colors.textMuted, opacity: 0.4 },
              ]}
            />
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add a dashboard"
        hitSlop={10}
        testID={`${testID}-add`}
        style={styles.add}
      >
        <PlusGlyph size={16} color={theme.colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  dot: {
    width: theme.dot.r * 2,
    height: theme.dot.r * 2,
    borderRadius: theme.dot.r,
  },
  add: {
    width: theme.spacing(7),
    height: theme.spacing(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
