// AOD-7 nominal-unit <-> pixel geometry. These pure functions back both the live gesture preview and
// the committed rect, so testing them is testing the drag/resize math itself.
import { applyDrag, applyResize, MIN_H, MIN_W, snapUnit, toPixels, UNIT_PX } from '../geometry';

const rect = { x: 1, y: 1, w: 2, h: 1, z: 0 };

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
