// The shared PIN pad surface (design-kiosk-wall.md §7): the four dots + the numeric keypad + backspace,
// each key sized for a wall touch target (the wall.pinKey token). Presentational only: the caller owns the
// entry state and what a completed entry means. Extracted (AOD-73) so the EXIT pad (ExitAffordance) and the
// first-run SET pad (PinSetup) share one keypad; the testIDPrefix keeps each surface's testIDs distinct while
// the exit pad preserves its AOD-72 kiosk-pin-* contract. Colours read off the theme so the sizes come from
// the `wall` token without tripping the computed-role-in-StyleSheet.create pitfall.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PIN_LENGTH } from './pin';

/** One PIN-pad key: a wall.pinKey circle (digit) or the backspace, sized for a wall touch target. */
function KeyButton({
  label,
  onPress,
  size,
  testID,
}: {
  label: string;
  onPress: () => void;
  size: number;
  testID: string;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ ...theme.type.title, color: theme.colors.text }}>{label}</Text>
    </Pressable>
  );
}

export interface PinPadProps {
  /** How many of the PIN_LENGTH dots are filled (the entry length). */
  filled: number;
  onKey(digit: string): void;
  onDelete(): void;
  /** testID namespace so ExitAffordance keeps kiosk-pin-* and PinSetup uses kiosk-setpin-*. */
  testIDPrefix?: string;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export function PinPad({ filled, onKey, onDelete, testIDPrefix = 'kiosk-pin' }: PinPadProps) {
  const { theme } = useUnistyles();
  const key = theme.wall.pinKey;
  return (
    <View style={{ gap: theme.spacing(4), alignItems: 'center' }}>
      {/* the four dots (filled as digits are entered) */}
      <View
        testID={`${testIDPrefix}-dots`}
        style={{ flexDirection: 'row', gap: theme.spacing(3), paddingVertical: theme.spacing(2) }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const isFilled = i < filled;
          return (
            <View
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: isFilled ? theme.colors.accent : 'transparent',
                borderWidth: isFilled ? 0 : 1.5,
                borderColor: theme.colors.border,
              }}
            />
          );
        })}
      </View>

      {/* the numeric keypad (wall.pinKey keys) */}
      <View style={{ gap: theme.spacing(3) }}>
        {ROWS.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
            {row.map((d) => (
              <KeyButton key={d} label={d} size={key} onPress={() => onKey(d)} testID={`${testIDPrefix}-key-${d}`} />
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
          <View style={{ width: key, height: key }} />
          <KeyButton label="0" size={key} onPress={() => onKey('0')} testID={`${testIDPrefix}-key-0`} />
          <KeyButton label="⌫" size={key} onPress={onDelete} testID={`${testIDPrefix}-delete`} />
        </View>
      </View>
    </View>
  );
}
