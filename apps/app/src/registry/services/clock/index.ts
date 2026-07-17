// The Clock service: the client half of the registration AND THE WHOLE registration (integration-clock.md
// §3.2, §8). The architectural BOOKEND: the first and only authClass 'none' service, with NO server half
// (no BACKEND_REGISTRY entry, no OPERATION_REGISTRY entry, no proxy call, no cache, no secret). Every
// other service mirrors a server half in supabase/functions/_shared/{registry,operations}.ts; Clock has
// none, by design (§3.2), because it has no secret and no provider, so nothing must live server-side. Its
// "data" is not a proxy payload: the ClockCard self-ticks from the device clock and formats via Intl
// (§4.1, §7.2). Adding Clock is this one entry + the ClockCard leaf + one line in the client registry
// index; addableWidgets already exempts 'none', so it is addable with no connection, and the host none
// no-fetch path (WidgetHost.tsx §6.3) renders it permanently Fresh.
import type { ServiceDefinition, WidgetDefinition } from '../../types';
import { ClockCard } from './ClockCard';
import { CLOCK_CONFIG_DEFAULTS } from './types';
import { validateTimeZone } from './time';

// Clock (the central ambient card, integration-clock.md §4.1). One widget: the time always shown, the date
// optional (§4.0). defaultRefresh 'manual' (no provider to poll); liveness is the in-widget render tick
// (§7.2). cacheTtlSeconds / minRefreshSeconds are OMITTED: there is no provider to protect and nothing is
// cached (§7). dimsWithAmbient FALSE (AOD-37 §8.5): the Clock is the canonical useAmbient() opt-in, so it
// skips the host's global dim overlay and recolours itself to the deep-red night palette instead. It also
// declares hideHeaderAtSizes ['S'] (§4.2): a 1x1 glance is just the time, no SERVICE header. Config
// (§5) is five static, client-validated fields; the timezone carries an Intl-based save-time validator
// (validateTimeZone), not a remote-options source (§5.3), so there is no needs_config edge (§5.4).
const clock: WidgetDefinition = {
  type: 'clock',
  serviceId: 'clock',
  title: 'Clock',
  // AOD-122 slot remap: was ['small','medium','wide','large']; small->S, medium(2x1)->W, large->L,
  // and the retired wide (3x1) folds into W — its banner layout retired with the slot (ClockCard).
  supportedSizes: ['S', 'W', 'L'],
  defaultRefresh: 'manual',
  dimsWithAmbient: false,
  hideHeaderAtSizes: ['S'],
  configSchema: {
    fields: [
      // 12h / 24h. Maps to Intl.DateTimeFormat hour12 (§12).
      {
        key: 'clockFormat',
        label: 'Time format',
        kind: 'enum',
        required: false,
        default: CLOCK_CONFIG_DEFAULTS.clockFormat,
        options: [
          { value: '24h', label: '24-hour' },
          { value: '12h', label: '12-hour' },
        ],
      },
      // Show seconds. Also drives the TICK cadence: true -> 1s, false -> 60s (§7.2).
      {
        key: 'showSeconds',
        label: 'Show seconds',
        kind: 'boolean',
        required: false,
        default: CLOCK_CONFIG_DEFAULTS.showSeconds,
      },
      // Show the date line at all.
      {
        key: 'showDate',
        label: 'Show date',
        kind: 'boolean',
        required: false,
        default: CLOCK_CONFIG_DEFAULTS.showDate,
      },
      // Date format. Maps to Intl.DateTimeFormat dateStyle (§12). A small closed set, no free text.
      {
        key: 'dateFormat',
        label: 'Date format',
        kind: 'enum',
        required: false,
        default: CLOCK_CONFIG_DEFAULTS.dateFormat,
        options: [
          { value: 'full', label: 'Monday, June 28' },
          { value: 'long', label: 'June 28, 2026' },
          { value: 'medium', label: 'Jun 28, 2026' },
          { value: 'short', label: '6/28/26' },
        ],
      },
      // Time zone (§5.2). Device-local by default; an optional IANA override for a second clock. A STATIC
      // string validated CLIENT-SIDE via Intl (validateTimeZone), NOT a remote-options field, so there is
      // no option source (§5.3) and no membership re-check / needs_config edge (§5.4). '' = device-local.
      {
        key: 'timezone',
        label: 'Time zone',
        kind: 'string',
        required: false,
        default: CLOCK_CONFIG_DEFAULTS.timezone,
        placeholder: 'Device local (e.g. America/New_York)',
        validate: validateTimeZone, // save-time only (config.ts runFieldValidators); render degrades (§7.3)
      },
    ],
  },
  render: ClockCard,
};

export const clockService: ServiceDefinition = {
  id: 'clock',
  displayName: 'Clock',
  icon: 'clock',
  authClass: 'none',
  widgets: [clock],
};
