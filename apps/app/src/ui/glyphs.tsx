// The component-chrome line-icon glyphs (design-component-library.md §11: "the padlock + chevron extend
// the shared chrome glyph family, ~1.7 stroke, round caps"). Same visual family and prop shape as the
// widget glyphs (src/widgets/glyphs.tsx), kept in the ui/ library so the component set is self-contained;
// each takes its colour from the caller (no theme knowledge), origin-centred to match the mockup paths.
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export interface GlyphProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** §11 lock row / locked tile: a padlock (body + shackle + keyhole). textMuted on a dimmed row. */
export function LockGlyph({ size = 18, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-9 -9 18 18" fill="none">
      <Rect x={-6} y={-1} width={12} height={9} rx={1.6} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M-3.4 -1 V-3.6 A3.4 3.4 0 0 1 3.4 -3.6 V-1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path d="M0 2.4 V4.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** §8/§11 trailing affordance: a right chevron (a list row / lock row that routes onward). */
export function ChevronGlyph({ size = 16, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-8 -8 16 16" fill="none">
      <Path
        d="M-2 -5 L3 0 L-2 5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** §9 overlays: a close/dismiss X for a sheet or modal header. */
export function CloseGlyph({ size = 16, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-8 -8 16 16" fill="none">
      <Path d="M-5 -5 L5 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M5 -5 L-5 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** §7 segmented / §9 popover: a check mark for a selected menu item (accent). */
export function CheckGlyph({ size = 16, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="-8 -8 16 16" fill="none">
      <Path
        d="M-5 0 l3.4 3.6 l6 -7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
