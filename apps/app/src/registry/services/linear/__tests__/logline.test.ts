// AOD-135: the Log Line pure geometry (logline.ts). Locks the knot MATH as an executable spec — the ring
// positions (start angle + clockwise direction), the crowding-adaptive knot radius, the lit/total clamp, and
// the N=0 / N=1 / large-N guards. Pure + React-free, so no host/render needed (the transit.ts / range.ts
// precedent). NO colour is asserted here: the lit/dim split is an INTENSITY the leaf applies at the draw site.
import { resolveLit, adaptiveKnotRadius, ringLayout, type RingGeometry } from '../logline';

// A generous geometry so the crowding cap does not bite until a genuinely large N.
const GEO: RingGeometry = { outerRadius: 40, knotRadius: 4, minKnotRadius: 1.5, minGap: 2 };

describe('resolveLit (the lit/total clamp shared by the ring + the W dashes)', () => {
  it('passes a normal completed <= total through', () => {
    expect(resolveLit(16, 24)).toEqual({ total: 24, lit: 16 });
  });

  it('clamps completed > total down to total (a full ring, never over-lit)', () => {
    expect(resolveLit(30, 24)).toEqual({ total: 24, lit: 24 });
  });

  it('clamps a negative / non-finite completed to 0 and floors total to a non-negative int', () => {
    expect(resolveLit(-5, 24)).toEqual({ total: 24, lit: 0 });
    expect(resolveLit(NaN, 24)).toEqual({ total: 24, lit: 0 });
    expect(resolveLit(3, -2)).toEqual({ total: 0, lit: 0 });
    expect(resolveLit(3, NaN)).toEqual({ total: 0, lit: 0 });
    expect(resolveLit(2.9, 5.9)).toEqual({ total: 5, lit: 2 }); // floored
  });
});

describe('adaptiveKnotRadius (knot size adapts to N; the crowding cap)', () => {
  it('uses the full knot radius for N <= 1 (no neighbour to crowd — a 1-issue cycle reads as one solid knot)', () => {
    expect(adaptiveKnotRadius(0, GEO)).toBe(GEO.knotRadius);
    expect(adaptiveKnotRadius(1, GEO)).toBe(GEO.knotRadius);
  });

  it('keeps the full knot radius while a small N leaves room', () => {
    // N=5 on R=40: arcSpacing = 2π·40/5 ≈ 50, maxR ≈ 24 → clamped to the token 4.
    expect(adaptiveKnotRadius(5, GEO)).toBe(GEO.knotRadius);
  });

  it('shrinks toward — but never below — the floor for a large N', () => {
    const r = adaptiveKnotRadius(40, GEO); // arcSpacing = 2π·40/40 ≈ 6.28, maxR ≈ 2.14
    expect(r).toBeLessThan(GEO.knotRadius);
    expect(r).toBeGreaterThanOrEqual(GEO.minKnotRadius);
    expect(r).toBeCloseTo((( (2 * Math.PI * 40) / 40) - 2) / 2, 5);
  });

  it('never returns below the floor even for an absurd N', () => {
    expect(adaptiveKnotRadius(1000, GEO)).toBe(GEO.minKnotRadius);
  });
});

describe('ringLayout (positions + lit split + guards)', () => {
  it('N=0: no knots, no ÷0, a stable centre/size, fraction 0', () => {
    const l = ringLayout(0, 0, GEO);
    expect(l.knots).toHaveLength(0);
    expect(l.total).toBe(0);
    expect(l.litCount).toBe(0);
    expect(l.fraction).toBe(0);
    expect(l.center).toBe(GEO.outerRadius + GEO.knotRadius); // 44
    expect(l.size).toBe((GEO.outerRadius + GEO.knotRadius) * 2); // 88
  });

  it('N=1: a single knot at the TOP (12 o’clock), lit when completed >= 1', () => {
    const empty = ringLayout(0, 1, GEO);
    expect(empty.knots).toHaveLength(1);
    expect(empty.knots[0].angle).toBe(0);
    expect(empty.knots[0].x).toBeCloseTo(empty.center, 6); // top: x == center
    expect(empty.knots[0].y).toBeCloseTo(empty.center - GEO.outerRadius, 6); // top: y == center - R
    expect(empty.knots[0].lit).toBe(false);
    expect(ringLayout(1, 1, GEO).knots[0].lit).toBe(true);
  });

  it('a small N=5: knot 0 at the top, going CLOCKWISE (knot 1 to the right of centre, below the top)', () => {
    const l = ringLayout(3, 5, GEO);
    expect(l.knots).toHaveLength(5);
    // knot 0 at the top
    expect(l.knots[0].x).toBeCloseTo(l.center, 6);
    expect(l.knots[0].y).toBeCloseTo(l.center - GEO.outerRadius, 6);
    // knot 1 (72° clockwise from top) is to the RIGHT (x > center) and DOWN from the top (y > top-y)
    expect(l.knots[1].x).toBeGreaterThan(l.center);
    expect(l.knots[1].y).toBeGreaterThan(l.center - GEO.outerRadius);
    // every knot sits on the ring: distance from centre == outerRadius
    for (const k of l.knots) {
      const d = Math.hypot(k.x - l.center, k.y - l.center);
      expect(d).toBeCloseTo(GEO.outerRadius, 5);
    }
    // 3 of 5 lit: the FIRST three
    expect(l.knots.map((k) => k.lit)).toEqual([true, true, true, false, false]);
    expect(l.litCount).toBe(3);
    expect(l.fraction).toBeCloseTo(3 / 5, 6);
  });

  it('a large N=40: 40 knots, all on the ring, discs shrunk below the token but visible', () => {
    const l = ringLayout(10, 40, GEO);
    expect(l.knots).toHaveLength(40);
    expect(l.knotRadius).toBeLessThan(GEO.knotRadius);
    expect(l.knotRadius).toBeGreaterThanOrEqual(GEO.minKnotRadius);
    expect(l.litCount).toBe(10);
    for (const k of l.knots) {
      expect(Math.hypot(k.x - l.center, k.y - l.center)).toBeCloseTo(GEO.outerRadius, 5);
    }
  });

  it('completed == total: the whole ring is lit (fraction 1)', () => {
    const l = ringLayout(24, 24, GEO);
    expect(l.knots.every((k) => k.lit)).toBe(true);
    expect(l.litCount).toBe(24);
    expect(l.fraction).toBe(1);
  });

  it('completed == 0: an empty ring — every knot dim (fraction 0)', () => {
    const l = ringLayout(0, 24, GEO);
    expect(l.knots.some((k) => k.lit)).toBe(false);
    expect(l.litCount).toBe(0);
    expect(l.fraction).toBe(0);
  });

  it('completed > total: clamped to a full ring (never over-lit, fraction 1)', () => {
    const l = ringLayout(99, 24, GEO);
    expect(l.knots.every((k) => k.lit)).toBe(true);
    expect(l.litCount).toBe(24);
    expect(l.fraction).toBe(1);
  });
});
