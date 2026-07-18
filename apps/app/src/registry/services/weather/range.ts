// The Range face's pure, React-free scale math (AOD-133; the Forecast RANGE take, Weather Eye 1f: "each
// day's high-low drawn as a span on the week's 8°-21°"). Two deterministic functions the ForecastCard
// composes: the week's shared min-max scale over the VISIBLE days, and one day's [tempMin,tempMax] mapped
// to [0,1] fractions ON that scale. Kept out of the leaf (the transit.ts precedent) so the "is the scale
// math right" flag is unit-testable and so no ÷0 slips through a flat week. NO colour here — the span
// bar's hue is tempColor (transit.ts) resolved at the draw site, so this stays a pure function of numbers.

/** The minimum shape a day needs to place a span on the scale (a slice of ForecastDay). */
export interface DayTempRange {
  tempMin: number;
  tempMax: number;
}

/** The week's shared temperature scale: the min low and the max high across the VISIBLE days. */
export interface WeekScale {
  min: number;
  max: number;
}

/** A day's span on the shared scale as [lo,hi] fractions in [0,1] (lo <= hi). */
export interface Span {
  lo: number;
  hi: number;
}

// A flat/degenerate week (max === min) or a non-finite day maps to a CENTRED SHORT bar so a zero-width
// span still reads (never invisible, never ÷0). ~30% of the track, centred — a flat week and a swingy
// week both read (the swingy week's days span their real fractions; a flat week's every bar is this mark).
export const CENTERED_SHORT: Span = { lo: 0.35, hi: 0.65 };

/**
 * The week's shared scale over the visible days: the min of the lows, the max of the highs. Returns null
 * when the set is empty or carries no finite temperatures (the caller then omits the header and every bar
 * degrades to the centred short mark) — never NaN.
 */
export function weekScale(days: readonly DayTempRange[]): WeekScale | null {
  let min = Infinity;
  let max = -Infinity;
  for (const d of days) {
    if (Number.isFinite(d.tempMin)) min = Math.min(min, d.tempMin);
    if (Number.isFinite(d.tempMax)) max = Math.max(max, d.tempMax);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * One day's [tempMin,tempMax] as [lo,hi] fractions on the shared `scale`. Guards the flat week
 * (scale.max === scale.min → ÷0) and a non-finite temp by returning the centred short bar, so the bar is
 * never invisible and never NaN. lo is always <= hi; both are clamped to [0,1] (a day can never exceed the
 * scale it defines, but the clamp keeps a malformed payload honest).
 */
export function spanFraction(tempMin: number, tempMax: number, scale: WeekScale): Span {
  const range = scale.max - scale.min;
  if (!(range > 0) || !Number.isFinite(tempMin) || !Number.isFinite(tempMax)) {
    return { ...CENTERED_SHORT };
  }
  const a = clamp01((tempMin - scale.min) / range);
  const b = clamp01((tempMax - scale.min) / range);
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}
