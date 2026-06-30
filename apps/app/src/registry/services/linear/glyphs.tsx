// The Linear leaves' per-widget SVG glyphs (design-linear.md §4, §5.3, §6.3). Same family as the shared
// chrome glyphs (apps/app/src/widgets/glyphs.tsx): presentational react-native-svg, colours from the
// caller, no theme knowledge. Two kinds live here:
//   1. PriorityGlyph (§4): the My Issues priority indication, the bespoke centerpiece. Five monochrome
//      glyphs in Linear's own language, carried by SHAPE and ink-weight, NOT colour (the §3 one-accent
//      rule + the §5 status-hue reservation forbid a priority-dot rainbow). Path data verbatim from
//      assets/design-linear-my-issues.svg (the 16x16 glyph defs).
//   2. The two §5.1 empty-body glyphs: CheckboxGlyph (My Issues "No assigned issues") and CycleRingGlyph
//      (Current Cycle "No active cycle", the very ring from design-empty-body.svg #cycle-empty).
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { GlyphProps } from '../../../widgets/glyphs';

// --- §4 priority indication -------------------------------------------------------------------------

/** The glyph kind a priority maps to: 'none' dashes, ascending 'bars' (filled count = level), or the
 *  'urgent' block. `filled` is how many of the three bars draw in the bright ink (1 low / 2 medium / 3 high). */
export type PriorityKind = 'none' | 'bars' | 'urgent';
export interface PriorityShape {
  kind: PriorityKind;
  filled: number;
}

/**
 * Pure: priority 0..4 -> the glyph shape (integration-linear.md §4.1: 0 none, 1 urgent, 2 high, 3 medium,
 * 4 low). The filled-bar count IS the level, so level is read by counting filled bars (a shape), never a
 * hue (§4.2). Defensive default to 'none' for any out-of-range value, so a partial payload never crashes.
 */
export function priorityShape(priority: number): PriorityShape {
  switch (priority) {
    case 1:
      return { kind: 'urgent', filled: 0 };
    case 2:
      return { kind: 'bars', filled: 3 }; // high
    case 3:
      return { kind: 'bars', filled: 2 }; // medium
    case 4:
      return { kind: 'bars', filled: 1 }; // low
    default:
      return { kind: 'none', filled: 0 }; // 0 none (and any unexpected value)
  }
}

// The three ascending bars (16x16 box), shortest-first; the first `filled` draw bright (verbatim from the
// mockup glyph defs). The none dashes share the box at three rows; the urgent block fills it.
const BARS = [
  { x: 2, y: 8, width: 3.4, height: 6 },
  { x: 6.7, y: 4.5, width: 3.4, height: 9.5 },
  { x: 11.4, y: 1.5, width: 3.4, height: 12.5 },
] as const;
const DASHES = [4.2, 8.05, 11.9] as const; // the three none-dash y-rows
const DASH_OPACITY = 0.5; // the §4.2 none-dashes ink (the mockup's .dash opacity; the quietest mark)
const BAR_RADIUS = 1;

export interface PriorityGlyphProps {
  priority: number; // 0 none, 1 urgent, 2 high, 3 medium, 4 low
  size?: number; // theme.priorityIcon.size (the 16x16 box scales to this edge)
  onColor: string; // colors.text: filled bars / the urgent block (the bright tier)
  offColor: string; // colors.textMuted: unfilled bars / the none dashes
  offOpacity?: number; // theme.priorityIcon.offOpacity: the unfilled-bar intensity (level by count)
  knockoutColor: string; // colors.surface: the urgent exclamation, cut out of the block
}

/** One priority glyph, drawn by shape (§4.2). Monochrome: bright ink = onColor, muted ink = offColor; the
 *  urgent exclamation is knocked out in knockoutColor (the card fill) so it reads as a cutout in the block. */
export function PriorityGlyph({
  priority,
  size = 14,
  onColor,
  offColor,
  offOpacity = 0.3,
  knockoutColor,
}: PriorityGlyphProps) {
  const { kind, filled } = priorityShape(priority);

  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {kind === 'none' &&
        DASHES.map((y) => (
          <Rect key={y} x={2} y={y} width={12.8} height={1.9} rx={0.9} fill={offColor} fillOpacity={DASH_OPACITY} />
        ))}

      {kind === 'bars' &&
        BARS.map((b, i) => {
          const on = i < filled;
          return (
            <Rect
              key={b.x}
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.height}
              rx={BAR_RADIUS}
              fill={on ? onColor : offColor}
              fillOpacity={on ? 1 : offOpacity}
            />
          );
        })}

      {kind === 'urgent' && (
        <>
          <Rect x={1.5} y={1.5} width={13} height={13} rx={3.2} fill={onColor} />
          <Rect x={7.15} y={4} width={1.7} height={5.2} rx={0.7} fill={knockoutColor} />
          <Circle cx={8} cy={11.1} r={1.0} fill={knockoutColor} />
        </>
      )}
    </Svg>
  );
}

// --- §5.1 empty-body glyphs (per-widget) ------------------------------------------------------------

/** My Issues "No assigned issues" empty glyph (§5.3): a checkbox with a check, speaking the issue/task
 *  language. Accent line-icon by default per the mockup (#mi-empty); the caller passes colors.accent. */
export function CheckboxGlyph({ size = 26, color, strokeWidth = 1.8 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect
        x={3}
        y={3}
        width={20}
        height={20}
        rx={4.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 13 l3.6 3.6 l7 -8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Current Cycle "No active cycle" empty glyph (§6.3): the cycle ring, reused verbatim from
 *  design-empty-body.svg #cycle-empty (an accent ring with a start dot, the cycle's own language). The
 *  reduced opacity is baked from the mockup (0.65); the caller passes colors.accent. */
export function CycleRingGlyph({ size = 26, color, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M16.58 3.66 A10 10 0 1 1 9.42 3.66"
        stroke={color}
        strokeOpacity={0.65}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={13} cy={2.8} r={1.35} fill={color} fillOpacity={0.65} />
    </Svg>
  );
}
