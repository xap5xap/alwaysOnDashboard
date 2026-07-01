// Shell-frame placeholders for the routes this task SCAFFOLDS but whose INTERIORS other issues own
// (app-ia §5 / design-core-navigation §13 seams). Each composes the shell (Screen + AppBar + a state) so
// the route tree is real and navigable for verification, and is clearly tagged with the owning issue. The
// per-screen builds REPLACE these bodies inside the same shell frame:
//   Onboarding + Paywall  -> AOD-29        Kiosk wall          -> AOD-11 / AOD-39
//   Themes                -> AOD-28
// The Dashboards switcher (was here) is BUILT: src/dashboard/DashboardsSwitcher.tsx (AOD-27 / AOD-69).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AppBar, EmptyState, Screen, ScreenBody } from '../shell';
import { AuthCard, Wordmark } from '../ui/Surfaces';
import { Button } from '../ui/Button';

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

/** Onboarding first-run (pushed, gated) — interior owned by AOD-29. Skippable into the dashboard so the
 *  scaffolded route is navigable; AOD-29 builds the guided stepper + connect-first-service flow. */
export function OnboardingScreen() {
  return (
    <Screen>
      <ScreenBody scroll={false}>
        <EmptyState
          line="Onboarding coming in AOD-29."
          actionLabel="Continue to dashboard"
          onAction={() => router.replace('/dashboard')}
        />
      </ScreenBody>
    </Screen>
  );
}

/** Paywall (modal route) — the full body is AOD-29; the shell fixes the modal presentation + the upgrade
 *  entry. Reads the `trigger` param so the real paywall can lead with the matching upsell angle (AOD-12 §9). */
export function PaywallScreen() {
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  const { theme } = useUnistyles();
  return (
    <Screen>
      <View style={styles.paywall}>
        <AuthCard testID="paywall-card">
          <Wordmark />
          <Text style={[theme.type.heading, { color: theme.colors.text }]}>Vela Pro</Text>
          <Text style={[theme.type.meta, { color: theme.colors.textMuted }]}>
            {trigger ? `Unlock this from ${trigger}. ` : ''}Full paywall coming in AOD-29.
          </Text>
          <Button label="Maybe later" variant="secondary" block onPress={() => router.back()} testID="paywall-close" />
        </AuthCard>
      </View>
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
  paywall: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.screen.paddingX },
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
