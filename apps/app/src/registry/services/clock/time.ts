// Pure on-device time formatting (integration-clock.md §4.1, §12; RB-M2 AOD-130 Meridian). No React and no
// I/O: a Date and a ClockConfig in, a ClockView out. Formatting reads the Date's fields directly (no Intl,
// §12); the leaf calls formatClock on each tick. This is the inverse of the credentialed services' server-side
// normalize (§6.4): the device clock is a trusted, local source, so the Date -> strings mapping correctly
// lives on-device, not server.
//
// AOD-130 (Meridian, subtractive): the timezone override (the "second clock") and the date line were
// stripped, so this module lost the whole zone/date half — deviceTimeZone, isValidTimeZone, validateTimeZone,
// humanizeZone, zoneShortOffset, and the date/zone/offset paths in formatClock all went with them (grep
// confirmed no consumer outside this folder). What remains is the parts split: formatClock derives the hero
// figure (hour:minute), the meridiem, and the seconds whisper from the Date's getHours/getMinutes/getSeconds,
// formatting in device-local time (no override to apply).
import type { ClockConfig, ClockView } from './types';
import { CLOCK_CONFIG_DEFAULTS } from './types';

/** Coalesce a raw/partial stored config against the defaults (integration-clock.md §5.1). The leaf gets RAW
 *  instance.config (the host passes it through unvalidated to the renderer), so read every field defensively;
 *  an unrecognized value falls back to its default rather than reaching Intl. Values stored by a pre-Meridian
 *  instance (showDate/dateFormat/timezone) are simply ignored — harmless. */
export function resolveConfig(raw: Record<string, unknown> | undefined): ClockConfig {
  const r = raw ?? {};
  const clockFormat = r.clockFormat === '12h' || r.clockFormat === '24h' ? r.clockFormat : CLOCK_CONFIG_DEFAULTS.clockFormat;
  return {
    clockFormat,
    showSeconds: typeof r.showSeconds === 'boolean' ? r.showSeconds : CLOCK_CONFIG_DEFAULTS.showSeconds,
  };
}

/**
 * Format the device clock into the Meridian ClockView parts (integration-clock.md §4.1). Derives the hero
 * FIGURE (hour:minute), the MERIDIEM (AM/PM, 12h only), and the SECONDS (only when showSeconds) directly from
 * the Date's getHours/getMinutes/getSeconds — no `Intl.DateTimeFormat`.
 *
 * NOTE (2026-07-19): the AOD-130 device blank was NOT this function — it was the leaf's FitBody `glance`
 * collapsing to zero height on the dashboard, which clipped the (correctly formatted) figure to a sliver
 * (fixed in FitBody, not here). The original Meridian used `Intl.DateTimeFormat.formatToParts` here; reading
 * the Date fields is a defensive, dependency-free simplification (device-verified rendering "12:31" on Hermes)
 * kept because it is simpler and one fewer engine-portability variable — NOT because formatToParts was broken.
 *
 * The device clock is always device-local (§4.1); the figure carries neither the seconds nor the AM/PM — the
 * leaf renders those as the small satellites beside the hero. `:` separator + English AM/PM: the app is
 * en-only in v1 (the old clock was too); a locale-aware split would reintroduce Intl, a follow-up if a
 * non-en locale ships. Pure: a Date + ClockConfig in, a ClockView out.
 */
export function formatClock(now: Date, config: ClockConfig): ClockView {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const h24 = now.getHours();
  const is12 = config.clockFormat === '12h';
  // 12h: 1..12 with no leading zero ("2:05"); 24h: a 2-digit hour ("14:05"). §4.1 examples.
  const hour = is12 ? String(h24 % 12 || 12) : pad2(h24);
  return {
    figure: `${hour}:${pad2(now.getMinutes())}`,
    meridiem: is12 ? (h24 < 12 ? 'AM' : 'PM') : null, // 12h only; 24h has no meridiem
    seconds: config.showSeconds ? pad2(now.getSeconds()) : null, // null when the whisper is off
  };
}
