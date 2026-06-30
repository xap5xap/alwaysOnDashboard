// The Claude usage leaf's per-widget line-icon (design-claude-usage.md §6.2; the §5.1 empty-body glyph is
// per-widget). Same family as the shared chrome glyphs (apps/app/src/widgets/glyphs.tsx): presentational
// react-native-svg, colours from the caller, no theme knowledge. The path data is the frozen design's,
// verbatim from assets/design-empty-body.svg (#chart-empty): a flat baseline with a few floor ticks, so
// the empty state speaks the sparkline's own visual language. Accent-toned at the mockup's reduced
// opacities (baseline 0.6, ticks 0.5); the caller passes colors.accent.
import React from 'react';
import Svg, { Line, Rect } from 'react-native-svg';
import type { GlyphProps } from '../../../widgets/glyphs';

/** The flat-chart empty glyph for Daily Spend's "No spend yet this month" body, passed into EmptyBody. */
export function ChartEmptyGlyph({ size = 26, color, strokeWidth = 1.6 }: GlyphProps) {
  const ticks = [2.5, 7.3, 12.0, 16.8, 21.5];
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Line
        x1={1.5}
        y1={19}
        x2={24.5}
        y2={19}
        stroke={color}
        strokeOpacity={0.6}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {ticks.map((x) => (
        <Rect key={x} x={x} y={14.5} width={3} height={4.5} rx={1} fill={color} fillOpacity={0.5} />
      ))}
    </Svg>
  );
}
