// The shared fit-to-bounds ladder (AOD-123, the AOD-95/97 centerpiece; vela-DESIGN.md §7-8). PURE and
// I/O-free: numeric line heights + a px box in, a render/drop decision out. No React, no theme, no
// measurement — the ladder is a function of host-computed dimensions (density-independent DP, the AOD-81
// lesson), never an on-device onLayout on the always-on hot path.
//
// The §7-8 contract this encodes EXACTLY:
//   - "the value renders at its type step and never shrinks below it": the value line is HELD — never
//     dropped, never re-stepped. There is no dynamic shrink stage; the value's step is fixed by the leaf
//     per size (e.g. the Clock time ramp, the money xl), and this ladder only ever DROPS around it.
//   - "secondary detail truncates first, then drops": truncation is a WIDTH concern handled at the render
//     site (each detail line is a single-line, tail-ellipsized Text — numberOfLines is a constant per line,
//     not a per-size ramp), so this module owns only the second stage: DROP a detail line when the stack
//     no longer fits the box HEIGHT. Dropping is deterministic and bottom-up (lowest-priority last-listed
//     line goes first); once one line is dropped, every line after it drops too, so the kept set is always
//     a prefix of the detail list (no holes).
// A leaf-optional `lead` line (a kicker above the value: the Next Event "when", the Clock zone) is also
// HELD like the value — it is part of the card's identity, not sheddable detail.
//
// DOC-SILENT INTERPRETATIONS (flagged, AOD-123 acceptance #2):
//   1. §7-8 says "fit BOTH width and height" but names only "truncate then drop". Width is the render
//      site's job (ellipsize); this module is the HEIGHT ladder. The value is never width-fit (never
//      truncated/shrunk) — a hero temperature or price reads whole or not at all — so a value wider than
//      the box overflows by design intent, backstopped by the card's overflow:hidden. Only detail
//      truncates for width.
//   2. §7-8 does not say whether the `lead` kicker is sheddable. Since every current face that has one
//      shows it at its smallest supported size (Next Event S, Clock W), it is modelled as HELD, not
//      dropped. If a box is so short even lead+value overflow, both still render (held) and the card clips
//      them rather than dropping the identity — the M4 face pass owns any size that genuinely cannot seat
//      lead+value.

/** The px box (DP) the body content may occupy, after the host subtracts header + padding from the slot. */
export interface FitBox {
  width: number;
  height: number;
}

/** One line's rendered vertical extent (px). Width lives at the render site (ellipsize), not here. */
export interface FitLineMetric {
  height: number;
}

export interface FitInput {
  /** A kicker above the value (optional). HELD like the value — never dropped. */
  lead?: FitLineMetric;
  /** The dominant line. HELD — never dropped, never re-stepped (§7-8 "never shrinks below its step"). */
  value: FitLineMetric;
  /** Ordered high -> low priority, below the value. Truncated at the render site, dropped here for height. */
  detail: FitLineMetric[];
  /** The vertical gap between two adjacent stacked lines (px). */
  gap: number;
  /** The available body box (px, DP). */
  box: FitBox;
}

export interface FitDecision {
  /** True iff a lead was provided; a lead, once present, always renders (it is held). */
  leadVisible: boolean;
  /** Parallel to input.detail: true = this line renders, false = it dropped. Always a prefix of trues. */
  detailVisible: boolean[];
  /** How many detail lines dropped for height (for a possible "+N" affordance; 0 when all fit). */
  droppedDetail: number;
}

/**
 * The height ladder. The value (and the lead, if any) are reserved first and never dropped; each detail
 * line is then admitted top-down while the running stack height still fits box.height, and the first line
 * that does not fit — plus every line after it — drops. Deterministic: the kept detail set is always a
 * prefix of the list, so priority order is honoured with no holes.
 */
export function fitBody(input: FitInput): FitDecision {
  const { lead, value, detail, gap, box } = input;

  // Reserved by the held lines. The lead sits above the value with one gap between them.
  let used = value.height + (lead ? lead.height + gap : 0);

  const detailVisible: boolean[] = [];
  let dropped = 0;
  let stillFitting = true;
  for (const line of detail) {
    const need = gap + line.height; // each detail line adds a gap + its own height below the stack
    if (stillFitting && used + need <= box.height) {
      detailVisible.push(true);
      used += need;
    } else {
      stillFitting = false; // once one drops, all after it drop (bottom-up, no holes)
      detailVisible.push(false);
      dropped++;
    }
  }

  return { leadVisible: lead != null, detailVisible, droppedDetail: dropped };
}

// --- the body box derivation (AOD-123 acceptance #3) ---------------------------------------------
// The host derives the body box from the slot rect: UNIT_PX * nominal units, minus the card padding on
// both axes and (when the header is shown) the header row + the card's header->body gap. These defaults
// are the shipped theme values, named here so the pure helper stays theme-free (the host passes the live
// theme numbers; the FitBody fallback uses these constants). Kept in sync with unistyles.ts by comment,
// not import, to keep this module dependency-free and trivially testable.
export const CARD_PADDING = 12; // theme.spacing(3): the widget card padding (WidgetHostView styles.card)
export const HEADER_HEIGHT = 16; // the SERVICE·WIDGET caption row: type.caption lineHeight 16 == RefreshControl box 16
export const HEADER_GAP = 8; // theme.spacing(2): the card's header -> body gap (WidgetHostView styles.card gap)

export interface BodyBoxChrome {
  headerShown: boolean;
  padding?: number; // default CARD_PADDING
  headerHeight?: number; // default HEADER_HEIGHT
  headerGap?: number; // default HEADER_GAP
}

/**
 * Pure: the body box (DP) for a slot of `nominalW x nominalH` units at `unitPx` DP/unit, after removing
 * the card padding (both axes) and, when shown, the header row + its gap (vertical only). Clamped at 0 so
 * a degenerate slot never yields a negative extent.
 */
export function bodyBox(nominalW: number, nominalH: number, unitPx: number, chrome: BodyBoxChrome): FitBox {
  const padding = chrome.padding ?? CARD_PADDING;
  const headerV = chrome.headerShown ? (chrome.headerHeight ?? HEADER_HEIGHT) + (chrome.headerGap ?? HEADER_GAP) : 0;
  return {
    width: Math.max(0, nominalW * unitPx - padding * 2),
    height: Math.max(0, nominalH * unitPx - padding * 2 - headerV),
  };
}

// --- the hero-value width-fit (AOD-123 attempt 2; AOD-97 direction) ------------------------------
// AOD-95/97 are the Clock: a fixed per-size font (the clockSize ramp) is too WIDE for a narrow cell —
// "18:45" at 34px is ~90px in a 72px S body, and a tall/narrow cell scales the time to the HEIGHT so it
// overflows the WIDTH and hard-clips to "19…". The fix (AOD-97, verbatim): "scale by min(widthScale,
// heightScale) so it never overflows either axis (the same pattern as the AOD-81 wall auto-fit, computed
// in DP)". So the hero value renders at its per-size type step when it fits, and otherwise scales DOWN to
// a legibility floor — it NEVER clips either axis. This is the reconciliation of the issue's "value
// renders at its type step and never shrinks below it": the STEP is chosen per size; within a size, a
// value that would overflow scales toward the floor rather than clipping. Detail still truncates-then-
// drops (fitBody above); only the value scales.

/** The intrinsic (unscaled) extent of a value at its nominal step, in DP. */
export interface Intrinsic {
  width: number;
  height: number;
}

// The legibility floor as a fraction of the value's per-size step, shared by every caller so the policy
// lives in ONE place. 0.35 keeps a 40px value at >=14px and a 34px Clock at >=12px — glanceable — while
// being low enough that realistic worst-case content (4-figure money, a seconds-time) still width-fits a
// 1-unit cell without clipping. Content that would need less than the floor (5-figure money in a 1x1, say)
// is a slot-misconfiguration: it reaches the floor and the card's overflow:hidden backstops it.
export const DEFAULT_MIN_SCALE = 0.35;

/**
 * Pure, no measurement: the scale in [minScale, 1] that makes `intrinsic` fit `box` on BOTH axes —
 * min(1, box.width/intrinsic.width, box.height/intrinsic.height), floored at minScale. Never scales UP
 * past 1 (the value renders at its step or smaller, never larger). A non-positive intrinsic is treated as
 * "nothing to fit" -> 1. minScale is the legibility floor (a value that cannot reach its box even at the
 * floor is a slot-misconfiguration, not a real-content case — see the tabularWidth callers' tests); it
 * defaults to DEFAULT_MIN_SCALE so a direct caller can never get an invisible (scale 0) value by omission.
 */
export function fitValueScale(intrinsic: Intrinsic, box: FitBox, minScale = DEFAULT_MIN_SCALE): number {
  if (intrinsic.width <= 0 || intrinsic.height <= 0) return 1;
  const raw = Math.min(1, box.width / intrinsic.width, box.height / intrinsic.height);
  return Math.max(minScale, raw);
}

// Per-glyph horizontal advance as a fraction of the font size, for a system tabular-figure value string
// (the Clock time, a money amount, a temperature). Deliberately on the GENEROUS side so the estimate
// over-states the width slightly and the fit errs toward shrinking a hair more — never toward a clip.
// Tabular digits share one advance; punctuation is narrow; capital letters (AM/PM) are wide.
const ADVANCE = {
  digit: 0.62, // tabular figures 0-9 (one fixed advance so a ticking value does not jitter)
  colon: 0.34, // ':'
  dot: 0.32, // '.'
  comma: 0.32, // ','
  currency: 0.60, // '$', '€', etc. (approximate; the symbol renders reduced in MoneyValue, so this over-states)
  degree: 0.55, // '°'
  space: 0.32, // ' '
  upper: 0.74, // A-Z (AM/PM, a weekday) — the widest class
  other: 0.62, // any other glyph (lowercase, sign) — the digit fallback
} as const;

/**
 * Pure: an over-estimate of a value string's rendered WIDTH in DP at `fontSize`, from per-glyph advance
 * fractions (no font metrics, no measurement). Feeds fitValueScale as `intrinsic.width` so the hero value
 * width-fits its box in DP on the always-on hot path. Over-estimating is intentional: a slightly small
 * value is calm; a clipped one is the AOD-95 bug.
 */
export function tabularWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') units += ADVANCE.digit;
    else if (ch === ':') units += ADVANCE.colon;
    else if (ch === '.') units += ADVANCE.dot;
    else if (ch === ',') units += ADVANCE.comma;
    else if (ch === '$' || ch === '€' || ch === '£' || ch === '¥') units += ADVANCE.currency;
    else if (ch === '°') units += ADVANCE.degree;
    else if (ch === ' ') units += ADVANCE.space;
    else if (ch >= 'A' && ch <= 'Z') units += ADVANCE.upper;
    else units += ADVANCE.other;
  }
  return units * fontSize;
}

// --- the list-count fit (AOD-123 attempt 2; AOD-95 "re-check every widget's smallest size") -----
// The collection cards (My Issues, Agenda, Forecast list) shed rows into a "+N more" footer, but with a
// FIXED per-size row count that ignores the box height, so a short cell renders more rows than fit and the
// card overflows. This derives the count from the HEIGHT instead, so a list never clips: how many
// fixed-height rows fit the box after an optional lead (a count/label line) and, when the data overflows,
// a reserved footer row for "+N more". Pure — the host-passed DP box in, a row count out.

export interface FitCountChrome {
  rowHeight: number; // one row's rendered height (px)
  gap: number; // vertical gap between rows (px)
  leadHeight?: number; // a header/count line above the list (px), with one gap below it
  footerHeight?: number; // the "+N more" row height (px), reserved only when the data overflows
}

/**
 * Pure: how many of `total` rows to render so the list fits `boxHeight`. If every row fits, returns
 * `total` (no footer). Otherwise reserves one footer row and returns as many rows as then fit (>= 0), so
 * the caller renders that many + a "+N more". Never returns more than `total`.
 */
export function fitCount(total: number, boxHeight: number, chrome: FitCountChrome): number {
  if (total <= 0) return 0;
  const lead = chrome.leadHeight ? chrome.leadHeight + chrome.gap : 0;
  const rowsThatFit = (avail: number) =>
    avail <= 0 ? 0 : Math.max(0, Math.floor((avail + chrome.gap) / (chrome.rowHeight + chrome.gap)));

  // First: do ALL rows fit with no footer?
  const fitNoFooter = rowsThatFit(boxHeight - lead);
  if (fitNoFooter >= total) return total;

  // They overflow: reserve a footer row and fit the rest.
  const footer = chrome.footerHeight != null ? chrome.footerHeight + chrome.gap : 0;
  return Math.min(total, rowsThatFit(boxHeight - lead - footer));
}
