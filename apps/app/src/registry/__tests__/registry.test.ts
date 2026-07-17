// The registry seam (AOD-8 §9, §10) against the REAL SERVICE_REGISTRY. addableWidgets encodes
// invariant 2 (connected-only): a credentialed service (oauth2 / admin_key / platform_key) is gated
// and offers nothing until connected; authClass 'none' (Clock) is the sole exemption.
// getWidgetDef/getService resolve an instance's references back to its definition (invariant 1).
import { addableWidgets, getService, getWidgetDef, SERVICE_REGISTRY } from '../registry';

describe('addableWidgets (AOD-8 §9 invariant 2: connected-only, with the authClass none exemption)', () => {
  it('offers only Clock (the sole none exemption) when nothing is connected', () => {
    // The Linear/Calendar/Weather/Claude services are all gated; Clock (authClass none) alone is
    // exempt (integration-clock.md §3.1), so it is the only widget offered with no connection.
    expect(addableWidgets(new Set()).map((w) => w.serviceId)).toEqual(['clock']);
  });

  it("offers a connected service's widgets alongside the always-on Clock", () => {
    const widgets = addableWidgets(new Set(['linear']));
    const linear = widgets.filter((w) => w.serviceId === 'linear');
    expect(linear.map((w) => w.type)).toEqual(['my_issues', 'current_cycle']);
    // Clock is always addable, even when another service is connected.
    expect(widgets.some((w) => w.serviceId === 'clock')).toBe(true);
  });

  it('ignores connected ids that are not in the registry (only the none-exempt Clock remains)', () => {
    expect(addableWidgets(new Set(['not-a-service'])).map((w) => w.serviceId)).toEqual(['clock']);
  });
});

describe('definition resolution (AOD-8 §9 invariant 1)', () => {
  it('resolves a registered service and widget, and returns undefined otherwise', () => {
    expect(getService('clock')?.displayName).toBe('Clock');
    expect(getWidgetDef('clock', 'clock')?.title).toBe('Clock');
    expect(getService('ghost')).toBeUndefined();
    expect(getWidgetDef('clock', 'ghost')).toBeUndefined();
  });
});

describe('walking-skeleton stub removal (AOD-126, resolves AOD-94)', () => {
  it('the production registry carries exactly the v1 real services, and no stub', () => {
    expect(SERVICE_REGISTRY.map((s) => s.id)).toEqual([
      'linear',
      'google_calendar',
      'weather',
      'anthropic_usage',
      'clock',
    ]);
    expect(getService('stub')).toBeUndefined();
    expect(getWidgetDef('stub', 'placeholder')).toBeUndefined();
    // No registered service publishes the stub's widget types either.
    const allTypes = SERVICE_REGISTRY.flatMap((s) => s.widgets.map((w) => w.type));
    expect(allTypes).not.toContain('placeholder');
    expect(allTypes).not.toContain('placeholder_remote');
  });

  it("a connected 'stub' id offers nothing (only the none-exempt Clock remains)", () => {
    expect(addableWidgets(new Set(['stub'])).map((w) => w.serviceId)).toEqual(['clock']);
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
    expect(def.supportedSizes).toEqual(['W', 'L', 'M']); // AOD-122 slot ids (was ['medium','large','tall'])
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

    // AOD-124: the caption is the PROJECT; projectId persists its chosen label under projectLabel.
    expect(def.caption).toEqual({ kind: 'projectOrTeam', labelKey: 'projectLabel' });
    expect(projectId.kind === 'remote-options' && projectId.labelKey).toBe('projectLabel');
  });

  it('Current Cycle declares the §4.2 sizes and the §5.2 teamId option source', () => {
    const def = getWidgetDef('linear', 'current_cycle')!;
    expect(def.supportedSizes).toEqual(['W', 'L']); // AOD-122 slot ids (was ['medium','large'])
    expect(def.cacheTtlSeconds).toBe(300);

    const teamId = def.configSchema.fields[0];
    expect(teamId.key).toBe('teamId');
    expect(teamId.kind === 'remote-options' && teamId.source.optionSource).toBe('linear_teams');

    // AOD-124: the caption is the TEAM; teamId persists its chosen label under teamLabel.
    expect(def.caption).toEqual({ kind: 'projectOrTeam', labelKey: 'teamLabel' });
    expect(teamId.kind === 'remote-options' && teamId.labelKey).toBe('teamLabel');
  });

  it('Linear widgets become addable only once Linear is connected (oauth2, not exempt)', () => {
    expect(addableWidgets(new Set()).some((w) => w.serviceId === 'linear')).toBe(false);
    const linearWidgets = addableWidgets(new Set(['linear'])).filter((w) => w.serviceId === 'linear');
    expect(linearWidgets.map((w) => w.type)).toEqual(['my_issues', 'current_cycle']);
  });
});

describe('Google Calendar service registration (AOD-56, integration-calendar.md §8)', () => {
  it("registers the Google Calendar oauth2 service with Next Event + Today's Agenda", () => {
    const cal = getService('google_calendar');
    expect(cal?.displayName).toBe('Google Calendar');
    expect(cal?.authClass).toBe('oauth2');
    expect(cal?.widgets.map((w) => w.type)).toEqual(['next_event', 'agenda']);
  });

  it('Next Event declares the §4.1 sizes/TTLs and the §5.1 calendarId option source', () => {
    const def = getWidgetDef('google_calendar', 'next_event')!;
    expect(def.title).toBe('Next Event');
    expect(def.supportedSizes).toEqual(['S', 'W']); // AOD-122 slot ids (was ['small','medium'])
    expect(def.defaultRefresh).toEqual({ seconds: 600 });
    expect(def.cacheTtlSeconds).toBe(300);
    expect(def.minRefreshSeconds).toBe(120);

    const calendarId = def.configSchema.fields[0];
    expect(calendarId.key).toBe('calendarId');
    expect(calendarId.kind).toBe('remote-options');
    expect(calendarId.required).toBe(true);
    expect(calendarId.kind === 'remote-options' && calendarId.source.optionSource).toBe('google_calendars');

    // AOD-124: the caption is the CALENDAR, hidden at the self-evident S; calendarId persists its label.
    expect(def.caption).toEqual({ kind: 'calendar', labelKey: 'calendarLabel', hideAtSizes: ['S'] });
    expect(calendarId.kind === 'remote-options' && calendarId.labelKey).toBe('calendarLabel');
  });

  it("Today's Agenda declares the §4.2 sizes/TTLs and the §5.2 calendarId option source", () => {
    const def = getWidgetDef('google_calendar', 'agenda')!;
    expect(def.title).toBe("Today's Agenda");
    expect(def.supportedSizes).toEqual(['M', 'W']); // AOD-122 slot ids (was ['tall','wide']; wide 3x1 folds into W)
    expect(def.defaultRefresh).toEqual({ seconds: 900 });
    expect(def.cacheTtlSeconds).toBe(600);
    expect(def.minRefreshSeconds).toBe(300);

    const calendarId = def.configSchema.fields[0];
    expect(calendarId.key).toBe('calendarId');
    expect(calendarId.kind === 'remote-options' && calendarId.source.optionSource).toBe('google_calendars');

    // AOD-124: the caption is the CALENDAR; Agenda is M/W (never S), so no size gate.
    expect(def.caption).toEqual({ kind: 'calendar', labelKey: 'calendarLabel' });
    expect(calendarId.kind === 'remote-options' && calendarId.labelKey).toBe('calendarLabel');
  });

  it('Calendar widgets become addable only once Google Calendar is connected (oauth2, not exempt)', () => {
    expect(addableWidgets(new Set()).some((w) => w.serviceId === 'google_calendar')).toBe(false);
    const calWidgets = addableWidgets(new Set(['google_calendar'])).filter((w) => w.serviceId === 'google_calendar');
    expect(calWidgets.map((w) => w.type)).toEqual(['next_event', 'agenda']);
  });
});

describe('Clock service registration (AOD-60, integration-clock.md §8): the authClass none bookend', () => {
  it('registers Clock as the only authClass none service, one widget, no server half to mirror', () => {
    const clock = getService('clock');
    expect(clock?.displayName).toBe('Clock');
    expect(clock?.authClass).toBe('none');
    expect(clock?.icon).toBe('clock');
    expect(clock?.widgets.map((w) => w.type)).toEqual(['clock']);
  });

  it('Clock declares manual refresh and OMITS the provider cache knobs (no provider to protect, §7)', () => {
    const def = getWidgetDef('clock', 'clock')!;
    expect(def.title).toBe('Clock');
    // AOD-122 slot ids (was ['small','medium','wide','large']; the retired 3x1 wide folds into W).
    expect(def.supportedSizes).toEqual(['S', 'W', 'L']);
    expect(def.defaultRefresh).toBe('manual');
    expect(def.cacheTtlSeconds).toBeUndefined();
    expect(def.minRefreshSeconds).toBeUndefined();
    // AOD-37 §8.5: the Clock is the deep-red useAmbient() opt-in, so it OPTS OUT of the global dim
    // overlay (false). AOD-124: it is chromeless — caption { kind: 'hidden' } drops the header at EVERY
    // size (a clock is self-evident), superseding the old hideHeaderAtSizes ['S'].
    expect(def.dimsWithAmbient).toBe(false);
    expect(def.caption).toEqual({ kind: 'hidden' });
  });

  it('declares the §5 static config: 12/24h, seconds, date + format, and a string timezone (no remote-options)', () => {
    const fields = getWidgetDef('clock', 'clock')!.configSchema.fields;
    expect(fields.map((f) => f.key)).toEqual(['clockFormat', 'showSeconds', 'showDate', 'dateFormat', 'timezone']);
    // No field is required (ready on add, §9.1); none is remote-options (no option source / no needs_config
    // edge, §5.3/§5.4); the timezone is a plain string validated client-side at save (§5.2).
    expect(fields.every((f) => f.required === false)).toBe(true);
    expect(fields.every((f) => f.kind !== 'remote-options')).toBe(true);
    expect(fields.find((f) => f.key === 'timezone')!.kind).toBe('string');
  });

  it('Clock is addable with NO connection (the sole none exemption, §3.1)', () => {
    const clockWidgets = addableWidgets(new Set()).filter((w) => w.serviceId === 'clock');
    expect(clockWidgets.map((w) => w.type)).toEqual(['clock']);
  });
});
