// Settings home — the secondary hub (design-core-navigation.md §6, app-ia.md §5 row 7). This is the
// settings-home SHELL: the pushed header, the section structure, and the nav rows that route to Themes /
// Kiosk / Account, composing the AOD-20 RowGroup / ListRow / LockRow. It canonicalizes the shipped screen
// (§12 drift 3): the 24/800 title + plain "Kiosk Mode (Pro, locked)" text + "Back to dashboard" link
// become the AppBar + the Gate lock rows + the standard back affordance.
//
// OWNERSHIP SPLIT (§6): AOD-68 owns this shell; the Connections INTERIOR (the connection-row states, the
// connect / disconnect / reconnect detail, the credential form sheet) stays AOD-28's — so the Connections
// section renders the shipped ConnectionsList unchanged as the placeholder until AOD-28 designs its interior.
// The Themes / Kiosk lock rows are the entitlements Gate fallback (UX-only; the server enforces): Pro sees
// the enabled nav row, Free sees the padlock row routing to the paywall with the matching trigger.
import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { Gate } from '../entitlements/Gate';
import { ConnectionsList } from '../connections/ConnectionsList';
import { AppBar, Screen, ScreenBody } from '../shell';
import { ListRow, RowGroup } from '../ui/Surfaces';
import { LockRow } from '../ui/LockRow';
import { ChevronGlyph } from '../ui/glyphs';

/** An enabled nav row: a pressable ListRow with a trailing chevron (routes onward). The Gate's entitled
 *  branch; its Free branch is the LockRow. */
function NavRow({ title, onPress, testID }: { title: string; onPress: () => void; testID?: string }) {
  const { theme } = useUnistyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}>
      <ListRow title={title} trailing={<ChevronGlyph color={theme.colors.textMuted} />} />
    </Pressable>
  );
}

export function Settings() {
  return (
    <Screen>
      <AppBar variant="pushed" title="Settings" onBack={() => router.back()} />
      <ScreenBody>
        {/* The Connections section: interior (heading, row states, credential sheet) owned by AOD-28; the
            shipped list stays as the section placeholder until then. */}
        <ConnectionsList />

        <RowGroup testID="settings-rows">
          <Gate
            feature="canUseThemes"
            fallback={<LockRow title="Themes" onPress={() => router.push('/paywall?trigger=themes')} testID="settings-themes-locked" />}
          >
            <NavRow title="Themes" onPress={() => router.push('/settings/themes')} testID="settings-themes" />
          </Gate>
          <Gate
            feature="canUseKiosk"
            fallback={<LockRow title="Kiosk Mode" onPress={() => router.push('/paywall?trigger=kiosk')} testID="settings-kiosk-locked" />}
          >
            <NavRow title="Kiosk Mode" onPress={() => router.push('/kiosk')} testID="settings-kiosk" />
          </Gate>
          <NavRow title="Account" onPress={() => router.push('/settings/account')} testID="settings-account" />
        </RowGroup>
      </ScreenBody>
    </Screen>
  );
}
