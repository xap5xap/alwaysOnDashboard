// The widget_instances row <-> WidgetInstance boundary. Reads drop malformed rows (AOD-8 §9
// invariant 1); writes re-validate so no bad geometry is persisted. AOD-122: reads also COERCE the
// authoritative rect onto the S/M/W/L slot grid (legacy rows render at legal slot sizes with no
// write-back), and writes serialize the slot id into the frozen DB CHECK vocabulary (SIZE_TO_DB).
import type { Tables } from '@vela/shared';
import {
  buildAddPos,
  configToUpdate,
  instanceToInsert,
  layoutToUpdate,
  mergeStoredRect,
  parseStoredRect,
  resolveInstances,
  rowToInstance,
  rowToStoredInstance,
  storedRectToJson,
  storedRectToUpdate,
  type InstanceSeed,
  type StoredInstance,
} from '../mapper';
import type { NormalizedStoredRect } from '../schema';

function row(overrides: Partial<Tables<'widget_instances'>> = {}): Tables<'widget_instances'> {
  return {
    id: 'inst-1',
    dashboard_id: 'dash-1',
    user_id: 'user-1',
    service_id: 'stub',
    widget_type: 'placeholder',
    size: 'medium',
    config: {},
    rect: { x: 0, y: 2, w: 2, h: 1, z: 0 },
    refresh: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('rowToInstance (read path: gate on the DB vocabulary, then coerce to the slot grid)', () => {
  it('maps a valid legacy row, coercing its size id (medium 2x1 -> W, rect untouched)', () => {
    expect(rowToInstance(row())).toEqual({
      instanceId: 'inst-1',
      serviceId: 'stub',
      widgetType: 'placeholder',
      config: {},
      rect: { x: 0, y: 2, w: 2, h: 1, z: 0 },
      size: 'W',
    });
  });

  it('resolves every legacy (size, rect) pair deterministically (the AOD-122 coercion table)', () => {
    expect(rowToInstance(row({ size: 'small', rect: { x: 1, y: 0, w: 1, h: 1, z: 3 } }))).toMatchObject({
      rect: { x: 1, y: 0, w: 1, h: 1, z: 3 },
      size: 'S',
    });
    expect(rowToInstance(row({ size: 'tall', rect: { x: 0, y: 1, w: 1, h: 2, z: 0 } }))).toMatchObject({
      rect: { x: 0, y: 1, w: 1, h: 2, z: 0 },
      size: 'M',
    });
    expect(rowToInstance(row({ size: 'large', rect: { x: 0, y: 3, w: 2, h: 2, z: 1 } }))).toMatchObject({
      rect: { x: 0, y: 3, w: 2, h: 2, z: 1 },
      size: 'L',
    });
    // The retired wide 3x1 clamps to the nearest legal horizontal slot: W 2x1.
    expect(rowToInstance(row({ size: 'wide', rect: { x: 0, y: 0, w: 3, h: 1, z: 0 } }))).toMatchObject({
      rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      size: 'W',
    });
  });

  it('snaps a free-drop fractional rect (the pre-slot arrange canvas) onto the grid', () => {
    // x=0.6 rounds to col1 and survives on the wide landscape grid (it no longer collapses to 0 as at 2 cols).
    expect(rowToInstance(row({ size: 'medium', rect: { x: 0.6, y: 1.25, w: 2.3, h: 1.4, z: 4 } }))).toMatchObject({
      rect: { x: 1, y: 1, w: 2, h: 1, z: 4 },
      size: 'W',
    });
  });

  it('the rect is authoritative: a size/rect disagreement resolves to the rect (stored hint ignored)', () => {
    // The row SAYS medium (-> W) but the rect the user last saw was ~1x2: the slot is M.
    expect(rowToInstance(row({ size: 'medium', rect: { x: 0, y: 0, w: 1.1, h: 1.9, z: 0 } }))).toMatchObject({
      rect: { x: 0, y: 0, w: 1, h: 2, z: 0 },
      size: 'M',
    });
  });

  it('includes a valid refresh override', () => {
    expect(rowToInstance(row({ refresh: { seconds: 120 } }))?.refresh).toEqual({ seconds: 120 });
    expect(rowToInstance(row({ refresh: 'manual' }))?.refresh).toBe('manual');
  });

  it('drops a row with a malformed rect', () => {
    expect(rowToInstance(row({ rect: { x: 0, y: 0, w: 0, h: 1, z: 0 } }))).toBeNull();
    expect(rowToInstance(row({ rect: { x: 'a', y: 0, w: 1, h: 1, z: 0 } as never }))).toBeNull();
    expect(rowToInstance(row({ rect: null as never }))).toBeNull();
  });

  it('drops a row whose size is outside the DB vocabulary (junk AND un-serialized slot ids)', () => {
    expect(rowToInstance(row({ size: 'huge' }))).toBeNull();
    // The CHECK constraint makes a stored 'W' impossible today; if a future migration moves the column
    // to slot ids, widen DbWidgetSizeSchema FIRST, then flip SIZE_TO_DB — this lock documents the order.
    expect(rowToInstance(row({ size: 'W' }))).toBeNull();
  });

  it('drops a row with an invalid refresh', () => {
    expect(rowToInstance(row({ refresh: { seconds: 0 } }))).toBeNull();
  });

  it('coerces a non-object config to an empty object', () => {
    expect(rowToInstance(row({ config: 42 as never }))?.config).toEqual({});
  });
});

describe('instanceToInsert (write path: serialize the new per-orientation rect + the DB-vocabulary size)', () => {
  it('builds a validated insert with explicit user_id, no client-supplied id, the serialized size, and the new rect shape', () => {
    const insert = instanceToInsert(
      { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'W', rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } },
      'dash-9',
      'user-9',
      { landscape: { x: 0, y: 0 } },
    );
    expect(insert).toMatchObject({
      dashboard_id: 'dash-9',
      user_id: 'user-9',
      service_id: 'stub',
      widget_type: 'placeholder',
      size: 'medium', // W's exact geometric twin in the frozen CHECK vocabulary
      // AOD-197: the shared footprint (w,h,z) + a position per designed orientation.
      rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } },
      refresh: null,
    });
    expect('id' in insert).toBe(false);
  });

  it('serializes a position for EVERY designed orientation the pos carries (add-in-all-designed)', () => {
    const insert = instanceToInsert(
      { serviceId: 's', widgetType: 't', config: {}, size: 'S', rect: { x: 4, y: 0, w: 1, h: 1, z: 2 } },
      'd',
      'u',
      { landscape: { x: 4, y: 0 }, portrait: { x: 0, y: 1 } },
    );
    expect(insert.rect).toEqual({ w: 1, h: 1, z: 2, pos: { landscape: { x: 4, y: 0 }, portrait: { x: 0, y: 1 } } });
  });

  it('serializes every slot id to its geometric legacy twin (S/M/W/L -> small/tall/medium/large)', () => {
    const seed = (size: 'S' | 'M' | 'W' | 'L', w: number, h: number) =>
      instanceToInsert(
        { serviceId: 's', widgetType: 't', config: {}, size, rect: { x: 0, y: 0, w, h, z: 0 } },
        'd',
        'u',
        { landscape: { x: 0, y: 0 } },
      ).size;
    expect(seed('S', 1, 1)).toBe('small');
    expect(seed('M', 1, 2)).toBe('tall');
    expect(seed('W', 2, 1)).toBe('medium');
    expect(seed('L', 2, 2)).toBe('large');
  });

  it('throws on a malformed footprint (validate on write)', () => {
    expect(() =>
      instanceToInsert(
        { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'W', rect: { x: 0, y: 0, w: -1, h: 1, z: 0 } },
        'd',
        'u',
        { landscape: { x: 0, y: 0 } },
      ),
    ).toThrow();
  });

  it('throws on an empty pos (no designed orientation is an invalid write)', () => {
    expect(() =>
      instanceToInsert(
        { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'W', rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } },
        'd',
        'u',
        {},
      ),
    ).toThrow();
  });

  it('throws on a non-slot size id (legacy words are a DB vocabulary, not a seed vocabulary)', () => {
    expect(() =>
      instanceToInsert(
        { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'medium' as never, rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } },
        'd',
        'u',
        { landscape: { x: 0, y: 0 } },
      ),
    ).toThrow();
  });
});

describe('layoutToUpdate (AOD-197: serialize the merged per-orientation stored rect + size)', () => {
  const stored = (pos: NormalizedStoredRect['pos'], w = 1, h = 2, z = 1): NormalizedStoredRect => ({
    w,
    h,
    z,
    pos,
  });

  it('always sets rect (the whole per-orientation shape) + the serialized size, and leaves refresh untouched when omitted', () => {
    const update = layoutToUpdate({ storedRect: stored({ landscape: { x: 0, y: 4 } }), size: 'M' });
    expect(update).toEqual({ rect: { w: 1, h: 2, z: 1, pos: { landscape: { x: 0, y: 4 } } }, size: 'tall' });
    expect('refresh' in update).toBe(false);
  });

  it('preserves the OTHER orientation in the serialized rect (a landscape commit keeps portrait)', () => {
    const update = layoutToUpdate({
      storedRect: stored({ landscape: { x: 2, y: 0 }, portrait: { x: 0, y: 1 } }),
      size: 'M',
    });
    expect(update.rect).toEqual({ w: 1, h: 2, z: 1, pos: { landscape: { x: 2, y: 0 }, portrait: { x: 0, y: 1 } } });
  });

  it('clears refresh when null and sets it when provided', () => {
    expect(
      layoutToUpdate({ storedRect: stored({ landscape: { x: 0, y: 0 } }, 1, 1, 0), size: 'S', refresh: null })
        .refresh,
    ).toBeNull();
    expect(
      layoutToUpdate({
        storedRect: stored({ landscape: { x: 0, y: 0 } }, 1, 1, 0),
        size: 'S',
        refresh: { seconds: 60 },
      }).refresh,
    ).toEqual({ seconds: 60 });
  });
});

describe('storedRectToUpdate (rect-only UPDATE for the materialize non-edited instances)', () => {
  it('sets ONLY the rect jsonb, never size/refresh (a materialize leaves the footprint/size untouched)', () => {
    const update = storedRectToUpdate({ w: 2, h: 1, z: 0, pos: { landscape: { x: 2, y: 0 }, portrait: { x: 0, y: 0 } } });
    expect(update).toEqual({ rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 2, y: 0 }, portrait: { x: 0, y: 0 } } } });
    expect('size' in update).toBe(false);
    expect('refresh' in update).toBe(false);
  });

  it('throws on an empty pos (a stored rect must have at least one orientation)', () => {
    expect(() => storedRectToUpdate({ w: 2, h: 1, z: 0, pos: {} })).toThrow();
  });
});

describe('storedRectToJson (write validation gate)', () => {
  it('round-trips a valid new-shape rect', () => {
    const rect: NormalizedStoredRect = { w: 2, h: 2, z: 3, pos: { portrait: { x: 0, y: 1 } } };
    expect(storedRectToJson(rect)).toEqual(rect);
  });

  it('throws on an empty pos and on a non-positive footprint', () => {
    expect(() => storedRectToJson({ w: 2, h: 1, z: 0, pos: {} })).toThrow();
    expect(() => storedRectToJson({ w: 0, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } })).toThrow();
  });
});

describe('configToUpdate (AOD-10 §4 config-update path)', () => {
  it('sets only config, never touching rect/size/refresh', () => {
    const update = configToUpdate({ density: 'compact', label: 'Wall' });
    expect(update).toEqual({ config: { density: 'compact', label: 'Wall' } });
    expect('rect' in update).toBe(false);
    expect('size' in update).toBe(false);
    expect('refresh' in update).toBe(false);
  });

  it('accepts an empty config object', () => {
    expect(configToUpdate({})).toEqual({ config: {} });
  });

  it('rejects a non-object config (structural guard, data-model §5.5)', () => {
    expect(() => configToUpdate([] as never)).toThrow();
    expect(() => configToUpdate(null as never)).toThrow();
  });
});

describe('round-trip', () => {
  it('a legacy row coerces once, then row -> instance -> insert -> instance is a fixed point', () => {
    // A worst-case legacy row: the retired wide 3x1 parked past the right edge of the landscape grid. w
    // clamps to MAX_SLOT_W=2 and x clamps to the last legal landscape column (5 -> GRID_COLUMNS-2 = 4).
    const original = row({ rect: { x: 5, y: 6, w: 3, h: 1, z: 2 }, size: 'wide', config: { projectId: 'p1' } });
    const instance = rowToInstance(original)!;
    expect(instance.rect).toEqual({ x: 4, y: 6, w: 2, h: 1, z: 2 });
    expect(instance.size).toBe('W');

    const insert = instanceToInsert(
      {
        serviceId: instance.serviceId,
        widgetType: instance.widgetType,
        config: instance.config,
        size: instance.size,
        rect: instance.rect,
        refresh: instance.refresh,
      },
      original.dashboard_id,
      original.user_id,
      // The instance the user last saw is landscape-designed at the coerced position.
      { landscape: { x: instance.rect.x, y: instance.rect.y } },
    );
    // The written rect is now the new per-orientation shape (landscape position + shared footprint).
    expect(insert.rect).toEqual({ w: 2, h: 1, z: 2, pos: { landscape: { x: 4, y: 6 } } });
    expect(insert.size).toBe('medium'); // W serialized into the frozen vocabulary
    expect(insert.config).toEqual({ projectId: 'p1' });

    // Reading the just-written NEW-shape row back changes NOTHING (idempotent on slot geometry).
    const echoed = rowToInstance(row({ rect: insert.rect as never, size: insert.size as never }))!;
    expect(echoed.rect).toEqual(instance.rect);
    expect(echoed.size).toBe(instance.size);
  });

  it('a NEW-shape landscape row round-trips its position with no drop and no coordinate loss', () => {
    const stored = row({
      rect: { w: 2, h: 2, z: 1, pos: { landscape: { x: 3, y: 2 } } } as never,
      size: 'large',
    });
    const instance = rowToInstance(stored)!;
    expect(instance).toMatchObject({ rect: { x: 3, y: 2, w: 2, h: 2, z: 1 }, size: 'L' });
  });
});

// AOD-197: the per-orientation READ. rowToStoredInstance parses the stored shape (legacy OR new) into a
// StoredInstance holding BOTH orientations; resolveInstances collapses a BOARD onto one orientation. The
// #1 failure mode to hunt is DATA LOSS via drop-on-invalid — these prove no VALID instance is ever dropped
// (legacy + new-shape), a malformed one still drops, and the wall's landscape resolution is UNCHANGED.
describe('rowToStoredInstance (parse the stored shape, hold both orientations)', () => {
  it('reads a legacy bare rect as LANDSCAPE-designed (no portrait), keeping the footprint', () => {
    const stored = rowToStoredInstance(row({ rect: { x: 1, y: 2, w: 2, h: 1, z: 0 } }))!;
    expect(stored).toMatchObject({
      instanceId: 'inst-1',
      w: 2,
      h: 1,
      z: 0,
      pos: { landscape: { x: 1, y: 2 } },
    });
    expect('portrait' in stored.pos).toBe(false);
  });

  it('reads a NEW-shape rect carrying BOTH orientations', () => {
    const stored = rowToStoredInstance(
      row({ rect: { w: 1, h: 2, z: 0, pos: { landscape: { x: 0, y: 0 }, portrait: { x: 2, y: 1 } } } as never }),
    )!;
    expect(stored.pos).toEqual({ landscape: { x: 0, y: 0 }, portrait: { x: 2, y: 1 } });
  });

  it('drops a row whose stored rect is malformed OR whose size/refresh is invalid (AOD-8 §9)', () => {
    expect(rowToStoredInstance(row({ rect: { w: 2, h: 1, z: 0, pos: {} } as never }))).toBeNull();
    expect(rowToStoredInstance(row({ rect: { x: 0, y: 0, w: 0, h: 1, z: 0 } }))).toBeNull();
    expect(rowToStoredInstance(row({ size: 'huge' }))).toBeNull();
    expect(rowToStoredInstance(row({ refresh: { seconds: 0 } }))).toBeNull();
  });

  it('carries a valid refresh override through', () => {
    expect(rowToStoredInstance(row({ refresh: 'manual' }))?.refresh).toBe('manual');
  });
});

describe('resolveInstances (collapse a board onto one orientation: designed=stored, derived=reflow)', () => {
  const s = (
    id: string,
    w: number,
    h: number,
    pos: StoredInstance['pos'],
  ): StoredInstance => ({ instanceId: id, serviceId: 'svc', widgetType: 't', config: {}, w, h, z: 0, pos });

  it('DESIGNED landscape uses the stored positions (WYSIWYG) and derives the size from the footprint', () => {
    const board = [
      s('a', 2, 1, { landscape: { x: 0, y: 0 } }),
      s('b', 1, 1, { landscape: { x: 4, y: 2 } }),
    ];
    expect(resolveInstances(board, 'landscape')).toEqual([
      { instanceId: 'a', serviceId: 'svc', widgetType: 't', config: {}, rect: { x: 0, y: 0, w: 2, h: 1, z: 0 }, size: 'W' },
      { instanceId: 'b', serviceId: 'svc', widgetType: 't', config: {}, rect: { x: 4, y: 2, w: 1, h: 1, z: 0 }, size: 'S' },
    ]);
  });

  it('the wall guarantee: a legacy (landscape-designed) board resolves BYTE-IDENTICAL to the pre-AOD-197 read', () => {
    // Same rows the old rowToInstance mapped; resolveInstances(landscape) must produce the same rects.
    const legacyRows = [
      row({ id: 'wi-a', rect: { x: 0, y: 0, w: 2, h: 1, z: 0 }, size: 'medium' }),
      row({ id: 'wi-b', rect: { x: 5, y: 6, w: 3, h: 1, z: 2 }, size: 'wide' }), // 3x1 clamps to W at col 4
    ];
    const stored = legacyRows.map(rowToStoredInstance).filter((x): x is StoredInstance => x !== null);
    const resolved = resolveInstances(stored, 'landscape'); // landscape is the default and the wall's orientation
    expect(resolved.map((i) => ({ rect: i.rect, size: i.size }))).toEqual([
      { rect: { x: 0, y: 0, w: 2, h: 1, z: 0 }, size: 'W' },
      { rect: { x: 4, y: 6, w: 2, h: 1, z: 2 }, size: 'W' },
    ]);
    // And it matches the per-row rowToInstance (the byte-identical proof).
    expect(resolved).toEqual(legacyRows.map((r) => rowToInstance(r)));
  });

  it('DERIVED portrait reflows the designed landscape "one next to the other" into 4 columns', () => {
    // A landscape-designed board spread across 6 columns; portrait derives by reflowToColumns(_, 4).
    const board = [
      s('a', 2, 1, { landscape: { x: 0, y: 0 } }),
      s('b', 2, 1, { landscape: { x: 4, y: 0 } }),
      s('c', 1, 1, { landscape: { x: 2, y: 3 } }),
    ];
    const portrait = resolveInstances(board, 'portrait');
    // Reading order (y,x): a(0,0) -> (0,0); b(0,4) -> (2,0) [cols 2-3]; c(3,2) -> (0,1) [next row].
    expect(portrait.map((i) => i.rect)).toEqual([
      { x: 0, y: 0, w: 2, h: 1, z: 0 },
      { x: 2, y: 0, w: 2, h: 1, z: 0 },
      { x: 0, y: 1, w: 1, h: 1, z: 0 },
    ]);
    // No instance dropped, none overlapping.
    expect(portrait).toHaveLength(3);
  });

  it('a PARTIAL/mixed state (some have pos[orientation], some do not) reflows — never drops or overlaps', () => {
    const board = [
      s('a', 2, 1, { landscape: { x: 0, y: 0 }, portrait: { x: 0, y: 0 } }), // designed in both
      s('b', 2, 1, { landscape: { x: 2, y: 0 } }), // NOT designed in portrait
    ];
    const portrait = resolveInstances(board, 'portrait'); // not every instance has portrait -> reflow path
    expect(portrait).toHaveLength(2);
    // Both placed on the 4-col grid without overlap (a at 0,0; b packs beside at cols 2-3).
    expect(portrait.map((i) => i.rect)).toEqual([
      { x: 0, y: 0, w: 2, h: 1, z: 0 },
      { x: 2, y: 0, w: 2, h: 1, z: 0 },
    ]);
  });

  it('returns [] for an empty board in either orientation (never throws)', () => {
    expect(resolveInstances([], 'landscape')).toEqual([]);
    expect(resolveInstances([], 'portrait')).toEqual([]);
  });

  it('defaults to landscape when no orientation is passed', () => {
    const board = [s('a', 1, 1, { landscape: { x: 3, y: 1 } })];
    expect(resolveInstances(board)).toEqual(resolveInstances(board, 'landscape'));
  });
});

describe('parseStoredRect (the read half of a read-modify-write)', () => {
  it('normalizes a legacy bare rect to landscape-designed', () => {
    expect(parseStoredRect({ x: 2, y: 3, w: 1, h: 1, z: 0 })).toEqual({
      w: 1,
      h: 1,
      z: 0,
      pos: { landscape: { x: 2, y: 3 } },
    });
  });

  it('returns null for a malformed stored rect', () => {
    expect(parseStoredRect({ w: 2, h: 1, z: 0, pos: {} })).toBeNull();
    expect(parseStoredRect(null)).toBeNull();
  });
});

describe('mergeStoredRect (write the active orientation, preserve the other)', () => {
  it('sets pos[orientation] + the shared footprint, PRESERVING the other orientation', () => {
    const base: NormalizedStoredRect = { w: 1, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 }, portrait: { x: 3, y: 2 } } };
    const merged = mergeStoredRect(base, 'landscape', { x: 2, y: 1 }, { w: 2, h: 2, z: 5 });
    expect(merged).toEqual({ w: 2, h: 2, z: 5, pos: { landscape: { x: 2, y: 1 }, portrait: { x: 3, y: 2 } } });
  });

  it('adds a second orientation to a base that only had one (materialize the derived edit)', () => {
    const base: NormalizedStoredRect = { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } };
    const merged = mergeStoredRect(base, 'portrait', { x: 1, y: 0 }, { w: 2, h: 1, z: 0 });
    expect(merged.pos).toEqual({ landscape: { x: 0, y: 0 }, portrait: { x: 1, y: 0 } });
  });
});

describe('buildAddPos (place in the active orientation + firstFreeSlot in every OTHER designed one)', () => {
  const seed: InstanceSeed = {
    serviceId: 's',
    widgetType: 't',
    config: {},
    size: 'W',
    rect: { x: 2, y: 0, w: 2, h: 1, z: 1 },
  };
  const s = (pos: StoredInstance['pos'], w = 2, h = 1): StoredInstance => ({
    instanceId: 'x',
    serviceId: 's',
    widgetType: 't',
    config: {},
    w,
    h,
    z: 0,
    pos,
  });

  it('a landscape-only board (portrait derived) stores JUST pos.landscape = the seed (the S3 live case)', () => {
    const existing = [s({ landscape: { x: 0, y: 0 } })]; // portrait NOT designed
    expect(buildAddPos(seed, 'landscape', existing)).toEqual({ landscape: { x: 2, y: 0 } });
  });

  it('an empty board stores just the active orientation', () => {
    expect(buildAddPos(seed, 'landscape', [])).toEqual({ landscape: { x: 2, y: 0 } });
  });

  it('when BOTH orientations are designed, the new card gets a firstFreeSlot in the OTHER too', () => {
    // portrait is designed: one 2x1 card at (0,0); the new W (w=2) firstFreeSlot in 4 cols is (2,0).
    const existing = [s({ landscape: { x: 0, y: 0 }, portrait: { x: 0, y: 0 } })];
    const pos = buildAddPos(seed, 'landscape', existing);
    expect(pos.landscape).toEqual({ x: 2, y: 0 }); // the active orientation = the seed
    expect(pos.portrait).toEqual({ x: 2, y: 0 }); // firstFreeSlot beside the existing card in 4-col portrait
  });

  it('adding in PORTRAIT places the seed in portrait and firstFreeSlot in the designed landscape', () => {
    const portraitSeed: InstanceSeed = { ...seed, rect: { x: 0, y: 0, w: 2, h: 1, z: 1 } };
    const existing = [s({ landscape: { x: 0, y: 0 } })]; // landscape designed, portrait derived
    const pos = buildAddPos(portraitSeed, 'portrait', existing);
    expect(pos.portrait).toEqual({ x: 0, y: 0 }); // the active orientation = the seed
    expect(pos.landscape).toEqual({ x: 2, y: 0 }); // firstFreeSlot beside the existing landscape card (6 cols)
  });
});
