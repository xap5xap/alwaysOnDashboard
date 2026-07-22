// AOD-140 pure arrange orchestration: the reflow preview + the commit set. The gesture FEEL is device
// (AOD-190), but these are the WYSIWYG RESULTS the contract turns on — a drag/resize lands the SNAPPED
// slot, the reflow is overlap-free, every displaced card commits, and a no-op drop commits nothing. They
// build straight on AOD-138's grid.reflow, so the invariant (no overlap after a reflow) is inherited and
// re-asserted structurally here over the instance-level layer.
import type { LayoutRect, WidgetInstance } from '../../registry/types';
import { cellsOverlap } from '../grid';
import { activeCommit, collectArrangeCommits, placeActive, reflowForTarget } from '../arrange';

const rect = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });

// A minimal WidgetInstance: only the fields the pure orchestration reads (id + rect). size is carried for
// realism but the commit derives size from the reflowed footprint, not from this.
function inst(id: string, r: LayoutRect, size: WidgetInstance['size'] = 'S'): WidgetInstance {
  return { instanceId: id, serviceId: 'stub', widgetType: 'w', config: {}, rect: r, size };
}

/** No two reflowed cells overlap — the property every reflow must hold (AOD-138). */
function assertNoOverlap(map: Map<string, LayoutRect>): void {
  const rects = [...map.values()];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(cellsOverlap(rects[i], rects[j])).toBe(false);
    }
  }
}

describe('reflowForTarget: pins the active card at its target, re-packs the rest', () => {
  it('drops a card onto an occupied slot; the neighbours re-pack around it, overlap-free', () => {
    // A(0,0) B(1,0) C(0,1); carry B onto A's slot (0,0). Matches the grid.reflow reading-order pack on the
    // 6-col landscape grid, where the displaced cards fill the wide row rather than wrapping.
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1)), inst('C', rect(0, 1, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'B', slot: { x: 0, y: 0, w: 1, h: 1 } });

    expect(map.get('B')).toEqual(rect(0, 0, 1, 1)); // pinned at the target
    expect(map.get('A')).toEqual(rect(1, 0, 1, 1)); // A packs to col1, row 0
    expect(map.get('C')).toEqual(rect(2, 0, 1, 1)); // C packs to col2, row 0 (the wide row has room)
    assertNoOverlap(map);
  });

  it('covers EVERY instance and preserves each neighbour footprint + z (only x/y move)', () => {
    const instances = [inst('A', rect(0, 0, 1, 1, 9)), inst('B', rect(0, 0, 1, 2, 4)), inst('C', rect(0, 0, 2, 1, 7))];
    const map = reflowForTarget(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 1, h: 1 } });
    expect([...map.keys()].sort()).toEqual(['A', 'B', 'C']);
    // Neighbours keep footprint + z.
    expect(map.get('B')).toMatchObject({ w: 1, h: 2, z: 4 });
    expect(map.get('C')).toMatchObject({ w: 2, h: 1, z: 7 });
    assertNoOverlap(map);
  });

  it('reflows around a RESIZE: growing the active card to L packs a neighbour beside it', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 2, h: 2 } });
    expect(map.get('A')).toEqual(rect(0, 0, 2, 2)); // the grown footprint, pinned
    expect(map.get('B')).toEqual(rect(2, 0, 1, 1)); // no room in cols 0-1 (the L) -> packs to col2 in row 0
    assertNoOverlap(map);
  });

  it('clamps a full-width target dropped off the right edge back onto the landscape grid', () => {
    const instances = [inst('A', rect(0, 0, 2, 1, 5)), inst('B', rect(0, 1, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'A', slot: { x: 5, y: 0, w: 2, h: 1 } });
    expect(map.get('A')).toMatchObject({ x: 4, w: 2, z: 5 }); // col5 -> col4 (x + w <= GRID_COLUMNS)
    assertNoOverlap(map);
  });

  it('returns the committed layout unchanged when the active id is not present (defensive)', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'ghost', slot: { x: 0, y: 5, w: 1, h: 1 } });
    expect(map.get('A')).toEqual(rect(0, 0, 1, 1));
    expect(map.get('B')).toEqual(rect(1, 0, 1, 1));
  });
});

describe('collectArrangeCommits: one patch per MOVED card, size from the footprint', () => {
  it('commits the dragged card + every displaced neighbour, and NOT an unchanged one', () => {
    // C already sits at its packed slot (2,0), so the reflow leaves it put -> no patch. (A(0,0), B(1,0),
    // C(2,0) is the reading-order-compact wide row; dropping B onto (0,0) shuffles A/B but not C.)
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1)), inst('C', rect(2, 0, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'B', slot: { x: 0, y: 0, w: 1, h: 1 } });
    const commits = collectArrangeCommits(instances, map);
    // B moved (1,0)->(0,0), A moved (0,0)->(1,0); C stayed at (2,0) -> no patch.
    expect(commits.map((c) => c.instanceId).sort()).toEqual(['A', 'B']);
    expect(commits.find((c) => c.instanceId === 'C')).toBeUndefined();
  });

  it('derives S/M/W/L from the reflowed footprint (a resize commits the new size)', () => {
    const instances = [inst('A', rect(0, 0, 1, 1, 0), 'S'), inst('B', rect(1, 0, 1, 1, 0), 'S')];
    const map = reflowForTarget(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 2, h: 2 } });
    const commits = collectArrangeCommits(instances, map);
    const A = commits.find((c) => c.instanceId === 'A');
    const B = commits.find((c) => c.instanceId === 'B');
    expect(A?.patch).toEqual({ rect: rect(0, 0, 2, 2), size: 'L' }); // grown to L
    expect(B?.patch).toEqual({ rect: rect(2, 0, 1, 1), size: 'S' }); // packed beside the L (col2), still S
  });

  it('maps each footprint to its slot id (S 1x1 / M 1x2 / W 2x1 / L 2x2)', () => {
    // One instance resized to each footprint in turn; the derived size must match the slot.
    const cases: Array<[LayoutRect, WidgetInstance['size']]> = [
      [rect(0, 0, 1, 1), 'S'],
      [rect(0, 0, 1, 2), 'M'],
      [rect(0, 0, 2, 1), 'W'],
      [rect(0, 0, 2, 2), 'L'],
    ];
    for (const [r, size] of cases) {
      // Start the card away from every target (row 5) so each resize is a genuine change that commits.
      const instances = [inst('A', rect(0, 5, 1, 1))];
      const map = reflowForTarget(instances, { instanceId: 'A', slot: r });
      expect(collectArrangeCommits(instances, map)[0].patch.size).toBe(size);
    }
  });

  it('commits NOTHING for a drop-in-place / a stable layout (the cancel-equivalent no-op)', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1))];
    // Target = A's current slot; the layout is already reading-order compact, so nothing moves.
    const map = reflowForTarget(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 1, h: 1 } });
    expect(collectArrangeCommits(instances, map)).toEqual([]);
  });

  it('every committed rect is non-overlapping against the whole reflowed layout', () => {
    const instances = [
      inst('A', rect(0, 0, 1, 1)),
      inst('B', rect(1, 0, 1, 1)),
      inst('C', rect(0, 1, 2, 1)),
      inst('D', rect(0, 2, 1, 2)),
    ];
    const map = reflowForTarget(instances, { instanceId: 'D', slot: { x: 0, y: 0, w: 2, h: 2 } });
    collectArrangeCommits(instances, map); // exercises the commit path
    assertNoOverlap(map);
  });
});

// AOD-197 (S4) place, don't pack (design §8): the live arrange path. Only the ACTIVE card moves; every
// neighbour holds its slot (gaps preserved). placeActive resolves the hairline + landing; activeCommit is
// the single drop commit.
describe('placeActive: the active card lands at the nearest FREE fitting slot, neighbours excluded', () => {
  it('a free target wins outright (WYSIWYG: the card lands where the finger is)', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1))];
    // A carried to a free cell (3,0) — nothing occupies it, so it lands exactly there. (placeActive returns a
    // GridRect: origin + footprint, no z.)
    expect(placeActive(instances, { instanceId: 'A', slot: { x: 3, y: 0, w: 1, h: 1 } }, 6)).toEqual({
      x: 3,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it('an OCCUPIED target snaps to the nearest free fit — neighbours are the only occupancy', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1)), inst('M', rect(4, 0, 1, 1))];
    // M dropped on (0,0): A@0,0 and B@1,0 block row 0's start, so the nearest free fit is (0,1).
    expect(placeActive(instances, { instanceId: 'M', slot: { x: 0, y: 0, w: 1, h: 1 } }, 6)).toEqual({
      x: 0,
      y: 1,
      w: 1,
      h: 1,
    });
  });

  it('EXCLUDES the active card from the occupancy (a card never collides with itself)', () => {
    const instances = [inst('A', rect(0, 0, 1, 1))];
    // A "dropped on its own slot": with self excluded, (0,0) is free, so it stays.
    expect(placeActive(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 1, h: 1 } }, 6)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it('clamps the fit to the ACTIVE orientation columns (a portrait 4-col clamp differs from landscape 6)', () => {
    const instances = [inst('A', rect(0, 0, 2, 1))]; // a lone W
    // col3 fits a W on the 6-col grid (3 + 2 <= 6) but not the 4-col grid (3 + 2 > 4 -> nearest is col2).
    expect(placeActive(instances, { instanceId: 'A', slot: { x: 3, y: 0, w: 2, h: 1 } }, 6).x).toBe(3);
    expect(placeActive(instances, { instanceId: 'A', slot: { x: 3, y: 0, w: 2, h: 1 } }, 4).x).toBe(2);
  });
});

describe('activeCommit: exactly one commit for the active card, or null', () => {
  it('commits the active card at its landing, size + z derived/preserved', () => {
    const instances = [inst('A', rect(0, 0, 1, 1, 5)), inst('B', rect(1, 0, 1, 1))];
    const c = activeCommit(instances, { instanceId: 'A', slot: { x: 3, y: 0, w: 1, h: 1 } }, 6);
    expect(c).toEqual({ instanceId: 'A', patch: { rect: rect(3, 0, 1, 1, 5), size: 'S' } }); // z=5 preserved
  });

  it('derives the size from the landed footprint (a resize to L commits L)', () => {
    const instances = [inst('A', rect(0, 5, 1, 1))]; // alone, far from the origin, so the resize is a change
    const c = activeCommit(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 2, h: 2 } }, 6);
    expect(c?.patch).toEqual({ rect: rect(0, 0, 2, 2), size: 'L' });
  });

  it('a resize whose footprint would overlap a neighbour nudges to the nearest free fit', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1))];
    // A grown to a W at (0,0) would cover B@1,0 -> nudged to (0,1); B never moves (only A is committed).
    const c = activeCommit(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 2, h: 1 } }, 6);
    expect(c).toEqual({ instanceId: 'A', patch: { rect: rect(0, 1, 2, 1), size: 'W' } });
  });

  it('returns null for a true in-place drop (landing == committed): nothing writes', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1))];
    expect(activeCommit(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 1, h: 1 } }, 6)).toBeNull();
  });

  it('returns null when the active id is not present (defensive)', () => {
    const instances = [inst('A', rect(0, 0, 1, 1))];
    expect(activeCommit(instances, { instanceId: 'ghost', slot: { x: 2, y: 0, w: 1, h: 1 } }, 6)).toBeNull();
  });
});
