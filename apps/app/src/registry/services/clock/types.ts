// The on-device Clock data contract (integration-clock.md §4.1, §5; RB-M2 AOD-130 Meridian). Unlike every
// other widget, the "data" the ClockCard renders is NOT a proxy payload: it is derived IN THE LEAF from the
// device clock each tick (§7.2), formatted straight from the device Date (no Intl) with the instance config.
// (The AOD-130 device blank was the leaf's FitBody `glance` collapsing to zero height, not the formatting.)
// The leaf is mounted with the AOD-8 §6.1 render contract { data, config, size } where data === undefined
// (the host none path, §6.3) and ignores data entirely. This module declares only the shapes the leaf
// computes and reads; the bookend has no server half, so there is no operations.ts to mirror (contrast
// services/weather/types.ts).
//
// AOD-130 (Meridian, subtractive): the Clock is now a single centered time FIGURE with no chrome at any
// size. The date line, the timezone override (the "second clock"), and its zone label/offset were stripped,
// so the config is two fields (clockFormat + showSeconds) and the view is the parts split: the hero figure
// (hour:minute), the meridiem (AM/PM, 12h only), and the seconds whisper.

/** The instance config (integration-clock.md §5.1). Both fields are static and validated client-side. */
export interface ClockConfig {
  clockFormat: '12h' | '24h'; // -> Intl.DateTimeFormat hour12 (§12)
  showSeconds: boolean; // shows the seconds whisper AND drives the tick cadence (1s vs 60s, §7.2)
}

/** The view the leaf derives from the device clock each tick (integration-clock.md §4.1), split into the
 *  Meridian parts (AOD-130). NOT normalized server-side, NOT cached: a pure function of (now, config). There
 *  is no empty/"nothing" state: the device clock always has a value, so ClockView is unconditional (§4.1). */
export interface ClockView {
  figure: string; // the hero: hour + separator + minute, e.g. "14:05" (24h) or "2:05" (12h). No seconds, no AM/PM.
  meridiem: string | null; // the dayPeriod part ("AM"/"PM"), 12h only; null in 24h.
  seconds: string | null; // the 2-digit seconds ("33") when showSeconds is true, else null. The whisper's text.
}

/** The config defaults (integration-clock.md §5.1), the single source of truth shared by the configSchema
 *  field defaults (index.ts) and the leaf's defensive read (resolveConfig in time.ts). A fresh instance has
 *  every default, so it renders immediately on add with no required field to complete (§9.1). */
export const CLOCK_CONFIG_DEFAULTS: ClockConfig = {
  clockFormat: '24h',
  showSeconds: false,
};
