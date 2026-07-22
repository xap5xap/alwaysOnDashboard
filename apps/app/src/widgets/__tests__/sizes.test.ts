// The AOD-122 S/M/W/L slot catalogue: reconcileSize (the AOD-10 §5.2 rule over the new catalogue) and
// coerceToSlotGrid (the read-time coercion that resolves every persisted legacy rect onto the slot
// grid). The coercion cases below ARE the legacy migration table — there is no write-time migration,
// so these locks are the contract for how pre-slot rows render.
import type { LayoutRect } from '../../registry/types';
import {
  GRID_COLUMNS,
  MAX_SLOT_H,
  MAX_SLOT_W,
  PORTRAIT_COLUMNS,
  SIZE_CATALOGUE,
  coerceToSlotGrid,
  reconcileSize,
} from '../sizes';

const rect = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });

describe('SIZE_CATALOGUE (AOD-122, Many Skies §1c) + the AOD-197 responsive grid shape', () => {
  it('is exactly the four-slot contract: S 1x1 / M 1x2 / W 2x1 / L 2x2', () => {
    expect(Object.keys(SIZE_CATALOGUE).sort()).toEqual(['L', 'M', 'S', 'W']);
    expect(SIZE_CATALOGUE.S).toEqual({ id: 'S', nominalW: 1, nominalH: 1, nominalAspect: 1.0 });
    expect(SIZE_CATALOGUE.M).toEqual({ id: 'M', nominalW: 1, nominalH: 2, nominalAspect: 0.5 });
    expect(SIZE_CATALOGUE.W).toEqual({ id: 'W', nominalW: 2, nominalH: 1, nominalAspect: 2.0 });
    expect(SIZE_CATALOGUE.L).toEqual({ id: 'L', nominalW: 2, nominalH: 2, nominalAspect: 1.0 });
  });

  it('places the grid at 6 landscape / 4 portrait columns, footprints capped at 2x2 (AOD-197)', () => {
    // The COLUMN COUNT (responsive per orientation) is now DISTINCT from the FOOTPRINT ceiling. The wall's
    // orientation (landscape) is the wider, default count; portrait is narrower (design §4).
    expect(GRID_COLUMNS).toBe(6);
    expect(PORTRAIT_COLUMNS).toBe(4);
    expect(MAX_SLOT_W).toBe(2);
    expect(MAX_SLOT_H).toBe(2);
    // Landscape is genuinely wider than portrait, which is wider than a single footprint (no conflation).
    expect(GRID_COLUMNS).toBeGreaterThan(PORTRAIT_COLUMNS);
    expect(PORTRAIT_COLUMNS).toBeGreaterThan(MAX_SLOT_W);
  });

  it('no slot exceeds the footprint ceiling MAX_SLOT_W x MAX_SLOT_H (the 3-wide banner class is retired)', () => {
    for (const spec of Object.values(SIZE_CATALOGUE)) {
      expect(spec.nominalW).toBeLessThanOrEqual(MAX_SLOT_W);
      expect(spec.nominalH).toBeLessThanOrEqual(MAX_SLOT_H);
    }
  });

  it('exports the footprint ceiling as the single source of truth for the slot algebra (AOD-138/AOD-197)', () => {
    // MAX_SLOT_W + MAX_SLOT_H are consumed by geometry.snapDrag/snapResize and layout/grid.ts; they must
    // equal the widest/tallest slot in the catalogue so every module agrees on the footprint bounds. They
    // are the FOOTPRINT ceiling, NOT the column count (GRID_COLUMNS), which is now strictly larger.
    expect(MAX_SLOT_W).toBe(2);
    expect(MAX_SLOT_H).toBe(2);
    expect(Math.max(...Object.values(SIZE_CATALOGUE).map((s) => s.nominalW))).toBe(MAX_SLOT_W);
    expect(Math.max(...Object.values(SIZE_CATALOGUE).map((s) => s.nominalH))).toBe(MAX_SLOT_H);
    expect(GRID_COLUMNS).toBeGreaterThan(MAX_SLOT_W); // column count and footprint ceiling are separate
  });
});

describe('coerceToSlotGrid: the AOD-122 read-time legacy coercion (one case per legacy class)', () => {
  it('small 1x1 -> S, geometry untouched', () => {
    expect(coerceToSlotGrid(rect(0, 0, 1, 1))).toEqual({ rect: rect(0, 0, 1, 1), size: 'S' });
  });

  it('medium 2x1 -> W, geometry untouched (the pre-slot Clock seed shape)', () => {
    expect(coerceToSlotGrid(rect(0, 0, 2, 1))).toEqual({ rect: rect(0, 0, 2, 1), size: 'W' });
  });

  it('tall 1x2 -> M, geometry untouched', () => {
    expect(coerceToSlotGrid(rect(1, 3, 1, 2))).toEqual({ rect: rect(1, 3, 1, 2), size: 'M' });
  });

  it('large 2x2 -> L, geometry untouched', () => {
    expect(coerceToSlotGrid(rect(0, 2, 2, 2))).toEqual({ rect: rect(0, 2, 2, 2), size: 'L' });
  });

  it('the retired wide 3x1 clamps to W 2x1 (the recorded AOD-122 call: nearest legal horizontal slot)', () => {
    expect(coerceToSlotGrid(rect(0, 0, 3, 1))).toEqual({ rect: rect(0, 0, 2, 1), size: 'W' });
  });

  it('free-drop fractional rects (the pre-slot arrange canvas) round to the nearest slot', () => {
    // 2.3 x 1.4 at (0.6, 1.25): w->2, h->1, x->clamp(round(0.6)=1, 0, GRID_COLUMNS-2=4)=1, y->1. On the
    // wide landscape grid the rounded column survives (it no longer collapses to 0 as it did at 2 columns).
    expect(coerceToSlotGrid(rect(0.6, 1.25, 2.3, 1.4, 4))).toEqual({ rect: rect(1, 1, 2, 1, 4), size: 'W' });
    // 1.5 rounds up (JS half-up): 1.5 x 1.5 -> 2x2 L.
    expect(coerceToSlotGrid(rect(0, 0, 1.5, 1.5))).toEqual({ rect: rect(0, 0, 2, 2), size: 'L' });
  });

  it('clamps an out-of-grid origin into the landscape columns and keeps rows unbounded downward', () => {
    // x=5 with a 2-wide footprint (w clamps to MAX_SLOT_W=2) cannot start past column GRID_COLUMNS-2=4 ->
    // x=4 (the last legal landscape column, no longer 0 as on the old 2-column grid); y=6 is a legal deep row.
    expect(coerceToSlotGrid(rect(5, 6, 3, 1, 2))).toEqual({ rect: { x: 4, y: 6, w: 2, h: 1, z: 2 }, size: 'W' });
    // a 1-wide card at x=1 still fits (x + w <= GRID_COLUMNS), untouched.
    expect(coerceToSlotGrid(rect(1, 0, 1, 1))).toEqual({ rect: rect(1, 0, 1, 1), size: 'S' });
    // negative / fractional origins clamp to 0.
    expect(coerceToSlotGrid(rect(-1, -0.4, 1, 1))).toEqual({ rect: rect(0, 0, 1, 1), size: 'S' });
  });

  it('clamps oversized and undersized extents onto the slot ladder (never 0, never past L)', () => {
    expect(coerceToSlotGrid(rect(0, 0, 11.25, 6.8))).toEqual({ rect: rect(0, 0, 2, 2), size: 'L' }); // the old dogfood My Issues card
    expect(coerceToSlotGrid(rect(0, 0, 0.2, 0.2))).toEqual({ rect: rect(0, 0, 1, 1), size: 'S' });
    expect(coerceToSlotGrid(rect(0, 0, 1, 5))).toEqual({ rect: rect(0, 0, 1, 2), size: 'M' });
  });

  it('preserves z (stacking order is not the coercion’s business)', () => {
    expect(coerceToSlotGrid(rect(0, 0, 2, 1, 7)).rect.z).toBe(7);
  });
});

describe('coerceToSlotGrid: the AOD-197 responsive grid (footprint ceiling + per-orientation columns)', () => {
  it('caps footprint WIDTH at MAX_SLOT_W (2) even though the grid is 6 columns wide', () => {
    // GRID_COLUMNS widened to 6, but a footprint is still at most 2 wide: a 6-wide rect clamps w to
    // MAX_SLOT_W (the wider-than-2 footprint is a deferred design seam, §13), NOT to the column count.
    expect(coerceToSlotGrid(rect(0, 0, 6, 1))).toEqual({ rect: rect(0, 0, 2, 1), size: 'W' });
    expect(coerceToSlotGrid(rect(0, 0, 3, 3))).toEqual({ rect: rect(0, 0, 2, 2), size: 'L' }); // retired 3x3 -> L
  });

  it('coerces a legacy 2-column layout LEFT-ALIGNED into the 6-column grid with no overlap (design §12)', () => {
    // Two side-by-side S cards from the old 2-column world (cols 0 and 1) keep their columns in the wide
    // grid — each x was already <= GRID_COLUMNS - w — so the pair stays put, no overlap, no shift onto col0.
    expect(coerceToSlotGrid(rect(0, 0, 1, 1)).rect).toEqual(rect(0, 0, 1, 1));
    expect(coerceToSlotGrid(rect(1, 0, 1, 1)).rect).toEqual(rect(1, 0, 1, 1)); // stays at col1
    // A legacy full-width-2 W at column 0 also survives unchanged (0 + 2 <= 6).
    expect(coerceToSlotGrid(rect(0, 3, 2, 1)).rect).toEqual(rect(0, 3, 2, 1));
  });

  it('clamps x into the PORTRAIT column count when columns=PORTRAIT_COLUMNS is passed (S3 wiring)', () => {
    // The optional columns param resolves the same rect onto a narrower orientation. A 2-wide card at x=3
    // cannot start past PORTRAIT_COLUMNS-2=2 -> x=2; the same card keeps col3 on landscape (3 + 2 <= 6).
    expect(coerceToSlotGrid(rect(3, 0, 2, 1), PORTRAIT_COLUMNS)).toEqual({ rect: rect(2, 0, 2, 1), size: 'W' });
    expect(coerceToSlotGrid(rect(3, 0, 2, 1)).rect.x).toBe(3); // landscape default keeps col3
    // A 1-wide card at the last portrait column still fits (3 + 1 <= 4).
    expect(coerceToSlotGrid(rect(3, 0, 1, 1), PORTRAIT_COLUMNS)).toEqual({ rect: rect(3, 0, 1, 1), size: 'S' });
  });
});

describe('reconcileSize (AOD-10 §5.2 rule over the AOD-122 catalogue)', () => {
  it('picks M for a tall narrow rect over W', () => {
    expect(reconcileSize({ w: 1, h: 2 }, ['W', 'L', 'M'])).toBe('M');
  });
  it('lets aspect dominate area (a wide rect picks W)', () => {
    expect(reconcileSize({ w: 6, h: 2 }, ['S', 'W'])).toBe('W');
  });
  it('falls to the area tiebreak for equal-aspect rects', () => {
    expect(reconcileSize({ w: 1, h: 1 }, ['S', 'L'])).toBe('S');
    expect(reconcileSize({ w: 2, h: 2 }, ['S', 'L'])).toBe('L');
  });
  it('returns the nearest supported class for a rect far from every class', () => {
    expect(reconcileSize({ w: 10, h: 1 }, ['S', 'M', 'W'])).toBe('W');
  });
  it('uses supported[0] as the seed when only one class is supported', () => {
    expect(reconcileSize({ w: 5, h: 5 }, ['W'])).toBe('W');
  });
});
