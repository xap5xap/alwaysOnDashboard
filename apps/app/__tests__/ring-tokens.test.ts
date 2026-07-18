// AOD-135 token-lock (design-linear.md §6; the Current Cycle "Log Line" segmented-knot-ring geometry). The
// same byte-identical guard the earlier geometry groups use (transit-tokens.test.ts / soundings-tokens.test.ts
// / range-tokens.test.ts, the sparkline/progress precedent): pin the one numbers-only token group the Log Line
// adds (`ring`) so a future edit cannot drift it silently. NUMBERS ONLY — the ONE accent arrives as a ROLE
// value from the leaf (colors.accent lit / accent @ progress.trackOpacity dim), never a hex here; this test
// never touches the FROZEN colour-family locks (data-tokens.test.ts / data-monochrome-tokens.test.ts).
import { darkTheme, lightTheme } from '../unistyles';

/** Every leaf of a nested numbers-only token group is a plain number (no role alias / no embedded TextStyle). */
function everyLeafIsNumber(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (v && typeof v === 'object') return Object.values(v).every(everyLeafIsNumber);
  return false;
}

describe('§6 ring (Log Line) token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('ring', () => {
    expect(darkTheme.ring).toEqual({
      radius: { S: 22, M: 30, L: 46 }, // the knot-centre ring radius per ringed size (cap; leaf fits to box)
      knot: 4, // the ideal / max knot disc radius (small N); the stable box margin
      minKnot: 1.5, // the knot disc radius floor (a large N stays visible, never 0)
      gap: 2, // the min gap between adjacent knot edges (the crowding-cap input)
      stroke: 3, // the smooth (Dead Reckoning) continuous-ring stroke width
      dash: { height: 10, gap: 3, radius: 2 }, // the W segmented bar: one dash per issue
    });
  });

  it('is theme-independent (dark and light share the same values)', () => {
    expect(lightTheme.ring).toEqual(darkTheme.ring);
  });

  it('every value is a plain number (no embedded TextStyle, no role alias) — Unistyles-safe', () => {
    expect(everyLeafIsNumber(darkTheme.ring)).toBe(true);
  });

  it('the knot floor is at or below the ideal knot (the crowding cap shrinks, never grows, the disc)', () => {
    expect(darkTheme.ring.minKnot).toBeLessThanOrEqual(darkTheme.ring.knot);
  });

  it('L is the biggest ring, S the smallest (the tally reads larger than the S texture)', () => {
    expect(darkTheme.ring.radius.L).toBeGreaterThan(darkTheme.ring.radius.M);
    expect(darkTheme.ring.radius.M).toBeGreaterThan(darkTheme.ring.radius.S);
  });
});
