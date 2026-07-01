// The pure day/night ambient math (kiosk-mode.md §8.2-§8.4). computeAmbient / boundaries / backlightFor are
// headless, so the curve is verified here with no device: phase across the day/night boundary + the midnight
// wrap, the eased dusk/dawn ramps, steady day/night, and the backlight map + its floor. The expo-* calls that
// ACT on these values (runtime.native.ts) are device-verified separately (the AOD-72 platform-split reason).
import {
  backlightFor,
  boundaries,
  computeAmbient,
  DEFAULT_CURVE,
  DEFAULT_SCHEDULE,
  type DayNightSchedule,
} from '../ambient';

// Local-time constructor so getHours()/getMinutes() are deterministic regardless of the jest runner TZ.
const at = (h: number, m = 0) => new Date(2026, 6, 1, h, m);

describe('boundaries §8.4', () => {
  it('fixed returns the configured day/night start minutes', () => {
    expect(boundaries(at(12), DEFAULT_SCHEDULE)).toEqual({ dayStart: 420, nightStart: 1260 });
  });

  it('solar falls back to the fixed defaults (sun-times resolution is a follow-up, §8.2 fallback)', () => {
    const solar: DayNightSchedule = { mode: 'solar', location: { lat: -0.18, lng: -78.47 }, transitionMinutes: 60 };
    expect(boundaries(at(12), solar)).toEqual({ dayStart: 420, nightStart: 1260 });
  });
});

describe('computeAmbient §8.4 (default fixed 07:00/21:00, curve 0 -> 0.7, T=60)', () => {
  it('full day is phase day, no dim', () => {
    expect(computeAmbient(at(12), DEFAULT_SCHEDULE, DEFAULT_CURVE)).toEqual({ phase: 'day', dimLevel: 0 });
  });

  it('deep night is phase night, full nightDim (steady)', () => {
    expect(computeAmbient(at(3), DEFAULT_SCHEDULE, DEFAULT_CURVE)).toEqual({ phase: 'night', dimLevel: 0.7 });
  });

  it('the dusk boundary starts undimmed then eases to nightDim across the window', () => {
    // at exactly nightStart (21:00) phase flips to night but the dim ramp is just beginning (0)
    expect(computeAmbient(at(21, 0), DEFAULT_SCHEDULE, DEFAULT_CURVE)).toEqual({ phase: 'night', dimLevel: 0 });
    // half-way through the 60-min ramp (21:30): smoothstep(0.5)=0.5 -> 0.35
    expect(computeAmbient(at(21, 30), DEFAULT_SCHEDULE, DEFAULT_CURVE).dimLevel).toBeCloseTo(0.35, 5);
    // past the ramp (22:30): steady nightDim
    expect(computeAmbient(at(22, 30), DEFAULT_SCHEDULE, DEFAULT_CURVE)).toEqual({ phase: 'night', dimLevel: 0.7 });
  });

  it('the dawn boundary eases from nightDim back to day', () => {
    // at dayStart (07:00) phase is day but the dim is still easing DOWN from night
    expect(computeAmbient(at(7, 0), DEFAULT_SCHEDULE, DEFAULT_CURVE)).toEqual({ phase: 'day', dimLevel: 0.7 });
    // half-way through the dawn ramp (07:30): 0.35
    expect(computeAmbient(at(7, 30), DEFAULT_SCHEDULE, DEFAULT_CURVE).dimLevel).toBeCloseTo(0.35, 5);
    // past the ramp (08:30): steady day, no dim
    expect(computeAmbient(at(8, 30), DEFAULT_SCHEDULE, DEFAULT_CURVE)).toEqual({ phase: 'day', dimLevel: 0 });
  });

  it('handles a schedule that wraps past midnight (night-shift wall: day 20:00 -> 08:00)', () => {
    const wrap: DayNightSchedule = { mode: 'fixed', dayStartMin: 20 * 60, nightStartMin: 8 * 60, transitionMinutes: 60 };
    expect(computeAmbient(at(22), wrap, DEFAULT_CURVE).phase).toBe('day'); // 22:00 is inside the wrapped day
    expect(computeAmbient(at(12), wrap, DEFAULT_CURVE).phase).toBe('night'); // noon is night for this wall
  });
});

describe('backlightFor §8.3', () => {
  it('maps dimLevel onto a backlight target (1 - dimLevel) when controlBacklight', () => {
    expect(backlightFor({ dimLevel: 0 }, true)).toBe(1);
    expect(backlightFor({ dimLevel: 0.7 }, true)).toBeCloseTo(0.3, 5);
  });

  it('never goes fully black: a wall stays faintly readable at deepest night (floor 0.06)', () => {
    expect(backlightFor({ dimLevel: 1 }, true)).toBe(0.06);
  });

  it('returns null when controlBacklight is off (iOS leaves dimming to the overlay)', () => {
    expect(backlightFor({ dimLevel: 0.7 }, false)).toBeNull();
  });
});
