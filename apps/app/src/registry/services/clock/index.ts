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

// Clock (the central ambient card, integration-clock.md §4.1; RB-M2 AOD-130 Meridian). One widget: a single
// centered time figure. defaultRefresh 'manual' (no provider to poll); liveness is the in-widget render tick
// (§7.2). cacheTtlSeconds / minRefreshSeconds are OMITTED: there is no provider to protect and nothing is
// cached (§7). dimsWithAmbient FALSE (AOD-37 §8.5): the Clock is the canonical useAmbient() opt-in, so it
// skips the host's global dim overlay and recolours itself to the deep-red night palette instead. It also
// declares caption { kind: 'hidden' } (AOD-124; claude-design "caption-less Clock"): a clock is self-evident,
// so it wears NO SERVICE header at ANY size. AOD-130 (Meridian, subtractive) stripped the date line and the
// timezone override (the "second clock"), so Config (§5) is now the TWO static, client-validated fields the
// face still honours: the 12h/24h format and whether the seconds whisper is shown (which also drives the tick
// cadence). No field is remote-options and none carries a save-time validator, so there is no needs_config
// edge (§5.4). Values stored by a pre-Meridian instance (showDate/dateFormat/timezone) are simply ignored.
const clock: WidgetDefinition = {
  type: 'clock',
  serviceId: 'clock',
  title: 'Clock',
  // AOD-122 slot remap: was ['small','medium','wide','large']; small->S, medium(2x1)->W, large->L,
  // and the retired wide (3x1) folds into W — its banner layout retired with the slot (ClockCard).
  supportedSizes: ['S', 'W', 'L'],
  defaultRefresh: 'manual',
  dimsWithAmbient: false,
  caption: { kind: 'hidden' }, // AOD-124: chromeless at every size (self-evident; no fetch → no dot/refresh)
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
      // Show the seconds whisper. Also drives the TICK cadence: true -> 1s, false -> 60s (§7.2).
      {
        key: 'showSeconds',
        label: 'Show seconds',
        kind: 'boolean',
        required: false,
        default: CLOCK_CONFIG_DEFAULTS.showSeconds,
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
