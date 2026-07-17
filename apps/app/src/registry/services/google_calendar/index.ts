// The Google Calendar service: the client half of the registration (AOD-8 §5.1, §8;
// integration-calendar.md §4, §5, §8). The mirror of the server half in
// supabase/functions/_shared/{registry,operations,option-sources}.ts: same ids, same widget types, but
// the client half carries the visual surface (titles, sizes, the render component) and never a secret,
// a provider URL, a query, or the {calendarId} path token (AOD-8 §4). Adding Calendar is this one entry
// plus its two leaf renderers plus one registration line in the client index; the layout engine, the
// widget host, the config form, and Settings are NOT edited (the §8 not-touched footprint). Calendar is
// the second real service (after Linear) and the first REST one.
import type { ServiceDefinition, WidgetDefinition } from '../../types';
import { NextEventCard } from './NextEventCard';
import { AgendaCard } from './AgendaCard';

// Next Event (the most glanceable card). Sizes / cadence / TTLs are integration-calendar.md §4.1, §7.2;
// the config schema is §5.1: calendarId (remote-options, required, the stable Google calendar id stored).
const nextEvent: WidgetDefinition = {
  type: 'next_event',
  serviceId: 'google_calendar',
  title: 'Next Event',
  supportedSizes: ['S', 'W'], // AOD-122 slot remap: was ['small','medium'] (same 1x1 / 2x1 geometry)
  defaultRefresh: { seconds: 600 }, // device asks every 10 min (AOD-4, AOD-10 §6.2)
  cacheTtlSeconds: 300, // provider hit at most once per 5 min across devices (AOD-10 §6.1)
  minRefreshSeconds: 120, // never poll Google faster than once every 2 min
  dimsWithAmbient: true,
  // §7: the 1x1 glance is self-evident (when kicker over the title), so the host suppresses the header there.
  hideHeaderAtSizes: ['S'],
  configSchema: {
    fields: [
      {
        key: 'calendarId',
        label: 'Calendar',
        kind: 'remote-options',
        required: true,
        source: { optionSource: 'google_calendars' },
      },
    ],
  },
  render: NextEventCard,
};

// Today's Agenda. Sizes / cadence / TTLs are §4.2, §7.2; config is §5.2 (identical: only calendarId).
// The agenda window is fixed server-side; the renderer scopes events to "today" against the device clock.
const agenda: WidgetDefinition = {
  type: 'agenda',
  serviceId: 'google_calendar',
  title: "Today's Agenda",
  // AOD-122 slot remap: was ['tall','wide']; tall (1x2) -> M, and the retired wide (3x1) folds into
  // W (2x1) — the banner keeps the horizontal-slot layout (AgendaCard).
  supportedSizes: ['M', 'W'],
  defaultRefresh: { seconds: 900 }, // device asks every 15 min (AOD-4)
  cacheTtlSeconds: 600, // provider hit at most once per 10 min across devices
  minRefreshSeconds: 300,
  dimsWithAmbient: true,
  configSchema: {
    fields: [
      {
        key: 'calendarId',
        label: 'Calendar',
        kind: 'remote-options',
        required: true,
        source: { optionSource: 'google_calendars' },
      },
    ],
  },
  render: AgendaCard,
};

export const googleCalendarService: ServiceDefinition = {
  id: 'google_calendar',
  displayName: 'Google Calendar',
  icon: 'google-calendar',
  authClass: 'oauth2',
  widgets: [nextEvent, agenda],
};
