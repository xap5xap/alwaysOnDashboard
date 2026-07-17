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
    // (Expressed via UNIT_PX so the lock tracks the unit size: ~1.055 at the pre-AOD-122 80 DP, ~0.879 at 96 DP.
    // The fit-to-bounds property — fills the width, fits the height — is unit-size-invariant.)
    expect(s).toBeCloseTo(962 / (11.4 * UNIT_PX), 5);
    expect(content.w * UNIT_PX * s).toBeCloseTo(962, 3); // fills the width
    expect(content.h * UNIT_PX * s).toBeLessThanOrEqual(601 + 1e-6); // and fits within the height
  });

  it('the OLD fixed 1.4x would have clipped that same card (why the fix was needed)', () => {
    const content = layoutBounds([rect(0.15, 0.1, 11.25, 6.8)]);
    // 1276 DP at the old 80-DP unit, 1532 DP at the AOD-122 96-DP unit: > 962 DP screen either way -> clipped.
    expect(content.w * UNIT_PX * 1.4).toBeGreaterThan(962);
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
    // 20x10u = 1920x960 DP at the AOD-122 96-DP unit (was 1600x800 at 80) — bigger than the screen either way.
    const s = wallFitScale(layoutBounds([rect(0, 0, 20, 10)]), FIRE_HD8);
    expect(s).toBeLessThan(1);
    expect(s).toBeCloseTo(Math.min(962 / (20 * UNIT_PX), 601 / (10 * UNIT_PX)), 6);
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

  it('the AOD-122 slot-grid wall on the Fire HD 8 (96-DP units): seed and full-sky fits', () => {
    // The first-run seed (one W Clock, 2x1u = 192x96 DP): width-constrained, scale ~5.01.
    const seed = wallFitScale(layoutBounds([rect(0, 0, 2, 1)]), FIRE_HD8);
    expect(seed).toBeCloseTo(962 / (2 * UNIT_PX), 6);
    // A full 2-col x 3-row sky (192x288 DP): height-constrained, scale ~2.09. Auto-fit keeps the whole
    // slot grid on-screen at 96 DP exactly as it did at 80 — the fit property is unit-size-invariant.
    const sky = wallFitScale(
      layoutBounds([rect(0, 0, 2, 1), rect(0, 1, 1, 2), rect(1, 1, 1, 1), rect(1, 2, 1, 1)]),
      FIRE_HD8,
    );
    expect(sky).toBeCloseTo(601 / (3 * UNIT_PX), 6);
  });
});
