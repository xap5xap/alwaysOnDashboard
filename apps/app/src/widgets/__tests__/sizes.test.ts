// The AOD-122 S/M/W/L slot catalogue: reconcileSize (the AOD-10 §5.2 rule over the new catalogue) and
// coerceToSlotGrid (the read-time coercion that resolves every persisted legacy rect onto the slot
// grid). The coercion cases below ARE the legacy migration table — there is no write-time migration,
// so these locks are the contract for how pre-slot rows render.
import type { LayoutRect } from '../../registry/types';
import { GRID_COLUMNS, MAX_SLOT_H, SIZE_CATALOGUE, coerceToSlotGrid, reconcileSize } from '../sizes';

const rect = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });

describe('SIZE_CATALOGUE (AOD-122, Many Skies §1c)', () => {
  it('is exactly the four-slot contract: S 1x1 / M 1x2 / W 2x1 / L 2x2 on a 2-column grid', () => {
    expect(GRID_COLUMNS).toBe(2);
    expect(Object.keys(SIZE_CATALOGUE).sort()).toEqual(['L', 'M', 'S', 'W']);
    expect(SIZE_CATALOGUE.S).toEqual({ id: 'S', nominalW: 1, nominalH: 1, nominalAspect: 1.0 });
    expect(SIZE_CATALOGUE.M).toEqual({ id: 'M', nominalW: 1, nominalH: 2, nominalAspect: 0.5 });
    expect(SIZE_CATALOGUE.W).toEqual({ id: 'W', nominalW: 2, nominalH: 1, nominalAspect: 2.0 });
    expect(SIZE_CATALOGUE.L).toEqual({ id: 'L', nominalW: 2, nominalH: 2, nominalAspect: 1.0 });
  });

  it('no slot exceeds the 2-column grid (the 3-wide banner class is retired)', () => {
    for (const spec of Object.values(SIZE_CATALOGUE)) {
      expect(spec.nominalW).toBeLessThanOrEqual(GRID_COLUMNS);
      expect(spec.nominalH).toBeLessThanOrEqual(2);
    }
  });

  it('exports the grid bounds as the single source of truth for the slot algebra (AOD-138)', () => {
    // GRID_COLUMNS + MAX_SLOT_H are consumed by geometry.snapDrag/snapResize and layout/grid.ts; they
    // must equal the widest/tallest slot in the catalogue so all three modules agree on the grid shape.
    expect(GRID_COLUMNS).toBe(2);
    expect(MAX_SLOT_H).toBe(2);
    expect(Math.max(...Object.values(SIZE_CATALOGUE).map((s) => s.nominalW))).toBe(GRID_COLUMNS);
    expect(Math.max(...Object.values(SIZE_CATALOGUE).map((s) => s.nominalH))).toBe(MAX_SLOT_H);
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
    // 2.3 x 1.4 at (0.6, 1.25): w->2, h->1, x->min(round(0.6), 2-2)=0, y->1.
    expect(coerceToSlotGrid(rect(0.6, 1.25, 2.3, 1.4, 4))).toEqual({ rect: rect(0, 1, 2, 1, 4), size: 'W' });
    // 1.5 rounds up (JS half-up): 1.5 x 1.5 -> 2x2 L.
    expect(coerceToSlotGrid(rect(0, 0, 1.5, 1.5))).toEqual({ rect: rect(0, 0, 2, 2), size: 'L' });
  });

  it('clamps an out-of-grid origin into the two columns and keeps rows unbounded downward', () => {
    // x=5 cannot host a 2-wide card on a 2-column grid -> x=0; y=6 is a legal deep row.
    expect(coerceToSlotGrid(rect(5, 6, 3, 1, 2))).toEqual({ rect: { x: 0, y: 6, w: 2, h: 1, z: 2 }, size: 'W' });
    // a 1-wide card at x=1 still fits (x + w <= 2), untouched.
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
