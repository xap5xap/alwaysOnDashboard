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

// AOD-132 Transit added M (1x2) and L (2x2) to Current.
const mCurrentInstance: WidgetInstance = {
  ...currentInstance,
  size: 'M',
  rect: { x: 0, y: 0, w: 1, h: 2, z: 0 },
};

const lCurrentInstance: WidgetInstance = {
  ...currentInstance,
  size: 'L',
  rect: { x: 0, y: 0, w: 2, h: 2, z: 0 },
};

function currentSource(data: CurrentWeatherData): WidgetDataSource {
  return {
    fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
    resolveOptions: jest.fn().mockResolvedValue([]),
  };
}

describe('CurrentWeatherCard Transit through the host lifecycle (AOD-132; was AOD-58 + AOD-35)', () => {
  it('at S renders the temperature + the day-form condition icon over the pane; NO condition/meta/arc (the glance)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(currentSource(CURRENT_DATA), currentInstance); // S

    expect(screen.getByTestId('widget-connecting')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    expect(screen.getByTestId('weather-current-temp')).toHaveTextContent('18°C'); // unit echoed from the payload
    // condition.isDay: true -> the day glyph (the icon's day/night is the payload's, §5.2)
    expect(screen.getByTestId('weather-icon-cloudy-day')).toBeTruthy();
    // the muted condition pane wears the sky at every size, S included
    expect(screen.getByTestId('weather-current-pane')).toBeTruthy();
    // the 1x1 glance suppresses the condition label, the meta, AND the arc (glyph-over-temp only)
    expect(screen.queryByTestId('weather-current-condition')).toBeNull();
    expect(screen.queryByTestId('weather-current-meta')).toBeNull();
    expect(screen.queryByTestId('weather-current-arc')).toBeNull();
    expect(screen.queryByTestId('weather-current-sun')).toBeNull();
  });

  it('at M is a stack: glyph+temp, condition, meta, over a flat waterline arc (with the day sun-mark)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(currentSource(CURRENT_DATA), mCurrentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    expect(screen.getByTestId('weather-current-temp')).toHaveTextContent('18°C');
    expect(screen.getByText('Partly cloudy')).toBeTruthy();
    expect(screen.getByTestId('weather-current-meta')).toHaveTextContent('Feels 18° · 60% · 7 km/h SE');
    expect(screen.getByTestId('weather-current-pane')).toBeTruthy();
    // arc present at M (flat waterline); day payload -> a sun-mark, never a moon (position-independent)
    expect(screen.getByTestId('weather-current-arc')).toBeTruthy();
    expect(screen.getByTestId('weather-current-sun')).toBeTruthy();
    expect(screen.queryByTestId('weather-current-moon')).toBeNull();
  });

  it('at W is the banner: temp+glyph lead + condition over the waterline; meta gives way to fit the slot', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(currentSource(CURRENT_DATA), wCurrentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    // temp + glyph + condition stay; the temperature is never the thing that drops
    expect(screen.getByTestId('weather-current-temp')).toHaveTextContent('18°C');
    expect(screen.getByText('Partly cloudy')).toBeTruthy();
    // the W body (~48dp) RESERVES the waterline, so the meta detail (feels/humidity/wind) drops FIRST
    // (truncate-then-drop order) — the card never exceeds its slot. This is a drop assertion, not a
    // visual-clip one (the meta element is not rendered at all when it does not fit).
    expect(screen.queryByTestId('weather-current-meta')).toBeNull();
    expect(screen.getByTestId('weather-current-pane')).toBeTruthy();
    expect(screen.getByTestId('weather-current-arc')).toBeTruthy();
    expect(screen.getByTestId('weather-current-sun')).toBeTruthy();
  });

  it('at L is the wall hero: glyph+temp, condition, meta, and the full curved arc (with the day sun-mark)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(currentSource(CURRENT_DATA), lCurrentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    expect(screen.getByTestId('weather-current-temp')).toHaveTextContent('18°C');
    expect(screen.getByText('Partly cloudy')).toBeTruthy();
    expect(screen.getByTestId('weather-current-meta')).toHaveTextContent('Feels 18° · 60% · 7 km/h SE');
    expect(screen.getByTestId('weather-current-pane')).toBeTruthy();
    expect(screen.getByTestId('weather-current-arc')).toBeTruthy();
    expect(screen.getByTestId('weather-current-sun')).toBeTruthy();
  });

  it('swaps the condition icon to the night variant when the payload isDay is false (S)', async () => {
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

  it('at night (isDay false) the arc drops the sun-mark and draws the moon crescent (L)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    const nightData: CurrentWeatherData = {
      ...CURRENT_DATA,
      condition: { ...CURRENT_DATA.condition, isDay: false }, // partly-night pane
    };
    renderHost(currentSource(nightData), lCurrentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    expect(screen.getByTestId('weather-current-arc')).toBeTruthy();
    // §7: the sun-mark is gone below the line, a moon crescent takes its place
    expect(screen.getByTestId('weather-current-moon')).toBeTruthy();
    expect(screen.queryByTestId('weather-current-sun')).toBeNull();
    expect(screen.getByTestId('weather-icon-cloudy-night')).toBeTruthy();
  });

  it('degrades gracefully when sunrise/sunset are missing: the arc line renders, no sun-mark, never crashes', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    const noSun: CurrentWeatherData = { ...CURRENT_DATA, sunrise: '', sunset: '' };
    renderHost(currentSource(noSun), lCurrentInstance);

    await waitFor(() => expect(screen.getByTestId('weather-current')).toBeTruthy());
    // the arc still draws (the line is a quiet fact) but there is no sun-mark (day) since the fraction is null
    expect(screen.getByTestId('weather-current-arc')).toBeTruthy();
    expect(screen.queryByTestId('weather-current-sun')).toBeNull();
    expect(screen.queryByTestId('weather-current-moon')).toBeNull(); // isDay true -> no moon either
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

describe('ForecastCard through the host lifecycle (AOD-133 Range: hi-lo span-bars on the week scale)', () => {
  it('at W is a compact span-bar list: Today, the day-form glyph, a bar per day, precip figure, NO label/header', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(forecastSource(FORECAST_DATA), forecastInstance); // W (the compact slot)

    await waitFor(() => expect(screen.getByTestId('weather-forecast')).toBeTruthy());
    expect(screen.getByText('Today')).toBeTruthy();
    // forecast days always use the day form (§4.2), even for showers/cloudy which swap at Current
    expect(screen.getByTestId('weather-icon-drizzle-day')).toBeTruthy();
    expect(screen.getByTestId('weather-icon-showers-day')).toBeTruthy();
    // one span-bar per visible day (the Range replaces the numeric hi-lo TEXT with a bar on the shared scale)
    expect(screen.getAllByTestId('weather-forecast-bar')).toHaveLength(FORECAST_DATA.days.length);
    // precip is its own figure (the rain ink); the condition label is carried by the glyph, never text
    expect(screen.getByText('16%')).toBeTruthy();
    expect(screen.queryByText(/Light drizzle/)).toBeNull();
    // the "Week …" shared-scale header is an L affordance; W drops it (compact, ~one row tall)
    expect(screen.queryByTestId('weather-forecast-week')).toBeNull();
  });

  it('at L is the span-bar list under the "Week X–Y" shared-scale header (rounded week min/max, degree echoed)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(forecastSource(FORECAST_DATA), largeForecastInstance);

    await waitFor(() => expect(screen.getByTestId('weather-forecast')).toBeTruthy());
    expect(screen.getByText('Today')).toBeTruthy();
    // the shared scale over the visible days: min low 9.1→9, max high 18.3→18; the degree echoed from °C
    expect(screen.getByTestId('weather-forecast-week')).toHaveTextContent(/Week 9°.18°/);
    // a bar per day + precip figures; still NO condition label text (the Range reads as shape, not words)
    expect(screen.getAllByTestId('weather-forecast-bar')).toHaveLength(FORECAST_DATA.days.length);
    expect(screen.getByText('16%')).toBeTruthy();
    expect(screen.getByText('4%')).toBeTruthy();
    expect(screen.queryByText(/Light drizzle/)).toBeNull();
    expect(screen.queryByText(/Slight rain showers/)).toBeNull();
  });

  it('omits precip when the payload value is null — BLANK, never "0%"; the bar/day still draw (W)', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    const noPrecip: ForecastData = {
      units: { temperature: '°C' },
      days: [{ ...FORECAST_DATA.days[0], precipProbabilityPct: null }],
    };
    renderHost(forecastSource(noPrecip), forecastInstance);

    await waitFor(() => expect(screen.getByTestId('weather-forecast')).toBeTruthy());
    expect(screen.queryByText(/%/)).toBeNull(); // a null precip stays blank
    expect(screen.getAllByTestId('weather-forecast-bar')).toHaveLength(1); // precip giving way never drops the bar
  });

  it('resolves to the host-drawn empty phase for an empty forecast (AOD-133 isForecastEmpty), NOT a leaf body', async () => {
    mockConnections = new Map([['weather', connection('weather', 'platform_key', QUITO)]]);
    renderHost(forecastSource({ days: [], units: { temperature: '°C' } }), forecastInstance);

    // AOD-133/AOD-125: the pre-M1 leaf-drawn "No forecast" is now the host-drawn `empty` phase (EmptyBody).
    await waitFor(() => expect(screen.getByTestId('widget-empty-body')).toBeTruthy());
    expect(screen.queryByTestId('weather-forecast')).toBeNull();
    expect(screen.queryByTestId('weather-forecast-empty')).toBeNull(); // the leaf no longer self-draws it
  });
});
