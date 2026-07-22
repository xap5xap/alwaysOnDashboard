// The widget_instances row <-> WidgetInstance boundary. Reads drop malformed rows (AOD-8 §9
// invariant 1); writes re-validate so no bad geometry is persisted. AOD-122: reads also COERCE the
// authoritative rect onto the S/M/W/L slot grid (legacy rows render at legal slot sizes with no
// write-back), and writes serialize the slot id into the frozen DB CHECK vocabulary (SIZE_TO_DB).
import type { Tables } from '@vela/shared';
import { configToUpdate, instanceToInsert, layoutToUpdate, rowToInstance } from '../mapper';

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

describe('instanceToInsert (write path: validate the slot id, serialize to the DB vocabulary)', () => {
  it('builds a validated insert with explicit user_id, no client-supplied id, and the serialized size', () => {
    const insert = instanceToInsert(
      { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'W', rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } },
      'dash-9',
      'user-9',
    );
    expect(insert).toMatchObject({
      dashboard_id: 'dash-9',
      user_id: 'user-9',
      service_id: 'stub',
      widget_type: 'placeholder',
      size: 'medium', // W's exact geometric twin in the frozen CHECK vocabulary
      rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      refresh: null,
    });
    expect('id' in insert).toBe(false);
  });

  it('serializes every slot id to its geometric legacy twin (S/M/W/L -> small/tall/medium/large)', () => {
    const seed = (size: 'S' | 'M' | 'W' | 'L', w: number, h: number) =>
      instanceToInsert(
        { serviceId: 's', widgetType: 't', config: {}, size, rect: { x: 0, y: 0, w, h, z: 0 } },
        'd',
        'u',
      ).size;
    expect(seed('S', 1, 1)).toBe('small');
    expect(seed('M', 1, 2)).toBe('tall');
    expect(seed('W', 2, 1)).toBe('medium');
    expect(seed('L', 2, 2)).toBe('large');
  });

  it('throws on a malformed rect (validate on write)', () => {
    expect(() =>
      instanceToInsert(
        { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'W', rect: { x: 0, y: 0, w: -1, h: 1, z: 0 } },
        'd',
        'u',
      ),
    ).toThrow();
  });

  it('throws on a non-slot size id (legacy words are a DB vocabulary, not a seed vocabulary)', () => {
    expect(() =>
      instanceToInsert(
        { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'medium' as never, rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } },
        'd',
        'u',
      ),
    ).toThrow();
  });
});

describe('layoutToUpdate', () => {
  it('always sets rect + the serialized size, and leaves refresh untouched when omitted', () => {
    const update = layoutToUpdate({ rect: { x: 0, y: 4, w: 1, h: 2, z: 1 }, size: 'M' });
    expect(update).toEqual({ rect: { x: 0, y: 4, w: 1, h: 2, z: 1 }, size: 'tall' });
    expect('refresh' in update).toBe(false);
  });

  it('clears refresh when null and sets it when provided', () => {
    expect(layoutToUpdate({ rect: { x: 0, y: 0, w: 1, h: 1, z: 0 }, size: 'S', refresh: null }).refresh).toBeNull();
    expect(
      layoutToUpdate({ rect: { x: 0, y: 0, w: 1, h: 1, z: 0 }, size: 'S', refresh: { seconds: 60 } }).refresh,
    ).toEqual({ seconds: 60 });
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
    );
    expect(insert.rect).toEqual({ x: 4, y: 6, w: 2, h: 1, z: 2 });
    expect(insert.size).toBe('medium'); // W serialized into the frozen vocabulary
    expect(insert.config).toEqual({ projectId: 'p1' });

    // Reading the just-written row back changes NOTHING (the coercion is idempotent on slot geometry).
    const echoed = rowToInstance(row({ rect: insert.rect as never, size: insert.size as never }))!;
    expect(echoed.rect).toEqual(instance.rect);
    expect(echoed.size).toBe(instance.size);
  });
});
