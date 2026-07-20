// The Log Line RENDER (AOD-135; design-linear.md §6). A STATIC-per-render figure: the knot positions are
// computed ONCE by ringLayout at render time — NO Animated / requestAnimationFrame loop (RN-SVG + Animated
// leaks `collapsable`, aod-unistyles-style-token-gotcha / TransitArc.tsx header; and the "one knot lights on
// refresh" settle is the ~10-min data-refresh RE-RENDER, not a ticking loop). Presentational: every colour
// arrives resolved from the leaf (no theme access here), so Monochrome resolves for free — lit vs unlit is
// an INTENSITY (full accent vs accent @ dimOpacity) on the SAME role, so it separates in every theme.
//
// TWO ring renders behind a leaf-owned toggle (RING_VARIANT in CurrentCycleCard), so the device pass can
// fall back with a one-line flip:
//   1. 'knots'  (primary): `total` discrete filled discs, the first `litCount` in full accent, the rest
//      accent @ dimOpacity. The segmented ring — one knot per cycle issue.
//   2. 'smooth' (Dead Reckoning fallback): a continuous ring — the full circle at accent @ dimOpacity, a lit
//      arc (litCount / total of the way round, clockwise from the top) in full accent. NO knots, for when the
//      discrete discs shimmer / alias on the low-DPI Fire HD 8.
//
// The bare Svg is wrapped in a View so its testID stays queryable, and the lit/dim split + the variant are
// asserted via 0-size marker Views (SVG-internal testIDs are unreliable under RNTL — the TransitArc rule).
import React from 'react';
import { View, type DimensionValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { RingLayout } from './logline';
import { resolveLit } from './logline';

export type RingVariant = 'knots' | 'smooth';

export interface LogLineRingProps {
  variant: RingVariant;
  /** The resolved ring (ringLayout output) — positions, lit split, centre, extent, fraction. */
  layout: RingLayout;
  /** The lit colour (theme.colors.accent) — the ONE accent. Lit draws at full, unlit at `dimOpacity`. */
  color: string;
  /** The unlit intensity (theme.progress.trackOpacity, 0.18) — the same accent, dimmed. */
  dimOpacity: number;
  /** The smooth-arc / continuous-ring stroke width (theme.ring.stroke). */
  stroke: number;
  /** testID for the wrapping View (default linear-cycle-ring). */
  testID?: string;
}

/** The clockwise-from-top point at angle θ on a circle of radius r about (c, c) — SVG y-down. */
function ringPoint(c: number, r: number, angle: number): { x: number; y: number } {
  return { x: c + r * Math.sin(angle), y: c - r * Math.cos(angle) };
}

export function LogLineRing({
  variant,
  layout,
  color,
  dimOpacity,
  stroke,
  testID = 'linear-cycle-ring',
}: LogLineRingProps) {
  const { knots, knotRadius, center, outerRadius, size, fraction, litCount, total } = layout;

  // The smooth (Dead Reckoning) lit arc: from the top (θ=0) clockwise by `fraction` of the circle. A full
  // ring (fraction >= 1) is a degenerate arc (start == end), so it draws as a plain Circle instead; an
  // empty ring (fraction <= 0) draws no lit arc at all (only the dim track circle shows).
  const phi = fraction * 2 * Math.PI;
  const p0 = ringPoint(center, outerRadius, 0);
  const p1 = ringPoint(center, outerRadius, phi);
  const largeArc = phi > Math.PI ? 1 : 0;
  const litArcPath = `M ${p0.x} ${p0.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
  const smoothFull = fraction >= 1;
  const smoothPartial = fraction > 0 && fraction < 1;

  return (
    <View testID={testID} style={{ width: size, height: size, pointerEvents: 'none' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {variant === 'knots'
          ? knots.map((k) => (
              <Circle
                key={k.index}
                cx={k.x}
                cy={k.y}
                r={knotRadius}
                fill={color}
                fillOpacity={k.lit ? 1 : dimOpacity}
              />
            ))
          : (
            <>
              {/* the continuous dim track (the whole ring at accent @ dimOpacity) */}
              <Circle
                cx={center}
                cy={center}
                r={outerRadius}
                stroke={color}
                strokeOpacity={dimOpacity}
                strokeWidth={stroke}
                fill="none"
              />
              {/* the lit portion: a full circle when complete, else the partial arc */}
              {smoothFull && (
                <Circle cx={center} cy={center} r={outerRadius} stroke={color} strokeWidth={stroke} fill="none" />
              )}
              {smoothPartial && (
                <Path d={litArcPath} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" />
              )}
            </>
          )}
      </Svg>

      {/* 0-size markers so a test can count the lit/dim split and tell the variant apart without reaching
          into the SVG tree (SVG-internal testIDs are unreliable under RNTL — the TransitArc precedent). */}
      {variant === 'knots' ? (
        <>
          {knots.filter((k) => k.lit).map((k) => (
            <View key={`lit-${k.index}`} testID="linear-cycle-knot-lit" />
          ))}
          {knots.filter((k) => !k.lit).map((k) => (
            <View key={`dim-${k.index}`} testID="linear-cycle-knot-dim" />
          ))}
        </>
      ) : (
        <>
          <View testID="linear-cycle-smooth" />
          {(smoothFull || smoothPartial) && <View testID="linear-cycle-arc" />}
        </>
      )}
    </View>
  );
}

export interface LogLineDashesProps {
  completedCount: number;
  totalCount: number;
  /** The dash thickness (theme.ring.dash.height). */
  height: number;
  /** The horizontal gap between dashes (theme.ring.dash.gap). */
  gap: number;
  /** The dash end-cap radius (theme.ring.dash.radius). */
  radius: number;
  /** The lit colour (theme.colors.accent). Lit at full, unlit at `dimOpacity`. */
  color: string;
  /** The unlit intensity (theme.progress.trackOpacity). */
  dimOpacity: number;
  testID?: string;
}

/**
 * The W (2×1) segmented BAR: one dash per cycle issue, the first `lit` in full accent, the rest accent @
 * dimOpacity — the LINEAR form of the same lit/total logic (a ring does not fit a wide-short cell). Plain
 * Views (not SVG), so each dash is directly queryable; they flex to fill the width, so a large N reads as a
 * denser bar of thinner dashes rather than clipping. total == 0 renders nothing (the percent carries it).
 */
export function LogLineDashes({
  completedCount,
  totalCount,
  height,
  gap,
  radius,
  color,
  dimOpacity,
  testID = 'linear-cycle-dashes',
}: LogLineDashesProps) {
  const { total, lit } = resolveLit(completedCount, totalCount);
  if (total <= 0) return null;

  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < lit;
        return (
          <View
            key={i}
            testID={on ? 'linear-cycle-dash-lit' : 'linear-cycle-dash-dim'}
            style={{ flex: 1, height, borderRadius: radius, backgroundColor: color, opacity: on ? 1 : dimOpacity }}
          />
        );
      })}
    </View>
  );
}

export interface LogLineBarProps {
  completedCount: number;
  totalCount: number;
  /** The bar thickness (theme.ring.dash.height). */
  height: number;
  /** The rounded end-cap radius (theme.ring.dash.radius). */
  radius: number;
  /** The lit colour (theme.colors.accent). The fill at full, the track at `dimOpacity`. */
  color: string;
  /** The track intensity (theme.progress.trackOpacity). */
  dimOpacity: number;
  testID?: string;
}

/**
 * The over-cap W bar: a single CONTINUOUS accent bar, fraction-filled — the LINEAR analogue of the smooth
 * ring, O(1) in N (a track + one fill, NO per-issue element). Rendered above RING_MAX_KNOTS instead of N
 * dashes so a huge / pathological cycle never allocates a per-issue array. A track (accent @ dimOpacity) under
 * a left-anchored fill (solid accent, the completed fraction). The percent + counts keep the TRUE total; only
 * the drawn bar collapses. total == 0 renders nothing (the percent carries it).
 */
export function LogLineBar({
  completedCount,
  totalCount,
  height,
  radius,
  color,
  dimOpacity,
  testID = 'linear-cycle-fill',
}: LogLineBarProps) {
  const { total, lit } = resolveLit(completedCount, totalCount);
  if (total <= 0) return null;
  const pct = (lit / total) * 100;

  return (
    <View testID={testID} style={{ height, borderRadius: radius, overflow: 'hidden', alignSelf: 'stretch' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: color, opacity: dimOpacity }} />
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%` as DimensionValue, backgroundColor: color }} />
    </View>
  );
}
