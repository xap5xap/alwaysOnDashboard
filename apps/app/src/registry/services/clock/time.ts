// Pure on-device time formatting (integration-clock.md §4.1, §12; RB-M2 AOD-130 Meridian). No React and no
// I/O: a Date and a ClockConfig in, a ClockView out. All formatting is Intl.DateTimeFormat (Hermes' built-in,
// §12); the leaf calls formatClock on each tick. This is the inverse of the credentialed services' server-side
// normalize (§6.4): the device clock is a trusted, local source, so the Date -> strings mapping correctly
// lives on-device, not server.
//
// AOD-130 (Meridian, subtractive): the timezone override (the "second clock") and the date line were
// stripped, so this module lost the whole zone/date half — deviceTimeZone, isValidTimeZone, validateTimeZone,
// humanizeZone, zoneShortOffset, and the date/zone/offset paths in formatClock all went with them (grep
// confirmed no consumer outside this folder). What remains is the parts split: formatClock derives the hero
// figure (hour:minute), the meridiem, and the seconds whisper via formatToParts, formatting in device-local
// time (no override to apply).
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

/** Format the device clock into the Meridian ClockView parts (integration-clock.md §4.1; AOD-130). Splits the
 *  Intl.DateTimeFormat output via formatToParts into: the hero FIGURE (hour + the locale hour/minute
 *  separator + minute), the MERIDIEM (the dayPeriod part, 12h only), and the SECONDS (the second part, only
 *  when showSeconds). The figure carries neither the seconds nor the AM/PM — the leaf renders those as the
 *  small satellites beside the hero. `locale` defaults to the device locale (undefined => Intl uses the
 *  runtime default); tests pass an explicit locale for determinism. clockFormat -> hour12, showSeconds -> the
 *  seconds field (§5.1, §12). No timezone option: the device clock is always device-local now (§4.1). */
export function formatClock(now: Date, config: ClockConfig, locale?: string): ClockView {
  const timeOptions: Intl.DateTimeFormatOptions = {
    // 24h: 2-digit hour ("14:05"); 12h: numeric hour, no leading zero ("2:05 PM"). §4.1 examples, §12.
    hour: config.clockFormat === '24h' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: config.clockFormat === '12h',
  };
  if (config.showSeconds) timeOptions.second = '2-digit';

  const parts = new Intl.DateTimeFormat(locale, timeOptions).formatToParts(now);
  const partValue = (t: Intl.DateTimeFormatPartTypes): string | null => parts.find((p) => p.type === t)?.value ?? null;

  const hour = partValue('hour') ?? '';
  const minute = partValue('minute') ?? '';
  // The hour->minute separator is the literal immediately after the hour part (':' in ~every locale). Read it
  // faithfully rather than hard-coding ':', defaulting to ':' if the runtime emits no literal there.
  const hourIndex = parts.findIndex((p) => p.type === 'hour');
  const separator = hourIndex >= 0 && parts[hourIndex + 1]?.type === 'literal' ? parts[hourIndex + 1].value : ':';

  return {
    figure: `${hour}${separator}${minute}`,
    meridiem: partValue('dayPeriod'), // null in 24h (no dayPeriod part)
    seconds: partValue('second'), // null when showSeconds is false (no second part)
  };
}
