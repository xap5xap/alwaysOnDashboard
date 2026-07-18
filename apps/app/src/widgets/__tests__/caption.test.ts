// The pure caption resolver (AOD-124): one test per strategy, locking the resolution the host relies on —
// the SERVICE · WIDGET collapse, the size→null gate (subsuming hideHeaderAtSizes), place from data/config,
// and the label kinds' widget-name fallback (the needs_config case). Pure I/O-free function, no host needed.
import { DEFAULT_CAPTION_STRATEGY, resolveCaption, type CaptionContext } from '../caption';
import type { CaptionStrategy, WidgetSize } from '../../registry/types';

function ctx(over: Partial<CaptionContext> & { strategy: CaptionStrategy }): CaptionContext {
  return {
    size: 'W' as WidgetSize,
    title: 'My Issues',
    serviceName: 'Linear',
    config: {},
    data: undefined,
    ...over,
  };
}

describe('resolveCaption: hidden (chromeless)', () => {
  it('is null at every size', () => {
    for (const size of ['S', 'W', 'L', 'M'] as WidgetSize[]) {
      expect(resolveCaption(ctx({ strategy: { kind: 'hidden' }, size }))).toBeNull();
    }
  });
});

describe('resolveCaption: serviceWidget (default)', () => {
  it('renders SERVICE · WIDGET', () => {
    expect(resolveCaption(ctx({ strategy: { kind: 'serviceWidget' } }))).toBe('Linear · My Issues');
  });

  it('collapses to one token when the title IS the service name (a legacy Clock)', () => {
    expect(
      resolveCaption(ctx({ strategy: { kind: 'serviceWidget' }, serviceName: 'Clock', title: 'Clock' })),
    ).toBe('Clock');
  });

  it('the exported DEFAULT_CAPTION_STRATEGY is serviceWidget', () => {
    expect(DEFAULT_CAPTION_STRATEGY).toEqual({ kind: 'serviceWidget' });
  });

  it('hideAtSizes drops the caption to null at a listed size (subsumes hideHeaderAtSizes)', () => {
    const strategy: CaptionStrategy = { kind: 'serviceWidget', hideAtSizes: ['S'] };
    expect(resolveCaption(ctx({ strategy, size: 'S' }))).toBeNull();
    expect(resolveCaption(ctx({ strategy, size: 'W' }))).toBe('Linear · My Issues');
  });
});

describe('resolveCaption: place (Weather)', () => {
  const strategy: CaptionStrategy = { kind: 'place', labelKey: 'name', hideAtSizes: ['S'] };
  const base = { serviceName: 'Weather', title: 'Current Weather' };

  it('prefers the payload place (data.place)', () => {
    expect(
      resolveCaption(ctx({ ...base, strategy, config: { name: 'Ignored' }, data: { place: 'Quito' } })),
    ).toBe('Weather · Quito');
  });

  it('falls back to the config labelKey when the payload lacks a place', () => {
    expect(resolveCaption(ctx({ ...base, strategy, config: { name: 'Quito, Ecuador' }, data: {} }))).toBe(
      'Weather · Quito, Ecuador',
    );
  });

  it('reverts to the widget name when neither carries a place (e.g. loading)', () => {
    expect(resolveCaption(ctx({ ...base, strategy, config: {}, data: undefined }))).toBe(
      'Weather · Current Weather',
    );
  });

  it('is null at S (the self-evident 1x1 glance)', () => {
    expect(resolveCaption(ctx({ ...base, strategy, size: 'S', data: { place: 'Quito' } }))).toBeNull();
  });
});

describe('resolveCaption: projectOrTeam (Linear)', () => {
  it('renders SERVICE · <project label> from config', () => {
    const strategy: CaptionStrategy = { kind: 'projectOrTeam', labelKey: 'projectLabel' };
    expect(resolveCaption(ctx({ strategy, config: { projectId: 'p1', projectLabel: 'Vela' } }))).toBe(
      'Linear · Vela',
    );
  });

  it('reverts to the widget name when the label is absent (the needs_config case)', () => {
    const strategy: CaptionStrategy = { kind: 'projectOrTeam', labelKey: 'projectLabel' };
    expect(resolveCaption(ctx({ strategy, config: {} }))).toBe('Linear · My Issues');
  });

  it('reads a team label for Current Cycle', () => {
    const strategy: CaptionStrategy = { kind: 'projectOrTeam', labelKey: 'teamLabel' };
    expect(
      resolveCaption(ctx({ strategy, title: 'Current Cycle', config: { teamId: 't1', teamLabel: 'Voyage' } })),
    ).toBe('Linear · Voyage');
  });
});

describe('resolveCaption: calendar (Google Calendar)', () => {
  const strategy: CaptionStrategy = { kind: 'calendar', labelKey: 'calendarLabel', hideAtSizes: ['S'] };
  const base = { serviceName: 'Google Calendar', title: 'Next Event' };

  it('renders SERVICE · <calendar label> from the persisted config key', () => {
    expect(
      resolveCaption(ctx({ ...base, strategy, config: { calendarId: 'me@x', calendarLabel: 'Personal' } })),
    ).toBe('Google Calendar · Personal');
  });

  it('reverts to the widget name when the label is absent', () => {
    expect(resolveCaption(ctx({ ...base, strategy, config: { calendarId: 'me@x' } }))).toBe(
      'Google Calendar · Next Event',
    );
  });

  it('is null at S', () => {
    expect(
      resolveCaption(ctx({ ...base, strategy, size: 'S', config: { calendarLabel: 'Personal' } })),
    ).toBeNull();
  });

  it('ignores a blank/whitespace label (reverts to the widget name)', () => {
    expect(resolveCaption(ctx({ ...base, strategy, config: { calendarLabel: '   ' } }))).toBe(
      'Google Calendar · Next Event',
    );
  });
});
