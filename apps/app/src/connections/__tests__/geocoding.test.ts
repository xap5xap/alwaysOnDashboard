// Unit coverage for the keyless geocoding helper (integration-weather.md §5.2/§5.3/§12). Pure parsing +
// the city->coordinates mapping; the only boundary faked is global.fetch (testing-strategy §6: fake the
// provider HTTP boundary). Verified against the live geocoding shape on 2026-06-27.
import { geocodeLabel, searchLocations, toWeatherLocation } from '../geocoding';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockFetch(impl: (url: string) => Promise<unknown>) {
  global.fetch = jest.fn((url: unknown) => impl(String(url))) as unknown as typeof fetch;
}

// A real geocoding result for Quito (integration-weather.md §12).
const QUITO_RESULT = {
  id: 3652462,
  name: 'Quito',
  latitude: -0.22985,
  longitude: -78.52495,
  timezone: 'America/Guayaquil',
  country: 'Ecuador',
  admin1: 'Pichincha',
  country_code: 'EC',
};

describe('searchLocations (integration-weather.md §5.3/§12)', () => {
  it('returns [] for a blank query without hitting the network', async () => {
    const f = jest.fn();
    global.fetch = f as unknown as typeof fetch;
    expect(await searchLocations('   ')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('parses the Open-Meteo results and carries the IANA timezone, hitting the keyless endpoint', async () => {
    let calledUrl = '';
    mockFetch((url) => {
      calledUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [QUITO_RESULT] }) });
    });
    const out = await searchLocations('Quito');
    expect(calledUrl).toContain('geocoding-api.open-meteo.com/v1/search');
    expect(calledUrl).toContain('name=Quito');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: 'Quito',
      latitude: -0.22985,
      longitude: -78.52495,
      timezone: 'America/Guayaquil',
      country: 'Ecuador',
      admin1: 'Pichincha',
    });
  });

  it('drops entries missing coordinates and tolerates an absent results array', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ name: 'NoCoords' }] }) }));
    expect(await searchLocations('x')).toEqual([]);
    mockFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    expect(await searchLocations('y')).toEqual([]);
  });

  it('throws on a non-2xx so the form can offer a retry', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }));
    await expect(searchLocations('Quito')).rejects.toThrow(/geocoding failed: 503/);
  });
});

describe('geocodeLabel + toWeatherLocation (§5.2)', () => {
  it('builds a concise "City, Region, Country" label, dropping blank parts', () => {
    expect(geocodeLabel({ name: 'Quito', admin1: 'Pichincha', country: 'Ecuador' })).toBe('Quito, Pichincha, Ecuador');
    expect(geocodeLabel({ name: 'Quito', country: 'Ecuador' })).toBe('Quito, Ecuador');
    expect(geocodeLabel({ name: 'Quito' })).toBe('Quito');
  });

  it('maps a chosen result to the stored coordinate WeatherLocation shape', () => {
    expect(
      toWeatherLocation({
        id: 1,
        name: 'Quito',
        latitude: -0.18,
        longitude: -78.47,
        timezone: 'America/Guayaquil',
        country: 'Ecuador',
        admin1: 'Pichincha',
      }),
    ).toEqual({ latitude: -0.18, longitude: -78.47, timezone: 'America/Guayaquil', name: 'Quito, Pichincha, Ecuador' });
  });
});
