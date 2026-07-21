// The Glance / Arrange mode dial (AOD-142; design "Vela — The sky fills in" §1e "Glance ⇄ Tend — the one
// dial", "Many Skies" §1a/§1b). The EXPLICIT edit-mode control that replaces the old long-press-as-primary
// + Done-pill model: selecting Arrange reveals the LayoutCanvas affordances (selection, resize handle,
// Remove), selecting Glance is the calm read-only state and the ONLY way to leave Arrange ("swipe never
// edits" — flipping the dial is the one thing that changes the mode). It composes the AOD-20 Segmented
// control (§7, the exclusive-choice control) so the dial IS the design-system segmented, not a bespoke
// toggle. In the boards the state is worded "Tend"; in code it is "Arrange" (RB-11).
//
// Wake/sink: the dial rides the dashboard's single "chrome awake" state (useChromeAwake). Awake → full
// opacity + interactive; sunk (idle) → faded out AND pointerEvents:none, so a touch that WAKES the chrome
// cannot also flip the mode ("waking ≠ editing"), and a brush can't flip a control it can't touch (the
// segment is a deliberate, small tap target). The fade is reanimated (a §14 motion refinement, device);
// the testable, synchronous signal is `pointerEvents`, which follows `awake` directly (the jest mock
// renders the fade statically, so opacity is not a reliable assertion — the pointer gate is).
import React, { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Segmented } from '../ui/Segmented';

export type DashboardMode = 'glance' | 'arrange';

const OPTIONS: { label: string; value: DashboardMode }[] = [
  { label: 'Glance', value: 'glance' },
  { label: 'Arrange', value: 'arrange' },
];

// The wake/sink fade rate. Exact timing is a feel detail (device pass AOD-190); the mechanism is the point.
const FADE_MS = 200;

export interface ModeDialProps {
  mode: DashboardMode;
  onChange(mode: DashboardMode): void;
  /** The shared chrome-awake state (useChromeAwake): full opacity + interactive when awake, faded out +
   *  non-interactive once the idle timer has sunk it. AOD-144's page dots will ride the same state. */
  awake: boolean;
  testID?: string;
}

export function ModeDial({ mode, onChange, awake, testID = 'mode-dial' }: ModeDialProps) {
  const opacity = useSharedValue(awake ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(awake ? 1 : 0, { duration: FADE_MS, easing: Easing.inOut(Easing.ease) });
  }, [awake, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // pointerEvents follows `awake` DIRECTLY (a plain prop, not the animated value): the sunk dial is
    // untouchable, so the first touch only wakes the chrome and never accidentally flips the mode. A sunk
    // dial is also dropped from the a11y tree (iOS accessibilityElementsHidden / Android
    // importantForAccessibility) so a screen reader can't focus an invisible, non-interactive control.
    <Animated.View
      style={fade}
      pointerEvents={awake ? 'auto' : 'none'}
      accessibilityElementsHidden={!awake}
      importantForAccessibility={awake ? 'auto' : 'no-hide-descendants'}
      testID={testID}
    >
      <Segmented options={OPTIONS} value={mode} onChange={onChange} testID={`${testID}-segmented`} />
    </Animated.View>
  );
}
