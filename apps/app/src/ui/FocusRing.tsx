// The shared 2px focus ring (design-component-library.md §5: "focusRing is one token, the same 2px accent
// ring on every interactive component"). An absolutely-positioned overlay offset a few px outside the
// control edge, so it never shifts layout; the parent is a normal (position: relative) View. Rendered
// when a control is `focused` (keyboard / switch-control). Themes against colors.focusRing, never a hex.
import React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export function FocusRing({ visible, radius }: { visible?: boolean; radius: number }) {
  const { theme } = useUnistyles();
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      testID="focus-ring"
      style={{
        position: 'absolute',
        top: -3,
        left: -3,
        right: -3,
        bottom: -3,
        borderWidth: 2,
        borderColor: theme.colors.focusRing,
        borderRadius: radius + 3,
      }}
    />
  );
}
