// The shared fit-to-bounds card body (AOD-123, the AOD-95/97 centerpiece; vela-DESIGN.md §7-8). ONE
// mechanism for every value-and-detail card: it renders a held value (at its fixed type step, never
// dropped, never shrunk) with an optional held lead kicker above it and ordered secondary detail below,
// and it DROPS detail lines that do not fit the box HEIGHT — replacing each leaf's old per-size type-ramp
// + numberOfLines clip and the host body's bare overflow:hidden. The drop DECISION is the pure `fitBody`
// ladder (fitLadder.ts); this component only measures each line's height from its type step and hands the
// ladder the numbers. It never calls onLayout: the box is host-computed in density-independent DP (the
// AOD-81 lesson — the kiosk wall auto-fits on top, so the body must be correct in DP, not screen px) and
// passed in, so nothing measures on the always-on hot path.
//
// SEAM (AOD-123 key question, decision recorded in the issue report): (a) — leaves declare a structured
// content descriptor (a `value` line + ordered `detail` lines, each tagged with its type role) and THIS
// component renders it, deciding truncate/drop. Leaves keep any width-driven arrangement of the value
// itself (e.g. a temperature beside its icon) by passing the composed node + an explicit height, but they
// no longer branch numberOfLines/visibility on size — the ladder owns that. Truncation (the "truncates
// first" half of §7-8) stays at the render site: a detail node is a single-line, tail-ellipsized Text
// (numberOfLines is a constant per line, never a per-size ramp), so a line that is kept but too WIDE
// ellipsizes; a line that cannot fit the HEIGHT is dropped here.
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { WidgetSize } from '../registry/types';
import { SIZE_CATALOGUE } from './sizes';
import { UNIT_PX } from '../layout/geometry';
import { bodyBox, fitBody, type FitBox } from './fitLadder';

/** The type steps a fit line may carry (mirrors unistyles.ts `TypeStep`); drives the line-height estimate. */
export type FitRole =
  | 'display'
  | 'hero'
  | 'xl'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'meta'
  | 'caption'
  | 'badge';

/** One line in the fit stack: its rendered node, its type role, and how tall it is. */
export interface FitLine {
  key: string;
  node: React.ReactNode;
  /** The type step the node renders at; used to estimate the line height (unless `height` is given). */
  role: FitRole;
  /** numberOfLines cap for the height estimate (default 1). A 2-line title passes 2. */
  lines?: number;
  /** An explicit height (px), overriding the role estimate — for a composite/non-text value node (a
   *  temp-beside-icon row, a MoneyValue) whose height is not one text line. */
  height?: number;
}

export interface FitBodyProps {
  /** The slot class; used only to derive the fallback box when `box` is absent. */
  size: WidgetSize;
  /** The host-computed body box (DP). Falls back to `bodyBox(size, headerShown)` for a direct render. */
  box?: FitBox;
  /** Whether the header is shown, for the fallback box only (default true). */
  headerShown?: boolean;
  /** An optional kicker above the value (held, never dropped). */
  lead?: FitLine;
  /** The dominant line (held, never dropped, never re-stepped). */
  value: FitLine;
  /** Ordered high -> low priority detail below the value; truncated at the node, dropped here for height. */
  detail?: FitLine[];
  /** The vertical gap between stacked lines (px). Default theme.spacing(2) = 8. */
  gap?: number;
  /** A centred, space-filling glance (the S 1x1 face: icon over value, centred). Default false = a stack. */
  glance?: boolean;
  testID?: string;
  accessibilityRole?: 'summary';
}

// The line-height for a role WITHOUT an explicit theme lineHeight (display/hero/xl/title/heading/label/
// badge). Slightly generous (RN's own default is ~1.2x) so the ladder never KEEPS a line that would then
// clip; erring toward dropping one borderline line on a 1-unit card is the calm, no-clip outcome §7-8
// wants, and the M4 face pass tunes the exact seat count on-device.
const LINE_HEIGHT_FACTOR = 1.25;

export function FitBody({
  size,
  box,
  headerShown = true,
  lead,
  value,
  detail = [],
  gap,
  glance = false,
  testID,
  accessibilityRole,
}: FitBodyProps) {
  const { theme } = useUnistyles();
  const stackGap = gap ?? theme.spacing(2);

  const heightOf = (line: FitLine): number => {
    if (line.height != null) return line.height;
    const token = theme.type[line.role];
    const lineHeight = token.lineHeight ?? Math.round((token.fontSize ?? 14) * LINE_HEIGHT_FACTOR);
    return lineHeight * (line.lines ?? 1);
  };

  const resolvedBox: FitBox =
    box ??
    bodyBox(SIZE_CATALOGUE[size].nominalW, SIZE_CATALOGUE[size].nominalH, UNIT_PX, {
      headerShown,
      padding: theme.spacing(3),
      headerGap: theme.spacing(2),
    });

  const decision = fitBody({
    lead: lead ? { height: heightOf(lead) } : undefined,
    value: { height: heightOf(value) },
    detail: detail.map((d) => ({ height: heightOf(d) })),
    gap: stackGap,
    box: resolvedBox,
  });

  // Static, theme-free layout (a plain stack, or the centred space-filling S glance). Kept as inline RN
  // style objects rather than a Unistyles StyleSheet: they need no theme, and the gap is applied inline.
  const containerStyle: ViewStyle = glance ? GLANCE_STYLE : STACK_STYLE;

  return (
    <View style={[containerStyle, { gap: stackGap }]} testID={testID} accessibilityRole={accessibilityRole}>
      {lead && decision.leadVisible ? <React.Fragment key={lead.key}>{lead.node}</React.Fragment> : null}
      <React.Fragment key={value.key}>{value.node}</React.Fragment>
      {detail.map((d, i) =>
        decision.detailVisible[i] ? <React.Fragment key={d.key}>{d.node}</React.Fragment> : null,
      )}
    </View>
  );
}

const STACK_STYLE: ViewStyle = { flexDirection: 'column' };
const GLANCE_STYLE: ViewStyle = { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
