// Dashboard-scoped line-icon glyphs (design-dashboard-editor.md §5, §8). Same visual family and prop
// shape as the AOD-20 component glyphs (src/ui/glyphs.tsx) and the widget glyphs: ~1.7 stroke, round
// caps, origin-centred; each takes its colour from the caller (no theme knowledge). Scoped here because
// they are editor-interior marks (the empty-CTA add glyph, the switcher's dashboard + create glyphs),
// not part of the reusable component set.
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export interface GlyphProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** §5 the empty-dashboard CTA mark: a soft DASHED rounded square + a centred plus (the brand's add
 *  metaphor, drawn in colors.accent by the caller). Deliberately NOT an alert glyph: nothing is wrong. */
export function AddGlyph({ size = 40, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-16 -16 32 32" fill="none" testID="dashboard-add-glyph">
      <Rect x={-13} y={-13} width={26} height={26} rx={7} stroke={color} strokeWidth={strokeWidth} strokeDasharray="3 3.5" />
      <Path d="M0 -6 V6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M-6 0 H6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** §8 the switcher row's leading mark: a small dashboard (a framed panel split into a column + tiles). */
export function DashboardGlyph({ size = 18, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-9 -9 18 18" fill="none">
      <Rect x={-7} y={-7} width={14} height={14} rx={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M-1 -7 V7" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M-1 -1 H7" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** §8 the switcher's "New dashboard" create mark: a plus (accent). */
export function PlusGlyph({ size = 18, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-9 -9 18 18" fill="none">
      <Path d="M0 -6 V6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M-6 0 H6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
