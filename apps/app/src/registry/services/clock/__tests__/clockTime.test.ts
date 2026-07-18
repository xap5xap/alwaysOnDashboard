// Pure unit tests for the on-device Clock formatting (integration-clock.md §4.1, §12; RB-M2 AOD-130
// Meridian). No React, no host: a Date + ClockConfig in, a ClockView (the parts split) out. The leaf
// (ClockCard) and the host none path are exercised in ClockCard.test.tsx. Locale is pinned to 'en-US' so the
// asserted AM/PM is deterministic under the Node/jest ICU. formatClock now formats in DEVICE-LOCAL time (the
// timezone override was removed with the second clock, AOD-130), and jest pins no TZ, so the HOUR (and, on a
// sub-hour-offset zone, the minute) is CI-dependent: the assertions below are TZ-robust — the seconds field
// (33) is offset-independent, the figure shape is fixed, and the exact figure/meridiem are pinned by
// reference-equality against Intl with the same options (both device-local), never a hard-coded "14:05".
import { formatClock, resolveConfig } from '../time';
import { CLOCK_CONFIG_DEFAULTS, type ClockConfig } from '../types';

// 2026-06-28T14:05:33Z. The SECONDS (33) are timezone-independent (no modern zone has a sub-minute offset),
// so v.seconds is deterministic on any CI zone; the hour/minute are not, hence the reference-equality below.
const INSTANT = new Date('2026-06-28T14:05:33.000Z');
const EN = 'en-US';

function config(overrides: Partial<ClockConfig> = {}): ClockConfig {
  return { ...CLOCK_CONFIG_DEFAULTS, ...overrides };
}

/** The reference parts split: the Intl output for the same options, split the way formatClock should. Both
 *  are device-local, so this pins the exact figure/meridiem on any CI timezone without a hard-coded value. */
function reference(clockFormat: '12h' | '24h', showSeconds: boolean) {
  const opts: Intl.DateTimeFormatOptions = {
    hour: clockFormat === '24h' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: clockFormat === '12h',
  };
  if (showSeconds) opts.second = '2-digit';
  const parts = new Intl.DateTimeFormat(EN, opts).formatToParts(INSTANT);
  const val = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? null;
  const hi = parts.findIndex((p) => p.type === 'hour');
  const sep = hi >= 0 && parts[hi + 1]?.type === 'literal' ? parts[hi + 1]!.value : ':';
  return { figure: `${val('hour') ?? ''}${sep}${val('minute') ?? ''}`, meridiem: val('dayPeriod'), seconds: val('second') };
}

describe('formatClock parts split (integration-clock.md §4.1, §12; AOD-130 Meridian)', () => {
  it('24-hour, no seconds -> a 2-digit figure, no meridiem, no seconds whisper', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '24h', showSeconds: false }), EN);
    expect(v.figure).toMatch(/^\d{2}:\d{2}$/); // hour:minute only — the split leaks no seconds and no AM/PM
    expect(v.meridiem).toBeNull(); // 24h carries no dayPeriod
    expect(v.seconds).toBeNull(); // the whisper is off
  });

  it('24-hour with seconds -> the seconds ride the whisper, NOT the figure', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '24h', showSeconds: true }), EN);
    expect(v.figure).toMatch(/^\d{2}:\d{2}$/); // still just hour:minute — seconds are split out
    expect(v.seconds).toBe('33'); // the instant's seconds, offset-independent
    expect(v.meridiem).toBeNull();
  });

  it('12-hour -> a meridiem (AM/PM) is split out, and it is NOT embedded in the figure', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '12h', showSeconds: false }), EN);
    expect(v.figure).toMatch(/^\d{1,2}:\d{2}$/); // numeric hour (no leading zero), minute; no AM/PM in the figure
    expect(v.meridiem === 'AM' || v.meridiem === 'PM').toBe(true);
    expect(v.seconds).toBeNull();
  });

  it('12-hour with seconds -> figure + meridiem + seconds whisper are all separated', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '12h', showSeconds: true }), EN);
    expect(v.figure).toMatch(/^\d{1,2}:\d{2}$/);
    expect(v.meridiem === 'AM' || v.meridiem === 'PM').toBe(true);
    expect(v.seconds).toBe('33');
  });

  it('the figure/meridiem/seconds match the Intl reference for the same options (exact, device-local)', () => {
    for (const clockFormat of ['24h', '12h'] as const) {
      for (const showSeconds of [false, true]) {
        const v = formatClock(INSTANT, config({ clockFormat, showSeconds }), EN);
        expect(v).toEqual(reference(clockFormat, showSeconds));
      }
    }
  });
});

describe('resolveConfig defensive read (integration-clock.md §5.1; AOD-130 two-field config)', () => {
  it('returns the defaults for an empty config', () => {
    expect(resolveConfig({})).toEqual(CLOCK_CONFIG_DEFAULTS);
    expect(resolveConfig(undefined)).toEqual(CLOCK_CONFIG_DEFAULTS);
  });

  it('passes through a fully valid config', () => {
    const c = { clockFormat: '12h', showSeconds: true } as const;
    expect(resolveConfig(c)).toEqual(c);
  });

  it('falls back to defaults for unrecognized values rather than reaching Intl with junk', () => {
    const c = resolveConfig({ clockFormat: 'bogus', showSeconds: 'yes' });
    expect(c.clockFormat).toBe('24h');
    expect(c.showSeconds).toBe(false);
  });

  it('IGNORES the stripped pre-Meridian fields (showDate/dateFormat/timezone) — they never reach the view', () => {
    // A pre-Meridian instance carries these in its stored config; resolveConfig drops them cleanly so the
    // resolved shape is exactly the two Meridian fields (harmless coexistence, integration-clock.md §5.1).
    const c = resolveConfig({ clockFormat: '12h', showSeconds: true, showDate: true, dateFormat: 'full', timezone: 'America/New_York' });
    expect(c).toEqual({ clockFormat: '12h', showSeconds: true });
  });
});
