// The "Current Cycle" leaf renderer (AOD-8 §6.1, integration-linear.md §4.2). Reached only on
// data-bearing lifecycle states; the host draws every other state. Receives only { data, config, size }.
// Functional and on-brand-enough; pixel polish is AOD-30.
import React from 'react';
import { type DimensionValue, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';

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

function clampPct(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

export function CurrentCycleCard({ data }: WidgetRenderProps) {
  const cycle = asCurrentCycleData(data);

  if (!cycle.active) {
    return (
      <View style={styles.empty} accessibilityRole="summary">
        <Text style={styles.emptyText} testID="linear-cycle-inactive">
          No active cycle
        </Text>
      </View>
    );
  }

  const pct = clampPct(cycle.progress);
  const label = cycle.name ? `Cycle ${cycle.number}: ${cycle.name}` : `Cycle ${cycle.number}`;

  return (
    <View style={styles.body} accessibilityRole="summary" testID="linear-cycle">
      <View style={styles.headerRow}>
        <Text style={styles.cycleLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.pct} testID="linear-cycle-pct">
          {pct}%
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as DimensionValue }]} />
      </View>

      <Text style={styles.counts} testID="linear-cycle-counts">
        {cycle.completedCount} / {cycle.totalCount} issues
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing(2),
  },
  empty: {
    paddingVertical: theme.spacing(2),
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  cycleLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  pct: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.skeleton,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  counts: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
}));
