// Default placement derivation (AOD-10 §5.1/§5.2 size + §4.1 config defaults). Pure: no registry, no
// I/O. Proves the size preference, the non-overlapping rect, and the generic config defaults that a
// freshly added instance carries before the dashboard repo inserts it.
import {
  defaultConfig,
  defaultPlacementRect,
  defaultPlacementSize,
  defaultSeedFor,
} from '../placement';
import type { WidgetConfigSchema, WidgetDefinition, WidgetInstance } from '../../registry/types';

function def(overrides: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return {
    type: 'placeholder',
    serviceId: 'stub',
    title: 'Stub Widget',
    supportedSizes: ['small', 'medium', 'large'],
    defaultRefresh: { seconds: 300 },
    configSchema: { fields: [] },
    render: () => null,
    ...overrides,
  };
}

function inst(rect: WidgetInstance['rect'], id = 'i'): WidgetInstance {
  return { instanceId: id, serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'medium', rect };
}

describe('defaultPlacementSize (AOD-10 §5.2)', () => {
  it('prefers medium when the widget supports it', () => {
    expect(defaultPlacementSize(['small', 'medium', 'large'])).toBe('medium');
    expect(defaultPlacementSize(['large', 'medium'])).toBe('medium');
  });

  it('falls back to the first declared size when medium is absent', () => {
    expect(defaultPlacementSize(['wide', 'tall'])).toBe('wide');
    expect(defaultPlacementSize(['small'])).toBe('small');
  });

  it('falls back to medium for a malformed empty set', () => {
    expect(defaultPlacementSize([])).toBe('medium');
  });
});

describe('defaultPlacementRect (AOD-10 §5.1 nominal geometry, non-overlap)', () => {
  it('places the first widget at the origin with the size nominal w/h', () => {
    expect(defaultPlacementRect('medium', [])).toEqual({ x: 0, y: 0, w: 2, h: 1, z: 0 });
    expect(defaultPlacementRect('large', [])).toEqual({ x: 0, y: 0, w: 2, h: 2, z: 0 });
    expect(defaultPlacementRect('tall', [])).toEqual({ x: 0, y: 0, w: 1, h: 2, z: 0 });
  });

  it('stacks below every existing instance and on top of the z-stack', () => {
    const existing = [
      inst({ x: 0, y: 0, w: 2, h: 1, z: 0 }),
      inst({ x: 3, y: 1, w: 2, h: 2, z: 5 }, 'j'),
    ];
    // max bottom = max(0+1, 1+2) = 3; max z = 5 -> 6
    expect(defaultPlacementRect('medium', existing)).toEqual({ x: 0, y: 3, w: 2, h: 1, z: 6 });
  });
});

describe('defaultConfig (AOD-10 §4.1)', () => {
  it('is empty for a schema with no fields (the stub)', () => {
    expect(defaultConfig({ fields: [] })).toEqual({});
  });

  it('applies field defaults generically across kinds, leaving defaultless fields unset', () => {
    const schema: WidgetConfigSchema = {
      fields: [
        {
          key: 'filter',
          label: 'Show',
          kind: 'enum',
          required: false,
          default: 'open',
          options: [{ value: 'open', label: 'Open' }],
        },
        { key: 'count', label: 'Count', kind: 'number', required: false, default: 5 },
        { key: 'live', label: 'Live', kind: 'boolean', required: false, default: true },
        // required, no default: collected by the config form (AOD-10 §4), not seeded here.
        { key: 'projectId', label: 'Project', kind: 'remote-options', required: true, source: { optionSource: 'x' } },
      ],
    };
    expect(defaultConfig(schema)).toEqual({ filter: 'open', count: 5, live: true });
  });
});

describe('defaultSeedFor', () => {
  it('derives size, an origin rect, and empty config for an empty board (matches the bootstrap stub seed)', () => {
    expect(defaultSeedFor(def(), [])).toEqual({
      serviceId: 'stub',
      widgetType: 'placeholder',
      config: {},
      size: 'medium',
      rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
    });
  });

  it('places a new instance below the existing ones', () => {
    const seed = defaultSeedFor(def(), [inst({ x: 0, y: 0, w: 2, h: 1, z: 0 })]);
    expect(seed.rect).toEqual({ x: 0, y: 1, w: 2, h: 1, z: 1 });
  });
});
