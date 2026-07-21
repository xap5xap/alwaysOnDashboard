// The bridge between the authoritative nominal-unit LayoutRect (AOD-8 §7, widget-model §5.1) and
// on-screen pixels. widget-model §5.1 leaves the concrete coordinate space to AOD-7; this settles it:
// rects are stored in nominal layout units and rendered at UNIT_PX pixels per unit. Keeping geometry in
// nominal units makes a persisted layout device-independent (author on web, reload on the Fire HD 8)
// and keeps reconcileSize's area term (AOD-10 §5.2) meaningful, which pixel-sized rects would saturate.
// Pure and I/O-free; these functions back both the live gesture preview and the committed value.
//
// Two flavours of drag/resize live here: the original CONTINUOUS pair (applyDrag/applyResize, kept for
// the live gesture preview and anything still free-form) and the DISCRETE pair (snapDrag/snapResize,
// AOD-138) that resolves a gesture onto the 2-column / 96px-row slot grid. The discrete pair is what the
// arrange path commits; the pure slot ALGEBRA it feeds (first-free, reflow, slot<->pixel) lives in
// layout/grid.ts. The grid's shape (columns, max row span) is imported from widgets/sizes so there is
// one source of truth for "2 columns, 2 rows tall".
import type { LayoutRect } from '../registry/types';
import { GRID_COLUMNS, MAX_SLOT_H } from '../widgets/sizes';

// 96 DP per nominal layout unit: the Many Skies §1c card-grid row (AOD-122; was 80 pre-slot-grid).
// DENSITY-INDEPENDENT pixels, never physical px — the AOD-81 lesson: rt.screen and this constant must
// share the DP space or every derived scale is density-wrong.
export const UNIT_PX = 96;
export const MIN_W = 1; // smallest widget extent (nominal units)
export const MIN_H = 1;

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
 * slot — column rounded and clamped into the two columns so the footprint stays on-grid (x + w <=
 * GRID_COLUMNS), row rounded and floored at 0 (rows are unbounded downward). The footprint (w/h) is also
 * legalised onto the slot ladder ({1..GRID_COLUMNS} x {1..MAX_SLOT_H}) so a rect carried over from the
 * pre-slot free-form canvas lands as a valid slot; a rect that is already a slot is unchanged. z passes
 * through. This is what the arrange canvas commits on drop; grid.reflow then re-packs the neighbours.
 */
export function snapDrag(rect: LayoutRect, dxPx: number, dyPx: number): LayoutRect {
  const w = snapClamp(rect.w, MIN_W, GRID_COLUMNS);
  const h = snapClamp(rect.h, MIN_H, MAX_SLOT_H);
  return {
    ...rect,
    x: snapClamp(rect.x + dxPx / UNIT_PX, 0, GRID_COLUMNS - w),
    y: Math.max(0, Math.round(rect.y + dyPx / UNIT_PX)),
    w,
    h,
  };
}

/**
 * The DISCRETE sibling of applyResize (AOD-138): grow/shrink by a pixel delta, then snap each extent to
 * the nearest S/M/W/L step (w in {1..GRID_COLUMNS}, h in {1..MAX_SLOT_H}) so what you drag is what you
 * get — no free-form bounds that only reconcile to a class on release. The origin column is clamped so a
 * card grown to full width at column 1 shifts to column 0 (x + w <= GRID_COLUMNS) rather than hanging off
 * the grid; y and z pass through. grid.reflow owns re-packing the neighbours after the snap.
 */
export function snapResize(rect: LayoutRect, dwPx: number, dhPx: number): LayoutRect {
  const w = snapClamp(rect.w + dwPx / UNIT_PX, MIN_W, GRID_COLUMNS);
  const h = snapClamp(rect.h + dhPx / UNIT_PX, MIN_H, MAX_SLOT_H);
  return {
    ...rect,
    x: snapClamp(rect.x, 0, GRID_COLUMNS - w),
    w,
    h,
  };
}
