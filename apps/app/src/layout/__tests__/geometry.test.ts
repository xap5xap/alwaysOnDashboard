// AOD-7 nominal-unit <-> pixel geometry. These pure functions back both the live gesture preview and
// the committed rect, so testing them is testing the drag/resize math itself.
import {
  cellPxFor,
  GRID_GUTTER,
  GRID_MARGIN,
  nominalGutter,
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

  it('one slot step is the PITCH (cellPx + gutter) once AOD-198 gutters exist, passed as the unit', () => {
    // With gutters the on-screen distance between adjacent slot origins is cellPx + gutter (the "pitch"): a
    // 132 px cell + a 24 px gutter is a 156 px step. PlacedInstance passes THAT pitch as snapDrag's unit, so a
    // finger travel of one pitch lands exactly one column over and a travel under half a pitch rounds back.
    expect(snapDrag(r(0, 0, 1, 1), 156, 0, 156).x).toBe(1); // one pitch -> one column
    expect(snapDrag(r(0, 0, 1, 1), 312, 0, 156).x).toBe(2); // two pitches -> two columns
    expect(snapDrag(r(0, 0, 1, 1), 70, 0, 156).x).toBe(0); // 70/156 = 0.45 rounds back to the origin
  });
});

describe('nominalGutter (AOD-198 handheld inter-cell gutter, design §4)', () => {
  it('is the nominal length that lands as gutterPx on screen once the cellPx/UNIT_PX scale is applied', () => {
    // The handheld canvas renders the nominal UNIT_PX grid then scales it by cellPx/UNIT_PX. To show a 24 px
    // gap between cells, the NOMINAL gutter must be 24 * UNIT_PX / cellPx so it scales back down to 24 px.
    expect(nominalGutter(24, 48)).toBe(48); // half scale -> the nominal gutter is double the screen gutter
    expect(nominalGutter(24, UNIT_PX)).toBe(24); // no fit scale -> nominal == screen
    expect(nominalGutter(24, 192)).toBe(12); // a bigger cell (bigger device) -> a smaller nominal gutter
  });

  it('round-trips: scaled by cellPx/UNIT_PX, the nominal gutter is exactly gutterPx on screen', () => {
    const cellPx = 132;
    const gutterPx = 24;
    expect(nominalGutter(gutterPx, cellPx) * (cellPx / UNIT_PX)).toBeCloseTo(gutterPx);
  });

  it('is 0 (edge-to-edge, byte-identical) when there is no gutter, and defaults cellPx to UNIT_PX', () => {
    expect(nominalGutter(0, 48)).toBe(0); // the wall + any no-gutter caller stays edge-to-edge
    expect(nominalGutter(0)).toBe(0);
    expect(nominalGutter(24)).toBe(24); // default cellPx = UNIT_PX (no fit scale)
    expect(nominalGutter(-5, 48)).toBe(0); // guards a nonsensical negative gutter
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
