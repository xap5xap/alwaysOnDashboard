// Toggle / switch (design-component-library.md §7). Replaces the unstyled native Switch (§13 drift 5).
// The track is a radius.full pill; off = surfaceAlt track + border + a textMuted knob at left, on = accent
// track + an onAccent knob at right. Disabled drops to toggle.disabledOpacity; focused draws the shared
// focusRing around the track. Geometry and both role maps come from the §12 `toggle` group, never a hex.
import React from 'react';
import { Pressable, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor } from './theme';
import { FocusRing } from './FocusRing';

export interface ToggleProps {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  focused?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Toggle({ value, onValueChange, disabled = false, focused = false, accessibilityLabel, testID }: ToggleProps) {
  const { theme } = useUnistyles();
  const t = theme.toggle;
  const state = value ? t.on : t.off;
  const knobDiameter = t.knobRadius * 2;
  const knobLeft = value ? t.trackWidth - t.padding - knobDiameter : t.padding;
  const knobTop = (t.trackHeight - knobDiameter) / 2;

  return (
    <View style={{ width: t.trackWidth, height: t.trackHeight, opacity: disabled ? t.disabledOpacity : 1 }}>
      <Pressable
        onPress={disabled ? undefined : () => onValueChange?.(!value)}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={{
          width: t.trackWidth,
          height: t.trackHeight,
          borderRadius: theme.radius.full,
          backgroundColor: roleColor(theme, state.track),
          borderWidth: value ? 0 : 1,
          borderColor: value ? undefined : roleColor(theme, t.border),
        }}
      >
        <View
          testID="toggle-knob"
          style={{
            position: 'absolute',
            top: knobTop,
            left: knobLeft,
            width: knobDiameter,
            height: knobDiameter,
            borderRadius: theme.radius.full,
            backgroundColor: roleColor(theme, state.knob),
          }}
        />
      </Pressable>
      <FocusRing visible={focused} radius={theme.radius.full} />
    </View>
  );
}
