// Button (design-component-library.md §5). Four variants (primary / secondary / ghost / destructive),
// three sizes (sm / md / lg), and the five states (default / pressed / focused / disabled / loading).
// Fills carry onAccent; text buttons tint with accentMuted when pressed; focus draws the shared focusRing;
// disabled drops to button.disabledOpacity. Every colour is a role resolved from the §12 `button` group,
// never a raw hex. The fill press-darken is a motion refinement (§14), done with opacity, not a token.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor, roleRadius } from './theme';
import { FocusRing } from './FocusRing';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Keyboard / switch-control focus; draws the shared 2px focusRing (§5). */
  focused?: boolean;
  /** A leading icon (a glyph); sits button.gap before the label. */
  icon?: React.ReactNode;
  /** radius.full pill instead of the default radius.md (§5). */
  pill?: boolean;
  /** Fills the available width (a full-width primary in a sheet / auth card). */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The fill press-darken (§14 motion refinement, not a token): a filled button dims slightly on press. */
const PRESSED_FILL_OPACITY = 0.88;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  focused = false,
  icon,
  pill = false,
  block = false,
  style,
  testID,
}: ButtonProps) {
  const { theme } = useUnistyles();
  const [pressed, setPressed] = useState(false);
  const t = theme.button;
  const sizing = t.size[size];
  const v = t.variant[variant];

  const isFill = v.bg != null; // primary / destructive carry a fill; secondary / ghost do not
  const isText = !isFill; // secondary / ghost tint with accentMuted when pressed
  const radius = pill ? theme.radius.full : roleRadius(theme, t.radius);
  const nonInteractive = disabled || loading;

  const bg = roleColor(theme, v.bg);
  // Disabled ghost/secondary label -> textMuted (§5); otherwise the variant fg role.
  const fg =
    disabled && isText ? theme.colors.textMuted : (roleColor(theme, v.fg) as string);
  const pressedTextBg = isText && pressed ? theme.colors.accentMuted : undefined;

  const typeToken = theme.type[sizing.type as keyof typeof theme.type];

  return (
    <View style={[block && { alignSelf: 'stretch' }, style]}>
      <Pressable
        onPress={nonInteractive ? undefined : onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={nonInteractive}
        accessibilityRole="button"
        accessibilityState={{ disabled: nonInteractive, busy: loading }}
        testID={testID}
        style={{
          height: sizing.height,
          paddingHorizontal: sizing.paddingX,
          borderRadius: radius,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.gap,
          backgroundColor: pressedTextBg ?? bg ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ? (roleColor(theme, v.fg) as string) : undefined,
          opacity: disabled ? t.disabledOpacity : isFill && pressed ? PRESSED_FILL_OPACITY : 1,
        }}
      >
        {/* §5 loading: the spinner joins the label (which stays); onAccent on a fill, accent on text. */}
        {loading ? (
          <ActivityIndicator
            testID="button-spinner"
            color={isFill ? theme.colors.onAccent : (roleColor(theme, v.fg) as string)}
          />
        ) : icon ? (
          icon
        ) : null}
        <Text numberOfLines={1} style={{ ...typeToken, color: fg }}>
          {label}
        </Text>
      </Pressable>
      <FocusRing visible={focused} radius={radius} />
    </View>
  );
}
