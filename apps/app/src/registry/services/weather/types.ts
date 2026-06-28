// The normalized Weather payloads the renderers receive (integration-weather.md §4), mirroring the
// server-side operations.ts output (WeatherCondition / CurrentWeatherData / ForecastData). This is the
// client data contract between the broker's normalize step and the two cards; the /v1/forecast query
// and the raw-response mapping (the WMO map, the columnar zip) stay server-side (§6.4), so the client
// re-declares only the shapes it renders, never the query, the selectors, or the WMO vocabulary.

/** The coarse condition bucket the renderer maps to an icon, never the ~28 raw WMO codes (§4.0). */
export type WeatherGroup =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'thunderstorm';

export interface WeatherCondition {
  code: number; // the raw WMO weather_code, preserved
  label: string; // human string from the WMO map, e.g. "Partly cloudy"
  group: WeatherGroup; // the coarse bucket (AOD-35 maps it to an icon)
  isDay: boolean; // current: from is_day; forecast days: true (daytime icon)
}

/** Echoed provider unit strings so the card labels values without hard-coding a unit (§4.0). */
export interface WeatherUnits {
  temperature: string; // "°C"
  windSpeed?: string; // "km/h" (Current only)
  humidity?: string; // "%" (Current only)
}

/** Current conditions; a connected location always has them, so there is no empty state (§4.1). */
export interface CurrentWeatherData {
  observedAt: string; // local ISO
  condition: WeatherCondition;
  temperature: number;
  apparentTemperature: number;
  humidityPct: number;
  windSpeed: number;
  windDirectionDeg: number;
  units: WeatherUnits;
}

/** One forecast day, zipped server-side from the columnar daily arrays (§4.2). */
export interface ForecastDay {
  date: string; // "YYYY-MM-DD"
  condition: WeatherCondition;
  tempMax: number;
  tempMin: number;
  precipProbabilityPct: number | null;
  sunrise: string; // local ISO
  sunset: string; // local ISO
}

export interface ForecastData {
  days: ForecastDay[];
  units: WeatherUnits;
}
