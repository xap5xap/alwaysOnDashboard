// Account (design-core-navigation.md §6, app-ia.md §5 row 11). The nav destination that holds the identity
// block, the manage-subscription link, and the two account actions. Sign out is RELOCATED here from the
// Dashboard header (app-ia §5 / §9, §12 drift 1): the Dashboard chrome keeps only glanceable concerns, and
// the account-management actions live on their own screen. Composes the AOD-20 Card / RowGroup / ListRow /
// Button; every colour is a role.
//
// Seams (out of this shell task): the RevenueCat "manage subscription" store link is billing (kept as the
// upgrade/subscription entry for now), and the in-app account deletion flow (AOD-5 E2) is a later account
// build — the shell PLACES the destructive control; its confirm + backend call are not wired here.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../auth/AuthProvider';
import { useEntitlements } from '../entitlements/useEntitlements';
import { AppBar, Screen, ScreenBody } from '../shell';
import { Button } from '../ui/Button';
import { Card, ListRow, RowGroup } from '../ui/Surfaces';
import { ChevronGlyph } from '../ui/glyphs';

export function Account() {
  const { session, signOut } = useAuth();
  const { tier } = useEntitlements();
  const { theme } = useUnistyles();
  const isPro = tier === 'pro';
  const email = session?.user?.email ?? 'Signed in';

  return (
    <Screen>
      <AppBar variant="pushed" title="Account" onBack={() => router.back()} />
      <ScreenBody>
        {/* Identity: email + plan, with an Upgrade action while Free. */}
        <Card testID="account-identity">
          <Text numberOfLines={1} style={[theme.type.title, styles.text]}>
            {email}
          </Text>
          <Text style={[theme.type.meta, styles.muted]} testID="account-plan">
            {isPro ? 'Pro plan' : 'Free plan'}
          </Text>
          {!isPro ? (
            <Button
              label="Upgrade to Pro"
              variant="primary"
              size="sm"
              onPress={() => router.push('/paywall?trigger=account')}
              style={styles.upgrade}
              testID="account-upgrade"
            />
          ) : null}
        </Card>

        <RowGroup>
          <Pressable
            onPress={() => router.push('/paywall?trigger=account')}
            accessibilityRole="button"
            testID="account-manage-subscription"
          >
            <ListRow title="Manage subscription" trailing={<ChevronGlyph color={theme.colors.textMuted} />} />
          </Pressable>
        </RowGroup>

        {/* Sign out (RELOCATED here) + the destructive deletion control. */}
        <View style={styles.actions}>
          <Button
            label="Sign out"
            variant="secondary"
            block
            onPress={() => void signOut()}
            testID="account-sign-out"
          />
          <Button
            label="Delete account"
            variant="destructive"
            block
            // AOD-5 E2 in-app deletion flow is a later account build; the shell places the control.
            onPress={() => {}}
            testID="account-delete"
          />
        </View>
      </ScreenBody>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  text: { color: theme.colors.text },
  muted: { color: theme.colors.textMuted },
  upgrade: { alignSelf: 'flex-start', marginTop: theme.spacing(2) },
  actions: { gap: theme.spacing(3), marginTop: theme.spacing(2) },
}));
