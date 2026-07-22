// AOD-140 / AOD-197 pure arrange orchestration under "place, don't pack" (design §8): placeActive resolves
// the nearest-free landing the hairline shows, activeCommit is the single drop commit. The gesture FEEL is
// device (AOD-190), but these are the WYSIWYG RESULTS the contract turns on — a free target wins outright,
// an occupied target nudges to the nearest free fit, neighbours never move, and a no-op drop commits nothing.
import type { LayoutRect, WidgetInstance } from '../../registry/types';
import { activeCommit, placeActive } from '../arrange';

const rect = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });

// A minimal WidgetInstance: only the fields the pure orchestration reads (id + rect). size is carried for
// realism but the commit derives size from the landed footprint, not from this.
function inst(id: string, r: LayoutRect, size: WidgetInstance['size'] = 'S'): WidgetInstance {
  return { instanceId: id, serviceId: 'stub', widgetType: 'w', config: {}, rect: r, size };
}

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
