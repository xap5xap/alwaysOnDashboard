// The Transit face's pure, React-free helpers (AOD-132; design-color-law.md §4-5, §7). Three deterministic
// functions the CurrentWeatherCard + TransitArc compose: the condition→pane-key mapping (the muted §5
// pane), the sunrise→sunset sun fraction (the arc's honest position), and the thermometer tempColor blend
// (§4). Kept out of the leaf so they are unit-testable and so the colour work stays a pure function of the
// theme's ROLE values (never a literal hex): tempColor blends between two role colours, so Monochrome —
// where every temp stop collapses to bone — blends bone↔bone and stays neutral for free (§8 theme axis).
import type { WeatherGroup } from './types';

// --- §5 the condition pane key -----------------------------------------------------------------------
// The 12 condition×daylight panes are keyed by (group, code, isDay). Only WMO code 0 is group 'clear'
// (Clear sky); codes 1/2/3 are all group 'cloudy' server-side (Mainly clear / Partly cloudy / Overcast),
// so the partly-vs-overcast split is read from the CODE within the cloudy group. showers borrows the
// rain pane; thunderstorm the storm pane. `clearFirst`/`clearGolden` are golden-hour panes NOT reachable
// from the is_day boolean model in v1 (colour-law §5 uses is_day, no solar-elevation blend), so they are
// deliberately never returned here — left for a future elevation-aware pass. This is the interpretation
// Xavier verifies on device (the pane is not in the Weather Eye PDF; runbook §5 AOD-132 flag a).
export type PaneKey =
  | 'clearDay'
  | 'clearNight'
  | 'partlyDay'
  | 'partlyNight'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'storm'
  | 'snow';

export function paneKeyFor(group: WeatherGroup, code: number, isDay: boolean): PaneKey {
  switch (group) {
    case 'clear': // WMO 0 only
      return isDay ? 'clearDay' : 'clearNight';
    case 'cloudy':
      // WMO 1 (mainly clear) / 2 (partly cloudy) → the partly pane; 3 (overcast) + anything else → cloudy.
      if (code === 1 || code === 2) return isDay ? 'partlyDay' : 'partlyNight';
      return 'cloudy';
    case 'fog':
      return 'fog';
    case 'drizzle':
      return 'drizzle';
    case 'rain':
      return 'rain';
    case 'showers': // no dedicated showers pane; it reads as rain
      return 'rain';
    case 'snow':
      return 'snow';
    case 'thunderstorm':
      return 'storm';
    default:
      return 'cloudy'; // unknown group degrades to the neutral pane (never throws)
  }
}

// --- the sunrise→sunset fraction ---------------------------------------------------------------------
// Parse a local-ISO wall-clock string ("2026-06-27T06:13", optional seconds) as device-LOCAL time, so it
// compares to Date.now() on the same axis. v1 assumes the device timezone == the location timezone (true
// for the dogfood user); a tz mismatch (a remote location) would skew the fraction — out of v1 scope,
// noted for a future timezone-aware pass. Returns ms epoch, or null when the string is missing/malformed
// (a guard so the arc degrades to no sun-mark rather than NaN — e.g. AOD-131 not yet deployed).
export function parseLocalIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso);
  if (!m) return null;
  const t = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
  ).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * The sun's position as a fraction in [0,1] of the way from sunrise to sunset, at `nowMs`. null when
 * either bound is missing/malformed or the window is degenerate (sunset <= sunrise) — the caller then
 * draws the arc line but no sun-mark. Clamped, so before dawn reads 0 and after dusk reads 1 (the
 * night case, where the caller drops the sun-mark below the line as a moon anyway).
 */
export function sunFraction(sunrise: string, sunset: string, nowMs: number): number | null {
  const sr = parseLocalIso(sunrise);
  const ss = parseLocalIso(sunset);
  if (sr == null || ss == null || ss <= sr) return null;
  const f = (nowMs - sr) / (ss - sr);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

// --- §4 the thermometer blend ------------------------------------------------------------------------
// The 8 frozen temp stops anchored to °C (unistyles.ts primitive.temp comments): the value's colour is a
// linear blend between the two neighbouring stops "at the draw site" (the unistyles temp comment). Below
// ice / above swelter pin the endpoint. Metric-only in v1 (the payload is °C); a non-numeric temp pins to
// the mild middle so the numeral is never invisible.
export type TempStops = {
  ice: string;
  cold: string;
  cool: string;
  mild: string;
  warm: string;
  balmy: string;
  hot: string;
  swelter: string;
};

const TEMP_STOPS: ReadonlyArray<{ t: number; key: keyof TempStops }> = [
  { t: 6, key: 'ice' },
  { t: 10, key: 'cold' },
  { t: 13, key: 'cool' },
  { t: 15, key: 'mild' },
  { t: 17, key: 'warm' },
  { t: 19, key: 'balmy' },
  { t: 22, key: 'hot' },
  { t: 30, key: 'swelter' },
];

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toHex(r: number, g: number, b: number): string {
  const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`.toUpperCase();
}

/** Linear blend between two hex colours at t∈[0,1]. Falls back to `a` when either is not #RRGGBB (so a
 *  non-hex role value, or a future rgba, degrades to a solid rather than NaN). */
export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  if (!A || !B) return a;
  const f = t < 0 ? 0 : t > 1 ? 1 : t;
  return toHex(A.r + (B.r - A.r) * f, A.g + (B.g - A.g) * f, A.b + (B.b - A.b) * f);
}

/**
 * The thermometer colour for `celsius`, blended across the 8 `temp` role stops. Binds to ROLE values
 * (temp.ice…temp.swelter) — in Monochrome every stop is bone, so this returns bone at any temperature.
 */
export function tempColor(celsius: number, temp: TempStops): string {
  if (!Number.isFinite(celsius)) return temp.mild;
  if (celsius <= TEMP_STOPS[0].t) return temp[TEMP_STOPS[0].key];
  const last = TEMP_STOPS[TEMP_STOPS.length - 1];
  if (celsius >= last.t) return temp[last.key];
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const lo = TEMP_STOPS[i];
    const hi = TEMP_STOPS[i + 1];
    if (celsius >= lo.t && celsius < hi.t) {
      const f = (celsius - lo.t) / (hi.t - lo.t);
      return mixHex(temp[lo.key], temp[hi.key], f);
    }
  }
  return temp[last.key]; // unreachable (bounds handled above), keeps the return total
}
