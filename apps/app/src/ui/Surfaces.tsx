// Surfaces (design-component-library.md §8): the app-chrome Card, RowGroup, ListRow, and AuthCard, all at
// elevation.raised (surface + 1px border, no shadow). NOTE the widget card is REUSED from the widget
// system (src/host/WidgetHostView, owned by AOD-37) and is NOT this; `Card` here is the app-chrome raised
// surface primitive (Settings panels, the paywall panel), consuming the §12 `card` token group. The list
// row generalises the shipped ConnectionRow / Settings rows into one anatomy: leading / identity /
// trailing, so a settings row, a connection row, and a lock row are one component with different trailings.
import React from 'react';
import { Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { elevationStyle, roleRadius } from './theme';

/** §8 the app-chrome raised surface primitive (a panel / card at elevation.raised). */
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { theme } = useUnistyles();
  const t = theme.card;
  return (
    <View testID={testID} style={[elevationStyle(theme, 'raised'), { borderRadius: roleRadius(theme, t.radius), padding: t.padding }, style]}>
      {children}
    </View>
  );
}

/** §8 a 1px divider (rowGroup.divider -> border) between rows in a RowGroup. */
function Divider() {
  const { theme } = useUnistyles();
  return <View testID="row-divider" style={{ height: 1, backgroundColor: theme.colors.border }} />;
}

/** §8 the Settings-style panel: a raised surface whose children are list rows split by border dividers. */
export function RowGroup({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { theme } = useUnistyles();
  const t = theme.rowGroup;
  const rows = React.Children.toArray(children);
  return (
    <View
      testID={testID}
      style={[elevationStyle(theme, 'raised'), { borderRadius: roleRadius(theme, t.radius), overflow: 'hidden' }]}
    >
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <Divider /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** An optional leading glyph / icon. */
  leading?: React.ReactNode;
  /** The trailing slot: an action button, a status badge, or a chevron. */
  trailing?: React.ReactNode;
  /** Dim the title to textMuted (the §11 lock-row variant reuses this row anatomy). */
  titleMuted?: boolean;
  testID?: string;
}

/** §8 the one list-row anatomy: leading / identity / trailing. A settings row, a connection row, and a
 *  lock row are this component with different trailing slots (and titleMuted for the lock row). */
export function ListRow({ title, subtitle, leading, trailing, titleMuted = false, testID }: ListRowProps) {
  const { theme } = useUnistyles();
  const t = theme.listRow;
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: t.gap, padding: t.padding }}>
      {leading ? <View>{leading}</View> : null}
      <View style={{ flexGrow: 1, flexShrink: 1, gap: theme.spacing(0.5) }}>
        <Text numberOfLines={1} style={{ ...theme.type.title, color: titleMuted ? theme.colors.textMuted : theme.colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ ...theme.type.meta, color: theme.colors.textMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

/** §8 the auth card (SignIn / paywall panel): a raised surface at radius.lg with generous padding. */
export function AuthCard({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { theme } = useUnistyles();
  const t = theme.authCard;
  return (
    <View
      testID={testID}
      style={[elevationStyle(theme, 'raised'), { borderRadius: roleRadius(theme, t.radius), padding: t.padding, width: '100%', maxWidth: 420, gap: theme.spacing(3) }, style]}
    >
      {children}
    </View>
  );
}

/** The lowercase "vela" wordmark (design-brand.md §5/§7, AOD-18). A minimal text lockup for the auth card;
 *  the brand owns the final mark. One accent, no new hue. */
export function Wordmark({ testID }: { testID?: string }) {
  const { theme } = useUnistyles();
  return (
    <Text testID={testID} style={{ ...theme.type.hero, color: theme.colors.text, letterSpacing: 0.5 }}>
      vela
    </Text>
  );
}
