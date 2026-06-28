// Keyless city -> coordinates lookup for the platform_key (Weather) connect flow (integration-weather.md
// §5.2, §5.3, §12). Open-Meteo's geocoding API is free and keyless, so this calls it DIRECTLY from the
// app (no broker, no secret): it is a connect-flow convenience, not widget data (widget data always goes
// through the proxy). It turns a typed city into the WeatherLocation stored as connections.config, the
// coordinate shape the /v1/forecast API consumes. A richer onboarding picker is AOD-26; this is the
// minimal capture the build owns (§10).

/** One geocoding candidate (the fields this flow uses; verified live 2026-06-27, §12). */
export interface GeocodeResult {
  id: number;
  name: string; // "Quito"
  latitude: number;
  longitude: number;
  timezone: string; // IANA, e.g. "America/Guayaquil"
  country: string; // "Ecuador"
  admin1?: string; // "Pichincha" (region), for disambiguation
  countryCode?: string; // "EC"
}

/** The coordinate location stored on the connection (integration-weather.md §5.2). */
export interface WeatherLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  name: string; // display label, e.g. "Quito, Ecuador"
}

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** A concise "City, Region, Country" display label for a result (blank parts dropped). */
export function geocodeLabel(r: { name: string; admin1?: string; country?: string }): string {
  return [r.name, r.admin1, r.country].filter(Boolean).join(', ');
}

/**
 * Resolve a typed city to a small list of candidate locations. A blank query returns [] without a
 * network call. A non-2xx throws so the form can surface a retry; a malformed body yields [].
 */
export async function searchLocations(
  name: string,
  opts?: { count?: number; signal?: AbortSignal },
): Promise<GeocodeResult[]> {
  const q = name.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    name: q,
    count: String(opts?.count ?? 5),
    language: 'en',
    format: 'json',
  });
  const res = await fetch(`${GEOCODING_URL}?${params.toString()}`, { signal: opts?.signal });
  if (!res.ok) throw new Error(`geocoding failed: ${res.status}`);
  const body = (await res.json().catch(() => null)) as { results?: unknown } | null;
  const results = Array.isArray(body?.results) ? body!.results : [];
  return (results as Record<string, unknown>[])
    .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
    .map((r) => ({
      id: typeof r.id === 'number' ? r.id : 0,
      name: typeof r.name === 'string' ? r.name : '',
      latitude: r.latitude as number,
      longitude: r.longitude as number,
      timezone: typeof r.timezone === 'string' ? r.timezone : 'auto',
      country: typeof r.country === 'string' ? r.country : '',
      admin1: typeof r.admin1 === 'string' ? r.admin1 : undefined,
      countryCode: typeof r.country_code === 'string' ? r.country_code : undefined,
    }));
}

/** Map a chosen geocode result to the stored WeatherLocation (integration-weather.md §5.2). */
export function toWeatherLocation(r: GeocodeResult): WeatherLocation {
  return { latitude: r.latitude, longitude: r.longitude, timezone: r.timezone, name: geocodeLabel(r) };
}
