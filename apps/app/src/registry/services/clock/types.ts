// The on-device Clock data contract (integration-clock.md §4.1, §5). Unlike every other widget, the
// "data" the ClockCard renders is NOT a proxy payload: it is derived IN THE LEAF from the device clock
// each tick (§7.2), formatted via Intl.DateTimeFormat with the instance config. The leaf is mounted with
// the AOD-8 §6.1 render contract { data, config, size } where data === undefined (the host none path,
// §6.3) and ignores data entirely. This module declares only the shapes the leaf computes and reads; the
// bookend has no server half, so there is no operations.ts to mirror (contrast services/weather/types.ts).

/** The instance config (integration-clock.md §5.1). Every field is static and validated client-side. */
export interface ClockConfig {
  clockFormat: '12h' | '24h'; // -> Intl.DateTimeFormat hour12 (§12)
  showSeconds: boolean; // shows seconds AND drives the tick cadence (1s vs 60s, §7.2)
  showDate: boolean; // whether to render the date line at all
  dateFormat: 'full' | 'long' | 'medium' | 'short'; // -> Intl.DateTimeFormat dateStyle (§12)
  timezone: string; // '' = device-local; an IANA override for a second clock (§5.2)
}

/** The view the leaf derives from the device clock each tick (integration-clock.md §4.1). NOT normalized
 *  server-side, NOT cached: a pure function of (now, config) plus the on-device IANA database. There is no
 *  empty/"nothing" state: the device clock always has a value, so ClockView is unconditional (§4.1). */
export interface ClockView {
  time: string; // formatted per clockFormat + showSeconds, e.g. "14:05" or "2:05:33 PM"
  date: string | null; // formatted per dateFormat when showDate is true, else null
  zone: string; // the IANA zone actually used: the config override, or the resolved device-local zone
}

/** The config defaults (integration-clock.md §5.1), the single source of truth shared by the configSchema
 *  field defaults (index.ts) and the leaf's defensive read (resolveConfig in time.ts). A fresh instance
 *  has every default, so it renders immediately on add with no required field to complete (§9.1). */
export const CLOCK_CONFIG_DEFAULTS: ClockConfig = {
  clockFormat: '24h',
  showSeconds: false,
  showDate: true,
  dateFormat: 'full',
  timezone: '',
};
