// AOD-134: the Soundings pure selector (soundings.ts). Locks the worded priority SUMMARY — the nonzero
// buckets in heavy→light order, the tally that replaced the retired aggregate silhouette after the
// 2026-07-20 device RETUNE — as an executable spec, no host / render pass needed (the transit.ts / range.ts
// precedent). The case Xavier hit on device is the first test: 9 High + 1 Med must read "9 High · 1 Med",
// legible where 9 identical marks were noise. Pure counts in, ordered buckets out.
import { prioritySummary } from '../soundings';

type P = { priority: number };
const p = (priority: number): P => ({ priority });
const repeat = (priority: number, n: number): P[] => Array.from({ length: n }, () => p(priority));

describe('prioritySummary (the worded histogram: nonzero buckets, heavy→light)', () => {
  it("reads the RETUNE case '9 High · 1 Med' — the tally the silhouette could not (real data)", () => {
    const summary = prioritySummary([...repeat(2, 9), ...repeat(3, 1)]);
    expect(summary).toEqual([
      { priority: 2, label: 'High', count: 9 },
      { priority: 3, label: 'Med', count: 1 },
    ]);
  });

  it('orders the buckets heavy→light (urgent > high > medium > low > none — NOT Linear numeric order)', () => {
    // one of each level, source order deliberately scrambled
    const summary = prioritySummary([p(0), p(4), p(1), p(3), p(2)]);
    expect(summary.map((s) => s.label)).toEqual(['Urgent', 'High', 'Med', 'Low', 'None']);
    expect(summary.map((s) => s.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it('includes none, but LAST (0 is the lightest level, never the heaviest)', () => {
    const summary = prioritySummary([...repeat(0, 3), ...repeat(1, 2)]);
    expect(summary).toEqual([
      { priority: 1, label: 'Urgent', count: 2 },
      { priority: 0, label: 'None', count: 3 },
    ]);
  });

  it('omits empty buckets — only levels that actually occur appear', () => {
    const summary = prioritySummary([...repeat(2, 4), ...repeat(4, 2)]); // high + low only
    expect(summary.map((s) => s.label)).toEqual(['High', 'Low']);
    expect(summary.find((s) => s.label === 'Med')).toBeUndefined();
    expect(summary.find((s) => s.label === 'Urgent')).toBeUndefined();
  });

  it('folds any out-of-range / NaN priority into the none bucket (mirrors priorityShape)', () => {
    const summary = prioritySummary([p(99), p(-1), p(NaN), p(1)]);
    expect(summary).toEqual([
      { priority: 1, label: 'Urgent', count: 1 },
      { priority: 0, label: 'None', count: 3 }, // 99, -1, NaN all fold to none
    ]);
  });

  it('returns an empty array for no issues (defensive — the host draws empty above this anyway)', () => {
    expect(prioritySummary([])).toEqual([]);
  });

  it('does not mutate the input array (the query data is left untouched)', () => {
    const input = [p(2), p(3)];
    prioritySummary(input);
    expect(input).toEqual([p(2), p(3)]);
    expect(input).toHaveLength(2);
  });
});
