// The wall AUTO-FIT scale (AOD-81, revised 2026-07-03 from dogfood). The wall no longer renders at a fixed
// 1.4x (which clipped any layout wider than the device's real usable width — and that width is much smaller
// than the AOD-80 contract assumed, because rt.screen is in DENSITY-INDEPENDENT PIXELS: the Fire HD 8 is
// 1280x800 physical at density 1.33, so the app sees 962x601 DP, and 1.4x showed only ~8.6u wide, clipping
// an 11.25u card). Instead the wall computes the largest uniform scale that fits the WHOLE arranged layout
// inside the device screen, so the dashboard fills the screen and nothing is clipped, on ANY device or
// resolution. Because rt.screen and UNIT_PX are both in DP, this is density-correct by construction.
//
// Pure + I/O-free (screen + content are inputs), so the fit is unit-tested without a device. The wall and
// the wall preview both derive their scale from this ONE helper, so the preview stays pixel-honest.
import type { LayoutRect } from '../registry/types';
import { UNIT_PX } from '../layout/geometry';

export interface Size {
  width: number;
  height: number;
}

/** The arranged layout's content extent in nominal units: the smallest box anchored at the canvas origin
 *  (0,0) that covers every instance, i.e. { max(x+w), max(y+h) }. An empty layout is {w:0,h:0}. Pure. */
export function layoutBounds(rects: LayoutRect[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const r of rects) {
    w = Math.max(w, r.x + r.w);
    h = Math.max(h, r.y + r.h);
  }
  return { w, h };
}

/**
 * The wall's fit-to-bounds scale: the largest uniform scale at which the content (in nominal units) fits
 * inside the screen (in DP) on BOTH axes, so the whole dashboard shows and nothing is clipped. Anchored at
 * the canvas origin (top-left). `screen` is rt.screen (DP), so the result is density-independent — the same
 * layout fills a Fire HD 8, a Fire HD 10, or a phone, each at its own scale. Empty content -> 1 (nothing to
 * fit). Pure; the wall and the preview both call it so their scale is identical.
 */
export function wallFitScale(content: { w: number; h: number }, screen: Size): number {
  const contentW = content.w * UNIT_PX;
  const contentH = content.h * UNIT_PX;
  if (contentW <= 0 || contentH <= 0) return 1;
  return Math.min(screen.width / contentW, screen.height / contentH);
}
