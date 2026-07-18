// CurrentWeatherCard + ForecastCard driven through the real WidgetHost + the registry + TanStack Query +
// a mock WidgetDataSource (testing-strategy §9, mirroring services/google_calendar/__tests__/
// CalendarCards.test.tsx). It also pins the one-time generic platform_key host params-seeding
// (integration-weather.md §6.3): for a platform_key service the host folds connection.config (the
// location) into the proxy params, while an oauth2 service passes instance.config through unchanged.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import type { ConnectionMap, ConnectionView } from '../../../../connections/connectionsRepo';
import type { CurrentWeatherData, ForecastData } from '../types';

// The host reads useConnections() for the platform_key params-seeding (§6.3). Drive it from a mutable
// map per test (the factory reads the current value at render time); no AuthProvider/supabase needed.
let mockConnections: ConnectionMap = new Map();
jest.mock('../../../../connections/useConnections', () => ({
  useConnections: () => ({ connections: mockConnections, isLoading: false, isError: false, error: null }),
}));

const QUITO = { latitude: -0.1807, longitude: -78.4678, timezone: 'America/Guayaquil', name: 'Quito, Ecuador' };

function connection(service: string, authClass: ConnectionView['authClass'], config: Record<string, unknown>): ConnectionView {
  return { connectionId: `c-${service}`, service, status: 'connected', authClass, accountLabel: null, config };
}

const currentInstance: WidgetInstance = {
  instanceId: 'wx-current',
  serviceId: 'weather',
  widgetType: 'current',
  config: {}, // zero-config: the location lives on the connection (§5.1)
  size: 'S', // AOD-122 slot id (was 'small')
  rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
};

const forecastInstance: WidgetInstance = {
  instanceId: 'wx-forecast',
  serviceId: 'weather',
  widgetType: 'forecast',
  config: {},
  size: 'W', // AOD-122: the banner slot (was the retired wide 3x1; W is 2x1)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

const CURRENT_DATA: CurrentWeatherData = {
  observedAt: '2026-06-27T11:15',
  condition: { code: 2, label: 'Partly cloudy', group: 'cloudy', isDay: true },
  temperature: 18.2,
  apparentTemperature: 17.5,
  humidityPct: 60,
  windSpeed: 7.1,
  windDirectionDeg: 120,
  sunrise: '2026-06-27T06:13',
  sunset: '2026-06-27T18:20',
  units: { temperature: '°C', windSpeed: 'km/h', humidity: '%' },
};

function ymd(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const FORECAST_DATA: ForecastData = {
  units: { temperature: '°C' },
  days: [
    { date: ymd(0), condition: { code: 51, label: 'Light drizzle', group: 'drizzle', isDay: true }, tempMax: 17.4, tempMin: 9.1, precipProbabilityPct: 16, sunrise: `${ymd(0)}T06:13`, sunset: `${ymd(0)}T18:20` },
    { date: ymd(1), condition: { code: 3, label: 'Overcast', group: 'cloudy', isDay: true }, tempMax: 17.6, tempMin: 9.7, precipProbabilityPct: 2, sunrise: `${ymd(1)}T06:13`, sunset: `${ymd(1)}T18:20` },
    { date: ymd(2), condition: { code: 80, label: 'Slight rain showers', group: 'showers', isDay: true }, tempMax: 18.3, tempMin: 9.7, precipProbabilityPct: 4, sunrise: `${ymd(2)}T06:14`, sunset: `${ymd(2)}T18:20` },
  ],
};

function renderHost(source: WidgetDataSource, instance: WidgetInstance) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } } });
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

beforeEach(() => {
  mockConnections = new Map();
});

describe('platform_key host params-seeding (integration-weather.md §6.3)', () => {
  it('seeds the proxy params from connection.config for a platform_key (weather) widget', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: CURRENT_DATA, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, currentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    // The zero-config widget's params are the connection location, so buildQuery sees latitude/longitude.
    expect(source.fetch).toHaveBeenCalledWith({ serviceId: 'weather', widgetType: 'current', params: QUITO });
  });

  it('leaves an oauth2 widget unchanged: params = instance.config, connection.config is NOT merged', async () => {
    // A google_calendar connection carrying config; oauth2 takes the else-branch, so the calendar's
    // instance config (calendarId) flows through and the connection config is ignored (§6.3).
    mockConnections = new Map([['google_calendar', connection('google_calendar', 'oauth2', { ignored: 'conn-config' })]]);
    const calendarInstance: WidgetInstance = {
      instanceId: 'gc-next',
      serviceId: 'google_calendar',
      widgetType: 'next_event',
      config: { calendarId: 'me@example.com' },
      size: 'S',
      rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
    };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { hasEvent: false }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([{ value: 'me@example.com', label: 'Personal' }]),
    };
    renderHost(source, calendarInstance);

    // AOD-125: hasEvent:false now resolves to the host-drawn `empty` phase (widget-empty-body), which settles
    // the render so the params assertion below is reached.
    await waitFor(() => expect(screen.getByTestId('widget-empty-body')).toBeTruthy());
    expect(source.fetch).toHaveBeenCalledWith({
      serviceId: 'google_calendar',
      widgetType: 'next_event',
      params: { calendarId: 'me@example.com' }, // NOT { calendarId, ignored }
    });
  });
});

const wCurrentInstance: WidgetInstance = {
  ...currentInstance,
  size: 'W', // AOD-122 slot id (was 'medium'; same 2x1 rect)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

function currentSource(data: CurrentWeatherData): WidgetDataSource {
  return {
    fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
    resolveOptions: jest.fn().mockResolvedValue([]),
  };
}

describe('CurrentWeatherCard through the host lifecycle (AOD-58 + AOD-35 polish)', () => {
  it('at S renders the temperature + the day-form condition icon, header/meta suppressed (the glance)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(currentSource(CURRENT_DATA), currentInstance); // S

    expect(screen.getByTestId('widget-connecting')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    expect(screen.getByTestId('weather-current-temp')).toHaveTextContent('18°C'); // unit echoed from the payload
    // condition.isDay: true -> the day glyph (the icon's day/night is the payload's, §5.2)
    expect(screen.getByTestId('weather-icon-cloudy-day')).toBeTruthy();
    // the 1x1 glance suppresses the condition label and the meta
    expect(screen.queryByTestId('weather-current-condition')).toBeNull();
    expect(screen.queryByTestId('weather-current-meta')).toBeNull();
  });

  it('at W adds the accent condition and the muted feels/humidity/wind meta line', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(currentSource(CURRENT_DATA), wCurrentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    expect(screen.getByText('Partly cloudy')).toBeTruthy();
    // §5 meta: "Feels {apparent}° · {humidity}% · {wind} {windUnit} {compass}" (bare ° in meta; the hero echoes the unit)
    expect(screen.getByTestId('weather-current-meta')).toHaveTextContent('Feels 18° · 60% · 7 km/h SE');
  });

  it('swaps the condition icon to the night variant when the payload isDay is false', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    const nightData: CurrentWeatherData = {
      ...CURRENT_DATA,
      condition: { ...CURRENT_DATA.condition, isDay: false },
    };
    renderHost(currentSource(nightData), currentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    expect(screen.getByTestId('weather-icon-cloudy-night')).toBeTruthy();
    expect(screen.queryByTestId('weather-icon-cloudy-day')).toBeNull();
  });
});

const largeForecastInstance: WidgetInstance = {
  ...forecastInstance,
  size: 'L', // AOD-122 slot id (was 'large'; same 2x2 rect)
  rect: { x: 0, y: 0, w: 2, h: 2, z: 0 },
};

function forecastSource(data: ForecastData): WidgetDataSource {
  return {
    fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
    resolveOptions: jest.fn().mockResolvedValue([]),
  };
}

describe('ForecastCard through the host lifecycle (AOD-58 + AOD-35 polish)', () => {
  it('at W is a banner strip: Today, the day-form per-day icon, and the accent precip (no label)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(forecastSource(FORECAST_DATA), forecastInstance); // W (the banner slot since AOD-122)

    await waitFor(() => expect(screen.getByTestId('weather-forecast')).toBeTruthy());
    expect(screen.getByText('Today')).toBeTruthy();
    // forecast days always use the day form (§4.2), even for showers/cloudy which swap at Current
    expect(screen.getByTestId('weather-icon-drizzle-day')).toBeTruthy();
    expect(screen.getByTestId('weather-icon-showers-day')).toBeTruthy();
    // precip is its own accent element at W; the condition label is carried by the icon, not text
    expect(screen.getByText('16%')).toBeTruthy();
    expect(screen.queryByText(/Light drizzle/)).toBeNull();
  });

  it('at L is a row list with the condition label + appended precip', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(forecastSource(FORECAST_DATA), largeForecastInstance);

    await waitFor(() => expect(screen.getByTestId('weather-forecast')).toBeTruthy());
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Light drizzle · 16%')).toBeTruthy();
    expect(screen.getByText('Slight rain showers · 4%')).toBeTruthy();
  });

  it('omits precip entirely when the payload value is null (W)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    const noPrecip: ForecastData = {
      units: { temperature: '°C' },
      days: [{ ...FORECAST_DATA.days[0], precipProbabilityPct: null }],
    };
    renderHost(forecastSource(noPrecip), forecastInstance);

    await waitFor(() => expect(screen.getByTestId('weather-forecast')).toBeTruthy());
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('renders the empty state for a malformed/empty forecast (never crashes)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(forecastSource({ days: [], units: { temperature: '°C' } }), forecastInstance);

    await waitFor(() => expect(screen.getByTestId('weather-forecast-empty')).toBeTruthy());
    expect(screen.queryByTestId('weather-forecast')).toBeNull();
  });
});
