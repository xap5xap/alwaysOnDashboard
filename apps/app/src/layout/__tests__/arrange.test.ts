// AOD-140 pure arrange orchestration: the reflow preview + the commit set. The gesture FEEL is device
// (AOD-190), but these are the WYSIWYG RESULTS the contract turns on — a drag/resize lands the SNAPPED
// slot, the reflow is overlap-free, every displaced card commits, and a no-op drop commits nothing. They
// build straight on AOD-138's grid.reflow, so the invariant (no overlap after a reflow) is inherited and
// re-asserted structurally here over the instance-level layer.
import type { LayoutRect, WidgetInstance } from '../../registry/types';
import { cellsOverlap } from '../grid';
import { collectArrangeCommits, reflowForTarget } from '../arrange';

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
    // A(0,0) B(1,0) C(0,1); carry B onto A's slot (0,0). Matches the grid.reflow reading-order pack.
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1)), inst('C', rect(0, 1, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'B', slot: { x: 0, y: 0, w: 1, h: 1 } });

    expect(map.get('B')).toEqual(rect(0, 0, 1, 1)); // pinned at the target
    expect(map.get('A')).toEqual(rect(1, 0, 1, 1)); // A pushed to col1
    expect(map.get('C')).toEqual(rect(0, 1, 1, 1)); // C stays at row1
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

  it('reflows around a RESIZE: growing the active card to L pushes a neighbour below it', () => {
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'A', slot: { x: 0, y: 0, w: 2, h: 2 } });
    expect(map.get('A')).toEqual(rect(0, 0, 2, 2)); // the grown footprint, pinned
    expect(map.get('B')).toEqual(rect(0, 2, 1, 1)); // no room in rows 0-1 -> appended below
    assertNoOverlap(map);
  });

  it('clamps a full-width target dropped at column 1 back onto the two-column grid', () => {
    const instances = [inst('A', rect(0, 0, 2, 1, 5)), inst('B', rect(0, 1, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'A', slot: { x: 1, y: 0, w: 2, h: 1 } });
    expect(map.get('A')).toMatchObject({ x: 0, w: 2, z: 5 }); // col1 -> col0 (x + w <= 2)
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
    const instances = [inst('A', rect(0, 0, 1, 1)), inst('B', rect(1, 0, 1, 1)), inst('C', rect(0, 1, 1, 1))];
    const map = reflowForTarget(instances, { instanceId: 'B', slot: { x: 0, y: 0, w: 1, h: 1 } });
    const commits = collectArrangeCommits(instances, map);
    // B moved (1,0)->(0,0), A moved (0,0)->(1,0); C stayed at (0,1) -> no patch.
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
    expect(B?.patch).toEqual({ rect: rect(0, 2, 1, 1), size: 'S' }); // pushed below, still S
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
