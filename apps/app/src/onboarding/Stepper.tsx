// The onboarding progress stepper (design-onboarding-screens.md §4): N dots, the current one `accent`, the
// rest `border`. No new token; it reuses the AOD-37 §3.1 `dot` vocabulary (r 4.5) at chrome scale, the same
// mark the connection warning dot / status badge draw. Pinned at the top of the first-run sequence.
import React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export function Stepper({ index, count }: { index: number; count: number }) {
  const { theme } = useUnistyles();
  const size = theme.dot.r * 2;
  return (
    <View
      testID="onboarding-stepper"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing(1.5), paddingVertical: theme.spacing(4) }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: theme.dot.r,
            backgroundColor: i === index ? theme.colors.accent : theme.colors.border,
          }}
        />
      ))}
    </View>
  );
}
