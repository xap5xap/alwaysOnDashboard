// AOD-7 nominal-unit <-> pixel geometry. These pure functions back both the live gesture preview and
// the committed rect, so testing them is testing the drag/resize math itself.
import {
  applyDrag,
  applyResize,
  cellPxFor,
  GRID_GUTTER,
  GRID_MARGIN,
  MIN_H,
  MIN_W,
  snapDrag,
  snapResize,
  snapUnit,
  toPixels,
  UNIT_PX,
} from '../geometry';
import type { LayoutRect } from '../../registry/types';

const rect = { x: 1, y: 1, w: 2, h: 1, z: 0 };

const r = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });

describe('toPixels', () => {
  it('scales nominal units by UNIT_PX (96 DP per unit, the AOD-122 Many Skies 96px row)', () => {
    expect(toPixels(rect)).toEqual({ left: 96, top: 96, width: 192, height: 96 });
  });
});

describe('applyDrag', () => {
  it('moves exactly one unit per UNIT_PX of pixel translation', () => {
    expect(applyDrag(rect, UNIT_PX, 0)).toMatchObject({ x: 2, y: 1 });
    expect(applyDrag(rect, 0, UNIT_PX)).toMatchObject({ x: 1, y: 2 });
  });

  it('clamps the origin into the canvas (x,y never negative)', () => {
    expect(applyDrag({ ...rect, x: 0, y: 0 }, -UNIT_PX * 5, -UNIT_PX * 5)).toMatchObject({ x: 0, y: 0 });
  });

  it('preserves w/h/z', () => {
    const moved = applyDrag(rect, UNIT_PX, UNIT_PX);
    expect(moved).toMatchObject({ w: 2, h: 1, z: 0 });
  });

  it('snaps fractional pixel deltas to hundredths of a unit', () => {
    // 24px at UNIT_PX 96 = 0.25 units exactly (was 12px at 80 = 0.15 pre-AOD-122)
    expect(applyDrag({ x: 0, y: 0, w: 1, h: 1, z: 0 }, 24, 0).x).toBe(0.25);
    // 12px at 96 = 0.125 -> snapUnit rounds to hundredths: 0.13
    expect(applyDrag({ x: 0, y: 0, w: 1, h: 1, z: 0 }, 12, 0).x).toBe(0.13);
  });
});

describe('applyResize', () => {
  it('grows w/h by the pixel delta in units', () => {
    expect(applyResize(rect, UNIT_PX, UNIT_PX)).toMatchObject({ w: 3, h: 2 });
  });

  it('enforces the minimum extent', () => {
    expect(applyResize(rect, -UNIT_PX * 10, -UNIT_PX * 10)).toMatchObject({ w: MIN_W, h: MIN_H });
  });

  it('preserves x/y/z', () => {
    expect(applyResize(rect, UNIT_PX, 0)).toMatchObject({ x: 1, y: 1, z: 0 });
  });
});

describe('snapUnit', () => {
  it('rounds to hundredths, killing float drift', () => {
    expect(snapUnit(0.1 + 0.2)).toBe(0.3);
    expect(snapUnit(1.2345)).toBe(1.23);
  });
});

describe('snapDrag (AOD-138 discrete move — origin snaps to a slot)', () => {
  it('moves one slot per UNIT_PX and lands on integer column/row', () => {
    expect(snapDrag(r(0, 0, 1, 1), UNIT_PX, 0)).toMatchObject({ x: 1, y: 0 });
    expect(snapDrag(r(0, 0, 1, 1), 0, UNIT_PX)).toMatchObject({ x: 0, y: 1 });
  });

  it('rounds a sub-slot drag to the nearest slot', () => {
    expect(snapDrag(r(0, 0, 1, 1), 0.4 * UNIT_PX, 0).x).toBe(0); // round(0.4) = 0
    expect(snapDrag(r(0, 0, 1, 1), 0.6 * UNIT_PX, 0).x).toBe(1); // round(0.6) = 1
  });

  it('clamps the column so a 2-wide footprint stays within the landscape grid (x + w <= GRID_COLUMNS)', () => {
    // On the 6-column landscape grid a W spans columns 0..4 (x + 2 <= 6); a one-column drag lands it at
    // col1, and dragging far right pins it to the last legal column (4), not to 0 as on the old 2-col grid.
    expect(snapDrag(r(0, 0, 2, 1), UNIT_PX, 0).x).toBe(1);
    expect(snapDrag(r(0, 0, 2, 1), 5 * UNIT_PX, 0).x).toBe(4); // last legal column for a 2-wide footprint
    expect(snapDrag(r(0, 0, 2, 1), 10 * UNIT_PX, 0).x).toBe(4); // dragged past the edge -> still clamped to 4
  });

  it('floors the row at 0 (rows are unbounded downward but never negative)', () => {
    expect(snapDrag(r(0, 2, 1, 1), 0, -10 * UNIT_PX).y).toBe(0);
  });

  it('legalises a carried-over continuous footprint onto the slot ladder', () => {
    expect(snapDrag(r(0, 0, 2.3, 1.4), 0, 0)).toMatchObject({ x: 0, y: 0, w: 2, h: 1 });
    expect(snapDrag(r(0, 0, 0.2, 0.2), 0, 0)).toMatchObject({ w: 1, h: 1 });
  });

  it('preserves z', () => {
    expect(snapDrag(r(0, 0, 1, 1, 7), UNIT_PX, UNIT_PX).z).toBe(7);
  });
});

describe('snapResize (AOD-138 discrete resize — extents snap to S/M/W/L)', () => {
  it('snaps each extent to the nearest {1,2} step (what you drag is what you get)', () => {
    expect(snapResize(r(0, 0, 1, 1), UNIT_PX, UNIT_PX)).toMatchObject({ w: 2, h: 2 }); // S -> L
    expect(snapResize(r(0, 0, 1, 1), 0.4 * UNIT_PX, 0.6 * UNIT_PX)).toMatchObject({ w: 1, h: 2 }); // -> M
  });

  it('clamps to the minimum extent when shrinking, and never exceeds the footprint ceiling (2x2, not the 6-col width)', () => {
    expect(snapResize(r(0, 0, 2, 2), -10 * UNIT_PX, -10 * UNIT_PX)).toMatchObject({ w: MIN_W, h: MIN_H });
    // A huge grow caps the footprint WIDTH at MAX_SLOT_W (2), never the wider GRID_COLUMNS (6).
    expect(snapResize(r(0, 0, 2, 2), 10 * UNIT_PX, 10 * UNIT_PX)).toMatchObject({ w: 2, h: 2 });
  });

  it('shifts the column left when a footprint grown near the right edge would leave the grid (x + w <= GRID_COLUMNS)', () => {
    // A card at the last column (5) grown to a W would run off the 6-col grid (5 + 2 > 6) -> it shifts left
    // to the last legal column (4). A W grown at col1 now FITS the wide grid, so it keeps col1 (no shift).
    expect(snapResize(r(5, 0, 1, 1), UNIT_PX, 0)).toMatchObject({ x: 4, w: 2 });
    expect(snapResize(r(1, 0, 1, 1), UNIT_PX, 0)).toMatchObject({ x: 1, w: 2 });
  });

  it('keeps the column when the grown footprint still fits', () => {
    expect(snapResize(r(1, 0, 1, 1), 0, UNIT_PX)).toMatchObject({ x: 1, w: 1, h: 2 }); // M stays in col1
  });

  it('preserves y and z', () => {
    expect(snapResize(r(1, 3, 1, 1, 4), 0, 0)).toMatchObject({ y: 3, z: 4 });
  });
});

describe('snapDrag / snapResize honor the AOD-197 (S4) cellPx + columns params', () => {
  it('snapDrag converts finger px by the given unit (the on-screen cellPx), not the nominal UNIT_PX', () => {
    // 96 px is one slot at the nominal UNIT_PX (96); at a fit-to-width cellPx of 48 the same finger travel is
    // TWO slots. This is why the handheld drag divides by cellPx, not UNIT_PX (the parent scale sizes the card).
    expect(snapDrag(r(0, 0, 1, 1), 96, 0).x).toBe(1); // default UNIT_PX
    expect(snapDrag(r(0, 0, 1, 1), 96, 0, 48).x).toBe(2); // cellPx = 48 -> 96/48 = 2 units
  });

  it('snapDrag clamps the column against the given `columns` (portrait 4 vs landscape 6)', () => {
    // A W dragged far right pins to the last legal column: col 2 on a 4-col grid (x + 2 <= 4), col 4 on 6 cols.
    expect(snapDrag(r(0, 0, 2, 1), 100 * UNIT_PX, 0, UNIT_PX, 4).x).toBe(2);
    expect(snapDrag(r(0, 0, 2, 1), 100 * UNIT_PX, 0, UNIT_PX, 6).x).toBe(4);
  });

  it('snapResize converts by cellPx and clamps the origin column by `columns`', () => {
    expect(snapResize(r(0, 0, 1, 1), 48, 0, 48).w).toBe(2); // +48px at cellPx 48 = +1 unit -> S 1x1 -> W 2x1
    // A W grown at col 3 shifts left to stay on-grid: col 2 on 4 cols, col 3 on 6 cols.
    expect(snapResize(r(3, 0, 1, 1), UNIT_PX, 0, UNIT_PX, 4)).toMatchObject({ x: 2, w: 2 });
    expect(snapResize(r(3, 0, 1, 1), UNIT_PX, 0, UNIT_PX, 6)).toMatchObject({ x: 3, w: 2 });
  });
});

describe('cellPxFor (AOD-197 fit-to-width placement scale, design §4)', () => {
  it('divides the usable width evenly across the columns: (viewportW - 2*margin - (C-1)*gutter) / C', () => {
    // 6 landscape columns on a 960 DP canvas with the default 24 DP margin + 24 DP gutter:
    // (960 - 2*24 - 5*24) / 6 = (960 - 48 - 120) / 6 = 792 / 6 = 132.
    expect(cellPxFor(6, 960)).toBe(132);
    // 4 portrait columns on the same canvas: (960 - 48 - 3*24) / 4 = (960 - 48 - 72) / 4 = 840 / 4 = 210,
    // so a portrait cell is wider than a landscape cell on the same device (fewer, fatter columns).
    expect(cellPxFor(4, 960)).toBe(210);
    expect(cellPxFor(4, 960)).toBeGreaterThan(cellPxFor(6, 960));
  });

  it('honors explicit margin + gutter overrides (tunable per orientation)', () => {
    // No margin, no gutter: the whole width splits evenly across the columns.
    expect(cellPxFor(6, 600, 0, 0)).toBe(100);
    // (400 - 2*10 - 1*20) / 2 = (400 - 20 - 20) / 2 = 360 / 2 = 180.
    expect(cellPxFor(2, 400, 10, 20)).toBe(180);
  });

  it('is additive: it never touches UNIT_PX (the nominal render unit stays 96)', () => {
    // cellPx is a separate placement scale; UNIT_PX + the default margin/gutter are load-bearing constants.
    expect(UNIT_PX).toBe(96);
    expect(GRID_MARGIN).toBe(24);
    expect(GRID_GUTTER).toBe(24);
  });
});
