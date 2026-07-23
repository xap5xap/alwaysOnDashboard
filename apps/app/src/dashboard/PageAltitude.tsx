// Page altitude — the second altitude inside one Arrange session (AOD-145; design "Many Skies" §1b "whole
// dashboards become the tiles", §1e "tending skies", §1g "a new sky"). It RETIRES the DashboardsSwitcher
// modal: instead of a pushed /dashboards route, pressing the card-altitude capsule (or pinching in) RISES
// here, in place, still inside Arrange. The user's skies are thumbnail tiles, centered with air; the current
// sky arrives ringed. Actions belong to the ringed sky (reorder / label / delete), and the + sliver waits at
// the end. Tap a sky to descend into its cards; the dial (in the hub header, owned by Dashboard) exits to
// Glance from here.
//
// The billing gate (the + = a new sky) reuses the AOD-144 pager fork EXACTLY: Free at maxDashboards -> the
// in-place §1f ProInviteSliver (never the paywall directly; only its See Pro routes through); Pro -> a real
// createDashboard, then descend into the new empty sky (§1g). The `>= 1` guard is the same defense-in-depth
// as SkyPager's: a transient empty/incoherent list must never read as "0 < 1, so create is free" (a billing
// bypass) — an empty list shows the invite, never creates.
//
// Data + mutations come as props from Dashboard (which owns useDashboards + the altitude state + the
// query-cache hand-off for descend), mirroring SkyPager. That keeps this a pure view: it never reads the hook
// directly, so it is testable with plain props and the descend coordination stays in one place.
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useEntitlements } from '../entitlements/useEntitlements';
import type { DashboardSummary } from '../layout/dashboardRepo';
import { AddGlyph } from './glyphs';
import { ProInviteSliver } from './ProInviteSliver';
import { SkyThumbnail } from './SkyThumbnail';

/** Move the item at `from` to `to` in an id list, returning a NEW ordered list (pure; the reorder drop's
 *  committed order). Exported for the wiring test — the gesture feel is device-only (AOD-190), but the order
 *  math is a plain, unit-checkable contract. Out-of-range indices are clamped to a no-op-safe move. */
export function reorderIds(ids: string[], from: number, to: number): string[] {
  const n = ids.length;
  if (from < 0 || from >= n) return ids.slice();
  const clampedTo = Math.max(0, Math.min(n - 1, to));
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  next.splice(clampedTo, 0, moved);
  return next;
}

export interface PageAltitudeProps {
  /** The user's skies, ordered (the tiles + the reorder subject). */
  dashboards: DashboardSummary[];
  /** The resolved active sky — the RINGED tile (the AOD-140 selection language). */
  activeId: string | null;
  /** Tap a tile: descend into that sky (Dashboard sets it active + drops to card altitude). */
  onTapSky(skyId: string): void;
  /** Pro create the new empty sky (the hook sets it active). Reached only when the gate allows (Pro). */
  createDashboard(name?: string): Promise<string>;
  /** After a Pro create: descend into the new empty sky (Dashboard drops to card altitude). */
  onCreated(): void;
  /** Rename a sky ('' -> nameless, §1e). */
  renameDashboard(id: string, name: string): Promise<void>;
  /** Persist a new sky order (§1e: this order is the swipe/dot order everywhere). */
  reorderDashboards(orderedIds: string[]): Promise<void>;
  /** Delete a sky (never the last — the hook enforces it, and the UX never offers it at count 1). */
  deleteDashboard(id: string): Promise<void>;
  testID?: string;
}

export function PageAltitude({
  dashboards,
  activeId,
  onTapSky,
  createDashboard,
  onCreated,
  renameDashboard,
  reorderDashboards,
  deleteDashboard,
  testID = 'page-altitude',
}: PageAltitudeProps) {
  const { theme } = useUnistyles();
  const entitlements = useEntitlements();
  const [inviteOpen, setInviteOpen] = useState(false);

  // Same count gate as the AOD-144 pager: Free 1 / Pro unlimited, with the empty-list defense-in-depth.
  const canCreate = dashboards.length >= 1 && dashboards.length < entitlements.maxDashboards;

  const onAdd = async () => {
    if (canCreate) {
      await createDashboard();
      onCreated();
    } else {
      setInviteOpen(true);
    }
  };

  const onReorder = (from: number, to: number) => {
    void reorderDashboards(reorderIds(dashboards.map((d) => d.id), from, to));
  };

  return (
    <View style={styles.container} testID={testID}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.tiles} testID={`${testID}-tiles`}>
          {dashboards.map((sky, index) => (
            <SkyThumbnail
              key={sky.id}
              sky={sky}
              index={index}
              count={dashboards.length}
              ringed={sky.id === activeId}
              onTap={onTapSky}
              onReorder={onReorder}
              onDelete={(id) => void deleteDashboard(id)}
              onRename={(id, name) => void renameDashboard(id, name)}
            />
          ))}

          {/* §1b the + sliver at the end — a dashed tile that opens a new sky (the AddGlyph's "nothing is
              wrong, add one" metaphor). Sized like a tile so it reads as "one more place". */}
          <Pressable
            onPress={() => void onAdd()}
            accessibilityRole="button"
            accessibilityLabel="New dashboard"
            testID={`${testID}-add`}
            style={[styles.addTile, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
          >
            <AddGlyph size={40} color={theme.colors.accent} />
          </Pressable>
        </View>
      </ScrollView>

      {inviteOpen ? (
        <ProInviteSliver
          onSeePro={() => {
            setInviteOpen(false);
            router.push('/paywall?trigger=dashboards');
          }}
          onDismiss={() => setInviteOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing(6),
  },
  // The tiles, centered with air (§1b). A wrapping row keeps the honest 2-3 count on one centered line and
  // flows to more rows past that; the tile column already reserves the label row so heights align.
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: theme.spacing(4),
    paddingHorizontal: theme.spacing(4),
  },
  // The + sliver: a dashed tile the same footprint as a thumbnail (matching SkyThumbnail's 116x150), so the
  // "add" reads as one more place among the skies.
  addTile: {
    width: 116,
    height: 150,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
