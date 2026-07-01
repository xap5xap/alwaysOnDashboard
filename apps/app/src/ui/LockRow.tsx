// Lock / PRO overlays (design-component-library.md §11). This IS the entitlements Gate fallback
// (src/entitlements/Gate.tsx): <Gate feature fallback={<LockRow/>}>children</Gate> renders the real
// control when entitled and this lock when not. The lock is UX-ONLY: it routes to the paywall and never
// performs the gated mutation; the server refuses an over-limit request regardless of the UI. LockRow is
// a listRow variant (leading padlock + muted title + a PRO badge + a chevron -> paywall), replacing the
// plain "Kiosk Mode (Pro, locked)" text (§13 drift 7). LockedTile is the picker's premium pick: the
// preview under a scrim, a padlock, a "Pro feature" line, and an Upgrade button. The full paywall is
// AOD-29; AOD-20 owns only this affordance and the upgrade entry point.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor, roleRadius } from './theme';
import { ListRow } from './Surfaces';
import { AccentBadge } from './Badge';
import { Button } from './Button';
import { ChevronGlyph, LockGlyph } from './glyphs';

export interface LockRowProps {
  title: string;
  /** Routes to the paywall (the upgrade entry point). Never runs the gated action. */
  onPress?: () => void;
  badgeLabel?: string;
  testID?: string;
}

/** §11 the lock row: a dimmed listRow with a padlock, a muted title, a PRO badge, and a chevron. */
export function LockRow({ title, onPress, badgeLabel = 'PRO', testID }: LockRowProps) {
  const { theme } = useUnistyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${badgeLabel}, upgrade`} testID={testID}>
      <ListRow
        title={title}
        titleMuted
        leading={<LockGlyph color={roleColor(theme, theme.lockRow.glyph) as string} />}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
            <AccentBadge label={badgeLabel} />
            <ChevronGlyph color={theme.colors.textMuted} />
          </View>
        }
      />
    </Pressable>
  );
}

export interface LockedTileProps {
  /** The premium preview underneath (dimmed by the scrim). */
  children: React.ReactNode;
  onUpgrade?: () => void;
  line?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** §11 the locked tile: a premium pick with the preview under a scrim + a padlock + a "Pro feature" line
 *  + an Upgrade button. The Upgrade button is imported lazily-free (Button) to keep the affordance whole. */
export function LockedTile({ children, onUpgrade, line = 'Pro feature', style, testID }: LockedTileProps) {
  const { theme } = useUnistyles();
  return (
    <View testID={testID} style={[{ borderRadius: roleRadius(theme, 'md'), overflow: 'hidden' }, style]}>
      <View pointerEvents="none">{children}</View>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.scrim, alignItems: 'center', justifyContent: 'center', gap: theme.spacing(2), padding: theme.spacing(4) }}>
        <LockGlyph size={28} color={theme.colors.onAccent} />
        <Text style={{ ...theme.type.body, color: theme.colors.onAccent, textAlign: 'center' }}>{line}</Text>
        <Button label="Upgrade" variant="primary" size="sm" onPress={onUpgrade} testID="locked-tile-upgrade" />
      </View>
    </View>
  );
}
