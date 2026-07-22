// AOD-7 nominal-unit <-> pixel geometry. These pure functions back both the live gesture preview and
// the committed rect, so testing them is testing the drag/resize math itself.
import {
  cellPxFor,
  GRID_GUTTER,
  GRID_MARGIN,
  snapDrag,
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

describe('snapDrag honors the AOD-197 (S4) cellPx + columns params', () => {
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
