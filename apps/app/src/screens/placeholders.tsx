// Shell-frame placeholders for the routes this task SCAFFOLDS but whose INTERIORS other issues own
// (app-ia §5 / design-core-navigation §13 seams). Each composes the shell (Screen + AppBar + a state) so
// the route tree is real and navigable for verification, and is clearly tagged with the owning issue. The
// per-screen builds REPLACE these bodies inside the same shell frame:
//   Themes                -> AOD-28        Kiosk wall          -> AOD-11 / AOD-39
// BUILT + moved out of here: Onboarding + Paywall -> AOD-29 (src/onboarding/Onboarding + src/paywall/Paywall);
// the Dashboards switcher -> src/dashboard/DashboardsSwitcher (AOD-27 / AOD-69).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AppBar, EmptyState, Screen, ScreenBody } from '../shell';

/** Themes picker (pushed) — interior owned by AOD-28. */
export function ThemesScreen() {
  return (
    <Screen>
      <AppBar variant="pushed" title="Themes" onBack={() => router.back()} />
      <ScreenBody scroll={false}>
        <EmptyState line="Theme picker coming in AOD-28." />
      </ScreenBody>
    </Screen>
  );
}

/** Kiosk wall (fullscreen route) — the wall presentation is AOD-39 / AOD-11. The shell fixes the
 *  chrome-hidden fullscreen frame (no AppBar, near-black field). A temporary visible Exit stands in for
 *  the AOD-11 gesture + PIN exit lock (gestureEnabled:false is set on the route); AOD-11/39 replace it. */
export function KioskScreen() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.kiosk} testID="kiosk-wall">
      <Text style={[theme.type.hero, { color: theme.colors.text }]}>Kiosk wall</Text>
      <Text style={[theme.type.meta, { color: theme.colors.textMuted }]}>Wall presentation: AOD-11 / AOD-39.</Text>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} testID="kiosk-exit" style={styles.kioskExit}>
        <Text style={[theme.type.label, { color: theme.colors.textMuted }]}>Exit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  kiosk: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
  },
  kioskExit: {
    position: 'absolute',
    top: rt.insets.top + theme.spacing(2),
    right: theme.spacing(4),
    padding: theme.spacing(2),
  },
}));
