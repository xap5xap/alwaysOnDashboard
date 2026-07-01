// Badges (design-component-library.md §10). Three kinds on the type.badge step (10 / 700 / +1 / uppercase),
// each a per-kind role map from the §12 `badge` group. StatusBadge = the widget status mark reused (a
// warning / error / success dot + an uppercase label). AccentBadge = PRO / NEW (accentMuted fill + accent
// text, radius.full). CountBadge = a count pill, primary (accent + onAccent) or neutral (surfaceAlt +
// border). Every colour is a role, never a hex; PRO / accent badges share the one accentMuted chrome tint.
import React from 'react';
import { Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor } from './theme';

export type StatusKind = 'warning' | 'error' | 'success';

/** §10 status badge: a coloured status dot + an uppercase label (textMuted), the widget status mark. */
export function StatusBadge({ status, label, testID }: { status: StatusKind; label: string; testID?: string }) {
  const { theme } = useUnistyles();
  const dotColor = roleColor(theme, theme.badge.status[status]);
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) }}>
      <View testID="status-badge-dot" style={{ width: theme.dot.r * 2, height: theme.dot.r * 2, borderRadius: theme.dot.r, backgroundColor: dotColor }} />
      <Text style={{ ...theme.type.badge, color: theme.colors.textMuted }}>{label}</Text>
    </View>
  );
}

/** §10 accent badge: PRO / NEW, an accentMuted fill + accent text on radius.full. */
export function AccentBadge({ label, testID }: { label: string; testID?: string }) {
  const { theme } = useUnistyles();
  const t = theme.badge;
  return (
    <View
      testID={testID}
      style={{ alignSelf: 'flex-start', paddingHorizontal: t.paddingX, paddingVertical: t.paddingY, borderRadius: theme.radius.full, backgroundColor: theme.colors.accentMuted }}
    >
      <Text style={{ ...theme.type.badge, color: roleColor(theme, t.accent.fg) }}>{label}</Text>
    </View>
  );
}

/** §10 count badge: a count pill, primary (accent + onAccent) or neutral (surfaceAlt + border). */
export function CountBadge({ count, tone = 'primary', testID }: { count: number | string; tone?: 'primary' | 'neutral'; testID?: string }) {
  const { theme } = useUnistyles();
  const t = theme.badge;
  const map = tone === 'primary' ? t.count.primary : t.count.neutral;
  const border = tone === 'neutral' ? roleColor(theme, t.count.neutral.border) : undefined;
  return (
    <View
      testID={testID}
      style={{ minWidth: 22, alignItems: 'center', paddingHorizontal: t.paddingX, paddingVertical: t.paddingY, borderRadius: theme.radius.full, backgroundColor: roleColor(theme, map.bg), borderWidth: border ? 1 : 0, borderColor: border }}
    >
      <Text style={{ ...theme.type.badge, letterSpacing: 0, color: roleColor(theme, map.fg) }}>{String(count)}</Text>
    </View>
  );
}
