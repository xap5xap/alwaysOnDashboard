// The dashboard screen (AOD-8 §8 DashboardLayout, rendered). It loads the signed-in user's real layout
// from Supabase under RLS (useDashboard: load + bootstrap-if-empty + persist), and mounts the free-form
// layout engine (LayoutCanvas) which renders each instance through the generic WidgetHost. The screen
// owns the arrange-mode flag so both exits work: tapping empty canvas, or the header Done control. It
// never names a service: the AOD-8 seam holds end to end.
//
// AOD-68 canonicalization (design-core-navigation §3, §5, §8, §12 drift 1-2): the inline header is now the
// shell HUB AppBar (the vela wordmark + Add + Settings + the dashboards-switcher chevron), sign out is
// RELOCATED to Account (dropped here), and the ad-hoc ActivityIndicator / inline error / empty CTA become
// the shell screen-level states.
// AOD-69 fills the AOD-27 dashboard INTERIOR: the arranging header shows a single accent Done pill (§4),
// the empty branch composes the shell EmptyState into the §5 calm add-first-widget CTA (glyph + subline),
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
import type { WidgetInstance } from '../registry/types';
import { AppBar, EmptyState, ErrorState, LoadingState, Screen } from '../shell';
import { Button } from '../ui/Button';
import { ChevronGlyph } from '../ui/glyphs';
import { AddGlyph } from './glyphs';

export function Dashboard() {
  const { instances, isLoading, isError, error, refetch, commit } = useDashboard();
  const { theme } = useUnistyles();
  const [arranging, setArranging] = useState(false);
  const [picking, setPicking] = useState(false);
  // The instance whose config form is open (AOD-10 §4). Owned here like `picking`/`arranging` so both
  // reconfigure entries (arrange-mode "Configure" and the host's needs_config prompt) route through it.
  const [configuring, setConfiguring] = useState<WidgetInstance | null>(null);

  const headerRight = arranging ? (
    // AOD-27 §4 / §11 drift 1: while arranging the hub header shows only a single accent Done pill
    // (primary = accent fill + onAccent label), the pushed-header trailing-action pattern on the hub.
    <Button label="Done" variant="primary" size="sm" pill onPress={() => setArranging(false)} testID="dashboard-done" />
  ) : (
    <>
      {!isLoading && !isError ? (
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
  );

  return (
    <Screen>
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
          <Text style={styles.hint}>
            {arranging
              ? 'Drag to move. Drag the corner handle to resize. Tap empty space or Done to finish.'
              : 'Long-press a widget to arrange.'}
          </Text>
          <LayoutCanvas
            instances={instances}
            arranging={arranging}
            onEnterArrange={() => setArranging(true)}
            onExitArrange={() => setArranging(false)}
            onCommit={commit}
            onRequestConfigure={setConfiguring}
          />
        </View>
      )}

      {picking && <WidgetPicker onClose={() => setPicking(false)} />}
      {configuring && <ConfigureInstanceModal instance={configuring} onClose={() => setConfiguring(null)} />}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { flex: 1 },
  hint: {
    color: theme.colors.textMuted,
    ...theme.type.meta,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
  },
}));
