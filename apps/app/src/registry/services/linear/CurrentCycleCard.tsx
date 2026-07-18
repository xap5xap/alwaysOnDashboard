// The "Current Cycle" leaf renderer — THE LOG LINE face (AOD-135; design-linear.md §6, claude-design/
// prompts/linear.md "The Log Line 21-knot ring"). Reached only on data-bearing lifecycle states; the host
// draws every other state. Receives only { data, config, size, box }. `active: false` is a normal, data-
// bearing state (the team has no live cycle), not an error.
//
// The Log Line replaces the AOD-30 progress BAR with a SEGMENTED KNOT RING: one knot per cycle issue, the
// completed ones lit. THE ONE ACCENT LIVES HERE — lit knots/dashes = colors.accent, unlit = the SAME accent
// @ progress.trackOpacity (0.18), so the card spends no second hue and Monochrome separates lit vs unlit by
// intensity for free. The knot COUNT is DYNAMIC (= totalCount, never the "21" in the title): the disc radius
// adapts to N (a large N shrinks the discs, never below a floor; logline.ts). The percent readout is now BONE
// (colors.text) — the brightest thing, and it CHANGES the old card, which drew the percent in accent; the
// accent is now spent on the ring. The ring is STATIC-per-render (plain react-native-svg, NO Animated / rAF —
// the AOD-72 `collapsable` leak; the "one knot lights on refresh" settle is just the re-render).
//
// Sizes (S/M/W/L): S the knots as a compact texture with the percent carrying the number; M the full knot
// ring + label + counts; W a segmented BAR of dashes (the linear form — a ring does not fit a wide-short
// cell); L the countable tally — the big ring + counts + "ends in N days". The ring FITS the host box (the
// AOD-81 fit-to-bounds lesson: never clip on the density-scaled device), capped by theme.ring.radius.
//
// A RING_MAX_KNOTS ceiling collapses a huge / pathological cycle (a garbage totalCount, or one so large the
// knots would collide) to the O(1) figure — the SMOOTH arc (S/M/L) or a single continuous fill bar (W) —
// instead of one element per issue, which would ANR / OOM the kiosk (resolveLit clamps sign/finiteness but
// NOT magnitude). Only the DRAWN figure collapses: the percent + the "N / M issues" counts always keep the
// true totalCount (honesty). The common case (a normal cycle) is unchanged — discrete knots via RING_VARIANT.
//
// active: false -> the host-drawn `empty` phase (AOD-125, isCurrentCycleEmpty), not a leaf body.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { FitBox } from '../../../widgets/fitLadder';
import { ringLayout, resolveLit, type RingGeometry } from './logline';
import { LogLineRing, LogLineDashes, LogLineBar, type RingVariant } from './LogLineRing';

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

// The Dead Reckoning fallback toggle (design-linear.md §6): 'knots' is the primary segmented ring; flip this
// ONE const to 'smooth' (a continuous arc, no discrete discs) if the knots shimmer / alias on the low-DPI
// Fire HD 8 device pass. Both renders are wired + tested (LogLineRing.tsx); the device pass decides.
const RING_VARIANT: RingVariant = 'knots';

// The sanity ceiling on the DRAWN knot/dash count. Above it a cycle collapses to the O(1) smooth ring (S/M/L)
// / continuous bar (W): (a) it guards against a garbage totalCount building a per-issue array (OOM/ANR — a raw
// 1e9 crashes; resolveLit clamps sign/finiteness but not magnitude); (b) it is below the knot-overlap
// threshold (edges collide from the mid-60s at M, low-40s at the compact S), so knots never collide; (c) no
// real Linear cycle reaches it. The COUNTS keep the true total regardless — only the figure collapses.
const RING_MAX_KNOTS = 48;

// The knot ring FITS the host body box (never clips — the AOD-81 lesson), reserving room for the text bands
// that share the box, and capped by the per-size theme.ring.radius. These are the conservative vertical
// reserves (label + counts/foot + gaps, DP) below the ring, per ringed size (W is dashes, no ring).
const RING_RESERVE_V: Record<'S' | 'M' | 'L', number> = { S: 0, M: 52, L: 56 };
const RING_MIN_RADIUS = 10; // a degenerate box still draws a small ring (overflow:hidden backstops it)

/** Fit the ring's outer radius to the box: the largest ring that fits (box width, and box height minus the
 *  reserved text bands), capped by the per-size token radius and floored so it never vanishes. No box (a
 *  direct render / a test without a host) → the token cap. */
function fitOuterRadius(cap: number, reserveV: number, knot: number, box: FitBox | undefined): number {
  if (!box) return cap;
  const availH = Math.max(0, box.height - reserveV);
  const fitDiameter = Math.min(box.width, availH);
  return Math.max(RING_MIN_RADIUS, Math.min(cap, fitDiameter / 2 - knot));
}

/** Defensive read: anything that is not a well-formed active cycle renders as "no active cycle". */
function asCurrentCycleData(data: unknown): CurrentCycleData {
  const d = data as { active?: unknown } | null | undefined;
  if (d?.active === true) return data as CurrentCycleData;
  return { active: false };
}

/** AOD-125 emptiness predicate (WidgetDefinition.isEmpty): no live cycle (active:false) -> the host-drawn
 *  empty phase. `active:false` is a normal state, not an error; the leaf no longer self-draws it. */
export function isCurrentCycleEmpty(data: unknown): boolean {
  return !asCurrentCycleData(data).active;
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

export function CurrentCycleCard({ data, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const cycle = asCurrentCycleData(data);

  // AOD-125: active:false is now the host-drawn `empty` phase (isCurrentCycleEmpty), so the leaf is reached
  // only with an active cycle. The guard remains for type-narrowing (and crash-safety) and draws nothing.
  if (!cycle.active) return null;

  const pct = clampPercent(cycle.progress);
  const label = cycle.name ? `Cycle ${cycle.number}: ${cycle.name}` : `Cycle ${cycle.number}`;
  const accent = theme.colors.accent; // the ONE accent (lit)
  const dimOpacity = theme.progress.trackOpacity; // the same accent, dimmed (unlit) — one hue, two intensities

  // Above RING_MAX_KNOTS the figure collapses to the O(1) smooth ring (S/M/L) / continuous bar (W) — never one
  // element per issue (the OOM/ANR guard). The percent + counts below always keep the true total regardless.
  const overCap = resolveLit(cycle.completedCount, cycle.totalCount).total > RING_MAX_KNOTS;

  // §6 the percent readout: BONE (colors.text), the brightest thing (was accent). tabular so it does not
  // jitter as it ticks/refreshes. Present at every size (centred inside the ring at S/M/L, in the W head).
  const percent = (
    <Text style={styles.pct} numberOfLines={1} testID="linear-cycle-pct">
      {pct}%
    </Text>
  );

  // §6.2 counts: completedCount bright, the rest muted; tabular so it does not jitter on refresh.
  const counts = (
    <Text style={styles.counts} numberOfLines={1} testID="linear-cycle-counts">
      <Text style={styles.countsDone}>{cycle.completedCount}</Text>
      <Text style={styles.countsRest}>
        {' / '}
        {cycle.totalCount} issues
      </Text>
    </Text>
  );

  // W (2×1): the segmented BAR — the linear form of the lit/total logic (a ring does not fit a wide-short
  // cell). label + percent on one line; the dashes (or, above the cap, a single continuous fill bar); the
  // counts. (Mirrors the old W bar layout.)
  if (size === 'W') {
    return (
      <View style={styles.body} accessibilityRole="summary" testID="linear-cycle">
        <View style={styles.head}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {percent}
        </View>
        {overCap ? (
          <LogLineBar
            completedCount={cycle.completedCount}
            totalCount={cycle.totalCount}
            height={theme.ring.dash.height}
            radius={theme.ring.dash.radius}
            color={accent}
            dimOpacity={dimOpacity}
          />
        ) : (
          <LogLineDashes
            completedCount={cycle.completedCount}
            totalCount={cycle.totalCount}
            height={theme.ring.dash.height}
            gap={theme.ring.dash.gap}
            radius={theme.ring.dash.radius}
            color={accent}
            dimOpacity={dimOpacity}
          />
        )}
        {counts}
      </View>
    );
  }

  // S / M / L: the knot ring, fit to the box, with the percent centred inside it.
  const ringedSize: 'S' | 'M' | 'L' = size; // narrowed: W returned above
  const outerRadius = fitOuterRadius(theme.ring.radius[ringedSize], RING_RESERVE_V[ringedSize], theme.ring.knot, box);
  const geo: RingGeometry = {
    outerRadius,
    knotRadius: theme.ring.knot,
    minKnotRadius: theme.ring.minKnot,
    minGap: theme.ring.gap,
  };
  // The cap is passed to ringLayout so a huge N never builds the knot array (OOM guard); above it the leaf
  // draws the smooth arc, which needs only fraction/geometry (not the knots).
  const layout = ringLayout(cycle.completedCount, cycle.totalCount, geo, RING_MAX_KNOTS);
  const ringVariant: RingVariant = overCap ? 'smooth' : RING_VARIANT;

  const ringWithPercent = (
    <View style={{ width: layout.size, height: layout.size }}>
      <LogLineRing variant={ringVariant} layout={layout} color={accent} dimOpacity={dimOpacity} stroke={theme.ring.stroke} />
      <View style={styles.percentOverlay} pointerEvents="none">
        {percent}
      </View>
    </View>
  );

  // S (1×1): the knots as texture, the percent centred over them (the percent carries the number). No label
  // or counts — the header caption carries the context and the cell is too small for more.
  if (size === 'S') {
    return (
      <View style={styles.centerBody} accessibilityRole="summary" testID="linear-cycle">
        {ringWithPercent}
      </View>
    );
  }

  // M (1×2): the full knot ring + "Cycle N" + counts, stacked.
  if (size === 'M') {
    return (
      <View style={styles.body} accessibilityRole="summary" testID="linear-cycle">
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.ringRow}>{ringWithPercent}</View>
        {counts}
      </View>
    );
  }

  // L (2×2): the countable tally — the big ring + the label + a foot with the counts and the "ends in N days"
  // meta (the L-only affordance, §6.2).
  const ends = endsInLabel(cycle.endsAt, new Date());
  return (
    <View style={styles.body} accessibilityRole="summary" testID="linear-cycle">
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.ringRow}>{ringWithPercent}</View>
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

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(2) },
  centerBody: { alignItems: 'center' }, // S: centre the compact ring in the cell
  ringRow: { alignItems: 'center' }, // M/L: centre the ring horizontally in the column

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) },

  // the percent overlay: absolutely centred over the ring (the ring is the container's size).
  percentOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // §6.2 the "Cycle N: name" label (type.heading).
  label: { ...theme.type.heading, color: theme.colors.text, flexShrink: 1 },

  // §6 the percent readout: BONE (colors.text), always the brightest thing (was accent). tabular.
  pct: { ...theme.type.title, fontWeight: '700', color: theme.colors.text, fontVariant: ['tabular-nums'] },

  // §6.2 counts: completedCount bright, the rest muted; tabular so it does not jitter on refresh.
  counts: { ...theme.type.meta },
  countsDone: { color: theme.colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countsRest: { color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },

  // §6.2 the large-only "ends in N days" meta, muted.
  ends: { ...theme.type.meta, color: theme.colors.textMuted },
}));
