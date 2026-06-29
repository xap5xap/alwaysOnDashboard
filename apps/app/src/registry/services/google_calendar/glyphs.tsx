// The Calendar leaf's per-widget line-icons (design-calendar-weather.md §7, §8; the §5.1 empty-body glyph
// is per-widget). Same family as the shared chrome glyphs (apps/app/src/widgets/glyphs.tsx): presentational
// react-native-svg, round caps/joins, colours from the caller, no theme knowledge. The path data is the
// frozen design's, verbatim from assets/design-calendar-next-event.svg / design-calendar-agenda.svg.
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { GlyphProps } from '../../../widgets/glyphs';

/** The empty-body calendar glyph (a calendar with a check), passed into the shared EmptyBody. Accent by
 *  default per the mockup; the line/subline stay textMuted (the empty body carries no action). */
export function CalendarGlyph({ size = 26, color, strokeWidth = 1.8 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect
        x={3}
        y={5}
        width={20}
        height={18}
        rx={2.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={3} y1={10} x2={23} y2={10} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={8} y1={2.5} x2={8} y2={7} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={18} y1={2.5} x2={18} y2={7} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M9.5 16.5 l2.5 2.5 l5 -5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The location pin for the Next Event location line (§7). Non-square (12x18); height drives the size. */
export function PinGlyph({ size = 14, color, strokeWidth = 1.5 }: GlyphProps) {
  return (
    <Svg width={(size * 12) / 18} height={size} viewBox="0 0 12 18" fill="none">
      <Path
        d="M6 4.6 C3.6 4.6 1.8 6.4 1.8 8.8 C1.8 12 6 16.6 6 16.6 C6 16.6 10.2 12 10.2 8.8 C10.2 6.4 8.4 4.6 6 4.6 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={6} cy={8.7} r={1.5} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}
