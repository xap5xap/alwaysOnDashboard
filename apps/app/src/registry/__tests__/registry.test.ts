// The registry seam (AOD-8 §9, §10) against the REAL SERVICE_REGISTRY. addableWidgets encodes
// invariant 2 (connected-only); the stub is platform_key, so it is gated like any credentialed service
// and offers nothing until connected. getWidgetDef/getService resolve an instance's references back to
// its definition (invariant 1).
import { addableWidgets, getService, getWidgetDef } from '../registry';

describe('addableWidgets (AOD-8 §9 invariant 2: connected-only)', () => {
  it('offers nothing when no service is connected (the stub is platform_key, not exempt)', () => {
    expect(addableWidgets(new Set())).toEqual([]);
  });

  it("offers a service's widgets once it is connected", () => {
    const widgets = addableWidgets(new Set(['stub']));
    // The stub service publishes the bootstrap widget plus the AOD-53 remote-options vehicle.
    expect(widgets.map((w) => w.type)).toEqual(['placeholder', 'placeholder_remote']);
    expect(widgets.every((w) => w.serviceId === 'stub')).toBe(true);
  });

  it('ignores connected ids that are not in the registry', () => {
    expect(addableWidgets(new Set(['not-a-service']))).toEqual([]);
  });
});

describe('definition resolution (AOD-8 §9 invariant 1)', () => {
  it('resolves a registered service and widget, and returns undefined otherwise', () => {
    expect(getService('stub')?.displayName).toBe('Stub');
    expect(getWidgetDef('stub', 'placeholder')?.title).toBe('Stub Widget');
    expect(getService('ghost')).toBeUndefined();
    expect(getWidgetDef('stub', 'ghost')).toBeUndefined();
  });
});

describe('Linear service registration (AOD-55, integration-linear.md §8)', () => {
  it('registers the Linear oauth2 service with My Issues + Current Cycle', () => {
    const linear = getService('linear');
    expect(linear?.displayName).toBe('Linear');
    expect(linear?.authClass).toBe('oauth2');
    expect(linear?.widgets.map((w) => w.type)).toEqual(['my_issues', 'current_cycle']);
  });

  it('My Issues declares the §4.1 sizes/TTLs and the §5.1 config schema (projectId + filter)', () => {
    const def = getWidgetDef('linear', 'my_issues')!;
    expect(def.title).toBe('My Issues');
    expect(def.supportedSizes).toEqual(['medium', 'large', 'tall']);
    expect(def.defaultRefresh).toEqual({ seconds: 300 });
    expect(def.cacheTtlSeconds).toBe(120);
    expect(def.minRefreshSeconds).toBe(60);

    const fields = def.configSchema.fields;
    expect(fields.map((f) => f.key)).toEqual(['projectId', 'filter']);

    const projectId = fields.find((f) => f.key === 'projectId')!;
    expect(projectId.kind).toBe('remote-options');
    expect(projectId.required).toBe(true);
    expect(projectId.kind === 'remote-options' && projectId.source.optionSource).toBe('linear_projects');

    const filter = fields.find((f) => f.key === 'filter')!;
    expect(filter.kind).toBe('enum');
    expect(filter.kind === 'enum' && filter.options.map((o) => o.value)).toEqual(['open', 'in_progress', 'all']);
  });

  it('Current Cycle declares the §4.2 sizes and the §5.2 teamId option source', () => {
    const def = getWidgetDef('linear', 'current_cycle')!;
    expect(def.supportedSizes).toEqual(['medium', 'large']);
    expect(def.cacheTtlSeconds).toBe(300);

    const teamId = def.configSchema.fields[0];
    expect(teamId.key).toBe('teamId');
    expect(teamId.kind === 'remote-options' && teamId.source.optionSource).toBe('linear_teams');
  });

  it('Linear widgets become addable only once Linear is connected (oauth2, not exempt)', () => {
    expect(addableWidgets(new Set()).some((w) => w.serviceId === 'linear')).toBe(false);
    const linearWidgets = addableWidgets(new Set(['linear'])).filter((w) => w.serviceId === 'linear');
    expect(linearWidgets.map((w) => w.type)).toEqual(['my_issues', 'current_cycle']);
  });
});
