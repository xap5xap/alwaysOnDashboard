// The shared line-icon glyph family (design-widget-system.md §4/§5 chrome glyphs + §5.1 empty body).
// Pure presentational SVG (react-native-svg), origin-centred to match the design mockups' path data
// (assets/design-card-anatomy.svg, design-lifecycle-states.svg, design-refresh-affordance.svg,
// design-empty-body.svg). Each takes its colours from the caller (the host / a leaf) so it carries no
// theme knowledge: ~1.7 non-scaling stroke, round caps/joins. Per-widget empty glyphs (the calendar
// glyph, the sparkline, the cycle ring) are designed with their leaves (AOD-35/36/30); RingGlyph is the
// neutral default the shared EmptyBody falls back to.
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export interface GlyphProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** AOD-15 refresh control: a ~270° circular arrow with a top-left arrowhead (design-refresh-affordance.svg). */
export function RefreshGlyph({ size = 16, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-9 -9 18 18" fill="none">
      <Path d="M-7 -1 A7 7 0 1 1 -5 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M-7 -6 L-7 -1 L-2 -1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The within-fetch-floor "up to date" check that replaces the spin when a tap is served cached (§6). */
export function CheckGlyph({ size = 12, color, strokeWidth = 1.6 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-6 -6 12 12" fill="none">
      <Path
        d="M-4 0 l3 3 l5 -6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export interface PromptGlyphProps extends GlyphProps {
  /** The card fill, so the sliders knobs read as rings sitting on the track (design-lifecycle-states.svg). */
  knobFill?: string;
}

/** needs_config: the two-track sliders glyph, knobs offset (design-lifecycle-states.svg). */
export function SlidersGlyph({ size = 40, color, knobFill = '#16161D', strokeWidth = 1.8 }: PromptGlyphProps) {
  return (
    <Svg width={size} height={(size * 24) / 40} viewBox="-20 -12 40 24" fill="none">
      <Line x1={-16} y1={-6} x2={16} y2={-6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={6} cy={-6} r={4} fill={knobFill} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={-16} y1={6} x2={16} y2={6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={-6} cy={6} r={4} fill={knobFill} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** disconnected: a chain-link of two rounded halves and a connector (design-lifecycle-states.svg). */
export function LinkGlyph({ size = 40, color, strokeWidth = 1.8 }: GlyphProps) {
  return (
    <Svg width={size} height={(size * 24) / 40} viewBox="-20 -12 40 24" fill="none">
      <Rect x={-15} y={-7} width={16} height={14} rx={7} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={-1} y={-7} width={16} height={14} rx={7} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={-5} y1={0} x2={5} y2={0} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** The neutral empty-body placeholder ring (a dotted accent circle, design-empty-body.svg #ring-ph). The
 *  per-widget builds replace it with their own line-icon; the convention itself carries no fixed glyph. */
export function RingGlyph({ size = 26, color, strokeWidth = 1.6 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-13 -13 26 26" fill="none">
      <Circle
        cx={0}
        cy={0}
        r={10}
        stroke={color}
        strokeOpacity={0.6}
        strokeWidth={strokeWidth}
        strokeDasharray="2.4 3.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
