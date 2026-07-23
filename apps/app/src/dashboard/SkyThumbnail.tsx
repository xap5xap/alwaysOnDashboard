// One sky thumbnail at page altitude (AOD-145; design "Many Skies" §1b "whole dashboards become the tiles —
// the dots, grown" + §1e "the same two moves — tap to select, hold to drag"). A tile is a SILHOUETTE of the
// sky: its placed cards drawn as proportional rounded blocks (from the per-sky read useSkyInstances), NOT the
// real widget hosts. This is the deliberate "lighter silhouette" the runbook allows: mounting N skies ×
// M live WidgetHosts (each pulling the data/provider stack) at thumbnail scale would be wasteful and racy, so
// the tile shows the ARRANGEMENT (what page altitude is about) without the faces (a later chat / the cards
// already render full-size at card altitude). The shape is faithful — same 2-column slot grid, same rects,
// fit into the tile preserving cell aspect — so "which sky is which" reads at a glance.
//
// Interactions belong to the ringed (current/active) sky, mirroring the card selection language (AOD-140):
//   - TAP the tile  -> descend into that sky's cards (onTap; the parent sets it active + drops to card
//     altitude). Short press only, so it never fights the reorder hold.
//   - HOLD + DRAG   -> reorder (Gesture.Pan activated after a long press; the drop reports from/to indices up,
//     the parent commits reorderDashboards). Device-verified feel (AOD-190); the drop math is a pure stride
//     round so the wiring is unit-testable without a real gesture.
//   - DELETE (ringed, and only when there is more than one sky — the last-sky rule) reuses the AOD-141
//     tile-face: the tile's OWN face becomes "Delete? Its N cards go with it.", no modal; Keep reverts;
//     connections survive (they belong to the account, not the arrangement).
//   - LABEL (ringed only) is an optional text field UNDER the tile -> renameDashboard; clearing returns the
//     sky to nameless (§1e). It shows ONLY here (never on Glance / the dots).
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { GRID_COLUMNS } from '../widgets/sizes';
import { useSkyInstances } from '../layout/useSkyInstances';
import type { DashboardSummary } from '../layout/dashboardRepo';

// The tile box (DP). Portrait, roughly the phone's 2-column proportion; the silhouette fits inside preserving
// square-ish cells (letterboxed), so a tall sky and a short sky both read at the same footprint.
const TILE_W = 116;
const TILE_H = 150;
// The horizontal stride (tile + row gap) a reorder drag rounds against to pick a target index. Exported so
// the wiring test can drive one slot of travel deterministically without a real gesture (the feel is AOD-190).
export const REORDER_STRIDE = TILE_W + 16;
// The long-press delay (ms) before a pan becomes a reorder drag — a tap under this stays a tap (descend).
const REORDER_HOLD_MS = 220;

/** Clamp a target index into range (pure; the reorder drop rounds travel/stride then clamps). */
function clampIndex(i: number, count: number): number {
  return Math.max(0, Math.min(count - 1, i));
}

export interface SkyThumbnailProps {
  sky: DashboardSummary;
  /** This tile's position in the ordered list (reorder reads it; the drop reports from -> to). */
  index: number;
  /** Total skies — gates reorder (needs > 1) and the last-sky delete rule (delete absent at 1). */
  count: number;
  /** Ringed = the current/active sky; only the ringed tile shows delete + the label field. */
  ringed: boolean;
  /** Tap the tile: descend into this sky (the parent sets it active + drops to card altitude). */
  onTap(skyId: string): void;
  /** A reorder drag settled: move index `from` to index `to` (the parent commits reorderDashboards). */
  onReorder(from: number, to: number): void;
  /** Confirmed delete on the ringed tile (only offered when count > 1). */
  onDelete(skyId: string): void;
  /** Rename (ringed label field); '' returns the sky to nameless (§1e). */
  onRename(skyId: string, name: string): void;
  testID?: string;
}

export function SkyThumbnail({
  sky,
  index,
  count,
  ringed,
  onTap,
  onReorder,
  onDelete,
  onRename,
  testID = `sky-thumb-${sky.id}`,
}: SkyThumbnailProps) {
  const { theme } = useUnistyles();
  const { instances, isLoading } = useSkyInstances(sky.id);

  // AOD-141 tile-face delete: a two-step in-place confirm, no modal. Reset if this tile stops being ringed
  // (e.g. the active sky moved) so it never re-opens on a stale confirm.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!ringed) setConfirming(false);
  }, [ringed]);

  // The label field is locally controlled so typing is smooth; the parent hears each committed value on
  // change (nameless <-> named is a low-frequency edit, so a per-keystroke rename is acceptable and keeps
  // "clear the text to return to nameless" honest). Re-sync if the sky's stored name changes underneath.
  const [label, setLabel] = useState(sky.name);
  useEffect(() => {
    setLabel(sky.name);
  }, [sky.name]);

  // Reorder drag geometry (UI thread). A hold lifts the tile; the pan translates it; the drop rounds travel
  // to a target index. Feel is device-only (AOD-190); the drop's index math is the testable contract.
  const dragX = useSharedValue(0);
  const lifted = useSharedValue(0);
  const reorder = Gesture.Pan()
    .enabled(count > 1 && !confirming)
    .activateAfterLongPress(REORDER_HOLD_MS)
    .onStart(() => {
      'worklet';
      lifted.value = withTiming(1, { duration: 140 });
    })
    .onUpdate((e) => {
      'worklet';
      dragX.value = e.translationX;
    })
    .onEnd((e) => {
      'worklet';
      const to = clampIndex(index + Math.round(e.translationX / REORDER_STRIDE), count);
      if (to !== index) runOnJS(onReorder)(index, to);
    })
    .onFinalize(() => {
      'worklet';
      dragX.value = withTiming(0, { duration: 160 });
      lifted.value = withTiming(0, { duration: 140 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { scale: 1 + lifted.value * 0.05 }],
    zIndex: lifted.value > 0 ? 50 : 0,
  }));

  // Silhouette fit: cell size that fits the sky's 2-column x N-row content into the tile, preserving square
  // cells (letterboxed + centered). An empty sky draws no blocks (just the frame) — the §1g "dark field".
  const contentRows = Math.max(1, ...instances.map((i) => i.rect.y + i.rect.h));
  const cell = Math.min(TILE_W / GRID_COLUMNS, TILE_H / contentRows);
  const originX = (TILE_W - cell * GRID_COLUMNS) / 2;
  const originY = (TILE_H - cell * contentRows) / 2;

  // A short tap descends; while confirming a delete, a tap on the tile face is Keep (revert), never descend.
  const onPressTile = () => {
    if (confirming) setConfirming(false);
    else onTap(sky.id);
  };

  return (
    <View style={styles.column} testID={testID}>
      <GestureDetector gesture={reorder}>
        <Animated.View style={animatedStyle}>
          <Pressable
            onPress={onPressTile}
            accessibilityRole="button"
            accessibilityState={{ selected: ringed }}
            accessibilityLabel={sky.name ? `Dashboard ${sky.name}` : 'Untitled dashboard'}
            testID={`${testID}-tile`}
            style={[
              styles.tile,
              { borderRadius: theme.radius.md },
              // AOD-140 selection language: the current sky arrives ringed (accent border + a faint accent
              // wash), the same mark a selected card wears.
              ringed
                ? { borderColor: theme.colors.accent, borderWidth: 2, backgroundColor: theme.colors.accentMuted }
                : { borderColor: theme.colors.border, borderWidth: 1, backgroundColor: theme.colors.surface },
            ]}
          >
            {/* The silhouette blocks — each placed card as a proportional rounded rect. Non-interactive. */}
            <View pointerEvents="none" style={styles.silhouette} testID={`${testID}-silhouette`}>
              {instances.map((inst) => (
                <View
                  key={inst.instanceId}
                  style={{
                    position: 'absolute',
                    left: originX + inst.rect.x * cell,
                    top: originY + inst.rect.y * cell,
                    width: Math.max(2, inst.rect.w * cell - 3),
                    height: Math.max(2, inst.rect.h * cell - 3),
                    borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.textMuted,
                    opacity: 0.5,
                  }}
                />
              ))}
            </View>

            {/* AOD-141 delete affordance — ringed sky only, and only when it is NOT the last sky (the hook
                enforces the rule; the UX simply never offers it). A sibling of nothing draggable, so the
                pill press is unambiguous. */}
            {ringed && count > 1 && !confirming ? (
              <Pressable
                onPress={() => setConfirming(true)}
                accessibilityRole="button"
                accessibilityLabel="Delete dashboard"
                testID={`${testID}-delete`}
                style={[styles.deletePill, { backgroundColor: theme.colors.error }]}
              >
                <Text style={[styles.pillText, { color: theme.colors.onAccent }]}>Delete</Text>
              </Pressable>
            ) : null}

            {/* AOD-141 tile-face confirm: the tile's OWN face becomes the question. Delete commits; Keep (or a
                tap on the face) reverts. Connections survive — only the arrangement dies. */}
            {ringed && confirming ? (
              <View
                style={[styles.confirmFace, { backgroundColor: theme.colors.scrim, borderRadius: theme.radius.md }]}
                testID={`${testID}-delete-confirm`}
              >
                <Text style={[styles.confirmQuestion, { color: theme.colors.onAccent }]}>Delete?</Text>
                <Text style={[styles.confirmDetail, { color: theme.colors.onAccent }]}>
                  {isLoading
                    ? 'Its cards go with it.'
                    : `Its ${instances.length} ${instances.length === 1 ? 'card' : 'cards'} go with it.`}
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable
                    onPress={() => onDelete(sky.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm delete dashboard"
                    testID={`${testID}-delete-confirm-yes`}
                    style={[styles.confirmButton, { backgroundColor: theme.colors.error }]}
                  >
                    <Text style={[styles.pillText, { color: theme.colors.onAccent }]}>Delete</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirming(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Keep dashboard"
                    testID={`${testID}-delete-keep`}
                    style={styles.confirmButton}
                  >
                    <Text style={[styles.pillText, { color: theme.colors.onAccent }]}>Keep</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>

      {/* §1e the optional label — ringed sky only, under the tile. Nameless by default; clearing returns to
          nameless. Shown ONLY at page altitude (never on Glance / the dots). */}
      {ringed ? (
        <TextInput
          value={label}
          onChangeText={setLabel}
          // Commit the rename on blur/submit, not per keystroke: renameDashboard does an UPDATE + a full-list
          // refetch, so typing "Home" would fire four un-awaited refetches and an out-of-order one could reset
          // the controlled field mid-typing. onEndEditing carries the final field text; '' returns to nameless.
          onEndEditing={(e) => onRename(sky.id, e.nativeEvent.text)}
          placeholder="Add label"
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel="Dashboard label"
          testID={`${testID}-label`}
          style={[
            styles.label,
            { color: theme.colors.text, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceAlt },
          ]}
        />
      ) : (
        // Reserve the label row's height on non-ringed tiles so the row of tiles stays visually aligned.
        <View style={styles.labelSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  column: {
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    overflow: 'hidden',
  },
  silhouette: {
    ...StyleSheet.absoluteFillObject,
  },
  deletePill: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confirmFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
  },
  confirmQuestion: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmDetail: {
    fontSize: 11,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  confirmButton: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
  },
  label: {
    width: TILE_W,
    height: 34,
    paddingHorizontal: theme.spacing(2),
    fontSize: 13,
    textAlign: 'center',
  },
  labelSpacer: {
    height: 34,
  },
}));
