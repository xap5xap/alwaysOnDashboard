// Pure on-device time formatting (integration-clock.md §4.1, §5.2, §6.4, §12). No React and no I/O: a
// Date and a ClockConfig in, a ClockView out, plus the IANA-zone validity check the config form runs at
// save time. All formatting is Intl.DateTimeFormat (Hermes' built-in, §12); the leaf calls formatClock on
// each tick. This is the inverse of the credentialed services' server-side normalize (§6.4): the device
// clock is a trusted, local source, so the Date -> strings mapping correctly lives on-device, not server.
import type { ClockConfig, ClockView } from './types';
import { CLOCK_CONFIG_DEFAULTS } from './types';

/** The device-local IANA zone (integration-clock.md §5.2 default). Intl resolves it on-device (§12). */
export function deviceTimeZone(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Is `tz` a valid IANA zone? Constructs a formatter and catches the RangeError an invalid zone throws
 *  (integration-clock.md §5.2, §12). This is a DEVICE capability, not a provider lookup (§5.3): every
 *  device ships the same IANA database, exposed through Intl, so the check is entirely client-side. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The config form's SAVE-TIME field validator (integration-clock.md §5.2): an entered zone must be a
 *  valid IANA zone. Empty is accepted (device-local). Returns an error message, or null when valid. Wired
 *  as the timezone field's `validate` (index.ts) and run by validateConfig only under runFieldValidators
 *  (the config form's save path), NEVER at the host's render-time check, so a bad stored zone is NOT
 *  needs_config (§5.4); formatClock degrades it to device-local at render instead (§7.3). */
export function validateTimeZone(value: string): string | null {
  if (!value) return null; // unset = device-local
  return isValidTimeZone(value) ? null : 'Enter a valid IANA time zone (e.g. America/New_York)';
}

/** Coalesce a raw/partial stored config against the defaults (integration-clock.md §5.1). The leaf gets
 *  RAW instance.config (the host passes it through unvalidated to the renderer), so read every field
 *  defensively; an unrecognized value falls back to its default rather than reaching Intl. */
export function resolveConfig(raw: Record<string, unknown> | undefined): ClockConfig {
  const r = raw ?? {};
  const clockFormat = r.clockFormat === '12h' || r.clockFormat === '24h' ? r.clockFormat : CLOCK_CONFIG_DEFAULTS.clockFormat;
  const dateFormat =
    r.dateFormat === 'full' || r.dateFormat === 'long' || r.dateFormat === 'medium' || r.dateFormat === 'short'
      ? r.dateFormat
      : CLOCK_CONFIG_DEFAULTS.dateFormat;
  return {
    clockFormat,
    showSeconds: typeof r.showSeconds === 'boolean' ? r.showSeconds : CLOCK_CONFIG_DEFAULTS.showSeconds,
    showDate: typeof r.showDate === 'boolean' ? r.showDate : CLOCK_CONFIG_DEFAULTS.showDate,
    dateFormat,
    timezone: typeof r.timezone === 'string' ? r.timezone : CLOCK_CONFIG_DEFAULTS.timezone,
  };
}

/** AOD-37 §8.4: derive a human zone label from an IANA id by humanizing its last path segment
 *  (America/New_York -> "New York", Europe/Madrid -> "Madrid"). Not stored; derived at render. */
export function humanizeZone(ianaId: string): string {
  const segment = ianaId.split('/').pop() ?? ianaId;
  return segment.replace(/_/g, ' ');
}

/** AOD-37 §8.4: the short GMT offset for the wide second-clock layout ("GMT-4"), via Intl. Returns null
 *  if the runtime's Intl does not support the shortOffset token, so the offset degrades away cleanly. */
export function zoneShortOffset(now: Date, ianaId: string, locale?: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat(locale ?? 'en-US', {
      timeZone: ianaId,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value;
    return tz && /\d/.test(tz) ? tz : null; // require a digit so a bare "GMT" is treated as absent
  } catch {
    return null;
  }
}

/** Format the device clock into a ClockView (integration-clock.md §4.1). Defensive on the zone: a
 *  malformed stored zone degrades to device-local (§7.3) and never throws to the host. `locale` defaults
 *  to the device locale (undefined => Intl uses the runtime default); tests pass an explicit locale for
 *  determinism. The config maps directly onto Intl options: clockFormat -> hour12, showSeconds -> the
 *  seconds field, dateFormat -> dateStyle, timezone -> timeZone (§5.1, §12). */
export function formatClock(now: Date, config: ClockConfig, locale?: string): ClockView {
  const requested = config.timezone && config.timezone.trim() ? config.timezone.trim() : undefined;
  // A configured-but-invalid zone degrades to device-local (§7.3). undefined => Intl uses device-local.
  const zoneForIntl = requested && isValidTimeZone(requested) ? requested : undefined;
  const zone = zoneForIntl ?? deviceTimeZone();

  const timeOptions: Intl.DateTimeFormatOptions = {
    // 24h: 2-digit hour ("14:05"); 12h: numeric hour, no leading zero ("2:05 PM"). §4.1 examples, §12.
    hour: config.clockFormat === '24h' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: config.clockFormat === '12h',
    timeZone: zoneForIntl,
  };
  if (config.showSeconds) timeOptions.second = '2-digit';

  const time = new Intl.DateTimeFormat(locale, timeOptions).format(now);
  const date = config.showDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: config.dateFormat, timeZone: zoneForIntl }).format(now)
    : null;

  // §8.4 the zone label/offset mark a SECOND clock: shown only when a valid override is set (zoneForIntl
  // defined). A device-local clock (no override, or an override that degraded) carries neither.
  const isSecondClock = zoneForIntl != null;
  const zoneLabel = isSecondClock ? humanizeZone(zoneForIntl) : null;
  const zoneOffset = isSecondClock ? zoneShortOffset(now, zoneForIntl, locale) : null;

  return { time, date, zone, zoneLabel, zoneOffset };
}
