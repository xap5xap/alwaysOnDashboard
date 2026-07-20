// The shared fit-to-bounds card body (AOD-123, the AOD-95/97 centerpiece; vela-DESIGN.md §7-8). ONE
// mechanism for every value-and-detail card. Two fit stages, both driven by the host-passed DP box (no
// onLayout on the always-on hot path):
//
//   1. WIDTH-FIT THE HERO VALUE (AOD-97). The value renders at its per-size type step when it fits, and
//      otherwise scales DOWN by min(widthScale, heightScale) to a legibility floor, so it NEVER overflows
//      either axis — the AOD-95 "18:… clipped" / AOD-97 "scales to height, overflows width" fix. This is
//      the reconciliation of "the value renders at its type step and never shrinks below it": the STEP is
//      per size; within a size a value that would clip scales toward the floor instead.
//   2. DETAIL truncate-then-drop (fitLadder.fitBody). Secondary lines are a single-line, tail-ellipsized
//      Text (constant numberOfLines, not a per-size ramp) so a kept-but-too-wide line ellipsizes; a line
//      that cannot fit the HEIGHT drops, bottom-up.
//
// The value YIELDS to shown detail: the box height left after reserving the (held) lead + the detail that
// fits is what the value width-fits into, so a wide-short cell keeps its detail with a smaller value rather
// than dropping content that could fit — the AOD-123-attempt-2 anti-regression rule. Detail drops ONLY
// when it cannot fit even with the value shrunk to its floor. Nothing ever clips.
//
// SEAM: (a) — leaves declare a descriptor (a scalable `value` + optional held `lead` + ordered `detail`,
// each tagged with a type role / intrinsic width) and THIS component fits + renders it. Leaves keep any
// width-driven arrangement of the value node by supplying a `render(fontSize)`; they no longer branch
// numberOfLines/visibility on size — the two fit stages own that.
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { WidgetSize } from '../registry/types';
import { SIZE_CATALOGUE } from './sizes';
import { UNIT_PX } from '../layout/geometry';
import { bodyBox, DEFAULT_MIN_SCALE, fitBody, fitValueScale, type FitBox } from './fitLadder';

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

/** A held line (lead or detail): a rendered node, its type role, and how tall it is. */
export interface FitLine {
  key: string;
  node: React.ReactNode;
  /** The type step the node renders at; used to estimate the line height (unless `height` is given). */
  role: FitRole;
  /** numberOfLines cap for the height estimate (default 1). A 2-line title passes 2. */
  lines?: number;
  /** An explicit height (px), overriding the role estimate — for a composite/non-text node. */
  height?: number;
}

/** The dominant line: width-fit down to a floor, never dropped. `render` draws it at the fitted font size. */
export interface FitValue {
  key: string;
  /** The nominal font size (px) at this size bucket — the clockSize step, or theme.type[role].fontSize. */
  baseSize: number;
  /** The value's intrinsic WIDTH (DP) at baseSize (the leaf computes it, e.g. via tabularWidth). */
  intrinsicWidth: number;
  /** Renders the value at the fitted font size. */
  render: (fontSize: number) => React.ReactNode;
  /** height = fittedSize * lineFactor (default 1.18, ~the tabular value line box). */
  lineFactor?: number;
  /** Legibility floor as a fraction of baseSize (default 0.35) — the value never shrinks below this. */
  minScale?: number;
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
  /** The dominant line (width-fit, never dropped). */
  value: FitValue;
  /** Ordered high -> low priority detail below the value; kept while it fits above the floored value. */
  detail?: FitLine[];
  /** The vertical gap between stacked lines (px). Default theme.spacing(2) = 8. */
  gap?: number;
  /** A centred, space-filling glance (the S 1x1 face: value centred). Default false = a top stack. */
  glance?: boolean;
  /** Extra container style (e.g. the Clock's night opacity). */
  style?: ViewStyle;
  testID?: string;
  accessibilityRole?: 'summary';
}

// The line-height for a role WITHOUT an explicit theme lineHeight (display/hero/xl/title/heading/label/
// badge). Slightly generous (RN's own default is ~1.2x) so the reserve never UNDER-counts a line.
const LINE_HEIGHT_FACTOR = 1.25;
const DEFAULT_VALUE_LINE_FACTOR = 1.18;
// The legibility floor is DEFAULT_MIN_SCALE, owned by fitLadder (the pure primitive) so the value scale
// and this per-size floor can never drift apart. See its comment for why 0.35.

export function FitBody({
  size,
  box,
  headerShown = true,
  lead,
  value,
  detail = [],
  gap,
  glance = false,
  style,
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

  const lineFactor = value.lineFactor ?? DEFAULT_VALUE_LINE_FACTOR;
  const minScale = value.minScale ?? DEFAULT_MIN_SCALE;

  // Stage 2 first (to know how much height the detail claims): admit detail top-down reserving only the
  // value's FLOOR height, so the value yields as much room as it can to keep detail (anti-regression).
  const valueFloorHeight = value.baseSize * minScale * lineFactor;
  const leadMetric = lead ? { height: heightOf(lead) } : undefined;
  const decision = fitBody({
    lead: leadMetric,
    value: { height: valueFloorHeight },
    detail: detail.map((d) => ({ height: heightOf(d) })),
    gap: stackGap,
    box: resolvedBox,
  });

  const leadReserved = leadMetric ? leadMetric.height + stackGap : 0;
  const detailReserved = detail.reduce(
    (sum, d, i) => (decision.detailVisible[i] ? sum + stackGap + heightOf(d) : sum),
    0,
  );

  // Stage 1: width-fit the value into whatever height is left after the held lead + kept detail.
  const availHeight = Math.max(0, resolvedBox.height - leadReserved - detailReserved);
  const scale = fitValueScale(
    { width: value.intrinsicWidth, height: value.baseSize * lineFactor },
    { width: resolvedBox.width, height: availHeight },
    minScale,
  );
  const fittedSize = value.baseSize * scale;

  // GLANCE (the Clock's centred figure) must carry an EXPLICIT height, not lean on flex:1 filling its parent.
  // On the dashboard the cards are content-sized — the reanimated cell height does not clamp them (weather
  // simply overflows its slot) — so a flex:1 glance has no bounded parent to fill: it collapsed to ~0 and the
  // (correctly fitted) value clipped to a sliver under the card's overflow:hidden — the AOD-130 device blank.
  // flex:1's flex-basis:0 even defeated a minHeight FLOOR in that auto-height chain (device-observed). An
  // explicit height is a definite dimension Yoga always honours: resolvedBox.height is the SAME box the value
  // was fit into, so the glance fills its box on every surface (the kiosk wall passes the cell height as this
  // box, so it fills there too). jest/web never caught it: react-test-renderer does no layout.
  const containerStyle: ViewStyle = glance
    ? { ...GLANCE_STYLE, height: resolvedBox.height }
    : STACK_STYLE;

  return (
    <View style={[containerStyle, { gap: stackGap }, style]} testID={testID} accessibilityRole={accessibilityRole}>
      {lead && decision.leadVisible ? <React.Fragment key={lead.key}>{lead.node}</React.Fragment> : null}
      <React.Fragment key={value.key}>{value.render(fittedSize)}</React.Fragment>
      {detail.map((d, i) =>
        decision.detailVisible[i] ? <React.Fragment key={d.key}>{d.node}</React.Fragment> : null,
      )}
    </View>
  );
}

const STACK_STYLE: ViewStyle = { flexDirection: 'column' };
const GLANCE_STYLE: ViewStyle = { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
