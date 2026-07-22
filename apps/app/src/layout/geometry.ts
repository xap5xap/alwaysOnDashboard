// The bridge between the authoritative nominal-unit LayoutRect (AOD-8 §7, widget-model §5.1) and
// on-screen pixels. widget-model §5.1 leaves the concrete coordinate space to AOD-7; this settles it:
// rects are stored in nominal layout units and rendered at UNIT_PX pixels per unit. Keeping geometry in
// nominal units makes a persisted layout device-independent (author on web, reload on the Fire HD 8)
// and keeps reconcileSize's area term (AOD-10 §5.2) meaningful, which pixel-sized rects would saturate.
// Pure and I/O-free; these functions back both the live gesture preview and the committed value.
//
// Two flavours of drag/resize live here: the original CONTINUOUS pair (applyDrag/applyResize, kept for
// the live gesture preview and anything still free-form) and the DISCRETE pair (snapDrag/snapResize,
// AOD-138) that resolves a gesture onto the responsive slot grid (GRID_COLUMNS landscape / PORTRAIT_COLUMNS
// portrait wide, footprints <= MAX_SLOT_W x MAX_SLOT_H — AOD-197). The discrete pair is what the arrange
// path commits; the pure slot ALGEBRA it feeds (first-free, reflow, slot<->pixel) lives in layout/grid.ts.
// The grid's column count and the footprint ceiling are imported from widgets/sizes so there is one source
// of truth for the grid's shape.
import type { LayoutRect } from '../registry/types';
import { GRID_COLUMNS, MAX_SLOT_H, MAX_SLOT_W } from '../widgets/sizes';

// 96 DP per nominal layout unit: the Many Skies §1c card-grid row (AOD-122; was 80 pre-slot-grid).
// DENSITY-INDEPENDENT pixels, never physical px — the AOD-81 lesson: rt.screen and this constant must
// share the DP space or every derived scale is density-wrong. LOAD-BEARING and unchanged by AOD-197: it is
// the nominal render unit for card internals (FitBody/fitLadder), the host, and the kiosk wall; cellPxFor
// below is a SEPARATE, additive fit-to-width scale, never a replacement for UNIT_PX.
export const UNIT_PX = 96;
export const MIN_W = 1; // smallest widget extent (nominal units)
export const MIN_H = 1;

// AOD-197 responsive placement scale (design §4). The handheld arrange/Glance canvas fits the grid to the
// viewport WIDTH: each cell is cellPxFor(columns, viewportW) DP wide, so `columns` cells plus their gutters
// plus the two outer margins exactly span the screen. ADDITIVE and separate from UNIT_PX (see above): S4
// applies cellPx as a fit-to-width scale over the nominal UNIT_PX canvas — exactly as KioskWall scales the
// wall — so FitBody/fitLadder/the host/the wall never see a changed unit. Margins + gutters are the Many
// Skies §1c "24px gutters" intent, tunable per orientation; both derive from rt.screen in DP (AOD-81).
export const GRID_MARGIN = 24; // DP, the outer margin on each side of the placement grid
export const GRID_GUTTER = 24; // DP, the inter-cell gutter

/** The pixel width of one grid cell when `columns` cells (plus their gutters and the two outer margins)
 *  fit a `viewportW`-DP-wide canvas: cellPx = (viewportW - 2*margin - (columns-1)*gutter) / columns. Pure;
 *  the S4 fit-to-width scale is cellPx / UNIT_PX applied over the nominal canvas, UNIT_PX itself untouched. */
export function cellPxFor(
  columns: number,
  viewportW: number,
  margin: number = GRID_MARGIN,
  gutter: number = GRID_GUTTER,
): number {
  return (viewportW - 2 * margin - (columns - 1) * gutter) / columns;
}

// Hundredths of a unit (~0.96px at UNIT_PX): kills floating-point drift in persisted geometry.
export function snapUnit(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function toPixels(rect: LayoutRect): PixelRect {
  return {
    left: rect.x * UNIT_PX,
    top: rect.y * UNIT_PX,
    width: rect.w * UNIT_PX,
    height: rect.h * UNIT_PX,
  };
}

/** Move an instance by a pixel delta. Converts to units and clamps the origin into the canvas (>= 0). */
export function applyDrag(rect: LayoutRect, dxPx: number, dyPx: number): LayoutRect {
  return {
    ...rect,
    x: snapUnit(Math.max(0, rect.x + dxPx / UNIT_PX)),
    y: snapUnit(Math.max(0, rect.y + dyPx / UNIT_PX)),
  };
}

/** Resize an instance by a pixel delta on its far edges, enforcing the minimum extent. */
export function applyResize(rect: LayoutRect, dwPx: number, dhPx: number): LayoutRect {
  return {
    ...rect,
    w: snapUnit(Math.max(MIN_W, rect.w + dwPx / UNIT_PX)),
    h: snapUnit(Math.max(MIN_H, rect.h + dhPx / UNIT_PX)),
  };
}

/** Round a value to the nearest integer, then clamp into [lo, hi]. The one-liner both snap helpers use
 *  to land a continuous unit coordinate on a discrete, in-bounds slot coordinate. */
function snapClamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/**
 * The DISCRETE sibling of applyDrag (AOD-138): move by a pixel delta, then snap the ORIGIN to the nearest
 * slot — column rounded and clamped so the footprint stays on-grid (x + w <= `columns`), row rounded and
 * floored at 0 (rows are unbounded downward). The footprint (w/h) is also legalised onto the slot ladder
 * ({1..MAX_SLOT_W} x {1..MAX_SLOT_H}) so a rect carried over from the pre-slot free-form canvas lands as a
 * valid slot; a rect that is already a slot is unchanged. z passes through. This is what the arrange canvas
 * commits on drop.
 *
 * AOD-197 (S4): `unitPx` + `columns` default to the nominal UNIT_PX + landscape GRID_COLUMNS so existing
 * callers (and the wall, which never arranges) stay byte-identical. The handheld arrange path passes the
 * fit-to-width `cellPx` as `unitPx` (the finger moves in ON-SCREEN pixels, and one on-screen cell is cellPx
 * wide under the LayoutCanvas scale) and the ACTIVE orientation's `columns`, so a drag converts + clamps
 * against the grid the user is actually touching. UNIT_PX itself is untouched (§1.1 #3).
 */
export function snapDrag(
  rect: LayoutRect,
  dxPx: number,
  dyPx: number,
  unitPx: number = UNIT_PX,
  columns: number = GRID_COLUMNS,
): LayoutRect {
  const w = snapClamp(rect.w, MIN_W, MAX_SLOT_W);
  const h = snapClamp(rect.h, MIN_H, MAX_SLOT_H);
  return {
    ...rect,
    x: snapClamp(rect.x + dxPx / unitPx, 0, columns - w),
    y: Math.max(0, Math.round(rect.y + dyPx / unitPx)),
    w,
    h,
  };
}

/**
 * The DISCRETE sibling of applyResize (AOD-138): grow/shrink by a pixel delta, then snap each extent to
 * the nearest S/M/W/L step (w in {1..MAX_SLOT_W}, h in {1..MAX_SLOT_H}) so what you drag is what you
 * get — no free-form bounds that only reconcile to a class on release. The origin column is clamped so a
 * footprint grown near the right edge shifts left to stay on-grid (x + w <= `columns`) rather than hanging
 * off; y and z pass through. Same `unitPx` + `columns` parameterization as snapDrag (AOD-197 S4): defaults
 * keep every existing caller byte-identical; the handheld path passes `cellPx` + the active column count.
 */
export function snapResize(
  rect: LayoutRect,
  dwPx: number,
  dhPx: number,
  unitPx: number = UNIT_PX,
  columns: number = GRID_COLUMNS,
): LayoutRect {
  const w = snapClamp(rect.w + dwPx / unitPx, MIN_W, MAX_SLOT_W);
  const h = snapClamp(rect.h + dhPx / unitPx, MIN_H, MAX_SLOT_H);
  return {
    ...rect,
    x: snapClamp(rect.x, 0, columns - w),
    w,
    h,
  };
}
