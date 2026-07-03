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
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AmbientProvider } from '../ambient/AmbientContext';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import { useDashboard } from '../layout/useDashboard';
import { layoutBounds, wallFitScale } from './viewport';
import { useKioskRuntime } from './runtime';
import { ExitAffordance } from './ExitAffordance';
import { PinSetup } from './PinSetup';

const noop = () => {};

export function KioskWall() {
  const { theme, rt } = useUnistyles();
  // The dashboardId param (app-ia §5 row 12: which layout to mount as the wall). useDashboard bootstraps
  // the single active dashboard today; selecting a layout by id is the SAME app-ia §10 seam AOD-69 flagged
  // for the switcher, so the param is accepted + documented and the active dashboard is rendered. Not forked.
  useLocalSearchParams<{ dashboardId?: string }>();
  const { instances, isLoading, isError } = useDashboard();
  const { pinHash, ambient, needsPinSetup, setPin } = useKioskRuntime();
  // AOD-81 (revised 2026-07-03, dogfood): the wall AUTO-FITS the arranged layout to the device screen, so the
  // whole dashboard shows and nothing is clipped — on any device/resolution. This REPLACES the AOD-39 fixed
  // 1.4x, which clipped any layout wider than the device's real usable width (and that width is smaller than
  // the AOD-80 contract assumed: rt.screen is in DENSITY-INDEPENDENT PIXELS, so the 1280x800-physical /
  // density-1.33 Fire HD 8 is 962x601 DP, and 1.4x showed only ~8.6u wide, clipping an 11.25u card). Because
  // rt.screen and UNIT_PX are both DP, the fit is density-correct. The stored geometry (rects) is UNTOUCHED
  // (kiosk-mode §7.2 seam): a pure visual transform, no rect rewritten. The preview derives the same scale.
  const scale = wallFitScale(layoutBounds(instances.map((i) => i.rect)), rt.screen);
  // rt.insets (not the imperative UnistylesRuntime.insets snapshot): the useUnistyles proxy SUBSCRIBES this
  // component to inset changes, so when the AOD-76 runtime hides the OS bars the padding collapses to 0 and
  // the content reclaims the full screen — and re-pads live if a swipe transiently reveals the bars. Same
  // source of truth as the ExitAffordance anchors (AOD-79). What the wall's usable viewport MEANS for the
  // layout math at scale stays the AOD-80 viewport-contract design; this is only the live accessor.
  const insets = rt.insets;

  const onExit = () => {
    // The gesture + PIN is the ONLY exit (the OS back is intercepted by the native seam; gestureEnabled is
    // false on the route). A correct PIN replaces back to the Dashboard hub (app-ia §6.1); unmounting the
    // wall fires useKioskRuntime's stop() (release pinning, restore brightness, deactivate keep-awake).
    router.replace('/dashboard');
  };

  return (
    <View style={styles.field} testID="kiosk-wall">
      {/* §8 no OS status bar: the wall is edge to edge (a native effect; a no-op on web). The SUSTAINED
          no-chrome state (both bars, transient-by-swipe, insets re-dispatch) is owned by the runtime's
          setImmersiveMode enter/exit (AOD-76); this expo-status-bar element is kept so the status bar is
          hidden from the very first wall frame and on platforms where the runtime is a no-op. */}
      <StatusBar hidden />

      {/* §8 the wall owns its day/night. On native the runtime drives computeAmbient(now) (§8.4) into this
          provider as a CONTROLLED value; on web `ambient` is undefined so the provider stays uncontrolled and
          the __velaSetAmbient dev seam forces the look from the preview. Composes AOD-62; the per-card overlay
          + the deep-red Clock opt-in are the AOD-37 §7 cards reacting, not rebuilt here. */}
      <AmbientProvider value={ambient}>
        {/* pointerEvents none: the wall shows content, not controls (§8; the §7 corner is the ONLY wall
            affordance), so the content subtree takes no part in touch. This is also LOAD-BEARING for the
            exit guard on-device (AOD-79): with the cards' RNGH detectors inside the 1.4x-scaled layer
            participating in hit-testing, Fire OS delivered NO touches to the corner Pressable even where
            it was fully visible (an injected hold at the corner's exact uiautomator bounds never fired
            onPressIn, while the same injection long-pressed a dashboard card fine); excluding the
            display-only subtree restores §7 "the gesture + PIN is the only exit". */}
        <View
          pointerEvents="none"
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
            // The auto-fit transform: a uniform scale of the composed cards so the whole layout fills the
            // screen without clipping (computed above). Grows from the top-left (transformOrigin), so what is
            // arranged at the canvas origin maps to the wall's top-left. No rect rewritten, no card internal
            // edited — the geometry seam holds; only the visual scale changed.
            <View style={[styles.scaleLayer, { transform: [{ scale }] }]} testID="kiosk-scale-layer">
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

      {/* §7/§8 the exit affordance layered over the whole wall, mounted OUTSIDE the padded content view so
          its layer spans the true screen edge (the AOD-72 intent, kept). Since AOD-79 the corner + hint
          anchor themselves INSIDE the OS-bar insets (rt.insets via useUnistyles, subscribed), and since
          AOD-76 the wall's content padding reads the same live rt.insets: with the runtime's immersive mode
          hiding the bars, both follow the insets to the true edge together, and re-anchor if a swipe
          transiently reveals the bars. The invisible corner + the "Hold to exit" hint + ring + the PIN pad
          (rendered inline so no modal window re-shows the bars); the app-level gesture + PIN is the
          portable exit guard (§9). pinHash is the runtime seam (secure-store on native, dev default on
          web). */}
      <ExitAffordance storedHash={pinHash ?? ''} onExit={onExit} />

      {/* §4.3 first-run exit-PIN setup: native with no stored PIN shows this before the wall is exitable, so a
          wall is never left un-exitable and the AOD-72 dev PIN never ships. Never shown on web (needsPinSetup
          is false there). Cancel leaves the wall via the same exit path. */}
      {needsPinSetup ? <PinSetup onDone={setPin} onCancel={onExit} /> : null}
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
