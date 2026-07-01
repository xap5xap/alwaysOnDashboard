// The pure day/night ambient math (kiosk-mode.md AOD-11 §8.2-§8.4). This is the SCHEDULE + CURVE that AOD-10
// §8 asked AOD-11 to provide: computeAmbient(now, schedule, curve) returns AOD-10's AmbientContext (imported,
// not redefined), boundaries(now, schedule) resolves the day/night start minutes, and backlightFor(...) maps
// the dim level onto an app-scoped backlight target (§8.3). All PURE + headless so the curve is unit-tested
// without a device; the expo-* calls that ACT on these values live in runtime.native.ts (the device layer).
import type { AmbientContextValue, DaylightPhase } from '../ambient/AmbientContext';

export type MinutesOfDay = number; // 0..1439, local wall-clock minutes
export interface GeoCoord {
  lat: number;
  lng: number;
}

// §8.2 the two scheduling modes. The pure module takes a RESOLVED GeoCoord for solar; the "weatherWidget" /
// "device" location precedence in the spec is device-side I/O (resolved before this pure fn is called).
export type DayNightSchedule =
  | { mode: 'fixed'; dayStartMin: MinutesOfDay; nightStartMin: MinutesOfDay; transitionMinutes: number }
  | { mode: 'solar'; location: GeoCoord; transitionMinutes: number };

// §8.2 the dim curve: flat dayDim / nightDim eased across each boundary window (8.4).
export interface DimCurve {
  dayDim: number; // dimLevel during full day, 0..1, default 0 (no dimming)
  nightDim: number; // dimLevel at full night, 0..1, default ~0.7 (deep dim, not black)
}

// §8.2 recommended defaults: fixed 07:00 day / 21:00 night, 60-min ramp; curve 0 -> 0.7. The native driver
// uses these until a persisted KioskConfig (custom times / solar) exists; that config surface is a follow-up.
const DEFAULT_DAY_START: MinutesOfDay = 7 * 60;
const DEFAULT_NIGHT_START: MinutesOfDay = 21 * 60;
export const DEFAULT_SCHEDULE: DayNightSchedule = {
  mode: 'fixed',
  dayStartMin: DEFAULT_DAY_START,
  nightStartMin: DEFAULT_NIGHT_START,
  transitionMinutes: 60,
};
export const DEFAULT_CURVE: DimCurve = { dayDim: 0, nightDim: 0.7 };

const mod = (a: number, n: number) => ((a % n) + n) % n;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * Resolve the day-start and night-start minutes for `now` (§8.4). fixed: as configured. solar: sunrise /
 * sunset from the location + date. The solar sun-times calc + the "weatherWidget"/"device" location
 * resolution are a flagged follow-up (the driver uses fixed today); per §8.2, an unresolved solar schedule
 * falls back to the fixed defaults rather than failing, so this stays total.
 */
export function boundaries(
  now: Date,
  schedule: DayNightSchedule,
): { dayStart: MinutesOfDay; nightStart: MinutesOfDay } {
  if (schedule.mode === 'fixed') {
    return { dayStart: schedule.dayStartMin, nightStart: schedule.nightStartMin };
  }
  // solar: not yet plumbed (needs a sun-times calc + location resolution, a follow-up). §8.2 fixed fallback.
  return { dayStart: DEFAULT_DAY_START, nightStart: DEFAULT_NIGHT_START };
}

/**
 * The dim curve, concretely (§8.4). Returns AOD-10's AmbientContext ({ phase, dimLevel }); it does NOT
 * redefine it. phase is day inside [dayStart, nightStart) with the midnight wrap handled; dimLevel is flat
 * by default and eased across each boundary window of `transitionMinutes` (dusk ramp, dawn ramp, else steady).
 */
export function computeAmbient(
  now: Date,
  schedule: DayNightSchedule,
  curve: DimCurve,
): AmbientContextValue {
  const { dayStart, nightStart } = boundaries(now, schedule);
  const m = now.getHours() * 60 + now.getMinutes();
  const T = Math.max(1, schedule.transitionMinutes);

  // phase: day inside [dayStart, nightStart), handling the midnight wrap.
  const inDay =
    nightStart > dayStart ? m >= dayStart && m < nightStart : m >= dayStart || m < nightStart;
  const phase: DaylightPhase = inDay ? 'day' : 'night';

  // dimLevel: flat by default, eased across each boundary window.
  const sinceNight = mod(m - nightStart, 1440); // minutes since the day->night boundary
  const sinceDay = mod(m - dayStart, 1440); // minutes since the night->day boundary
  let dimLevel: number;
  if (sinceNight < T) dimLevel = lerp(curve.dayDim, curve.nightDim, smoothstep(sinceNight / T)); // dusk ramp
  else if (sinceDay < T) dimLevel = lerp(curve.nightDim, curve.dayDim, smoothstep(sinceDay / T)); // dawn ramp
  else dimLevel = inDay ? curve.dayDim : curve.nightDim; // steady

  return { phase, dimLevel };
}

/**
 * Map dimLevel onto an app-scoped backlight target (§8.3), applied only when controlBacklight (default true
 * on Android/Fire, false on iOS where the overlay carries the dimming). Never fully black: a wall display
 * stays faintly readable at deepest night. Pure; runtime.native.ts calls expo-brightness with the result.
 */
export function backlightFor(
  ambient: Pick<AmbientContextValue, 'dimLevel'>,
  controlBacklight: boolean,
): number | null {
  if (!controlBacklight) return null;
  const floor = 0.06; // never fully black; a wall display should stay faintly readable at deepest night
  return Math.max(floor, 1 - ambient.dimLevel); // dimLevel 0 -> ~full; dimLevel 0.7 -> 0.3 backlight
}
