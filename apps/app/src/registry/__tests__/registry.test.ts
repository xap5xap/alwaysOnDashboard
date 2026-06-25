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
    expect(widgets.map((w) => w.type)).toEqual(['placeholder']);
    expect(widgets[0].serviceId).toBe('stub');
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
