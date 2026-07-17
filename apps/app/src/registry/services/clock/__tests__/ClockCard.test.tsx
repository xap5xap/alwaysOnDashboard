// ClockCard self-tick + the host none no-fetch path + the config-validation seam (integration-clock.md
// §6.3, §7.2, §5.2/§5.4), mirroring services/weather/__tests__/WeatherCards.test.tsx. The pure formatting
// matrix lives in clockTime.test.ts; this drives the leaf and the real WidgetHost. The host reads
// useConnections() for the platform_key params-seeding; a none widget needs no connection, so an empty map
// is fine (and proves Clock renders with nothing connected).
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockCard } from '../ClockCard';
import { AmbientProvider } from '../../../../ambient/AmbientContext';
import { clockService } from '..';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import { validateConfig } from '../../../../widgets/config';
import { tabularWidth } from '../../../../widgets/fitLadder';

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
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true, showDate: false, timezone: 'UTC' }} size="W" />);

    expect(timeText()).toBe('14:05:00');
    act(() => jest.advanceTimersByTime(1000));
    expect(timeText()).toBe('14:05:01');
    act(() => jest.advanceTimersByTime(1000));
    expect(timeText()).toBe('14:05:02');
  });

  it('ticks every minute when showSeconds is false: 1s does nothing, 60s advances the minute', () => {
    jest.useFakeTimers({ now: new Date('2026-06-28T14:05:00.000Z') });
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: false, showDate: false, timezone: 'UTC' }} size="W" />);

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
    const view = render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true, showDate: false, timezone: 'UTC' }} size="W" />);
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
  size: 'W', // AOD-122 slot id (was 'medium'; same 2x1 rect)
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

describe('ClockCard face across sizes (AOD-37 §8.2-§8.4 over the AOD-122 S/W/L slots; the §8.2 wide 3x1 banner is retired with the 3-wide slot)', () => {
  const cfg = (o: Record<string, unknown> = {}) => ({ clockFormat: '24h', showSeconds: false, showDate: true, dateFormat: 'full', ...o });

  it('S: time only, no date line (§8.3)', () => {
    render(<ClockCard data={undefined} config={cfg()} size="S" />);
    expect(screen.getByTestId('clock-time')).toBeTruthy();
    expect(screen.queryByTestId('clock-date')).toBeNull();
    expect(screen.queryByTestId('clock-zone')).toBeNull();
  });

  it('W: time over a date line, no zone kicker for a device-local clock (§8.4)', () => {
    render(<ClockCard data={undefined} config={cfg({ timezone: '' })} size="W" />);
    expect(screen.getByTestId('clock-time')).toBeTruthy();
    expect(screen.getByTestId('clock-date')).toBeTruthy();
    expect(screen.queryByTestId('clock-zone')).toBeNull();
  });

  it('a timezone override shows the second-clock zone kicker, derived from the IANA id (§8.4)', () => {
    // Pre-AOD-122 this rode the wide banner; the kicker is size-independent above S, so W carries it now.
    render(<ClockCard data={undefined} config={cfg({ timezone: 'America/New_York' })} size="W" />);
    expect(screen.getByTestId('clock-zone').props.children).toBe('New York');
  });

  it('L: still draws time + date (the wall hero)', () => {
    render(<ClockCard data={undefined} config={cfg()} size="L" />);
    expect(screen.getByTestId('clock-time')).toBeTruthy();
    expect(screen.getByTestId('clock-date')).toBeTruthy();
  });
});

describe('ClockCard width-fit: the time never clips (AOD-95/97)', () => {
  /** The fitted font size the time rendered at. */
  const timeSize = () => screen.getByTestId('clock-time').props.style.fontSize as number;

  it('AOD-95: at S a seconds time scales BELOW its 34px step so "HH:MM:SS" fits the 72px width', () => {
    // Direct render -> the S fallback box is 72x72 (header suppressed). clockSize.small is 34; the full
    // "18:45:30" is ~150px at 34px, so the width-fit must scale it down. Before the fix it hard-clipped.
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true, showDate: false, timezone: 'UTC' }} size="S" />);
    expect(timeSize()).toBeLessThan(34); // scaled down to fit the narrow cell
    expect(timeSize()).toBeGreaterThan(0);
  });

  it('AOD-97: at L the time fits the cell WIDTH rather than overflowing it at the 96px step', () => {
    // The clockSize steps are sized for the wall; a 96px "14:05" is ~270px, far wider than the 168px L
    // body, so the old fixed step overflowed/clipped. The width-fit scales it to fit the width — no clip.
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: false, showDate: false, timezone: 'UTC' }} size="L" />);
    const size = timeSize();
    expect(size).toBeLessThanOrEqual(96);
    expect(tabularWidth('14:05', size)).toBeLessThanOrEqual(168 + 0.001); // fits the L body width
  });
});

describe('ClockCard night palette (AOD-37 §8.5)', () => {
  it('draws the time in the deep-red night.primary at phase night', () => {
    render(
      <AmbientProvider value={{ phase: 'night', dimLevel: 0.7 }}>
        <ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: false, showDate: true, dateFormat: 'full', timezone: '' }} size="W" />
      </AmbientProvider>,
    );
    // §3.2 night.primary is the deep red the time swaps to at night.
    expect(screen.getByTestId('clock-time').props.style.color).toBe('#C2362B');
  });

  it('draws the time in the standard text colour by day', () => {
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: false, showDate: true, dateFormat: 'full', timezone: '' }} size="W" />);
    // §3.1 dark theme text.
    expect(screen.getByTestId('clock-time').props.style.color).toBe('#F4F4F8');
  });
});
