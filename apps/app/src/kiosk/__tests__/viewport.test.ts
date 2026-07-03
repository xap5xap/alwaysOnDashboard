// AOD-81 (revised) the wall AUTO-FIT scale. The wall fits the whole arranged layout to the device screen so
// nothing is ever clipped, on any device. These pin the fit math and the density-correctness that the fixed
// 1.4x approach got wrong (rt.screen is in DP, so a 1280x800-physical / density-1.33 Fire HD 8 is 962x601 DP).
import { UNIT_PX } from '../../layout/geometry';
import type { LayoutRect } from '../../registry/types';
import { layoutBounds, wallFitScale } from '../viewport';

const rect = (x: number, y: number, w: number, h: number): LayoutRect => ({ x, y, w, h, z: 0 });

// The Fire HD 8 as the app actually sees it: 1280x800 physical / 1.33 density = 962x601 DP.
const FIRE_HD8: { width: number; height: number } = { width: 962, height: 601 };

describe('layoutBounds: the arranged content extent (max x+w, max y+h)', () => {
  it('covers a single origin-offset card', () => {
    const b = layoutBounds([rect(0.15, 0.1, 11.25, 6.8)]);
    expect(b.w).toBeCloseTo(11.4, 6); // 0.15 + 11.25
    expect(b.h).toBeCloseTo(6.9, 6); // 0.1 + 6.8 (raw float, not snapped)
  });
  it('covers the farthest edge across several cards', () => {
    expect(layoutBounds([rect(0, 0, 2, 1), rect(3, 2, 4, 1)])).toEqual({ w: 7, h: 3 });
  });
  it('an empty layout has zero extent', () => {
    expect(layoutBounds([])).toEqual({ w: 0, h: 0 });
  });
});

describe('wallFitScale: fit the whole layout to the screen, never clip', () => {
  it("the AOD-78 My Issues card FILLS the Fire HD 8 width and is NOT clipped (the dogfood fix)", () => {
    const content = layoutBounds([rect(0.15, 0.1, 11.25, 6.8)]); // 11.40 x 6.90u
    const s = wallFitScale(content, FIRE_HD8);
    // width-constrained here, so the scale is the width ratio and the content exactly fills the screen width.
    expect(s).toBeCloseTo(962 / (11.4 * UNIT_PX), 5); // ~1.055
    expect(content.w * UNIT_PX * s).toBeCloseTo(962, 3); // fills the width
    expect(content.h * UNIT_PX * s).toBeLessThanOrEqual(601 + 1e-6); // and fits within the height
  });

  it('the OLD fixed 1.4x would have clipped that same card (why the fix was needed)', () => {
    const content = layoutBounds([rect(0.15, 0.1, 11.25, 6.8)]);
    expect(content.w * UNIT_PX * 1.4).toBeGreaterThan(962); // 1276 DP > 962 DP screen -> clipped on the right
    expect(wallFitScale(content, FIRE_HD8)).toBeLessThan(1.4); // the fit stays inside the screen
  });

  it('never clips: content x scale fits within the screen on both axes', () => {
    for (const content of [layoutBounds([rect(0, 0, 11.25, 6.8)]), layoutBounds([rect(0, 0, 20, 10)]), layoutBounds([rect(0, 0, 3, 2)])]) {
      const s = wallFitScale(content, FIRE_HD8);
      expect(content.w * UNIT_PX * s).toBeLessThanOrEqual(962 + 1e-6);
      expect(content.h * UNIT_PX * s).toBeLessThanOrEqual(601 + 1e-6);
    }
  });

  it('shrinks a layout larger than the screen (scale < 1)', () => {
    const s = wallFitScale(layoutBounds([rect(0, 0, 20, 10)]), FIRE_HD8); // 1600x800 DP > screen
    expect(s).toBeLessThan(1);
    expect(s).toBeCloseTo(Math.min(962 / 1600, 601 / 800), 6);
  });

  it('is density-independent: the same layout fits a bigger DP screen at a bigger scale', () => {
    const content = layoutBounds([rect(0.15, 0.1, 11.25, 6.8)]);
    const hd10 = { width: 1371, height: 857 }; // a larger-DP display
    const s8 = wallFitScale(content, FIRE_HD8);
    const s10 = wallFitScale(content, hd10);
    expect(s10).toBeGreaterThan(s8);
    expect(content.w * UNIT_PX * s10).toBeLessThanOrEqual(1371 + 1e-6); // still fits, still unclipped
  });

  it('empty content -> scale 1 (nothing to fit)', () => {
    expect(wallFitScale({ w: 0, h: 0 }, FIRE_HD8)).toBe(1);
  });
});
