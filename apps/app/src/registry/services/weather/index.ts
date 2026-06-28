// The Weather service: the client half of the registration (AOD-8 §5.1, §8;
// integration-weather.md §4, §5, §8). The mirror of the server half in
// supabase/functions/_shared/{registry,operations}.ts: same id, same widget types, but the client half
// carries the visual surface (titles, sizes, the render component) and never a secret, a provider URL, a
// query, or the WMO vocabulary (AOD-8 §4). Weather is the third real service, the first platform_key
// one, and zero-config: the only user choice (the location) lives on the CONNECTION (§5.1), so both
// widgets declare an empty config schema and ride the one-time platform_key host params-seeding (§6.3).
// Adding Weather is this one entry plus its two leaf renderers plus one line in the client index; the
// layout engine, the widget host, the config form, and Settings are NOT edited (the §8 footprint).
import type { ServiceDefinition, WidgetDefinition } from '../../types';
import { CurrentWeatherCard } from './CurrentWeatherCard';
import { ForecastCard } from './ForecastCard';

// Current Weather (the most glanceable card). Sizes / cadence / TTLs are integration-weather.md §4.1,
// §7.2. Zero-config: the location is on the connection (§5.1), so configSchema.fields is empty.
const current: WidgetDefinition = {
  type: 'current',
  serviceId: 'weather',
  title: 'Current Weather',
  supportedSizes: ['small', 'medium'],
  defaultRefresh: { seconds: 900 }, // device asks every ~15 min (AOD-4)
  cacheTtlSeconds: 900, // provider hit at most once / 15 min; matches Open-Meteo's update step (§7.2)
  minRefreshSeconds: 600,
  dimsWithAmbient: true,
  configSchema: { fields: [] },
  render: CurrentWeatherCard,
};

// Forecast (multi-day). Sizes / cadence / TTLs are §4.2, §7.2. A daily forecast moves slowly, so the
// device asks every ~30 min and is served from the <=900s cache, which conserves the shared free budget.
const forecast: WidgetDefinition = {
  type: 'forecast',
  serviceId: 'weather',
  title: 'Forecast',
  supportedSizes: ['wide', 'large'],
  defaultRefresh: { seconds: 1800 }, // device asks every ~30 min; forecast moves slowly (§7.2)
  cacheTtlSeconds: 900, // provider floor at the AOD-5 ceiling; conserves the shared budget (§7.2)
  minRefreshSeconds: 900,
  dimsWithAmbient: true,
  configSchema: { fields: [] },
  render: ForecastCard,
};

export const weatherService: ServiceDefinition = {
  id: 'weather',
  displayName: 'Weather',
  icon: 'weather',
  authClass: 'platform_key',
  widgets: [current, forecast],
};
