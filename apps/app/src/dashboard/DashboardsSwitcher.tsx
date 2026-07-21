// The dashboards switcher (app-ia §5 row 6, design-dashboard-editor §8; Many Skies §1b/§1e). The /dashboards
// modal-route INTERIOR: the list of the user's skies with the active one marked (an accentMuted highlight + an
// accent check), and a "New dashboard" create action gated by maxDashboards -- on Free (maxDashboards = 1) it
// is the AOD-20 §11 LockRow -> Paywall (trigger=dashboards), the entitlements Gate pattern (UX-only; the
// server enforces the limit). Composes the AOD-68 shell (Screen + pushed AppBar + screen states) and the
// AOD-67 components (RowGroup / ListRow / LockRow), so it adds no new chrome.
//
// AOD-143 wired the real multi-dashboard backing: useDashboards is the live list + active pointer + create.
// Selecting a sky flips the active pointer and dismisses; the Pro "New dashboard" creates a real EMPTY sky
// (§1g) and descends into it. A nameless sky (§1e) shows a placeholder label here (Glance never grows text,
// but page altitude may). The Free create gate stays client-UX only.
import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useEntitlements } from '../entitlements/useEntitlements';
import { useDashboards } from '../layout/useDashboards';
import { AppBar, ErrorState, LoadingState, Screen, ScreenBody } from '../shell';
import { ListRow, LockRow, RowGroup } from '../ui';
import { CheckGlyph } from '../ui/glyphs';
import { DashboardGlyph, PlusGlyph } from './glyphs';

// §1e: a nameless sky is a dot, not a word. Page altitude may show an optional label; when there is none we
// fall back to a neutral placeholder rather than blank so the row is still a tappable, legible target.
const NAMELESS_LABEL = 'Untitled sky';

export function DashboardsSwitcher() {
  const { theme } = useUnistyles();
  const { dashboards, activeId, setActive, createDashboard, isLoading, isError, error, refetch } =
    useDashboards();
  const entitlements = useEntitlements();

  // A count gate, not the boolean Gate component: maxDashboards is a count (Free 1, Pro unlimited).
  const canCreate = dashboards.length < entitlements.maxDashboards;

  const close = () => router.back();

  // Flip the active sky, then dismiss (the /dashboards modal closes back to the sky it selected).
  const onSelect = (id: string) => {
    setActive(id);
    close();
  };

  // Create a real EMPTY sky (§1g) and descend into it, then dismiss. Reachable only when canCreate (Pro).
  const onCreate = async () => {
    await createDashboard();
    close();
  };

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
              const active = d.id === activeId;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => onSelect(d.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  testID={`dashboard-row-${d.id}`}
                  style={active ? styles.activeRow : undefined}
                >
                  <ListRow
                    title={d.name || NAMELESS_LABEL}
                    leading={<DashboardGlyph color={theme.colors.textMuted} />}
                    trailing={active ? <CheckGlyph color={theme.colors.accent} /> : undefined}
                  />
                </Pressable>
              );
            })}

            {/* §8 the create gate: an enabled "New dashboard" action, or the lock row on Free -> Paywall. */}
            {canCreate ? (
              <Pressable onPress={() => void onCreate()} accessibilityRole="button" testID="dashboard-create">
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
