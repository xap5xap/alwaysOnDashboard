// The card-altitude page capsule (AOD-145; design "Many Skies" §1b "the dots have grown a capsule.
// Information became a button"). This is the Arrange-side sibling of the Glance PageDots: in Glance the dots
// are INDICATORS ONLY (pointerEvents:none so a swipe grazing them still pages, AOD-144); here — one altitude
// deeper, already in Arrange — the same dots are wrapped in a pressable PILL that is the door UP to page
// altitude ("the control that shows the set is the control that opens it"). Press rises to the skies.
//
// It rides the AOD-142 chrome-awake state EXACTLY as the ModeDial does (not box-none like the Glance dots,
// because the WHOLE capsule is one deliberate tap target): awake -> visible + interactive; sunk (idle) ->
// faded out AND pointerEvents:none + dropped from the a11y tree, so a touch that merely WAKES the chrome can
// never also rise a level ("waking ≠ editing"). `awake -> pointerEvents` is the synchronous, test-reliable
// signal (the reanimated fade renders statically under the jest mock, exactly as the ModeDial/PageDots note).
//
// Unlike the Glance dots, the capsule shows even for a SINGLE sky: here it is a button (not a passive
// position indicator), and a solo user still needs the door up to label their one sky or add a second — so a
// lone dot inside the pill is intentional, not the §1a "no dots on one page" calm-surface rule.
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// The wake/sink fade rate — the same feel as the ModeDial + PageDots (device pass AOD-190 tunes it; the
// mechanism is the point). The whole hub chrome fades on one curve so it moves as a single thing.
const FADE_MS = 200;

export interface PageCapsuleProps {
  /** How many skies — one dot each (the current one lit); at least one dot always shows (it is a button). */
  count: number;
  /** The current sky index (the sky the card-altitude surface is arranging). */
  current: number;
  /** The shared chrome-awake state (useChromeAwake): visible + interactive when awake, sunk when idle. */
  awake: boolean;
  /** Pressed the capsule: rise to page altitude (the caller flips the altitude state). */
  onRise(): void;
  testID?: string;
}

export function PageCapsule({ count, current, awake, onRise, testID = 'page-capsule' }: PageCapsuleProps) {
  const { theme } = useUnistyles();
  const opacity = useSharedValue(awake ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(awake ? 1 : 0, { duration: FADE_MS, easing: Easing.inOut(Easing.ease) });
  }, [awake, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // At least one dot: the capsule is a button, so an empty pill would read as broken. A single-sky account
  // sees one lit dot — "you are here, and there is one place".
  const dots = Math.max(1, count);

  return (
    // pointerEvents follows `awake` DIRECTLY (a plain prop, not the animated value): a sunk capsule is
    // untouchable, so the first touch only wakes the chrome and never accidentally rises a level. A sunk
    // capsule is also dropped from the a11y tree, mirroring the ModeDial.
    <Animated.View
      style={[styles.fade, fade]}
      pointerEvents={awake ? 'auto' : 'none'}
      accessibilityElementsHidden={!awake}
      importantForAccessibility={awake ? 'auto' : 'no-hide-descendants'}
      testID={testID}
    >
      <Pressable
        onPress={onRise}
        accessibilityRole="button"
        accessibilityLabel="Show all dashboards"
        hitSlop={10}
        testID={`${testID}-press`}
        style={styles.pill}
      >
        <View style={styles.dots} pointerEvents="none">
          {Array.from({ length: dots }).map((_, i) => (
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
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  fade: { alignItems: 'center' },
  // The grown pill: the dots inside a raised, bordered capsule (elevation.raised in role terms) so it reads
  // as a button, not the calm Glance indicator. Radius.full = the capsule end.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(2.5),
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
}));
