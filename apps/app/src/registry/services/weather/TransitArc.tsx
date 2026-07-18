// The Transit sun-arc (AOD-132; design-color-law.md §4 sun/moon inks, §7 night frame; weather.md "the
// sunrise-to-sunset day arc carrying the sun's real position"). A STATIC-per-render figure: the sun's
// position is computed ONCE from `fraction` at render time — NO Animated / requestAnimationFrame loop
// (RN-SVG + Animated leaks `collapsable`, aod-unistyles-style-token-gotcha; and the ambient "movement" is
// the ~15-min data refresh re-render, not a ticking loop). Geometry by size: a full quadratic CURVE at L,
// a flat WATERLINE at W/M, absent at S (the caller does not mount it). Day → a gold sun-mark rides the
// line at `fraction`; night (isDay false) → the sun-mark is gone and a moon crescent sits BELOW the line,
// which persists as a quiet fact. Missing sunrise/sunset (fraction null) → the line only, no mark, never
// NaN. Presentational: every colour arrives as a resolved ROLE value from the leaf (no theme access here),
// so Monochrome resolves for free. The bare Svg is wrapped in a View so its testID stays queryable, and
// day/night is asserted via the 0-size marker Views (SVG-internal testIDs are unreliable under RNTL).
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type ArcVariant = 'curve' | 'waterline';

export interface TransitArcProps {
  variant: ArcVariant;
  /** The band width (DP), from the host body box; the arc endpoints inset from it. */
  width: number;
  /** The band height (DP): theme.transit.arcHeight (curve) or waterlineHeight (waterline). */
  height: number;
  /** Whether it is day (payload isDay): true → sun-mark, false → moon crescent below the line. */
  isDay: boolean;
  /** The sun's sunrise→sunset position in [0,1], or null when sunrise/sunset are missing (no mark). */
  fraction: number | null;
  /** The arc/hairline colour (theme.pane[key].line). */
  lineColor: string;
  /** The sun-mark colour (theme.ink.sun). */
  sunColor: string;
  /** The moon colour (theme.pane.clearNight.moon on a clear night, else theme.ink.moon). */
  moonColor: string;
  /** The pane bg (theme.pane[key].bg) — the crescent bite is carved with it. */
  paneBg: string;
  /** Geometry from theme.transit. */
  stroke: number;
  sunRadius: number;
  moonRadius: number;
  inset: number;
  /** testID for the wrapping View (default weather-current-arc). */
  testID?: string;
}

function quadPointX(x0: number, x1: number, x2: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
}

export function TransitArc({
  variant,
  width,
  height,
  isDay,
  fraction,
  lineColor,
  sunColor,
  moonColor,
  paneBg,
  stroke,
  sunRadius,
  moonRadius,
  inset,
  testID = 'weather-current-arc',
}: TransitArcProps) {
  // Guard a degenerate width (missing box): fall back to a small positive extent so the SVG never gets a
  // NaN/0 viewBox. The endpoints inset from the edges; clamp the inset for a very narrow band.
  const w = Number.isFinite(width) && width > 0 ? width : 120;
  const pad = Math.min(inset, w / 2 - 2);
  const x0 = pad;
  const x2 = w - pad;
  const xc = w / 2;

  // The moon always fits: centred, sitting one radius up from the bottom edge; the line rides above it.
  const moonCy = height - moonRadius - 1;
  const moonCx = w / 2;

  let linePath: string;
  let sunX = 0;
  let sunY = 0;
  if (variant === 'curve') {
    const baseY = Math.max(inset + 2, moonCy - moonRadius - 1); // the arc baseline, above the moon
    const topY = inset; // the arc apex
    linePath = `M ${x0} ${baseY} Q ${xc} ${topY} ${x2} ${baseY}`;
    if (fraction != null) {
      const t = fraction;
      sunX = quadPointX(x0, xc, x2, t);
      sunY = quadPointX(baseY, topY, baseY, t); // same Bézier basis on the y-coords
    }
  } else {
    const lineY = Math.max(2, moonCy - moonRadius - 2); // the horizon, above the moon
    linePath = `M ${x0} ${lineY} L ${x2} ${lineY}`;
    if (fraction != null) {
      sunX = x0 + fraction * (x2 - x0);
      sunY = lineY;
    }
  }

  const showSun = isDay && fraction != null;
  // The crescent: a filled disc bitten by a pane-bg disc offset up-and-right (a waxing sliver).
  const biteCx = moonCx + moonRadius * 0.62;
  const biteCy = moonCy - moonRadius * 0.5;

  return (
    <View testID={testID} style={{ pointerEvents: 'none' }}>
      <Svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} fill="none">
        <Path
          d={linePath}
          stroke={lineColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        {showSun && <Circle cx={sunX} cy={sunY} r={sunRadius} fill={sunColor} />}
        {!isDay && (
          <>
            <Circle cx={moonCx} cy={moonCy} r={moonRadius} fill={moonColor} />
            <Circle cx={biteCx} cy={biteCy} r={moonRadius} fill={paneBg} />
          </>
        )}
      </Svg>
      {/* 0-size markers so a test can assert day vs night without reaching into the SVG tree. */}
      {showSun && <View testID="weather-current-sun" />}
      {!isDay && <View testID="weather-current-moon" />}
    </View>
  );
}
