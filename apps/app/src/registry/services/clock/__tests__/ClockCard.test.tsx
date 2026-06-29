// ClockCard self-tick + the host none no-fetch path + the config-validation seam (integration-clock.md
// §6.3, §7.2, §5.2/§5.4), mirroring services/weather/__tests__/WeatherCards.test.tsx. The pure formatting
// matrix lives in clockTime.test.ts; this drives the leaf and the real WidgetHost. The host reads
// useConnections() for the platform_key params-seeding; a none widget needs no connection, so an empty map
// is fine (and proves Clock renders with nothing connected).
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockCard } from '../ClockCard';
import { clockService } from '..';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import { validateConfig } from '../../../../widgets/config';

jest.mock('../../../../connections/useConnections', () => ({
  useConnections: () => ({ connections: new Map(), isLoading: false, isError: false, error: null }),
}));

/** The current clock-time text, with Unicode whitespace normalized. */
function timeText(): string {
  return String(screen.getByTestId('clock-time').props.children).replace(/\s+/g, ' ').trim();
}

describe('ClockCard self-tick cadence (integration-clock.md §7.2)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('ticks every second when showSeconds is true', () => {
    jest.useFakeTimers({ now: new Date('2026-06-28T14:05:00.000Z') });
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true, showDate: false, timezone: 'UTC' }} size="medium" />);

    expect(timeText()).toBe('14:05:00');
    act(() => jest.advanceTimersByTime(1000));
    expect(timeText()).toBe('14:05:01');
    act(() => jest.advanceTimersByTime(1000));
    expect(timeText()).toBe('14:05:02');
  });

  it('ticks every minute when showSeconds is false: 1s does nothing, 60s advances the minute', () => {
    jest.useFakeTimers({ now: new Date('2026-06-28T14:05:00.000Z') });
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: false, showDate: false, timezone: 'UTC' }} size="medium" />);

    expect(timeText()).toBe('14:05');
    act(() => jest.advanceTimersByTime(1000));
    expect(timeText()).toBe('14:05'); // unchanged after one second (no seconds shown)
    act(() => jest.advanceTimersByTime(60000));
    expect(timeText()).toBe('14:06');
  });

  it('clears its timers on unmount (no leaked interval)', () => {
    jest.useFakeTimers({ now: new Date('2026-06-28T14:05:00.000Z') });
    const clearInterval = jest.spyOn(globalThis, 'clearInterval');
    const clearTimeout = jest.spyOn(globalThis, 'clearTimeout');
    const view = render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true, showDate: false, timezone: 'UTC' }} size="medium" />);
    act(() => jest.advanceTimersByTime(1000)); // promote the aligned timeout into a running interval
    view.unmount();
    expect(clearTimeout).toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalled();
    clearInterval.mockRestore();
    clearTimeout.mockRestore();
  });
});

const clockInstance: WidgetInstance = {
  instanceId: 'clk-1',
  serviceId: 'clock',
  widgetType: 'clock',
  config: {}, // ready on add: every field has a default, no required field (§9.1)
  size: 'medium',
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

function renderHost(source: WidgetDataSource, instance: WidgetInstance) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={instance} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

describe('WidgetHost authClass:none no-fetch + self-tick path (integration-clock.md §6.3)', () => {
  it('makes NO proxy fetch for a none widget and renders Fresh immediately (no loading)', () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { ignored: true }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, clockInstance);

    // Fresh on mount: the card is present and the loading skeleton never shows.
    expect(screen.getByTestId('clock-card')).toBeTruthy();
    expect(screen.queryByTestId('widget-loading')).toBeNull();
    // The leaf actually formatted the device clock (a time string is rendered).
    expect(screen.getByTestId('clock-time').props.children).toBeTruthy();
    // The defining proof: the proxy is never called for a none widget.
    expect(source.fetch).not.toHaveBeenCalled();
  });

  it('is addable with no connection (the addableWidgets none exemption, §3.1)', () => {
    // No connection is mocked (empty map). The widget still resolves and renders, proving none widgets do
    // not gate on a connection. addableWidgets is unit-tested in the registry; this is the host-path proof.
    const source: WidgetDataSource = { fetch: jest.fn(), resolveOptions: jest.fn().mockResolvedValue([]) };
    renderHost(source, clockInstance);
    expect(screen.getByTestId('clock-card')).toBeTruthy();
    expect(screen.queryByTestId('widget-disconnected')).toBeNull();
  });
});

describe('Clock config validation: the Intl time-zone seam (integration-clock.md §5.2, §5.4, §7.3)', () => {
  const clockSchema = clockService.widgets[0].configSchema;

  it('accepts a valid IANA override at save time (runFieldValidators)', () => {
    const r = validateConfig(clockSchema, { timezone: 'America/New_York' }, undefined, { runFieldValidators: true });
    expect(r.ok).toBe(true);
  });

  it('rejects an invalid zone at save time', () => {
    const r = validateConfig(clockSchema, { timezone: 'Mars/Phobos' }, undefined, { runFieldValidators: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.key === 'timezone')).toBe(true);
  });

  it('does NOT Intl-check at render time, so a bad stored zone is accepted (no needs_config edge, §5.4)', () => {
    // The host calls validateConfig WITHOUT runFieldValidators. A malformed stored zone must pass here so
    // the widget renders (the leaf degrades it to device-local, §7.3) instead of flipping to needs_config.
    const r = validateConfig(clockSchema, { timezone: 'Mars/Phobos' });
    expect(r.ok).toBe(true);
  });

  it('applies defaults for an empty config (ready on add, no required field, §9.1)', () => {
    const r = validateConfig(clockSchema, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.clockFormat).toBe('24h');
      expect(r.values.showSeconds).toBe(false);
      expect(r.values.showDate).toBe(true);
      expect(r.values.dateFormat).toBe('full');
    }
  });
});
