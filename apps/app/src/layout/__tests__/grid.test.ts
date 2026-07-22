// AOD-138 discrete slot algebra: the slot<->pixel mapping, the first-free-slot scan, the grid-cell
// overlap test, and the deterministic reflow. These are the pure helpers the arrange UX (AOD-140),
// placement (AOD-139) and the gallery preview (AOD-147) all build on, so the locks here ARE the
// contract for how cards land and how neighbours move. The headline invariant — overlap is impossible
// after a reflow — is asserted structurally (assertNoOverlap over every pair), not by spot cases.
import type { LayoutRect } from '../../registry/types';
import { UNIT_PX } from '../geometry';
import {
  type Footprint,
  type GridRect,
  cellsOverlap,
  firstFreeSlot,
  nearestFreeSlot,
  pixelsToSlot,
  reflowToColumns,
  slotToPixels,
} from '../grid';

const cell = (x: number, y: number, w: number, h: number): GridRect => ({ x, y, w, h });
const rect = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });

// The four slot footprints (Many Skies §1c).
const S: Footprint = { w: 1, h: 1 };
const M: Footprint = { w: 1, h: 2 };
const W: Footprint = { w: 2, h: 1 };
const L: Footprint = { w: 2, h: 2 };

/** True iff any two cells in the set share a covered grid cell — the property a reflow must kill. */
function anyOverlap(cells: GridRect[]): boolean {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cellsOverlap(cells[i], cells[j])) return true;
    }
  }
  return false;
}

const cellsOf = (rects: LayoutRect[]): GridRect[] => rects.map((r) => cell(r.x, r.y, r.w, r.h));

describe('slotToPixels / pixelsToSlot (consistent with geometry.toPixels)', () => {
  it('maps a slot origin/footprint to pixels at UNIT_PX per unit', () => {
    expect(slotToPixels(cell(1, 2, 2, 1))).toEqual({ left: UNIT_PX, top: 2 * UNIT_PX, width: 2 * UNIT_PX, height: UNIT_PX });
  });

  it('round-trips any on-grid cell (pixelsToSlot ∘ slotToPixels = identity)', () => {
    for (const c of [cell(0, 0, 1, 1), cell(1, 0, 1, 2), cell(0, 3, 2, 1), cell(0, 5, 2, 2)]) {
      expect(pixelsToSlot(slotToPixels(c))).toEqual(c);
    }
  });

  it('rounds an off-grid pixel rect to the nearest whole slot', () => {
    expect(pixelsToSlot({ left: UNIT_PX * 0.6, top: UNIT_PX * 1.4, width: UNIT_PX * 1.9, height: UNIT_PX * 1.1 })).toEqual(
      cell(1, 1, 2, 1),
    );
  });
});

describe('cellsOverlap (half-open grid cells)', () => {
  it('detects a shared cell', () => {
    expect(cellsOverlap(cell(0, 0, 2, 2), cell(1, 1, 1, 1))).toBe(true);
  });

  it('treats edge-adjacent cells (directly right / directly below) as NOT overlapping', () => {
    expect(cellsOverlap(cell(0, 0, 1, 1), cell(1, 0, 1, 1))).toBe(false); // right neighbour
    expect(cellsOverlap(cell(0, 0, 1, 1), cell(0, 1, 1, 1))).toBe(false); // below neighbour
  });

  it('is symmetric', () => {
    expect(cellsOverlap(cell(0, 0, 2, 1), cell(1, 0, 1, 2))).toBe(cellsOverlap(cell(1, 0, 1, 2), cell(0, 0, 2, 1)));
  });
});

describe('firstFreeSlot: reading order on a narrow (2-column) grid — wrapping and stacking', () => {
  // These lock the reading-order packing (row-major, top-to-bottom, left-column-first, wrapping when a row
  // fills) at an EXPLICIT narrow width. `columns` is now a first-class param (AOD-197: GRID_COLUMNS=6
  // landscape / PORTRAIT_COLUMNS=4 portrait); a 2-column grid exercises the wrap crisply, and the
  // landscape/portrait DEFAULTS are locked in the next describe.
  it('places the first card at the origin on an empty grid', () => {
    expect(firstFreeSlot(S, [], 2)).toEqual(cell(0, 0, 1, 1));
    expect(firstFreeSlot(L, [], 2)).toEqual(cell(0, 0, 2, 2));
  });

  it('an S walks col0 -> col1 -> next row as the grid fills', () => {
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1)], 2)).toEqual(cell(1, 0, 1, 1)); // col1, same row
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1), cell(1, 0, 1, 1)], 2)).toEqual(cell(0, 1, 1, 1)); // next row
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1), cell(1, 0, 1, 1), cell(0, 1, 1, 1)], 2)).toEqual(cell(1, 1, 1, 1));
  });

  it('an M (1x2) drops into the first column that has two free rows', () => {
    expect(firstFreeSlot(M, [cell(0, 0, 1, 1)], 2)).toEqual(cell(1, 0, 1, 2)); // col1 spans rows 0-1
    expect(firstFreeSlot(M, [], 2)).toEqual(cell(0, 0, 1, 2));
  });

  it('a W (2x1) only fits in a fully-free row; otherwise it stacks below', () => {
    expect(firstFreeSlot(W, [cell(0, 0, 2, 1)], 2)).toEqual(cell(0, 1, 2, 1)); // below another W
    expect(firstFreeSlot(W, [cell(0, 0, 1, 1)], 2)).toEqual(cell(0, 1, 2, 1)); // a single S blocks the row
  });

  it('an L (2x2) needs the whole 2-col grid, so it appends below any occupant', () => {
    expect(firstFreeSlot(L, [cell(0, 0, 1, 1)], 2)).toEqual(cell(0, 1, 2, 2));
  });

  it('fills an interior hole in reading order before appending', () => {
    // M in col0 (rows 0-1) + S in col1 row0 -> the hole is col1 row1.
    expect(firstFreeSlot(S, [cell(0, 0, 1, 2), cell(1, 0, 1, 1)], 2)).toEqual(cell(1, 1, 1, 1));
  });

  it('a full grid never blocks — it appends at a fresh row below everything (the sky scrolls)', () => {
    // Two stacked full-width rows: no interior gap, next S lands at row 2.
    expect(firstFreeSlot(S, [cell(0, 0, 2, 1), cell(0, 1, 2, 1)], 2)).toEqual(cell(0, 2, 1, 1));
    // An L filling rows 0-1 -> append at row 2.
    expect(firstFreeSlot(S, [cell(0, 0, 2, 2)], 2)).toEqual(cell(0, 2, 1, 1));
  });
});

describe('firstFreeSlot honors the columns param (AOD-197: landscape 6 default / portrait 4)', () => {
  it('defaults to the landscape count (GRID_COLUMNS = 6): S cards fill a wide row before wrapping', () => {
    // No columns arg -> 6. An S beside a single S goes to col1, still row 0; two S at cols 0-1 leave col2
    // free in the SAME row (it does not wrap as it would at 2 columns).
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1)])).toEqual(cell(1, 0, 1, 1));
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1), cell(1, 0, 1, 1)])).toEqual(cell(2, 0, 1, 1)); // col2, row 0
    // Only a full row of six S wraps to row 1.
    const rowOfSix: GridRect[] = [0, 1, 2, 3, 4, 5].map((x) => cell(x, 0, 1, 1));
    expect(firstFreeSlot(S, rowOfSix)).toEqual(cell(0, 1, 1, 1));
    // A W fits BESIDE a single W on the wide row (cols 2-3), no stacking.
    expect(firstFreeSlot(W, [cell(0, 0, 2, 1)])).toEqual(cell(2, 0, 2, 1));
    // An L fits beside a single S on the wide row (cols 1-2), no stacking.
    expect(firstFreeSlot(L, [cell(0, 0, 1, 1)])).toEqual(cell(1, 0, 2, 2));
  });

  it('packs into an explicit portrait grid (columns = 4): wraps after four columns', () => {
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1), cell(1, 0, 1, 1), cell(2, 0, 1, 1)], 4)).toEqual(cell(3, 0, 1, 1));
    const rowOfFour: GridRect[] = [0, 1, 2, 3].map((x) => cell(x, 0, 1, 1));
    expect(firstFreeSlot(S, rowOfFour, 4)).toEqual(cell(0, 1, 1, 1)); // full row of 4 -> wrap to row 1
    // Two W fill a 4-col row (cols 0-1, 2-3); a third W appends below.
    expect(firstFreeSlot(W, [cell(0, 0, 2, 1), cell(2, 0, 2, 1)], 4)).toEqual(cell(0, 1, 2, 1));
  });
});

describe('reflowToColumns (AOD-197 §6.3: derive an orientation by packing reading-order)', () => {
  it('packs a spread-out layout "one next to the other" into the target column count', () => {
    // Three S cards spread across rows repack into the top row of a 6-col grid in reading order (y,x,index),
    // but are RETURNED in input order. Reading order here: (0,0) -> (3,1) -> (0,2).
    const rects = [rect(0, 0, 1, 1, 0), rect(0, 2, 1, 1, 1), rect(3, 1, 1, 1, 2)];
    const out = reflowToColumns(rects, 6);
    expect(out[0]).toMatchObject({ x: 0, y: 0 }); // (0,0): first in reading order -> col0
    expect(out[2]).toMatchObject({ x: 1, y: 0 }); // (3,1): second in reading order -> col1
    expect(out[1]).toMatchObject({ x: 2, y: 0 }); // (0,2): third in reading order -> col2
    expect(anyOverlap(cellsOf(out))).toBe(false);
  });

  it('appends below when a row fills (rows unbounded), preserving each footprint and z', () => {
    // Four W (each 2 wide) into a 4-col grid: two per row -> rows 0 and 1.
    const rects = [rect(0, 5, 2, 1, 3), rect(0, 6, 2, 1, 4), rect(0, 7, 2, 1, 5), rect(0, 8, 2, 1, 6)];
    const out = reflowToColumns(rects, 4);
    expect(out.map((r) => ({ x: r.x, y: r.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ]);
    for (let i = 0; i < rects.length; i++) {
      expect(out[i].w).toBe(2); // footprint rides through untouched
      expect(out[i].h).toBe(1);
      expect(out[i].z).toBe(rects[i].z); // z preserved
    }
    expect(anyOverlap(cellsOf(out))).toBe(false);
  });

  it('is order-preserving (returns input order) and NEVER mutates the input', () => {
    const rects = [rect(2, 3, 1, 1, 0), rect(0, 0, 2, 2, 1)];
    const snapshot = rects.map((r) => ({ ...r }));
    const out = reflowToColumns(rects, 6);
    expect(out).toHaveLength(2);
    expect(out).not.toBe(rects); // a fresh array
    expect(rects).toEqual(snapshot); // input untouched
    // Reading order: the L (0,0) lands at the origin, the S (2,3) packs after it at col2 row0.
    expect(out[1]).toMatchObject({ x: 0, y: 0, w: 2, h: 2 }); // input index 1 = the L
    expect(out[0]).toMatchObject({ x: 2, y: 0, w: 1, h: 1 }); // input index 0 = the S
  });
});

describe("nearestFreeSlot (AOD-197 §8: the place-don't-pack hairline)", () => {
  it('returns the target cell itself when it is free and on-grid (WYSIWYG, no neighbour moves)', () => {
    expect(nearestFreeSlot(S, [], { x: 3, y: 2 })).toEqual(cell(3, 2, 1, 1)); // empty grid: land at the finger
    expect(nearestFreeSlot(S, [cell(0, 0, 1, 1)], { x: 4, y: 0 })).toEqual(cell(4, 0, 1, 1)); // free cell beside an occupant, unchanged
  });

  it('snaps to the NEAREST free fitting cell when the target is occupied (ties by reading order y,x)', () => {
    // Target (0,0) is taken; the nearest fits (1,0) and (0,1) are both distance 1, so reading order (y then
    // x) breaks the tie -> (1,0). No neighbour moves (gaps preserved, unlike reflow's pack).
    expect(nearestFreeSlot(S, [cell(0, 0, 1, 1)], { x: 0, y: 0 })).toEqual(cell(1, 0, 1, 1));
  });

  it('snaps a footprint dropped past the right edge back to the last legal column (nearest on-grid fit)', () => {
    // A W with target x=5 runs off the 6-col grid (5 + 2 > 6); the nearest fitting on-grid origin is col4.
    expect(nearestFreeSlot(W, [], { x: 5, y: 0 })).toEqual(cell(4, 0, 2, 1));
  });

  it('appends below all cards when no interior gap fits (rows unbounded)', () => {
    const fullRow: GridRect[] = [0, 1, 2, 3, 4, 5].map((x) => cell(x, 0, 1, 1)); // row 0 full across 6 cols
    expect(nearestFreeSlot(S, fullRow, { x: 0, y: 0 })).toEqual(cell(0, 1, 1, 1)); // to the fresh row below
  });

  it('honors an explicit portrait column count (columns = 4)', () => {
    // The same off-right-edge W snaps to col2 on a 4-col portrait grid (3 + 2 > 4 -> nearest on-grid fit col2).
    expect(nearestFreeSlot(W, [], { x: 3, y: 0 }, 4)).toEqual(cell(2, 0, 2, 1));
  });
});
