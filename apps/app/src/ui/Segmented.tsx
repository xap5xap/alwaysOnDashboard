// Segmented control (design-component-library.md §7). The EXCLUSIVE choice control, the strong selected
// state: a surfaceAlt group with a border, the selected segment filled with the accent + onAccent text,
// the others plain text on the group. Distinct from the multi-select Pills (§3.3: exclusive selection
// keeps the full-accent fill, it is not promoted to accentMuted). Roles come from the §12 `segmented`
// group; the generic per-instance config form maps an enum field onto this (design-dashboard-editor §9).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor, roleRadius } from './theme';

export interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T | undefined;
  onChange?: (value: T) => void;
  disabled?: boolean;
  testID?: string;
}

export function Segmented<T extends string>({ options, value, onChange, disabled = false, testID }: SegmentedProps<T>) {
  const { theme } = useUnistyles();
  const t = theme.segmented;
  const radius = roleRadius(theme, t.radius);

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        backgroundColor: roleColor(theme, t.group),
        borderColor: roleColor(theme, t.border),
        borderWidth: 1,
        borderRadius: radius,
        padding: 2,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={disabled ? undefined : () => onChange?.(opt.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            testID={`segmented-${opt.value}`}
            style={{
              minHeight: t.height - 4,
              paddingHorizontal: t.paddingX,
              justifyContent: 'center',
              borderRadius: radius - 2,
              backgroundColor: selected ? roleColor(theme, t.selectedBg) : 'transparent',
            }}
          >
            <Text
              style={{
                ...theme.type.label,
                color: selected ? roleColor(theme, t.selectedFg) : roleColor(theme, t.fg),
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
