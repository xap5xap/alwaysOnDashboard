// Selectable pills (design-component-library.md §7). The MULTI-SELECT control, the soft selected state:
// a selected pill uses the accentMuted fill + an accent border + accent text (§3.3 promotes accentMuted
// for exactly this non-exclusive selection, where a full accent fill would over-weight the choice); an
// unselected pill is a plain border + text. radius.full ends. The generic config form maps a remote-
// options (multiple) field onto this (design-dashboard-editor §9). Roles from the §12 `pill` group.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor } from './theme';

export interface PillOption {
  label: string;
  value: string;
}

export interface PillsProps {
  options: PillOption[];
  /** The selected values (multi-select). */
  selected: string[];
  onToggle?: (value: string) => void;
  disabled?: boolean;
  testID?: string;
}

export function Pills({ options, selected, onToggle, disabled = false, testID }: PillsProps) {
  const { theme } = useUnistyles();
  const t = theme.pill;

  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), opacity: disabled ? 0.4 : 1 }}>
      {options.map((opt) => {
        const isOn = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={disabled ? undefined : () => onToggle?.(opt.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn, disabled }}
            testID={`pill-${opt.value}`}
            style={{
              paddingHorizontal: t.paddingX,
              paddingVertical: t.paddingY,
              borderRadius: theme.radius.full,
              borderWidth: 1,
              backgroundColor: isOn ? theme.colors.accentMuted : 'transparent',
              borderColor: roleColor(theme, isOn ? t.selectedBorder : t.border),
            }}
          >
            <Text style={{ ...theme.type.body, fontWeight: '600', color: roleColor(theme, isOn ? t.selectedFg : t.fg) }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
