// The discrete 2-column / 96px-row SLOT algebra for the arrange canvas (AOD-138, the geometry side of
// RB-04). geometry.ts is the CONTINUOUS px bridge; this module is the DISCRETE slot model layered on
// top. It answers the two questions the arrange UX asks — "where does a footprint land" (first-free)
// and "how do the neighbours move so nothing overlaps" (reflow) — plus the slot<->pixel mapping the
// hairline slot and the gallery preview draw from. Pure and I/O-free, and registry-free (no per-service
// knowledge): the shared engine that AOD-140 (gestures), AOD-139 (placement) and AOD-147 (gallery
// preview) all consume.
//
// Grid law (Many Skies §1c/§1d, orchestrator-locked on AOD-138):
//   - LayoutRect maps x = column, y = row; the grid is GRID_COLUMNS (2) wide and UNBOUNDED downward
//     (the sky scrolls) — rows are never capped, a full grid appends below rather than blocking.
//   - Reading order is row-major, top-to-bottom, LEFT-COLUMN-FIRST: slot (r,0) precedes (r,1) precedes
//     (r+1,0). Both firstFreeSlot and reflow walk this order, so placement is deterministic.
//   - Overlap is IMPOSSIBLE after a reflow — the whole point of this issue (the read path still tolerates
//     overlap via z, widgets/sizes.ts, but the arrange path no longer produces it).
import type { LayoutRect } from '../registry/types';
import { GRID_COLUMNS } from '../widgets/sizes';
import { type PixelRect, UNIT_PX, toPixels } from './geometry';

/** A discrete grid footprint: how many columns/rows a card spans. On the slot grid w,h are in {1,2}. */
export interface Footprint {
  w: number;
  h: number;
}

/**
 * The grid-cell rectangle a card occupies: x = column origin, y = row origin, w/h = span. The discrete
 * face of LayoutRect (a LayoutRect is a GridRect plus a z). All slot algebra speaks GridRect so it stays
 * free of stacking concerns; callers zip z back on themselves (reflow does, preserving each rect's z).
 */
export type GridRect = Pick<LayoutRect, 'x' | 'y' | 'w' | 'h'>;

/** The pixel rect for a grid cell, byte-for-byte consistent with geometry.toPixels (z is irrelevant to
 *  pixels, so it is filled with 0). The slot-native entry point the gallery preview (AOD-147) and the
 *  arrange hairline slot draw from. */
export function slotToPixels(cell: GridRect): PixelRect {
  return toPixels({ ...cell, z: 0 });
}

/** The grid cell a pixel rect resolves to (the inverse of slotToPixels): divide each edge by UNIT_PX
 *  and round to the nearest whole slot. Round-trips slotToPixels exactly for any on-grid cell. */
export function pixelsToSlot(px: PixelRect): GridRect {
  return {
    x: Math.round(px.left / UNIT_PX),
    y: Math.round(px.top / UNIT_PX),
    w: Math.round(px.width / UNIT_PX),
    h: Math.round(px.height / UNIT_PX),
  };
}

/** Do two grid cells share any covered cell? Half-open intervals [x, x+w) x [y, y+h), so a card placed
 *  directly to the right of or directly below another is edge-ADJACENT, not overlapping. */
export function cellsOverlap(a: GridRect, b: GridRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * The first slot (reading order) where `footprint` fits with no overlap against `occupied`. A footprint
 * (w,h) fits at (row r, col c) iff `c + w <= GRID_COLUMNS` AND every covered cell (rows r..r+h-1, cols
 * c..c+w-1) is free of every occupied rect. The scan walks rows from 0 and, within a row, column 0 then
 * column 1, returning the earliest fit. When no interior gap fits (the grid is "full" in its existing
 * rows), it APPENDS at a fresh row equal to the deepest occupied bottom — below everything — so a full
 * grid never blocks; the sky grows downward. Returns the slot as a GridRect (origin + the footprint).
 */
export function firstFreeSlot(footprint: Footprint, occupied: GridRect[]): GridRect {
  const { w, h } = footprint;
  // The deepest occupied row edge; any interior gap must live within [0, bottom). Below it we append.
  const bottom = occupied.reduce((deepest, cell) => Math.max(deepest, cell.y + cell.h), 0);
  for (let row = 0; row < bottom; row++) {
    for (let col = 0; col + w <= GRID_COLUMNS; col++) {
      const candidate: GridRect = { x: col, y: row, w, h };
      if (!occupied.some((cell) => cellsOverlap(candidate, cell))) {
        return candidate;
      }
    }
  }
  // No interior gap: append below all occupied rows, left column first (the sky scrolls).
  return { x: 0, y: bottom, w, h };
}

/**
 * Deterministic reflow after a move or resize. `rects[pinnedIndex]` is the actively moved/resized card
 * at its TARGET slot+footprint; it stays PUT (only its column is clamped so `x + w <= GRID_COLUMNS`, and
 * its row floored at 0 — a W/L dropped at column 1 shifts left rather than hanging off the grid). Every
 * OTHER rect is re-packed in its CURRENT reading-order sequence (sorted by (y, x)) via firstFreeSlot
 * around the pinned card and the others already placed this pass, so overlap becomes IMPOSSIBLE. Each
 * card's identity (array position), footprint (w/h) and z pass through unchanged — only x/y move. The
 * result is returned in the INPUT order (so a caller can zip it straight back onto its instances).
 *
 * Precondition: every rect is already slot-discrete (integer x/y, w/h in {1,2}) — the read boundary
 * (coerceToSlotGrid) guarantees this, and the snap helpers (geometry.snapDrag/snapResize) produce it.
 * Reflow is a pure algebra over an already-legal grid; it does not re-snap fractional input.
 */
export function reflow(rects: LayoutRect[], pinnedIndex: number): LayoutRect[] {
  const result = rects.slice();

  // Pin: keep the moved/resized card's footprint and z; clamp only its origin onto the grid.
  const src = rects[pinnedIndex];
  const pinned: LayoutRect = {
    ...src,
    x: clampColumn(src.x, src.w),
    y: Math.max(0, src.y),
  };
  result[pinnedIndex] = pinned;

  // Everyone else, in their current reading order (row-major, left column first). The `index` tiebreak
  // makes the order total and the whole pass deterministic regardless of the engine's sort stability.
  const others = rects
    .map((rect, index) => ({ rect, index }))
    .filter((entry) => entry.index !== pinnedIndex)
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x || a.index - b.index);

  const occupied: GridRect[] = [cellOf(pinned)];
  for (const { rect, index } of others) {
    const slot = firstFreeSlot({ w: rect.w, h: rect.h }, occupied);
    const placed: LayoutRect = { ...rect, x: slot.x, y: slot.y };
    result[index] = placed;
    occupied.push(cellOf(placed));
  }
  return result;
}

// --- internals -----------------------------------------------------------------------------------

/** The grid cell (drop z) of a rect. */
function cellOf(rect: LayoutRect): GridRect {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

/** Clamp a column origin so a `w`-wide footprint stays inside the two columns: x in [0, GRID_COLUMNS-w]. */
function clampColumn(x: number, w: number): number {
  return Math.max(0, Math.min(x, GRID_COLUMNS - w));
}
