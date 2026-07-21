// AOD-7 nominal-unit <-> pixel geometry. These pure functions back both the live gesture preview and
// the committed rect, so testing them is testing the drag/resize math itself.
import {
  applyDrag,
  applyResize,
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

  it('clamps the column so a 2-wide footprint never leaves the two-column grid', () => {
    // A W can only ever sit at column 0 (x + w <= 2), no matter how far right it is dragged.
    expect(snapDrag(r(0, 0, 2, 1), UNIT_PX, 0).x).toBe(0);
    expect(snapDrag(r(0, 0, 2, 1), 5 * UNIT_PX, 0).x).toBe(0);
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

  it('clamps to the minimum extent when shrinking past it, and never exceeds the grid', () => {
    expect(snapResize(r(0, 0, 2, 2), -10 * UNIT_PX, -10 * UNIT_PX)).toMatchObject({ w: MIN_W, h: MIN_H });
    expect(snapResize(r(0, 0, 2, 2), 10 * UNIT_PX, 10 * UNIT_PX)).toMatchObject({ w: 2, h: 2 });
  });

  it('shifts the column left when a card grows to full width at column 1 (x + w <= 2)', () => {
    expect(snapResize(r(1, 0, 1, 1), UNIT_PX, 0)).toMatchObject({ x: 0, w: 2 });
  });

  it('keeps the column when the grown footprint still fits', () => {
    expect(snapResize(r(1, 0, 1, 1), 0, UNIT_PX)).toMatchObject({ x: 1, w: 1, h: 2 }); // M stays in col1
  });

  it('preserves y and z', () => {
    expect(snapResize(r(1, 3, 1, 1, 4), 0, 0)).toMatchObject({ y: 3, z: 4 });
  });
});
