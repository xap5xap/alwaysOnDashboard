// The bridge between the authoritative nominal-unit LayoutRect (AOD-8 §7, widget-model §5.1) and
// on-screen pixels. widget-model §5.1 leaves the concrete coordinate space to AOD-7; this settles it:
// rects are stored in nominal layout units and rendered at UNIT_PX pixels per unit. Keeping geometry in
// nominal units makes a persisted layout device-independent (author on web, reload on the Fire HD 8)
// and keeps reconcileSize's area term (AOD-10 §5.2) meaningful, which pixel-sized rects would saturate.
// Pure and I/O-free; these functions back both the live gesture preview and the committed value.
import type { LayoutRect } from '../registry/types';

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
