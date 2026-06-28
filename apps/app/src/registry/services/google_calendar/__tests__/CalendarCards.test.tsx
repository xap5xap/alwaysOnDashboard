// NextEventCard + AgendaCard driven through the real WidgetHost + the registry + TanStack Query + a
// mock WidgetDataSource (testing-strategy §9, mirroring services/linear/__tests__/MyIssuesCard.test.tsx).
// Proves the Calendar paths end to end on the client: loading -> fresh renders the event(s), the empty
// states (hasEvent:false / nothing-left-today), the 409 -> disconnected mapping, the AOD-10 §4.4
// render-time calendarId membership re-check, and the §4.2 device-clock "today" scoping in the agenda.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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
  size: 'small',
  rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
};

const agendaInstance: WidgetInstance = {
  instanceId: 'gc-agenda',
  serviceId: 'google_calendar',
  widgetType: 'agenda',
  config: { calendarId: 'me@example.com' },
  size: 'tall',
  rect: { x: 0, y: 0, w: 2, h: 3, z: 0 },
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

describe('Next Event through the host lifecycle (AOD-56)', () => {
  it('resolves loading -> fresh and renders the event with the configured calendarId param', async () => {
    const data: NextEventData = { hasEvent: true, event: mkEvent('e1', 'Standup', localAt(0, 23)) };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, nextEventInstance);

    expect(screen.getByTestId('widget-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('gcal-next-event')).toBeTruthy());
    expect(screen.getByText('Standup')).toBeTruthy();
    expect(source.fetch).toHaveBeenCalledWith({
      serviceId: 'google_calendar',
      widgetType: 'next_event',
      params: { calendarId: 'me@example.com' },
    });
  });

  it('renders the empty state when nothing is upcoming (hasEvent:false is a normal state)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { hasEvent: false }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, nextEventInstance);
    await waitFor(() => expect(screen.getByTestId('gcal-next-event-empty')).toBeTruthy());
    expect(screen.queryByTestId('gcal-next-event')).toBeNull();
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

  it('renders the empty state when the agenda is empty', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { events: [] }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, agendaInstance);
    await waitFor(() => expect(screen.getByTestId('gcal-agenda-empty')).toBeTruthy());
    expect(screen.queryByTestId('gcal-agenda')).toBeNull();
  });

  it('falls to the empty state when only tomorrow has events (today filter applied)', async () => {
    const data: AgendaData = { events: [mkEvent('a3', 'Tomorrow planning', localAt(1, 9))] };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(calendarChoices),
    };
    renderHost(source, agendaInstance);
    await waitFor(() => expect(screen.getByTestId('gcal-agenda-empty')).toBeTruthy());
    expect(screen.queryByText('Tomorrow planning')).toBeNull();
  });
});
