// AOD-134: the Soundings pure selectors (soundings.ts). Locks the heavy→light priority sort + the
// silhouette packing cap as an executable spec — no host / render pass needed (the transit.ts / range.ts
// precedent). The two flags Xavier verifies on device (runbook §5 AOD-134 b): the INVERTED-numbering sort
// order (urgent 1 leads, none 0 trails — NOT a plain numeric sort) and how the silhouette packs without
// clipping. Pure numbers in, order / count out.
import { priorityWeight, sortByPriorityHeavyToLight, silhouetteCapacity } from '../soundings';

type P = { id: string; priority: number };
const p = (id: string, priority: number): P => ({ id, priority });

describe("priorityWeight (Linear's inverted numbering → a heavy→light ascending key)", () => {
  it('maps urgent(1) heaviest … low(4) lightest of the real levels, none(0) LAST (Infinity)', () => {
    expect(priorityWeight(1)).toBe(1); // urgent — the heaviest, sorts first
    expect(priorityWeight(2)).toBe(2); // high
    expect(priorityWeight(3)).toBe(3); // medium
    expect(priorityWeight(4)).toBe(4); // low — the lightest REAL level
    expect(priorityWeight(0)).toBe(Infinity); // none — sorts last, NOT first (the inverted-numbering trap)
  });

  it('collapses any out-of-range / NaN value to the none bucket (mirrors priorityShape)', () => {
    expect(priorityWeight(99)).toBe(Infinity);
    expect(priorityWeight(-1)).toBe(Infinity);
    expect(priorityWeight(NaN)).toBe(Infinity);
  });
});

describe('sortByPriorityHeavyToLight (urgent → high → medium → low → none, stable)', () => {
  it('orders a mixed set heavy→light (NOT a plain numeric sort — urgent 1 leads, none 0 trails)', () => {
    const sorted = sortByPriorityHeavyToLight([p('none', 0), p('low', 4), p('urgent', 1), p('high', 2), p('med', 3)]);
    expect(sorted.map((i) => i.id)).toEqual(['urgent', 'high', 'med', 'low', 'none']);
  });

  it('puts none LAST even against low (0 is the LIGHTEST, not the heaviest)', () => {
    expect(sortByPriorityHeavyToLight([p('none', 0), p('low', 4)]).map((i) => i.id)).toEqual(['low', 'none']);
  });

  it('is STABLE for ties — equal priorities keep their source order', () => {
    const sorted = sortByPriorityHeavyToLight([p('a', 2), p('b', 2), p('c', 2), p('d', 1), p('e', 2)]);
    expect(sorted.map((i) => i.id)).toEqual(['d', 'a', 'b', 'c', 'e']); // d (urgent) leads; the 2s hold order
  });

  it('is stable across TWO none issues (the Infinity === Infinity comparator case, no NaN drift)', () => {
    const sorted = sortByPriorityHeavyToLight([p('n1', 0), p('urgent', 1), p('n2', 0)]);
    expect(sorted.map((i) => i.id)).toEqual(['urgent', 'n1', 'n2']);
  });

  it('does not mutate the input array (the query data is left untouched)', () => {
    const input = [p('none', 0), p('urgent', 1)];
    const before = input.map((i) => i.id);
    sortByPriorityHeavyToLight(input);
    expect(input.map((i) => i.id)).toEqual(before);
  });

  it('returns an empty array unchanged (defensive)', () => {
    expect(sortByPriorityHeavyToLight([])).toEqual([]);
  });
});

describe('silhouetteCapacity (marks that fit a width — the never-clip packing cap)', () => {
  it('counts the n·mark + (n−1)·gap marks that fit the width (S 72dp → 4, W/L 168dp → 9)', () => {
    expect(silhouetteCapacity(72, 14, 4)).toBe(4); // ⌊(72+4)/18⌋ = 4  (the S body width)
    expect(silhouetteCapacity(168, 14, 4)).toBe(9); // ⌊(168+4)/18⌋ = 9 (the W / L body width)
  });

  it('fits exactly n at the exact boundary and one fewer a pixel short (never overflows)', () => {
    expect(silhouetteCapacity(50, 14, 4)).toBe(3); // 3·14 + 2·4 = 50 exactly → 3
    expect(silhouetteCapacity(49, 14, 4)).toBe(2); // one px short → 2, never a clipped 3rd
  });

  it('returns 0 for a degenerate width or mark (no negative count)', () => {
    expect(silhouetteCapacity(0, 14, 4)).toBe(0);
    expect(silhouetteCapacity(-10, 14, 4)).toBe(0);
    expect(silhouetteCapacity(72, 0, 4)).toBe(0);
  });
});
