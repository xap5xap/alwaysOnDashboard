// Pure unit tests for the on-device Clock formatting (integration-clock.md §4.1, §5.2, §7.3, §12). No
// React, no host: a Date + ClockConfig in, a ClockView out, plus the IANA-zone validity check. The leaf
// (ClockCard) and the host none path are exercised in ClockCard.test.tsx. Locale is pinned to 'en-US' so
// the asserted strings are deterministic under the Node/jest ICU; whitespace is normalized because modern
// ICU emits a narrow no-break space (U+202F) before AM/PM.
import {
  deviceTimeZone,
  formatClock,
  humanizeZone,
  isValidTimeZone,
  resolveConfig,
  validateTimeZone,
  zoneShortOffset,
} from '../time';
import { CLOCK_CONFIG_DEFAULTS, type ClockConfig } from '../types';

// 2026-06-28T14:05:33Z: in UTC this reads 14:05:33 on Sunday, June 28, 2026.
const INSTANT = new Date('2026-06-28T14:05:33.000Z');
const EN = 'en-US';

/** Collapse Unicode whitespace (incl. the U+202F before AM/PM in modern ICU) to a single ASCII space. */
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function config(overrides: Partial<ClockConfig> = {}): ClockConfig {
  return { ...CLOCK_CONFIG_DEFAULTS, timezone: 'UTC', ...overrides };
}

describe('formatClock time formatting (integration-clock.md §4.1, §12)', () => {
  it('24-hour, no seconds -> "14:05"', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '24h', showSeconds: false, showDate: false }), EN);
    expect(norm(v.time)).toBe('14:05');
    expect(v.date).toBeNull();
  });

  it('24-hour with seconds -> "14:05:33"', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '24h', showSeconds: true, showDate: false }), EN);
    expect(norm(v.time)).toBe('14:05:33');
  });

  it('12-hour with seconds -> "2:05:33 PM"', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '12h', showSeconds: true, showDate: false }), EN);
    expect(norm(v.time)).toBe('2:05:33 PM');
  });

  it('12-hour, no seconds -> "2:05 PM"', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '12h', showSeconds: false, showDate: false }), EN);
    expect(norm(v.time)).toBe('2:05 PM');
  });
});

describe('formatClock date formatting maps dateFormat -> Intl dateStyle (integration-clock.md §5.1, §12)', () => {
  // Reference-equality against Intl with the same dateStyle/zone/locale: this pins that formatClock wires
  // dateFormat through as dateStyle (a wrong style or zone would diverge from the reference), without
  // hard-coding ICU output that can shift between versions.
  for (const dateStyle of ['full', 'long', 'medium', 'short'] as const) {
    it(`dateFormat "${dateStyle}" matches Intl dateStyle "${dateStyle}"`, () => {
      const v = formatClock(INSTANT, config({ dateFormat: dateStyle, showDate: true }), EN);
      const ref = new Intl.DateTimeFormat(EN, { dateStyle, timeZone: 'UTC' }).format(INSTANT);
      expect(v.date).toBe(ref);
    });
  }

  it('short date is the stable "6/28/26"', () => {
    const v = formatClock(INSTANT, config({ dateFormat: 'short', showDate: true }), EN);
    expect(v.date).toBe('6/28/26');
  });

  it('omits the date entirely when showDate is false', () => {
    const v = formatClock(INSTANT, config({ showDate: false }), EN);
    expect(v.date).toBeNull();
  });
});

describe('formatClock time-zone handling (integration-clock.md §5.2, §7.3)', () => {
  it('formats in an IANA override zone, and different zones differ at the same instant', () => {
    const ny = formatClock(INSTANT, config({ clockFormat: '12h', timezone: 'America/New_York', showSeconds: true, showDate: false }), EN);
    const tokyo = formatClock(INSTANT, config({ clockFormat: '12h', timezone: 'Asia/Tokyo', showSeconds: true, showDate: false }), EN);
    expect(ny.zone).toBe('America/New_York');
    expect(tokyo.zone).toBe('Asia/Tokyo');
    // 14:05:33Z is 10:05:33 in New York (UTC-4 in June) and 23:05:33 in Tokyo (UTC+9).
    expect(norm(ny.time)).toBe('10:05:33 AM');
    expect(norm(tokyo.time)).toBe('11:05:33 PM');
  });

  it('an empty timezone resolves to the device-local zone (the default, §5.2)', () => {
    const v = formatClock(INSTANT, { ...CLOCK_CONFIG_DEFAULTS, timezone: '' }, EN);
    expect(v.zone).toBe(deviceTimeZone());
  });

  it('a malformed stored zone degrades to device-local and never throws (§7.3)', () => {
    const fn = () => formatClock(INSTANT, { ...CLOCK_CONFIG_DEFAULTS, timezone: 'Mars/Phobos' }, EN);
    expect(fn).not.toThrow();
    expect(fn().zone).toBe(deviceTimeZone());
  });
});

describe('isValidTimeZone / validateTimeZone (integration-clock.md §5.2)', () => {
  it('isValidTimeZone accepts real IANA zones and rejects junk/empty', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidTimeZone('Mars/Phobos')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('validateTimeZone accepts empty (device-local) and valid zones, rejects invalid ones', () => {
    expect(validateTimeZone('')).toBeNull();
    expect(validateTimeZone('America/Guayaquil')).toBeNull();
    expect(validateTimeZone('Not/AZone')).toEqual(expect.any(String));
  });
});

describe('resolveConfig defensive read (integration-clock.md §5.1)', () => {
  it('returns the defaults for an empty config', () => {
    expect(resolveConfig({})).toEqual(CLOCK_CONFIG_DEFAULTS);
    expect(resolveConfig(undefined)).toEqual(CLOCK_CONFIG_DEFAULTS);
  });

  it('passes through a fully valid config', () => {
    const c = { clockFormat: '12h', showSeconds: true, showDate: false, dateFormat: 'short', timezone: 'Asia/Tokyo' };
    expect(resolveConfig(c)).toEqual(c);
  });

  it('falls back to defaults for unrecognized values rather than reaching Intl with junk', () => {
    const c = resolveConfig({ clockFormat: 'bogus', showSeconds: 'yes', dateFormat: 42 });
    expect(c.clockFormat).toBe('24h');
    expect(c.showSeconds).toBe(false);
    expect(c.dateFormat).toBe('full');
  });
});

describe('AOD-37 §8.4 second-clock zone label/offset', () => {
  it('humanizeZone humanizes the last IANA path segment', () => {
    expect(humanizeZone('America/New_York')).toBe('New York');
    expect(humanizeZone('Europe/Madrid')).toBe('Madrid');
    expect(humanizeZone('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });

  it('zoneShortOffset returns a GMT offset for a real zone (or null if Intl lacks shortOffset)', () => {
    const off = zoneShortOffset(INSTANT, 'America/New_York', EN);
    // shortOffset support is runtime-dependent; when present it carries a digit (e.g. "GMT-4").
    if (off !== null) expect(off).toMatch(/GMT[+-]?\d/);
  });

  it('formatClock exposes a zone label only when a valid override is set (a second clock)', () => {
    const second = formatClock(INSTANT, config({ timezone: 'America/New_York' }), EN);
    expect(second.zoneLabel).toBe('New York');

    const local = formatClock(INSTANT, config({ timezone: '' }), EN);
    expect(local.zoneLabel).toBeNull();
    expect(local.zoneOffset).toBeNull();

    // A degraded (invalid) override is device-local, so it carries no kicker either (§7.3).
    const degraded = formatClock(INSTANT, config({ timezone: 'Mars/Phobos' }), EN);
    expect(degraded.zoneLabel).toBeNull();
  });
});
