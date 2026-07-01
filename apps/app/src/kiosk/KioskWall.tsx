// The kiosk wall (design-kiosk-wall.md, kiosk-mode.md AOD-11). The DISTINCT chrome-hidden fullscreen
// presentation profile (app-ia §5 row 12) that replaces the AOD-68 KioskScreen placeholder: it mounts an
// ordinary DashboardLayout under the wall-mount profile (dark, larger type, no chrome) and COMPOSES the
// AOD-37 cards (via the AOD-7 layout engine) + the AOD-62 AmbientProvider for the day/night ramp. It is NOT
// an application of the AOD-21 shell (no Screen, no AppBar): the wall is content, edge to edge.
//
// Seams (the AOD-72 KEY DECISION): the NATIVE runtime (keep-awake, backlight, orientation lock, pinning,
// the expo-secure-store PIN hash, CadenceProfile, the computeAmbient driver, the OS back-intercept) is
// wired behind useKioskRuntime() as a web no-op and IMPLEMENTED in a separate K-M1 follow-up type:tech-task
// that ends with the EAS + Fire HD 8 device verify. Everything this file ships is web-verified.
import React from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { AmbientProvider } from '../ambient/AmbientContext';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import { useDashboard } from '../layout/useDashboard';
import { wallProfile } from './profile';
import { useKioskRuntime } from './runtime';
import { ExitAffordance } from './ExitAffordance';

const noop = () => {};

export function KioskWall() {
  const { theme } = useUnistyles();
  // The dashboardId param (app-ia §5 row 12: which layout to mount as the wall). useDashboard bootstraps
  // the single active dashboard today; selecting a layout by id is the SAME app-ia §10 seam AOD-69 flagged
  // for the switcher, so the param is accepted + documented and the active dashboard is rendered. Not forked.
  useLocalSearchParams<{ dashboardId?: string }>();
  const { instances, isLoading, isError } = useDashboard();
  const runtime = useKioskRuntime();
  const profile = wallProfile(theme.wall.typeScale);
  const insets = UnistylesRuntime.insets;

  const onExit = () => {
    // The gesture + PIN is the ONLY exit (the OS back is intercepted by the native seam; gestureEnabled is
    // false on the route). A correct PIN replaces back to the Dashboard hub (app-ia §6.1); unmounting the
    // wall fires useKioskRuntime's stop() (release pinning, restore brightness, deactivate keep-awake).
    router.replace('/dashboard');
  };

  return (
    <View style={styles.field} testID="kiosk-wall">
      {/* §8 no OS status bar: the wall is edge to edge (a native effect; a no-op on web). */}
      <StatusBar hidden />

      {/* §6 the wall owns its day/night: an uncontrolled AmbientProvider (defaults to day, dev-settable via
          __velaSetAmbient). The native runtime drives it with computeAmbient(now) (AOD-11 §8.4, the seam);
          on web the day/night look is forced from the preview via __velaSetAmbient. Composes AOD-62; the
          per-card overlay + the deep-red Clock opt-in are the AOD-37 §7 cards reacting, not rebuilt here. */}
      <AmbientProvider>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
          ]}
        >
          {isLoading ? (
            // §5 the wall never blanks harshly: a calm centered line while the layout resolves (brief).
            <View style={styles.centered}>
              <Text style={styles.calm}>Loading your wall…</Text>
            </View>
          ) : isError ? (
            <View style={styles.centered} testID="kiosk-error">
              <Text style={styles.calm}>Couldn’t load this dashboard.</Text>
            </View>
          ) : instances.length === 0 ? (
            <View style={styles.centered} testID="kiosk-empty">
              <Text style={styles.calm}>No widgets on this dashboard.</Text>
            </View>
          ) : (
            // §3/§4 the wall type scale: a uniform up-scale of the composed cards ("the cards, only larger").
            // The stored geometry (rects) is UNTOUCHED (kiosk-mode §7.2 seam); this is a pure visual
            // transform, no rect rewritten and no layout/card internal edited. A pure font-only scale would
            // need a derived wall theme applied via UnistylesRuntime; flagged as a refinement, not built.
            <View style={[styles.scaleLayer, { transform: [{ scale: profile.typeScale }] }]} testID="kiosk-scale-layer">
              <LayoutCanvas
                instances={instances}
                arranging={false}
                onEnterArrange={noop}
                onExitArrange={noop}
                onCommit={noop}
                onRequestConfigure={noop}
              />
            </View>
          )}
        </View>
      </AmbientProvider>

      {/* §7/§8 the exit affordance at the true screen edge (outside the safe-area padding), above the wall.
          The invisible corner + the "Hold to exit" hint + ring + the PIN pad; the app-level gesture + PIN is
          the portable exit guard (§8). readPinHash is the runtime seam (dev default on web). */}
      <ExitAffordance storedHash={runtime.readPinHash()} onExit={onExit} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    flex: 1,
    backgroundColor: theme.colors.background, // §4 the near-black wall field, edge to edge
    overflow: 'hidden',
  },
  content: { flex: 1 },
  scaleLayer: {
    flex: 1,
    transformOrigin: 'left top', // §4 grow the wall from the top-left so the layout stays anchored
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  calm: { ...theme.type.body, color: theme.colors.textMuted }, // §5 calm, never an error treatment
}));
