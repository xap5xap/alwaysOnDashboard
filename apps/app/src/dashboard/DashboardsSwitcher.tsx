// The dashboards switcher (app-ia §5 row 6, design-dashboard-editor §8). The /dashboards modal-route
// INTERIOR: the list of the user's dashboards with the active one marked (an accentMuted highlight + an
// accent check), and a "New dashboard" create action gated by maxDashboards -- on Free (maxDashboards = 1)
// it is the AOD-20 §11 LockRow -> Paywall (trigger=dashboards), the entitlements Gate pattern (UX-only; the
// server enforces the limit). Composes the AOD-68 shell (Screen + pushed AppBar + screen states) and the
// AOD-67 components (RowGroup / ListRow / LockRow), so it adds no new chrome.
//
// Designed AHEAD of its backing (design-dashboard-editor §8, §12; app-ia §10): useDashboard bootstraps ONE
// dashboard today, so the list has a single active row and switching is a no-op dismiss. The multi-dashboard
// table, the active-selection persistence, and the Pro create wiring are the multi-dashboard-backing build's
// SEAM (out of scope here). This fixes the interior + the Free create gate so that build has a target.
import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useEntitlements } from '../entitlements/useEntitlements';
import { useDashboard } from '../layout/useDashboard';
import { AppBar, ErrorState, LoadingState, Screen, ScreenBody } from '../shell';
import { ListRow, LockRow, RowGroup } from '../ui';
import { CheckGlyph } from '../ui/glyphs';
import { DashboardGlyph, PlusGlyph } from './glyphs';

export function DashboardsSwitcher() {
  const { theme } = useUnistyles();
  const { dashboardId, dashboardName, isLoading, isError, error, refetch } = useDashboard();
  const entitlements = useEntitlements();

  // Today: a single bootstrapped dashboard. The list + active mark are drawn ahead of the multi-dashboard
  // backing (app-ia §10). A count gate, not the boolean Gate component: maxDashboards is a count.
  const dashboards = dashboardId ? [{ id: dashboardId, name: dashboardName ?? 'Dashboard' }] : [];
  const canCreate = dashboards.length < entitlements.maxDashboards;

  const close = () => router.back();

  // A single dashboard is already active; selecting it dismisses. Switching the active layout among many
  // is the multi-dashboard-backing seam (out of scope), so this stays a dismiss for now.
  const onSelect = () => close();

  // SEAM (app-ia §10): creating a 2nd dashboard needs the multi-dashboard table + active-selection
  // persistence, which are out of scope. On Free this branch is unreachable (the create is the lock row);
  // on Pro the backing build wires the real create. Dismiss for now rather than leave a dead control.
  const onCreate = () => close();

  return (
    <Screen>
      <AppBar variant="pushed" title="Dashboards" onBack={close} testID="dashboards-header" />
      {isLoading ? (
        <LoadingState rows={2} />
      ) : isError ? (
        <ErrorState line="Could not load your dashboards." detail={error?.message} onRetry={() => void refetch()} />
      ) : (
        <ScreenBody>
          <RowGroup testID="dashboards-list">
            {dashboards.map((d) => {
              const active = d.id === dashboardId;
              return (
                <Pressable
                  key={d.id}
                  onPress={onSelect}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  testID={`dashboard-row-${d.id}`}
                  style={active ? styles.activeRow : undefined}
                >
                  <ListRow
                    title={d.name}
                    leading={<DashboardGlyph color={theme.colors.textMuted} />}
                    trailing={active ? <CheckGlyph color={theme.colors.accent} /> : undefined}
                  />
                </Pressable>
              );
            })}

            {/* §8 the create gate: an enabled "New dashboard" action, or the lock row on Free -> Paywall. */}
            {canCreate ? (
              <Pressable onPress={onCreate} accessibilityRole="button" testID="dashboard-create">
                <ListRow title="New dashboard" leading={<PlusGlyph color={theme.colors.accent} />} />
              </Pressable>
            ) : (
              <LockRow
                title="New dashboard"
                onPress={() => router.push('/paywall?trigger=dashboards')}
                testID="dashboard-create-locked"
              />
            )}
          </RowGroup>
        </ScreenBody>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  // §8 the active dashboard row: an accentMuted highlight (the accent check is the ListRow trailing).
  activeRow: {
    backgroundColor: theme.colors.accentMuted,
  },
}));
