// The signed-in zone (app-ia.md §4.3): a Stack that ALSO guards the zone, so a deep-link straight to any
// (app) route (settings, kiosk, ...) cannot bypass auth. While the session resolves -> Splash; no session
// -> Redirect to /sign-in (the same gate predicate as app/index.tsx, enforced at the group boundary). This
// is the idiomatic expo-router expression of the inline `session ? <Dashboard/> : <SignIn/>` the gate did
// before (app-ia §9 additive refactor). Per-screen PRESENTATION is set here (app-ia §4.4): the paywall is a
// modal route; kiosk is fullscreen with the gesture-back disabled (its exit lock is AOD-11's,
// design-core-navigation §9). The /dashboards switcher modal is RETIRED (AOD-145) — the Glance pager + the
// Arrange page altitude replace it. headerShown:false app-wide; the app draws its own AppBar chrome.
// Configure Unistyles before any styled component in this group evaluates. expo-router eagerly evaluates
// the route context, and the `(app)` / `(auth)` group directories sort BEFORE `app/_layout.tsx` (which owns
// the primary `import '../unistyles'`), so a group child's StyleSheet.create would otherwise run before the
// theme is configured. This import is the module singleton, so it is a no-op wherever configure already ran.
import '../../unistyles';
import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { Splash } from '../../src/shell';

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Redirect href="/sign-in" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* AOD-29: transparentModal so the AOD-67 Sheet's own scrim dims the caller behind it (design §6). */}
      <Stack.Screen name="paywall" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="kiosk" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
