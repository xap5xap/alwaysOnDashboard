// AOD-133: the Range pure helpers (range.ts). Locks the shared-scale math as an executable spec — the
// week's min-max over the visible days, and one day's [tempMin,tempMax] mapped to [0,1] fractions ON that
// scale. Pure + React-free, so no host/render needed. The "is the scale math right" flag: a swingy week,
// a FLAT week (max === min → no ÷0, the centred min bar), a single day, and the exact fraction mapping.
import { weekScale, spanFraction, CENTERED_SHORT, type DayTempRange } from '../range';

const day = (tempMin: number, tempMax: number): DayTempRange => ({ tempMin, tempMax });

describe('weekScale (the shared min-low / max-high over the VISIBLE days)', () => {
  it('takes the min of the lows and the max of the highs across a swingy week', () => {
    const days = [day(9, 17), day(8, 21), day(10, 20)];
    expect(weekScale(days)).toEqual({ min: 8, max: 21 });
  });

  it('a single day is its own scale (min = its low, max = its high)', () => {
    expect(weekScale([day(9, 19)])).toEqual({ min: 9, max: 19 });
  });

  it('a flat week collapses min === max (degenerate scale, guarded downstream)', () => {
    expect(weekScale([day(15, 15), day(15, 15)])).toEqual({ min: 15, max: 15 });
  });

  it('returns null for an empty set or one with no finite temps (never NaN)', () => {
    expect(weekScale([])).toBeNull();
    expect(weekScale([day(NaN, NaN)])).toBeNull();
    expect(weekScale([day(Infinity, -Infinity)])).toBeNull();
  });
});

describe('spanFraction (a day mapped onto the shared scale)', () => {
  const scale = { min: 8, max: 21 }; // span 13

  it('maps [tempMin,tempMax] to the exact fractions on the scale', () => {
    // day 9-19 on 8-21: lo = (9-8)/13, hi = (19-8)/13
    const s = spanFraction(9, 19, scale);
    expect(s.lo).toBeCloseTo(1 / 13, 6);
    expect(s.hi).toBeCloseTo(11 / 13, 6);
    expect(s.lo).toBeLessThan(s.hi);
  });

  it('the coldest low anchors lo = 0 and the hottest high anchors hi = 1', () => {
    expect(spanFraction(8, 12, scale).lo).toBe(0); // the week min
    expect(spanFraction(15, 21, scale).hi).toBe(1); // the week max
    // the day that defines both ends spans the full track
    expect(spanFraction(8, 21, scale)).toEqual({ lo: 0, hi: 1 });
  });

  it('a single-day scale spans the full track (lo 0, hi 1)', () => {
    const s = weekScale([day(9, 19)])!;
    expect(spanFraction(9, 19, s)).toEqual({ lo: 0, hi: 1 });
  });

  it('a FLAT week (max === min) returns the centred short bar — no ÷0, never invisible', () => {
    const flat = { min: 15, max: 15 };
    expect(spanFraction(15, 15, flat)).toEqual(CENTERED_SHORT);
    // and both the "swingy" and "flat" reads coexist: a real span is fractional, a flat bar is the mark
    expect(spanFraction(15, 15, flat).hi).toBeGreaterThan(spanFraction(15, 15, flat).lo);
  });

  it('a rangeless day inside a swingy week is a zero-width point on the scale (lo === hi)', () => {
    const s = spanFraction(15, 15, scale); // 15° both ends, week 8-21
    expect(s.lo).toBeCloseTo((15 - 8) / 13, 6);
    expect(s.hi).toBe(s.lo); // the render floors it to minBarWidth so it still shows
  });

  it('clamps to [0,1] and returns the centred short bar for a non-finite temp (never NaN)', () => {
    const s = spanFraction(-40, 60, scale); // beyond both ends → clamped
    expect(s.lo).toBe(0);
    expect(s.hi).toBe(1);
    expect(spanFraction(NaN, 19, scale)).toEqual(CENTERED_SHORT);
  });
});
