// The §4 sparkline chart rule as pure data (barMetrics): window-max scale (§4.1), today emphasis (§4.2),
// the minBarHeight floor + the degenerate all-zero series (§4.3). Tested directly, no layout pass needed
// (the x-positions are the only width-dependent part; height/opacity are pure). design-claude-usage.md §4.
import { barMetrics } from '../Sparkline';
import type { DailyCost } from '../types';

const OPTS = { chartHeight: 96, minBarHeight: 2, todayOpacity: 1, pastOpacity: 0.5 };
const day = (date: string, amount: number): DailyCost => ({ date, amount });

describe('barMetrics (design-claude-usage.md §4)', () => {
  it('scales each bar to the window peak; the peak day fills the chart, today is bright, the rest recede', () => {
    const days = [
      day('2026-06-01', 1.5),
      day('2026-06-02', 2.5),
      day('2026-06-03', 0), // a recorded $0 day
      day('2026-06-04', 6.2), // the window peak
      day('2026-06-05', 3.0), // today (rightmost, oldest-first)
    ];
    const m = barMetrics(days, OPTS);

    expect(m).toHaveLength(5);
    expect(m[3].height).toBe(96); // the peak day fills the chart (6.2 / 6.2 * 96)
    expect(m[2].height).toBe(2); // a $0 day floors to minBarHeight (a tick, not a gap, §4.3)
    expect(m[4].isToday).toBe(true);
    expect(m[4].opacity).toBe(1); // today bright (§4.2)
    expect(m[0].isToday).toBe(false);
    expect(m[0].opacity).toBe(0.5); // earlier days recede
    // today is a partial, still-growing day -> marked by colour, not height (it is NOT the tallest bar)
    expect(m[4].height).toBeLessThan(m[3].height);
  });

  it('draws an all-zero window flat at the floor, never a divide-by-zero (§4.3)', () => {
    const days = [day('2026-06-01', 0), day('2026-06-02', 0), day('2026-06-03', 0)];
    const m = barMetrics(days, OPTS);

    expect(m.every((b) => b.height === 2)).toBe(true); // every bar at minBarHeight
    expect(m.every((b) => Number.isFinite(b.height))).toBe(true); // no NaN from /0
    expect(m[2].opacity).toBe(1); // today still the bright one
    expect(m[0].opacity).toBe(0.5);
  });

  it('handles a sparse early-month series: few bars, today still the peak/bright one', () => {
    const days = [day('2026-06-01', 1.0), day('2026-06-02', 0.5), day('2026-06-03', 2.0)];
    const m = barMetrics(days, OPTS);

    expect(m).toHaveLength(3);
    expect(m[2].height).toBe(96); // today is the window max here -> fills the chart
    expect(m[2].opacity).toBe(1);
    expect(m[0].opacity).toBe(0.5);
  });
});
