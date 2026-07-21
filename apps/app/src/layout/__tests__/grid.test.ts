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
  pixelsToSlot,
  reflow,
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

describe('firstFreeSlot: reading order = row-major, top-to-bottom, left-column-first', () => {
  it('places the first card at the origin on an empty grid', () => {
    expect(firstFreeSlot(S, [])).toEqual(cell(0, 0, 1, 1));
    expect(firstFreeSlot(L, [])).toEqual(cell(0, 0, 2, 2));
  });

  it('an S walks col0 -> col1 -> next row as the grid fills', () => {
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1)])).toEqual(cell(1, 0, 1, 1)); // col1, same row
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1), cell(1, 0, 1, 1)])).toEqual(cell(0, 1, 1, 1)); // next row
    expect(firstFreeSlot(S, [cell(0, 0, 1, 1), cell(1, 0, 1, 1), cell(0, 1, 1, 1)])).toEqual(cell(1, 1, 1, 1));
  });

  it('an M (1x2) drops into the first column that has two free rows', () => {
    expect(firstFreeSlot(M, [cell(0, 0, 1, 1)])).toEqual(cell(1, 0, 1, 2)); // col1 spans rows 0-1
    expect(firstFreeSlot(M, [])).toEqual(cell(0, 0, 1, 2));
  });

  it('a W (2x1) only fits in a fully-free row; otherwise it stacks below', () => {
    expect(firstFreeSlot(W, [cell(0, 0, 2, 1)])).toEqual(cell(0, 1, 2, 1)); // below another W
    expect(firstFreeSlot(W, [cell(0, 0, 1, 1)])).toEqual(cell(0, 1, 2, 1)); // a single S blocks the row
  });

  it('an L (2x2) needs the whole grid, so it appends below any occupant', () => {
    expect(firstFreeSlot(L, [cell(0, 0, 1, 1)])).toEqual(cell(0, 1, 2, 2));
  });

  it('fills an interior hole in reading order before appending', () => {
    // M in col0 (rows 0-1) + S in col1 row0 -> the hole is col1 row1.
    expect(firstFreeSlot(S, [cell(0, 0, 1, 2), cell(1, 0, 1, 1)])).toEqual(cell(1, 1, 1, 1));
  });

  it('a full grid never blocks — it appends at a fresh row below everything (the sky scrolls)', () => {
    // Two stacked full-width rows: no interior gap, next S lands at row 2.
    expect(firstFreeSlot(S, [cell(0, 0, 2, 1), cell(0, 1, 2, 1)])).toEqual(cell(0, 2, 1, 1));
    // An L filling rows 0-1 -> append at row 2.
    expect(firstFreeSlot(S, [cell(0, 0, 2, 2)])).toEqual(cell(0, 2, 1, 1));
  });
});

describe('reflow: pinned card stays put, neighbours re-pack, overlap becomes impossible', () => {
  it('re-packs the others around a moved pin, in reading order, with no overlap', () => {
    // A(0,0) B(1,0) C(0,1); pick up B and drop it onto A's slot (0,0). Others keep their old rects.
    const rects = [rect(0, 0, 1, 1, 0), rect(0, 0, 1, 1, 1), rect(0, 1, 1, 1, 2)];
    const out = reflow(rects, 1);
    expect(out[1]).toEqual(rect(0, 0, 1, 1, 1)); // pinned unchanged
    expect(anyOverlap(cellsOf(out))).toBe(false);
    expect(out).toHaveLength(3);
  });

  it('clamps a W/L pinned at column 1 back onto the grid before packing (x + w <= 2)', () => {
    // Caller set the pinned card to a full-width footprint anchored at column 1 (off-grid); reflow shifts it left.
    const rects = [rect(1, 0, 2, 1, 5), rect(0, 0, 1, 1, 0)];
    const out = reflow(rects, 0);
    expect(out[0]).toEqual(rect(0, 0, 2, 1, 5)); // clamped col1 -> col0, footprint + z intact
    expect(anyOverlap(cellsOf(out))).toBe(false);
    expect(out[1].y).toBeGreaterThan(0); // the neighbour was pushed below the pinned W
  });

  it('makes overlap impossible even from a fully-overlapping input (every card stacked at the origin)', () => {
    const rects = [rect(0, 0, 1, 1, 0), rect(0, 0, 1, 1, 1), rect(0, 0, 2, 1, 2), rect(0, 0, 1, 2, 3)];
    const out = reflow(rects, 0);
    expect(out[0]).toEqual(rect(0, 0, 1, 1, 0)); // pin held at the origin
    expect(anyOverlap(cellsOf(out))).toBe(false);
  });

  it('is deterministic — repeated reflow is identical and ties resolve by array index, not sort stability', () => {
    // Two 1x1 cards tied at the same origin (0,1); the pin sits at (0,0). The (y,x) sort cannot separate
    // the tie, so the index tiebreak must — deterministically, and NOT by leaning on V8 sort stability.
    const a = rect(0, 1, 1, 1, 5);
    const b = rect(0, 1, 1, 1, 6);
    const pin = rect(0, 0, 1, 1, 9);

    const out1 = reflow([pin, a, b], 0);
    expect(out1).toEqual(reflow([pin, a, b], 0)); // referentially deterministic
    // `a` is earlier in the array, so it packs into the earlier reading-order slot (col1 row0) and `b`
    // into the next (col0 row1). Swapping their array order swaps which slot each card gets.
    expect(out1[1]).toEqual(rect(1, 0, 1, 1, 5)); // a -> (col1, row0)
    expect(out1[2]).toEqual(rect(0, 1, 1, 1, 6)); // b -> (col0, row1)

    const out2 = reflow([pin, b, a], 0);
    expect(out2[1]).toEqual(rect(1, 0, 1, 1, 6)); // now b is earlier -> b takes (col1, row0)
    expect(out2[2]).toEqual(rect(0, 1, 1, 1, 5)); // a -> (col0, row1)
  });

  it('preserves array order, footprint (w/h) and z for every card — only x/y move', () => {
    const rects = [rect(0, 0, 1, 1, 9), rect(0, 0, 1, 2, 4), rect(0, 0, 2, 1, 7)];
    const out = reflow(rects, 1);
    expect(out).toHaveLength(rects.length);
    for (let i = 0; i < rects.length; i++) {
      expect(out[i].w).toBe(rects[i].w);
      expect(out[i].h).toBe(rects[i].h);
      expect(out[i].z).toBe(rects[i].z);
    }
  });

  it('a single-card reflow just clamps the pin onto the grid', () => {
    expect(reflow([rect(1, 0, 2, 1, 0)], 0)).toEqual([rect(0, 0, 2, 1, 0)]);
  });

  it('keeps a neighbour that is already well-placed but compacts a gap in reading order', () => {
    // Pin A at (0,0); B sits far below at row 5 -> it compacts up to the first free reading-order slot.
    const rects = [rect(0, 0, 1, 1, 0), rect(0, 5, 1, 1, 1)];
    const out = reflow(rects, 0);
    expect(out[1]).toEqual(rect(1, 0, 1, 1, 1)); // compacted to col1 row0
    expect(anyOverlap(cellsOf(out))).toBe(false);
  });
});
