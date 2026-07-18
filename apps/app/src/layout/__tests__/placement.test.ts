// Default placement derivation (AOD-10 §5.1/§5.2 size + §4.1 config defaults). Pure: no registry, no
// I/O. Proves the size preference, the non-overlapping rect, and the generic config defaults that a
// freshly added instance carries before the dashboard repo inserts it.
import {
  defaultConfig,
  defaultPlacementRect,
  defaultPlacementSize,
  defaultSeedFor,
  requiresConfiguration,
} from '../placement';
import type { WidgetConfigSchema, WidgetDefinition, WidgetInstance } from '../../registry/types';

function def(overrides: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return {
    type: 'placeholder',
    serviceId: 'stub',
    title: 'Stub Widget',
    supportedSizes: ['S', 'W', 'L'], // AOD-122 slot ids (was ['small','medium','large'])
    defaultRefresh: { seconds: 300 },
    configSchema: { fields: [] },
    render: () => null,
    ...overrides,
  };
}

function inst(rect: WidgetInstance['rect'], id = 'i'): WidgetInstance {
  return { instanceId: id, serviceId: 'stub', widgetType: 'placeholder', config: {}, size: 'W', rect };
}

describe('defaultPlacementSize (AOD-10 §5.2 rule over the AOD-122 slot grid)', () => {
  it('prefers W (the 2x1 default card, the pre-slot medium) when the widget supports it', () => {
    expect(defaultPlacementSize(['S', 'W', 'L'])).toBe('W');
    expect(defaultPlacementSize(['L', 'W'])).toBe('W');
  });

  it('falls back to the first declared size when W is absent', () => {
    expect(defaultPlacementSize(['M', 'L'])).toBe('M');
    expect(defaultPlacementSize(['S'])).toBe('S');
  });

  it('falls back to W for a malformed empty set', () => {
    expect(defaultPlacementSize([])).toBe('W');
  });
});

describe('defaultPlacementRect (AOD-10 §5.1 nominal geometry, non-overlap)', () => {
  it('places the first widget at the origin with the slot nominal w/h', () => {
    expect(defaultPlacementRect('W', [])).toEqual({ x: 0, y: 0, w: 2, h: 1, z: 0 });
    expect(defaultPlacementRect('L', [])).toEqual({ x: 0, y: 0, w: 2, h: 2, z: 0 });
    expect(defaultPlacementRect('M', [])).toEqual({ x: 0, y: 0, w: 1, h: 2, z: 0 });
  });

  it('stacks below every existing instance and on top of the z-stack', () => {
    const existing = [
      inst({ x: 0, y: 0, w: 2, h: 1, z: 0 }),
      inst({ x: 1, y: 1, w: 1, h: 2, z: 5 }, 'j'),
    ];
    // max bottom = max(0+1, 1+2) = 3; max z = 5 -> 6
    expect(defaultPlacementRect('W', existing)).toEqual({ x: 0, y: 3, w: 2, h: 1, z: 6 });
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

describe('requiresConfiguration (AOD-10 §4 configure-on-add predicate)', () => {
  it('is false when the schema has no fields (the stub-as-shipped before config fields)', () => {
    expect(requiresConfiguration({ fields: [] })).toBe(false);
  });

  it('is false when every required field has a default (defaults alone validate)', () => {
    const schema: WidgetConfigSchema = {
      fields: [
        { key: 'density', label: 'Density', kind: 'enum', required: true, default: 'comfortable', options: [{ value: 'comfortable', label: 'Comfortable' }] },
        { key: 'label', label: 'Label', kind: 'string', required: false, default: 'Stub' },
      ],
    };
    expect(requiresConfiguration(schema)).toBe(false);
  });

  it('is true when a required field has no default (defaults cannot make it valid)', () => {
    const schema: WidgetConfigSchema = {
      fields: [{ key: 'name', label: 'Name', kind: 'string', required: true }],
    };
    expect(requiresConfiguration(schema)).toBe(true);
  });
});

describe('defaultSeedFor', () => {
  it('derives size, an origin rect, and empty config for an empty board (matches the bootstrap seed geometry)', () => {
    expect(defaultSeedFor(def(), [])).toEqual({
      serviceId: 'stub',
      widgetType: 'placeholder',
      config: {},
      size: 'W',
      rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
    });
  });

  it('places a new instance below the existing ones', () => {
    const seed = defaultSeedFor(def(), [inst({ x: 0, y: 0, w: 2, h: 1, z: 0 })]);
    expect(seed.rect).toEqual({ x: 0, y: 1, w: 2, h: 1, z: 1 });
  });

  it('uses the collected config when configure-on-add supplies one (overriding schema defaults)', () => {
    const seed = defaultSeedFor(def(), [], { name: 'chosen' });
    expect(seed.config).toEqual({ name: 'chosen' });
  });
});
