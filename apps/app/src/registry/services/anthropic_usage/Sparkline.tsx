// The Daily Spend sparkline (design-claude-usage.md §4), the bespoke centerpiece of the AOD-36 polish,
// the parallel to AOD-35's weather icon set. A month-to-date series of daily costs drawn as one bar per
// day, oldest on the left and today on the right (§4.1). Each bar's height is its day's spend over the
// window's peak spend, so the chart shows the SHAPE of the month while the MTD total carries magnitude
// (§6.1). Today is the one emphasis: the rightmost bar draws at full colors.accent while every earlier
// day recedes to the same accent at pastOpacity, so the eye lands on now with no second colour (§4.2);
// because today is a partial, still-growing day it is marked by COLOUR, not height. A minBarHeight floor
// keeps a zero / tiny day visible as a baseline tick (a $0 day is not a gap), and an all-zero window
// draws every bar at the floor, never a divide-by-zero (§4.3). The bars sit on a 1px colors.border
// baseline. All MTD days are shown (bars flex to fill the width); there is no VISIBLE_BY_SIZE slice.
//
// Built as a react-native-svg module (the design's chosen form): bar geometry + per-bar opacity + a clean
// 1px baseline are crisp in SVG. The chart fills its container's width, so it measures that width with
// onLayout and draws once known (the testID rides a wrapping View, both because Svg testID forwarding is
// unreliable under jest-expo and because the wrapper renders even before measurement). The height/opacity
// math is the pure barMetrics() below, unit-tested without a layout pass; only the x-positions need width.
import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import type { DailyCost } from './types';

/** One bar's drawn geometry (no x: x needs the measured width, height/opacity do not). */
export interface BarMetric {
  amount: number;
  height: number; // px, floored at minBarHeight, scaled to the window max otherwise
  opacity: number; // todayOpacity for the last (today) bar, pastOpacity for the rest
  isToday: boolean;
}

export interface BarMetricsOpts {
  chartHeight: number;
  minBarHeight: number;
  todayOpacity: number;
  pastOpacity: number;
}

/**
 * The §4 chart rule as pure data: height = amount / windowMax * chartHeight, floored at minBarHeight; the
 * last day (today, oldest-first series) takes todayOpacity, the rest pastOpacity. An all-zero window
 * (windowMax 0) yields every bar at the floor, never a divide-by-zero (§4.3).
 */
export function barMetrics(days: DailyCost[], opts: BarMetricsOpts): BarMetric[] {
  const { chartHeight, minBarHeight, todayOpacity, pastOpacity } = opts;
  const windowMax = days.reduce((m, d) => (d.amount > m ? d.amount : m), 0);
  const last = days.length - 1;
  return days.map((d, i) => {
    const isToday = i === last;
    const scaled = windowMax > 0 ? (d.amount / windowMax) * chartHeight : 0;
    return {
      amount: d.amount,
      height: Math.max(minBarHeight, scaled),
      opacity: isToday ? todayOpacity : pastOpacity,
      isToday,
    };
  });
}

export interface SparklineProps {
  days: DailyCost[]; // oldest-first; the rightmost is today (§4.1)
  height: number; // theme.sparkline.chartHeight[size]: the tallest bar
  barColor: string; // colors.accent
  baselineColor: string; // colors.border
  barGap: number; // theme.sparkline.barGap
  barRadius: number; // theme.sparkline.barRadius
  minBarHeight: number; // theme.sparkline.minBarHeight
  todayOpacity: number; // theme.sparkline.todayOpacity
  pastOpacity: number; // theme.sparkline.pastOpacity
  testID?: string;
}

const BASELINE_STROKE = 1; // the §4.3 baseline is a 1px rule the bars sit on

export function Sparkline({
  days,
  height,
  barColor,
  baselineColor,
  barGap,
  barRadius,
  minBarHeight,
  todayOpacity,
  pastOpacity,
  testID,
}: SparklineProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const metrics = barMetrics(days, { chartHeight: height, minBarHeight, todayOpacity, pastOpacity });
  const svgHeight = height + BASELINE_STROKE; // room for the baseline just under the bars
  const baselineY = height + BASELINE_STROKE / 2;

  // Bars flex to fill the measured width: barW = (width - gap*(n-1)) / n, never negative.
  const n = metrics.length;
  const barW = n > 0 && width > 0 ? Math.max(0, (width - barGap * (n - 1)) / n) : 0;

  return (
    <View style={{ width: '100%' }} onLayout={onLayout} testID={testID} accessibilityRole="image">
      {width > 0 && n > 0 ? (
        <Svg width={width} height={svgHeight}>
          <Line
            x1={0}
            y1={baselineY}
            x2={width}
            y2={baselineY}
            stroke={baselineColor}
            strokeWidth={BASELINE_STROKE}
          />
          {metrics.map((m, i) => (
            <Rect
              key={i}
              x={i * (barW + barGap)}
              y={height - m.height}
              width={barW}
              height={m.height}
              rx={barRadius}
              fill={barColor}
              fillOpacity={m.opacity}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
