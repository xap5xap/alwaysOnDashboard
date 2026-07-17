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
