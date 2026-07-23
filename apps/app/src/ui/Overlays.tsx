// Overlays (design-component-library.md §9). Floating UI is scrim + elevation.overlay, NEVER a shadow.
// Sheet = a bottom sheet (scrim over the field + a surfaceAlt sheet with a grabber, top corners radius.lg)
// — this is the shipped ConfigFormModal, whose hardcoded rgba(0,0,0,0.6) backdrop reconciles onto the
// `scrim` token and whose background fill reconciles onto elevation.overlay (§13 drift 4). Modal = a
// centered confirm dialog at elevation.overlay, hosted in an RN Modal by default or rendered INLINE in the
// caller's window (the AOD-76 additive mode for the immersive kiosk wall; see ModalProps.inline). Popover =
// an anchored menu (surfaceAlt + border, radius.md, items split by border) with NO scrim, since it hangs
// off a known trigger (§9 rule). Colours are roles.
import React from 'react';
import { Modal as RNModal, Pressable, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';
import { elevationStyle, roleColor, roleRadius } from './theme';
import { CheckGlyph } from './glyphs';

// AOD-211 §5 / §10 row 3 the pressed row fill: the shared "fill darkens ~12% flat" step (design §4 pressed
// convention). A flat neutral black wash over the row's surfaceAlt — NOT a palette colour and NOT a red one
// (a destructive row keeps THIS neutral fill, never floods red, §5). No new token, per §10 row 3.
const PRESSED_FILL = 'rgba(0, 0, 0, 0.12)';

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
  /** Windowed mode only: RN Modal wires this to the OS dismissal (Android hardware back). Inline mode has
   *  no OS window of its own, so dismissal is whatever affordance the caller renders (a Cancel button). */
  onRequestClose?: () => void;
  title?: string;
  children: React.ReactNode;
  /** Render the same §9 visual (scrim + centered card at elevation.overlay) as an absolute-fill overlay in
   *  the CALLER'S window, instead of hosting it in an RN Modal. An RN Modal is a separate Android window
   *  carrying its own system-bar state, and on API <= 30 (Fire OS 8) ReactModalHostView only syncs bar
   *  visibility onto that window on SDK > R, so opening one over the immersive kiosk wall re-shows the OS
   *  status bar (AOD-76). Inline keeps the surface inside the window whose immersive state already holds.
   *  No fade (the windowed fade is the RN Modal's own). Default false: every windowed call site unchanged. */
  inline?: boolean;
  testID?: string;
}

/** §9 center modal: the scrim + a centered dialog at elevation.overlay (radius.lg). */
export function Modal({ visible, onRequestClose, title, children, inline = false, testID }: ModalProps) {
  const { theme } = useUnistyles();
  const t = theme.modal;
  if (inline && !visible) return null;
  const surface = (
    <View
      style={[
        inline ? RNStyleSheet.absoluteFill : { flex: 1 },
        { backgroundColor: theme.colors.scrim, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(5) },
      ]}
      testID={testID}
    >
      <View style={[elevationStyle(theme, 'overlay'), { borderRadius: roleRadius(theme, t.radius), padding: t.padding, width: '100%', maxWidth: 420, gap: theme.spacing(3) }]}>
        {title ? <Text style={{ ...theme.type.title, color: theme.colors.text }}>{title}</Text> : null}
        {children}
      </View>
    </View>
  );
  if (inline) return surface;
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      {surface}
    </RNModal>
  );
}

/** AOD-211 §4 / §7 the hairline beak: a small triangle on the edge facing the touch, filled with the
 *  surface (quickMenu.beak.fill) so it merges with the popover, its two OUTER edges continued in the 1px
 *  `border` (quickMenu.beak.edge). Rendered as a sibling OUTSIDE the surface's overflow:hidden, positioned
 *  by the caller-supplied edge + offset (CardQuickActions slides it to point at the touch, §7). */
function Beak({ edge, offset }: { edge: 'top' | 'bottom'; offset: number }) {
  const { theme } = useUnistyles();
  const b = theme.quickMenu.beak;
  const fill = roleColor(theme, b.fill);
  const stroke = roleColor(theme, b.edge);
  // Apex points AWAY from the surface (up for a top beak, down for a bottom beak); the base overlaps the
  // surface's 1px border by 1px so there is no seam across the base.
  const points = edge === 'top' ? `0,${b.h} ${b.w / 2},0 ${b.w},${b.h}` : `0,0 ${b.w / 2},${b.h} ${b.w},0`;
  const sides = edge === 'top' ? `M0,${b.h} L${b.w / 2},0 L${b.w},${b.h}` : `M0,0 L${b.w / 2},${b.h} L${b.w},0`;
  const pos: ViewStyle =
    edge === 'top'
      ? { top: -(b.h - 1), left: offset - b.w / 2 }
      : { bottom: -(b.h - 1), left: offset - b.w / 2 };
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: b.w, height: b.h }, pos]} testID="popover-beak">
      <Svg width={b.w} height={b.h} viewBox={`0 0 ${b.w} ${b.h}`}>
        <Polygon points={points} fill={fill} />
        <Path d={sides} stroke={stroke} strokeWidth={1} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** §9 popover / menu: an anchored surface at elevation.overlay, NO scrim; the caller positions it. AOD-211
 *  adds an optional `minWidth` override (the quick menu wants quickMenu.minWidth) and an optional `beak`
 *  (edge + offset) that juts toward the touch; both default off, so every other call site is unchanged. */
export function Popover({
  children,
  style,
  minWidth = 180,
  beak,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  minWidth?: number;
  beak?: { edge: 'top' | 'bottom'; offset: number };
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const t = theme.popover;
  const items = React.Children.toArray(children);
  const surface = (
    <View testID={testID} style={[elevationStyle(theme, 'overlay'), { borderRadius: roleRadius(theme, t.radius), overflow: 'hidden', minWidth }, style]}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
          {item}
        </React.Fragment>
      ))}
    </View>
  );
  if (!beak) return surface;
  // The beak sits OUTSIDE the surface's clipped corner, so wrap the surface (hugging its width) and float the
  // beak on the pointed edge.
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Beak edge={beak.edge} offset={beak.offset} />
      {surface}
    </View>
  );
}

/** §9 a popover menu item: a label with an optional leading icon (AOD-211 §5), an optional accent check
 *  when selected (the Theme picker), and a destructive tone (red INK for Delete). The pressed fill is the
 *  neutral ~12% step for EVERY row — a destructive row never floods red (§5). Metrics come from the
 *  quickMenu group (rowMinHeight / rowPaddingX / icon size + gap + tone), so the row honours the design's
 *  48pt comfortable touch on the Fire HD 8. `icon` is a render-prop taking the resolved tone, so the icon
 *  "takes the row's tone" (textMuted normally, error when destructive) without the caller knowing it. */
export function MenuItem({
  label,
  selected = false,
  icon,
  destructive = false,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  icon?: (color: string) => React.ReactNode;
  destructive?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const q = theme.quickMenu;
  const labelColor = destructive ? roleColor(theme, q.destructive.tone) : theme.colors.text;
  const iconTone = destructive ? roleColor(theme, q.destructive.tone) : roleColor(theme, q.icon.tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: q.rowMinHeight,
          paddingHorizontal: q.rowPaddingX,
          paddingVertical: theme.spacing(1.5),
        },
        pressed && { backgroundColor: PRESSED_FILL },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: q.icon.gap, flexShrink: 1 }}>
        {icon ? icon(iconTone ?? theme.colors.textMuted) : null}
        <Text style={{ ...theme.type.body, color: labelColor }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {selected ? <CheckGlyph color={theme.colors.accent} /> : null}
    </Pressable>
  );
}
