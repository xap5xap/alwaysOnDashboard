// The "Current Cycle" leaf renderer (AOD-8 §6.1, integration-linear.md §4.2, design-linear.md §6). Reached
// only on data-bearing lifecycle states; the host draws every other state. Receives only { data, config,
// size }. `active: false` is a normal, data-bearing state (the team has no live cycle), not an error.
//
// AOD-30 polish: the progress bar is the value, the percent the readout (the bespoke centerpiece, the
// parallel to the spend sparkline). The bar is one accent at TWO intensities (§6.1): the fill is
// colors.accent (the completed fraction), the track is the same colors.accent at theme.progress.trackOpacity
// (the remaining fraction), so the card spends no second colour. This FIXES the shipped token smell, which
// filled the track with colors.skeleton (the loading-shimmer colour). The percent is colors.accent /
// tabular-nums (big at large, small at medium); the "Cycle N: name" label is type.heading; the completed/
// total counts read with completedCount bright; at large an "ends in N days" meta gives time remaining.
// active: false -> the §5.1 EmptyBody with the cycle-ring glyph, not a host state. Sizes map onto type.* (§9).
import React from 'react';
import { type DimensionValue, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import { EmptyBody } from '../../../widgets/EmptyBody';
import { CycleRingGlyph } from './glyphs';

// The normalized payload (integration-linear.md §4.2), mirroring the server-side normalizeCurrentCycle
// output. `active: false` is a normal, data-bearing state (the team has no live cycle), not an error.
export type CurrentCycleData =
  | { active: false }
  | {
      active: true;
      number: number;
      name: string | null;
      startsAt: string;
      endsAt: string;
      progress: number; // 0..1
      completedCount: number;
      totalCount: number;
    };

/** Defensive read: anything that is not a well-formed active cycle renders as "no active cycle". */
function asCurrentCycleData(data: unknown): CurrentCycleData {
  const d = data as { active?: unknown } | null | undefined;
  if (d?.active === true) return data as CurrentCycleData;
  return { active: false };
}

/** Pure: Linear's 0..1 progress -> a clamped integer percent (§6.1). Guards a non-finite value to 0. */
export function clampPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

/**
 * Pure: the cycle's endsAt vs the device-local day -> a relative "ends in N days" meta (§6.2; the calendar's
 * relative-time idiom). Null when already ended (defensive; the cycle should have rolled) or unparseable.
 */
export function endsInLabel(endsAt: string, now: Date): string | null {
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round((endDay.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays < 0) return null;
  if (diffDays === 0) return 'ends today';
  if (diffDays === 1) return 'ends tomorrow';
  return `ends in ${diffDays} days`;
}

export function CurrentCycleCard({ data, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const cycle = asCurrentCycleData(data);

  if (!cycle.active) {
    // §6.3 empty body: a calm "No active cycle" with the cycle-ring glyph, no action (nothing is wrong, the
    // team simply has no live cycle). Wrapped to keep the existing *-inactive testID contract.
    return (
      <View style={styles.fill} testID="linear-cycle-inactive">
        <EmptyBody
          line="No active cycle"
          subline="No cycle running"
          glyph={<CycleRingGlyph color={theme.colors.accent} />}
        />
      </View>
    );
  }

  const isLarge = size === 'large';
  const pct = clampPercent(cycle.progress);
  const label = cycle.name ? `Cycle ${cycle.number}: ${cycle.name}` : `Cycle ${cycle.number}`;
  const trackHeight = isLarge ? theme.progress.trackHeight.large : theme.progress.trackHeight.medium;
  const radius = trackHeight / 2;
  const ends = isLarge ? endsInLabel(cycle.endsAt, new Date()) : null;

  // §6.1 the bar: a track (accent @ trackOpacity) under a left-anchored fill (solid accent). The container
  // clips, so the fill's rounded end rides the track. One accent at two intensities (NOT colors.skeleton).
  const bar = (
    <View style={[styles.bar, { height: trackHeight, borderRadius: radius }]} testID="linear-cycle-bar">
      <View style={styles.barTrack} />
      <View style={[styles.barFill, { width: `${pct}%` as DimensionValue, borderRadius: radius }]} />
    </View>
  );

  const counts = (
    <Text style={styles.counts} numberOfLines={1} testID="linear-cycle-counts">
      <Text style={styles.countsDone}>{cycle.completedCount}</Text>
      <Text style={styles.countsRest}>
        {' / '}
        {cycle.totalCount} issues
      </Text>
    </Text>
  );

  // large (2x2): a big percent hero; the bar; the label up top; the counts + the "ends in N days" meta.
  if (isLarge) {
    return (
      <View style={styles.body} accessibilityRole="summary" testID="linear-cycle">
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.pctLarge} testID="linear-cycle-pct">
          {pct}%
        </Text>
        {bar}
        <View style={styles.foot}>
          {counts}
          {ends ? (
            <Text style={styles.ends} numberOfLines={1} testID="linear-cycle-ends">
              {ends}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // medium (2x1): compact. label + percent on one line; the bar; the counts.
  return (
    <View style={styles.body} accessibilityRole="summary" testID="linear-cycle">
      <View style={styles.head}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.pctMedium} testID="linear-cycle-pct">
          {pct}%
        </Text>
      </View>
      {bar}
      {counts}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  fill: { flex: 1 },
  body: { gap: theme.spacing(2) },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) },

  // §6.2 the "Cycle N: name" label (type.heading) and the percent readout (accent, tabular; big at large).
  label: { ...theme.type.heading, color: theme.colors.text, flexShrink: 1 },
  pctMedium: { ...theme.type.title, fontWeight: '700', color: theme.colors.accent, fontVariant: ['tabular-nums'] },
  pctLarge: { ...theme.type.hero, color: theme.colors.accent, textAlign: 'center' },

  // §6.1 the bar: one accent at two intensities. The track is accent @ trackOpacity; the fill is solid accent.
  bar: { overflow: 'hidden', alignSelf: 'stretch' },
  barTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent,
    opacity: theme.progress.trackOpacity,
  },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: theme.colors.accent },

  // §6.2 counts: completedCount bright, the rest muted; tabular so it does not jitter on refresh.
  counts: { ...theme.type.meta },
  countsDone: { color: theme.colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countsRest: { color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },

  // §6.2 the large-only "ends in N days" meta, muted.
  ends: { ...theme.type.meta, color: theme.colors.textMuted },
}));
