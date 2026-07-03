// The wall viewport contract, as ONE pure helper (AOD-81; design-wall-viewport-contract.md §3, §9 add. 2).
// The kiosk wall mounts the canvas, pads it by the live insets, scales it uniformly by wall.typeScale from
// the top-left, and clips at the field edge (KioskWall.tsx). That shipped render path IMPLIES a fixed,
// computable window of the canvas; this module states it once so the arrange-mode boundary box (§5) and the
// wall preview (§6) can derive the IDENTICAL window the wall shows. Pure + I/O-free (it takes the screen +
// steady insets + the type-scale token as inputs), so the §3 table is unit-testable without a device. It is
// engine-adjacent constant math, NOT a style token (design §9: `UNIT_PX` lives in geometry.ts for the same
// reason). The shipped wall transform already implies this window, so the wall is not required to call it.
import { UNIT_PX } from '../layout/geometry';

export interface ScreenSize {
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The wall-visible region of the canvas, in nominal layout units (§3). */
export interface ViewportUnits {
  w: number;
  h: number;
}

/** No insets: the Android/Fire wall steady state under immersive chrome (§7 — unistyles dispatches zeroed
 *  insets on hide, so the usable region is the full physical screen). The boundary box computes the wall
 *  window from THIS, never the editor's live insets (§5). A non-immersive wall steady state (an iOS home
 *  indicator, the web preview) would pass its own nonzero insets to the same helper (§7, a named seam). */
export const WALL_STEADY_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * §3 the viewport formula: visibleUnits = (screen dp - steady insets) / (typeScale x UNIT_PX), per axis.
 * The single source of truth the boundary box and the wall preview both derive from. Anchored at the canvas
 * origin (0,0); the clip at the boundary is the wall's overflow:hidden (§3). Returns the RAW floats (no
 * rounding); the tag chip rounds to one decimal for display (`wallTagLabel`).
 */
export function wallViewportUnits(
  screen: ScreenSize,
  steadyInsets: Insets,
  typeScale: number,
): ViewportUnits {
  const denom = typeScale * UNIT_PX;
  return {
    w: (screen.width - steadyInsets.left - steadyInsets.right) / denom,
    h: (screen.height - steadyInsets.top - steadyInsets.bottom) / denom,
  };
}

/** Normalize a device screen to the wall's LANDSCAPE orientation (§5): the wall is landscape-locked
 *  (kiosk-mode §7), so the long edge is always the width. The boundary box passes the editor device's screen
 *  through this so the window always reflects the wall's landscape steady state, wherever the editor is turned. */
export function landscapeScreen(screen: ScreenSize): ScreenSize {
  return {
    width: Math.max(screen.width, screen.height),
    height: Math.min(screen.width, screen.height),
  };
}

/** The boundary-box tag label, one decimal (§5): "WALL · 11.4 x 7.1". The single place the display rounding
 *  lives, so the tag is the §3 window rounded consistently. */
export function wallTagLabel(units: ViewportUnits): string {
  return `WALL · ${units.w.toFixed(1)} x ${units.h.toFixed(1)}`;
}
