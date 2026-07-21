// Shell-frame placeholders for the routes this task SCAFFOLDS but whose INTERIORS other issues own
// (app-ia §5 / design-core-navigation §13 seams). Each composes the shell (Screen + AppBar + a state) so
// the route tree is real and navigable for verification, and is clearly tagged with the owning issue. The
// per-screen builds REPLACE these bodies inside the same shell frame:
//   Themes                -> AOD-28
// BUILT + moved out of here: Onboarding + Paywall -> AOD-29 (src/onboarding/Onboarding + src/paywall/Paywall);
// the Dashboards switcher was RETIRED into page altitude (AOD-145; formerly src/dashboard/DashboardsSwitcher,
// AOD-27 / AOD-69); the Kiosk wall -> AOD-72
// (src/kiosk/KioskWall, the AOD-39 presentation; NOT a shell application, so it is not a placeholder here).
import React from 'react';
import { router } from 'expo-router';
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
