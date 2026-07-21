// The dashboard screen (AOD-8 §8 DashboardLayout, rendered). It loads the signed-in user's real layout
// from Supabase under RLS (useDashboard: load + bootstrap-if-empty + persist), and mounts the free-form
// layout engine (LayoutCanvas) which renders each instance through the generic WidgetHost. The screen
// owns the arrange-mode flag; the AOD-142 Glance | Arrange dial is the explicit control that drives it
// (flipping to Glance leaves Arrange), with a long-press on a card as a shortcut and tap-empty-canvas as a
// convenience exit. It never names a service: the AOD-8 seam holds end to end.
//
// AOD-142 (design "The sky fills in" §1e): the arranging Done pill is REPLACED by the persistent Glance |
// Arrange dial in the hub header; the wall Preview pill stays (AOD-81). The dial rides a single "chrome
// awake" idle state (useChromeAwake) wired to the surface's touch callbacks, so the hub chrome sinks when
// idle (calm Glance) and wakes on any touch — one mechanism, reused by AOD-144's page dots.
//
// AOD-68 canonicalization (design-core-navigation §3, §5, §8, §12 drift 1-2): the inline header is now the
// shell HUB AppBar (the vela wordmark + Add + Settings + the dashboards-switcher chevron), sign out is
// RELOCATED to Account (dropped here), and the ad-hoc ActivityIndicator / inline error / empty CTA become
// the shell screen-level states.
// AOD-69 fills the AOD-27 dashboard INTERIOR: the arranging header shows the Preview pill (the Done pill it
// once paired with is now the AOD-142 dial), the empty branch composes the shell EmptyState into the §5
// calm add-first-widget CTA (glyph + subline),
// and the canvas (LayoutCanvas), the picker (WidgetPicker) and the per-instance config sheet
// (ConfigureInstanceModal) are the polished editor surfaces this task canonicalizes to the design.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ConfigureInstanceModal } from '../layout/ConfigureInstanceModal';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import { WidgetPicker } from '../layout/WidgetPicker';
import { useDashboard } from '../layout/useDashboard';
import { useRemoveWidget } from '../layout/useRemoveWidget';
import { WallPreview } from '../kiosk/WallPreview';
import type { WidgetInstance } from '../registry/types';
import { AppBar, EmptyState, ErrorState, LoadingState, Screen } from '../shell';
import { Button } from '../ui/Button';
import { ChevronGlyph } from '../ui/glyphs';
import { AddGlyph } from './glyphs';
import { ModeDial } from './ModeDial';
import { useChromeAwake } from './useChromeAwake';

export function Dashboard() {
  const { instances, isLoading, isError, error, refetch, commit } = useDashboard();
  const { removeWidget } = useRemoveWidget();
  const { theme } = useUnistyles();
  const [arranging, setArranging] = useState(false);
  // AOD-142: the single "chrome awake" idle state. `wake` is wired to the surface touch callbacks below;
  // `awake` drives the dial's fade (and, later, AOD-144's page dots). One timer, reset on any touch.
  const { awake, wake } = useChromeAwake();
  const [picking, setPicking] = useState(false);
  // AOD-81 §6: the wall preview peek. Owned here like `picking`/`arranging` (the app-ia locked fact: a
  // surface carrying a live object stays in-screen, never a router route), mounted as an overlay below.
  const [previewing, setPreviewing] = useState(false);
  // The instance whose config form is open (AOD-10 §4). Owned here like `picking`/`arranging` so both
  // reconfigure entries (arrange-mode "Configure" and the host's needs_config prompt) route through it.
  const [configuring, setConfiguring] = useState<WidgetInstance | null>(null);

  // AOD-142: the hub trailing cluster. The Glance | Arrange dial is the PERSISTENT mode control (present in
  // both modes — flipping it to Glance is how you leave Arrange), riding the chrome-awake state so it sinks
  // when the surface is idle. Its mode-specific siblings follow it: while arranging, only the wall Preview
  // pill (AOD-81 §6, ghost; the Done pill it once paired with is gone — the dial replaces it); otherwise
  // Add + Settings + the dashboards-switcher chevron. The dial + Add appear once the board has loaded (there
  // is nothing to arrange while loading/erroring); Settings + the switcher stay put as before.
  const canArrange = !isLoading && !isError;
  const headerRight = (
    <>
      {canArrange ? (
        <ModeDial mode={arranging ? 'arrange' : 'glance'} awake={awake} onChange={(m) => setArranging(m === 'arrange')} />
      ) : null}
      {arranging ? (
        <Button label="Preview" variant="ghost" size="sm" pill onPress={() => setPreviewing(true)} testID="dashboard-preview" />
      ) : (
        <>
          {canArrange ? (
            <Button label="Add" variant="ghost" size="sm" onPress={() => setPicking(true)} testID="dashboard-add-widget" />
          ) : null}
          <Button label="Settings" variant="ghost" size="sm" onPress={() => router.push('/settings')} testID="dashboard-settings" />
          <Pressable
            onPress={() => router.push('/dashboards')}
            accessibilityRole="button"
            accessibilityLabel="Switch dashboard"
            hitSlop={8}
            testID="dashboard-switcher"
          >
            <ChevronGlyph color={theme.colors.textMuted} />
          </Pressable>
        </>
      )}
    </>
  );

  return (
    <>
      <Screen>
        {/* AOD-142 the wake surface: any touch re-arms the chrome-awake idle timer. onTouchStart/onTouchMove
            are PASSIVE responder callbacks (they never call setResponder), so they observe the touch without
            capturing it — they can't move a card ("waking ≠ editing") and never contend with the arrange
            gestures. Wrapping the whole hub means a touch on the dial, a card, or empty space all wake it. */}
        <View style={styles.surface} onTouchStart={wake} onTouchMove={wake} testID="dashboard-surface">
          <AppBar variant="hub" right={headerRight} testID="dashboard-header" />

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState line="Could not load your dashboard." detail={error?.message} onRetry={() => void refetch()} />
          ) : !arranging && instances.length === 0 ? (
            // AOD-27 §5: the calm empty-dashboard CTA (a soft accent add glyph + line + a quieter subline + one
            // primary "Add widget"), composing the shell EmptyState. Never an error treatment; the board is new.
            <EmptyState
              glyph={<AddGlyph color={theme.colors.accent} />}
              line="Your dashboard is empty."
              subline="Add a widget to get started."
              actionLabel="Add widget"
              onAction={() => setPicking(true)}
              testID="dashboard-empty"
            />
          ) : (
            <View style={styles.body}>
              {/* AOD-142: the arrange-only hint. The old Glance instruction ("Long-press a widget to
                  arrange") is gone — the dial is the visible control now. Glance stays wordless and calm. */}
              {arranging ? (
                <Text style={styles.hint}>Drag to move. Drag a corner to resize. Flip to Glance to finish.</Text>
              ) : null}
              <LayoutCanvas
                instances={instances}
                arranging={arranging}
                onEnterArrange={() => setArranging(true)}
                onExitArrange={() => setArranging(false)}
                onCommit={commit}
                onRequestConfigure={setConfiguring}
                onRemove={(instanceId) => void removeWidget(instanceId)}
              />
            </View>
          )}

          {picking && <WidgetPicker onClose={() => setPicking(false)} />}
          {configuring && <ConfigureInstanceModal instance={configuring} onClose={() => setConfiguring(null)} />}
        </View>
      </Screen>
      {/* AOD-81 §6: the wall preview, mounted OVER the whole route container (a sibling of Screen, above the
          shell chrome) so the peek is edge to edge like the wall. Reachable only while arranging (now entered
          via the AOD-142 dial or a long-press); WallPreview renders an empty draft fine, so the dial entering
          Arrange on an empty board is harmless. Tap anywhere / OS back returns. */}
      {previewing ? <WallPreview instances={instances} onClose={() => setPreviewing(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  // AOD-142 the wake surface: fills the frame so a touch anywhere in the hub re-arms the idle timer.
  surface: { flex: 1 },
  body: { flex: 1 },
  hint: {
    color: theme.colors.textMuted,
    ...theme.type.meta,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
  },
}));
