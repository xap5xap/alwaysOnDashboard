// Pure unit tests for the on-device Clock formatting (integration-clock.md §4.1, §12; RB-M2 AOD-130
// Meridian). No React, no host: a Date + ClockConfig in, a ClockView (the parts split) out. The leaf
// (ClockCard) and the host none path are exercised in ClockCard.test.tsx. formatClock derives the parts
// DIRECTLY FROM THE Date (no Intl) — a dependency-free simplification (the AOD-130 device blank was the leaf's
// FitBody `glance` collapsing to zero height, NOT the formatting), formatting in DEVICE-LOCAL time (the
// timezone override was removed with the second clock, AOD-130). jest pins no TZ, so the HOUR is CI-dependent: the assertions
// below are TZ-robust — the seconds field (33) is offset-independent, the figure shape is fixed, and the
// exact figure/meridiem are pinned by parity against the SAME Date methods the impl uses (both device-local).
import { formatClock, resolveConfig } from '../time';
import { CLOCK_CONFIG_DEFAULTS, type ClockConfig } from '../types';

// 2026-06-28T14:05:33Z. The SECONDS (33) are timezone-independent (no modern zone has a sub-minute offset),
// so v.seconds is deterministic on any CI zone; the hour/minute are not, hence the Date-parity reference below.
const INSTANT = new Date('2026-06-28T14:05:33.000Z');

function config(overrides: Partial<ClockConfig> = {}): ClockConfig {
  return { ...CLOCK_CONFIG_DEFAULTS, ...overrides };
}

/** The reference parts, computed from the Date the SAME way the impl does (device-local, no Intl), so the
 *  parity test pins the exact figure/meridiem on any CI timezone without a hard-coded value or formatToParts. */
function reference(clockFormat: '12h' | '24h', showSeconds: boolean) {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const h = INSTANT.getHours();
  const hour = clockFormat === '12h' ? String(h % 12 || 12) : pad2(h);
  return {
    figure: `${hour}:${pad2(INSTANT.getMinutes())}`,
    meridiem: clockFormat === '12h' ? (h < 12 ? 'AM' : 'PM') : null,
    seconds: showSeconds ? pad2(INSTANT.getSeconds()) : null,
  };
}

describe('formatClock parts split (integration-clock.md §4.1, §12; AOD-130 Meridian, Hermes-safe)', () => {
  it('24-hour, no seconds -> a 2-digit figure, no meridiem, no seconds whisper', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '24h', showSeconds: false }));
    expect(v.figure).toMatch(/^\d{2}:\d{2}$/); // hour:minute only — the split leaks no seconds and no AM/PM
    expect(v.meridiem).toBeNull(); // 24h carries no dayPeriod
    expect(v.seconds).toBeNull(); // the whisper is off
  });

  it('24-hour with seconds -> the seconds ride the whisper, NOT the figure', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '24h', showSeconds: true }));
    expect(v.figure).toMatch(/^\d{2}:\d{2}$/); // still just hour:minute — seconds are split out
    expect(v.seconds).toBe('33'); // the instant's seconds, offset-independent
    expect(v.meridiem).toBeNull();
  });

  it('12-hour -> a meridiem (AM/PM) is split out, and it is NOT embedded in the figure', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '12h', showSeconds: false }));
    expect(v.figure).toMatch(/^\d{1,2}:\d{2}$/); // numeric hour (no leading zero), minute; no AM/PM in the figure
    expect(v.meridiem === 'AM' || v.meridiem === 'PM').toBe(true);
    expect(v.seconds).toBeNull();
  });

  it('12-hour with seconds -> figure + meridiem + seconds whisper are all separated', () => {
    const v = formatClock(INSTANT, config({ clockFormat: '12h', showSeconds: true }));
    expect(v.figure).toMatch(/^\d{1,2}:\d{2}$/);
    expect(v.meridiem === 'AM' || v.meridiem === 'PM').toBe(true);
    expect(v.seconds).toBe('33');
  });

  it('the figure/meridiem/seconds match the Date-derived reference (exact, device-local)', () => {
    for (const clockFormat of ['24h', '12h'] as const) {
      for (const showSeconds of [false, true]) {
        const v = formatClock(INSTANT, config({ clockFormat, showSeconds }));
        expect(v).toEqual(reference(clockFormat, showSeconds));
      }
    }
  });

  it('12-hour wraps midnight/noon to 12 (h%12||12), never 0; 24h is zero-padded', () => {
    const mk = (h: number) => new Date(2026, 5, 28, h, 7, 0); // LOCAL h:07 (constructed local, no UTC skew)
    expect(formatClock(mk(0), config({ clockFormat: '12h' }))).toMatchObject({ figure: '12:07', meridiem: 'AM' });
    expect(formatClock(mk(12), config({ clockFormat: '12h' }))).toMatchObject({ figure: '12:07', meridiem: 'PM' });
    expect(formatClock(mk(13), config({ clockFormat: '12h' }))).toMatchObject({ figure: '1:07', meridiem: 'PM' });
    expect(formatClock(mk(9), config({ clockFormat: '24h' }))).toMatchObject({ figure: '09:07', meridiem: null });
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
