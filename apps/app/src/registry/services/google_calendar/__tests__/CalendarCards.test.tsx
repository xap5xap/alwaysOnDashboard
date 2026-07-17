// NextEventCard + AgendaCard driven through the real WidgetHost + the registry + TanStack Query + a
// mock WidgetDataSource (testing-strategy §9, mirroring services/linear/__tests__/MyIssuesCard.test.tsx).
// Proves the Calendar paths end to end on the client: connecting -> live renders the event(s), the
// host-drawn `empty` phase (hasEvent:false / nothing-left-today; AOD-125), the 409 -> disconnected mapping,
// the AOD-10 §4.4 render-time calendarId membership re-check, and the §4.2 device-clock "today" scoping.
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import type { AgendaData, CalendarEvent, NextEventData } from '../types';

// The host reads useConnections() for the generic platform_key params-seeding (integration-weather.md
// §6.3). google_calendar is oauth2, so seeding is a no-op (params = instance.config); stub the hook so
// the host needs no AuthProvider/supabase here.
jest.mock('../../../../connections/useConnections', () => ({
  useConnections: () => ({ connections: new Map(), isLoading: false, isError: false, error: null }),
}));

// The calendarId picker resolves through the same seam; me@example.com is a member so config validates.
const calendarChoices = [{ value: 'me@example.com', label: 'Personal' }];

const nextEventInstance: WidgetInstance = {
  instanceId: 'gc-next',
  serviceId: 'google_calendar',
  widgetType: 'next_event',
  config: { calendarId: 'me@example.com' },
  size: 'S', // AOD-122 slot id (was 'small')
  rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
};

const agendaInstance: WidgetInstance = {
  instanceId: 'gc-agenda',
  serviceId: 'google_calendar',
  widgetType: 'agenda',
  config: { calendarId: 'me@example.com' },
  size: 'M', // AOD-122 slot id (was 'tall'; the deep-column layout), rect at M's 1x2 nominal
  rect: { x: 0, y: 0, w: 1, h: 2, z: 0 },
};

function renderHost(
  source: WidgetDataSource,
  instance: WidgetInstance,
  config: Record<string, unknown> = instance.config,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={{ ...instance, config }} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

/** A timed event at a device-LOCAL day offset + hour, DST-safe (it sets local components, not UTC math). */
function localAt(dayOffset: number, hour: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function mkEvent(id: string, summary: string, startIso: string): CalendarEvent {
  return { id, summary, location: null, start: startIso, end: startIso, allDay: false, htmlLink: `https://cal/${id}` };
}
/** An all-day event today (start is the local "YYYY-MM-DD", allDay true; it has no time anchor). */
function allDayToday(id: string, summary: string): CalendarEvent {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
  return { id, summary, location: null, start: ymd, end: ymd, allDay: true, htmlLink: `https://cal/${id}` };
}
/** Today at 23:59 local: a timed event that is upcoming for any realistic run time (so it is the "next"). */
function lateTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

const wNextEventInstance: WidgetInstance = {
  ...nextEventInstance,
  size: 'W', // AOD-122 slot id (was 'medium'; same 2x1 rect)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

describe('Next Event through the host lifecycle (AOD-56)', () => {
  it('resolves loading -> fresh and renders the event with the configured calendarId param', async () => {
    const data: NextEventData = { hasEvent: true, event: mkEvent('e1', 'Standup', localAt(0, 23)) };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, nextEventInstance);

    expect(screen.getByTestId('widget-connecting')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('gcal-next-event')).toBeTruthy());
    expect(screen.getByText('Standup')).toBeTruthy();
    expect(source.fetch).toHaveBeenCalledWith({
      serviceId: 'google_calendar',
      widgetType: 'next_event',
      params: { calendarId: 'me@example.com' },
    });
  });

  it('resolves to the host-drawn empty phase when nothing is upcoming: plain words, NO action (AOD-125)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { hasEvent: false }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, nextEventInstance); // S: caption hidden -> headerless card (AOD-124)
    // AOD-125: hasEvent:false is now the host-drawn `empty` phase (isNextEventEmpty), drawn as the shared
    // EmptyBody with the design's plain words ("Nothing right now."); the leaf no longer self-draws it.
    await waitFor(() => expect(screen.getByTestId('widget-empty-body')).toBeTruthy());
    expect(screen.queryByTestId('gcal-next-event')).toBeNull();
    expect(screen.getByText('Nothing right now.')).toBeTruthy();
    // the empty BODY carries no action (the trait that separates it from the host error/needs_config
    // prompts). The host's on-demand refresh control is separate chrome — at S (headerless) it now rides
    // the AOD-124 corner cluster, so scope the "no action" check to the empty body itself.
    expect(within(screen.getByTestId('widget-empty-body')).queryByRole('button')).toBeNull();
    expect(screen.getByTestId('widget-refresh')).toBeTruthy();
  });

  it('emphasizes the when: a timed event leads with the relative-time kicker', async () => {
    const data: NextEventData = { hasEvent: true, event: mkEvent('e1', 'Design review', lateTodayIso()) };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, nextEventInstance);
    await waitFor(() => expect(screen.getByTestId('gcal-next-event')).toBeTruthy());
    // the kicker is the relative time (uppercased by the style); a future event reads "in ..." or "Now"
    expect(screen.getByTestId('gcal-next-event-when')).toHaveTextContent(/in |Now/);
    expect(screen.getByText('Design review')).toBeTruthy();
  });

  it('an all-day event shows the ALL DAY kicker and no clock, with the location at W', async () => {
    const event: CalendarEvent = { ...allDayToday('e-ad', "Carla's birthday"), location: 'Home' };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { hasEvent: true, event }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, wNextEventInstance);
    await waitFor(() => expect(screen.getByTestId('gcal-next-event')).toBeTruthy());
    // the when reads exactly "All day" (no clock rides alongside; an all-day event has no time anchor)
    expect(screen.getByTestId('gcal-next-event-when')).toHaveTextContent('All day');
    expect(screen.getByText("Carla's birthday")).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('maps a needs_reconnect proxy error (409) to the disconnected state, no card', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockRejectedValue({ kind: 'needs_reconnect' }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, nextEventInstance);
    await waitFor(() => expect(screen.getByTestId('widget-disconnected')).toBeTruthy());
    expect(screen.queryByTestId('gcal-next-event')).toBeNull();
  });

  it('surfaces needs_config when the stored calendarId is no longer a member (AOD-10 §4.4)', async () => {
    const data: NextEventData = { hasEvent: true, event: mkEvent('e1', 'Standup', localAt(0, 23)) };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices), // only me@example.com; the stored ghost is gone
    };
    renderHost(source, nextEventInstance, { calendarId: 'ghost@x' });
    await screen.findByTestId('widget-needs-config');
    expect(screen.queryByTestId('gcal-next-event')).toBeNull();
  });
});

describe("Today's Agenda through the host lifecycle (AOD-56)", () => {
  it('scopes events to the current device-local day, dropping tomorrow (integration-calendar.md §4.2)', async () => {
    const data: AgendaData = {
      events: [
        mkEvent('a1', 'Standup', localAt(0, 9)),
        mkEvent('a2', 'Design review', localAt(0, 14)),
        mkEvent('a3', 'Tomorrow planning', localAt(1, 9)),
      ],
    };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, agendaInstance);

    await waitFor(() => expect(screen.getByTestId('gcal-agenda')).toBeTruthy());
    expect(screen.getByText('Standup')).toBeTruthy();
    expect(screen.getByText('Design review')).toBeTruthy();
    // The server's coarse now -> now+~36h window can include tomorrow; the renderer drops it on-device.
    expect(screen.queryByText('Tomorrow planning')).toBeNull();
  });

  it('resolves to the host-drawn empty phase when the agenda is empty: plain words (AOD-125)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { events: [] }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, agendaInstance);
    // AOD-125: an empty agenda is now the host-drawn `empty` phase (isAgendaEmpty), the shared EmptyBody.
    await waitFor(() => expect(screen.getByTestId('widget-empty-body')).toBeTruthy());
    expect(screen.queryByTestId('gcal-agenda')).toBeNull();
    expect(screen.getByText('Nothing right now.')).toBeTruthy();
  });

  it('groups all-day on top under the ALL DAY kicker and marks the next event with the accent rail', async () => {
    const data: AgendaData = {
      events: [
        mkEvent('t1', 'Design review', lateTodayIso()), // upcoming today -> the "next"
        allDayToday('ad1', "Carla's birthday"), // no time anchor -> grouped on top
      ],
    };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, agendaInstance); // M (the deep column, ex tall)
    await waitFor(() => expect(screen.getByTestId('gcal-agenda')).toBeTruthy());
    expect(screen.getByText('ALL DAY')).toBeTruthy(); // the all-day group kicker (M density)
    expect(screen.getByText("Carla's birthday")).toBeTruthy();
    expect(screen.getByText('Design review')).toBeTruthy();
    // the soonest upcoming event carries the accent left rail (the agenda points at what is next)
    expect(screen.getByTestId('gcal-agenda-next-rail')).toBeTruthy();
  });

  it('folds events beyond the HEIGHT-driven visible count into "+N more" (AOD-123 no-overflow)', async () => {
    // AOD-123: M (1x2, ~144px body) now seats as many 2-line rows as FIT, not the old fixed 10 (which
    // stacked ~400px and clipped). The overflow folds into "+N more" — the exact N is height-driven, so
    // this asserts the fold happens and the card does not render all 12 rows, without pinning the count.
    const data: AgendaData = {
      events: Array.from({ length: 12 }, (_, i) => mkEvent(`e${i}`, `Event ${i}`, localAt(0, i))),
    };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, agendaInstance); // M (the deep column)
    await waitFor(() => expect(screen.getByTestId('gcal-agenda')).toBeTruthy());
    expect(screen.getByTestId('gcal-agenda-more')).toHaveTextContent(/^\+\d+ more$/); // some rows shed
    expect(screen.queryByText('Event 11')).toBeNull(); // the last event is folded, not overflowing
  });

  it('falls to the empty phase when only tomorrow has events (today filter in isAgendaEmpty, AOD-125)', async () => {
    const data: AgendaData = { events: [mkEvent('a3', 'Tomorrow planning', localAt(1, 9))] };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, agendaInstance);
    // AOD-125: isAgendaEmpty is TODAY-scoped, not events.length — a tomorrow-only payload is empty today, so
    // the host draws the empty phase even though the events array is non-empty.
    await waitFor(() => expect(screen.getByTestId('widget-empty-body')).toBeTruthy());
    expect(screen.queryByText('Tomorrow planning')).toBeNull();
  });
});
