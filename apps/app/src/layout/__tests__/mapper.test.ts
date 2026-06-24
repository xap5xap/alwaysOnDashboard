// The widget_instances row <-> WidgetInstance boundary. Reads drop malformed rows (AOD-8 §9
// invariant 1); writes re-validate so no bad geometry is persisted.
import type { Tables } from '@vela/shared';
import { instanceToInsert, layoutToUpdate, rowToInstance } from '../mapper';

function row(overrides: Partial<Tables<'widget_instances'>> = {}): Tables<'widget_instances'> {
  return {
    id: 'inst-1',
    dashboard_id: 'dash-1',
    user_id: 'user-1',
    service_id: 'stub',
    widget_type: 'placeholder',
    size: 'medium',
    config: {},
    rect: { x: 1, y: 2, w: 2, h: 1, z: 0 },
    refresh: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('rowToInstance', () => {
  it('maps a valid row to a WidgetInstance', () => {
    expect(rowToInstance(row())).toEqual({
      instanceId: 'inst-1',
      serviceId: 'stub',
      widgetType: 'placeholder',
      config: {},
      rect: { x: 1, y: 2, w: 2, h: 1, z: 0 },
      size: 'medium',
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

  it('drops a row with an invalid size or refresh', () => {
    expect(rowToInstance(row({ size: 'huge' }))).toBeNull();
    expect(rowToInstance(row({ refresh: { seconds: 0 } }))).toBeNull();
  });

  it('coerces a non-object config to an empty object', () => {
    expect(rowToInstance(row({ config: 42 as never }))?.config).toEqual({});
  });
});

describe('instanceToInsert', () => {
  it('builds a validated insert with explicit user_id and no client-supplied id', () => {
    const insert = instanceToInsert(
      { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'medium', rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } },
      'dash-9',
      'user-9',
    );
    expect(insert).toMatchObject({
      dashboard_id: 'dash-9',
      user_id: 'user-9',
      service_id: 'stub',
      widget_type: 'placeholder',
      size: 'medium',
      rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      refresh: null,
    });
    expect('id' in insert).toBe(false);
  });

  it('throws on a malformed rect (validate on write)', () => {
    expect(() =>
      instanceToInsert(
        { serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'medium', rect: { x: 0, y: 0, w: -1, h: 1, z: 0 } },
        'd',
        'u',
      ),
    ).toThrow();
  });
});

describe('layoutToUpdate', () => {
  it('always sets rect + size, and leaves refresh untouched when omitted', () => {
    const update = layoutToUpdate({ rect: { x: 3, y: 4, w: 1, h: 2, z: 1 }, size: 'tall' });
    expect(update).toEqual({ rect: { x: 3, y: 4, w: 1, h: 2, z: 1 }, size: 'tall' });
    expect('refresh' in update).toBe(false);
  });

  it('clears refresh when null and sets it when provided', () => {
    expect(layoutToUpdate({ rect: { x: 0, y: 0, w: 1, h: 1, z: 0 }, size: 'small', refresh: null }).refresh).toBeNull();
    expect(
      layoutToUpdate({ rect: { x: 0, y: 0, w: 1, h: 1, z: 0 }, size: 'small', refresh: { seconds: 60 } }).refresh,
    ).toEqual({ seconds: 60 });
  });
});

describe('round-trip', () => {
  it('row -> instance -> insert preserves geometry, size, and config', () => {
    const original = row({ rect: { x: 5, y: 6, w: 3, h: 1, z: 2 }, size: 'wide', config: { projectId: 'p1' } });
    const instance = rowToInstance(original)!;
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
    expect(insert.rect).toEqual({ x: 5, y: 6, w: 3, h: 1, z: 2 });
    expect(insert.size).toBe('wide');
    expect(insert.config).toEqual({ projectId: 'p1' });
  });
});
