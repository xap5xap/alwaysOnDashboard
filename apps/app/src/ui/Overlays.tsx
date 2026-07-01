// Overlays (design-component-library.md §9). Floating UI is scrim + elevation.overlay, NEVER a shadow.
// Sheet = a bottom sheet (scrim over the field + a surfaceAlt sheet with a grabber, top corners radius.lg)
// — this is the shipped ConfigFormModal, whose hardcoded rgba(0,0,0,0.6) backdrop reconciles onto the
// `scrim` token and whose background fill reconciles onto elevation.overlay (§13 drift 4). Modal = a
// centered confirm dialog at elevation.overlay. Popover = an anchored menu (surfaceAlt + border, radius.md,
// items split by border) with NO scrim, since it hangs off a known trigger (§9 rule). Colours are roles.
import React from 'react';
import { Modal as RNModal, Pressable, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { elevationStyle, roleColor, roleRadius } from './theme';
import { CheckGlyph } from './glyphs';

export interface SheetProps {
  visible: boolean;
  onRequestClose?: () => void;
  children: React.ReactNode;
  /** The mounting screen's safe-area bottom inset (from Unistyles rt.insets); defaults to 0. */
  bottomInset?: number;
  testID?: string;
}

/** §9 bottom sheet: the scrim darkens the field; the sheet sits at elevation.overlay with a grabber. */
export function Sheet({ visible, onRequestClose, children, bottomInset = 0, testID }: SheetProps) {
  const { theme } = useUnistyles();
  const t = theme.sheet;
  const overlaySurface = roleColor(theme, theme.elevation.overlay.surface);
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'flex-end' }} testID={testID}>
        <Pressable style={RNStyleSheet.absoluteFill} onPress={onRequestClose} accessibilityLabel="Dismiss" testID="sheet-scrim" />
        <View
          style={{
            backgroundColor: overlaySurface,
            borderTopLeftRadius: roleRadius(theme, t.radius),
            borderTopRightRadius: roleRadius(theme, t.radius),
            borderTopWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: t.paddingX,
            paddingTop: t.paddingTop,
            paddingBottom: bottomInset + theme.spacing(4),
            maxHeight: '85%',
          }}
        >
          <View
            testID="sheet-grabber"
            style={{ alignSelf: 'center', width: t.grabberWidth, height: t.grabberHeight, borderRadius: theme.radius.full, backgroundColor: theme.colors.border, marginBottom: theme.spacing(3) }}
          />
          {children}
        </View>
      </View>
    </RNModal>
  );
}

export interface ModalProps {
  visible: boolean;
  onRequestClose?: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
}

/** §9 center modal: the scrim + a centered dialog at elevation.overlay (radius.lg). */
export function Modal({ visible, onRequestClose, title, children, testID }: ModalProps) {
  const { theme } = useUnistyles();
  const t = theme.modal;
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.scrim, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(5) }} testID={testID}>
        <View style={[elevationStyle(theme, 'overlay'), { borderRadius: roleRadius(theme, t.radius), padding: t.padding, width: '100%', maxWidth: 420, gap: theme.spacing(3) }]}>
          {title ? <Text style={{ ...theme.type.title, color: theme.colors.text }}>{title}</Text> : null}
          {children}
        </View>
      </View>
    </RNModal>
  );
}

/** §9 popover / menu: an anchored surface at elevation.overlay, NO scrim; the caller positions it. */
export function Popover({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { theme } = useUnistyles();
  const t = theme.popover;
  const items = React.Children.toArray(children);
  return (
    <View testID={testID} style={[elevationStyle(theme, 'overlay'), { borderRadius: roleRadius(theme, t.radius), overflow: 'hidden', minWidth: 180 }, style]}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
          {item}
        </React.Fragment>
      ))}
    </View>
  );
}

/** §9 a popover menu item: a label with an optional accent check when selected (the Theme picker). */
export function MenuItem({ label, selected = false, onPress, testID }: { label: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      testID={testID}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(3), paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(2.5) }}
    >
      <Text style={{ ...theme.type.body, color: theme.colors.text }}>{label}</Text>
      {selected ? <CheckGlyph color={theme.colors.accent} /> : null}
    </Pressable>
  );
}
