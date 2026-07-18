// AOD-132: the Transit pure helpers (transit.ts). Locks the three contracts the leaf composes — the
// condition→pane-key mapping (§5), the sunrise→sunset fraction (the honest arc position), and the
// thermometer tempColor blend (§4) — as executable specs. Pure + React-free, so no host/render needed.
import { paneKeyFor, sunFraction, parseLocalIso, tempColor, mixHex, type TempStops } from '../transit';

describe('paneKeyFor (§5 condition → muted pane, keyed by group+code+isDay)', () => {
  it('clear (WMO 0) → clearDay / clearNight by daylight', () => {
    expect(paneKeyFor('clear', 0, true)).toBe('clearDay');
    expect(paneKeyFor('clear', 0, false)).toBe('clearNight');
  });

  it('mainly-clear / partly (WMO 1 or 2, group cloudy) → partlyDay / partlyNight', () => {
    expect(paneKeyFor('cloudy', 1, true)).toBe('partlyDay');
    expect(paneKeyFor('cloudy', 2, true)).toBe('partlyDay');
    expect(paneKeyFor('cloudy', 2, false)).toBe('partlyNight');
  });

  it('overcast (WMO 3) and any other cloudy code → the neutral cloudy pane (day/night alike)', () => {
    expect(paneKeyFor('cloudy', 3, true)).toBe('cloudy');
    expect(paneKeyFor('cloudy', 3, false)).toBe('cloudy');
    expect(paneKeyFor('cloudy', 99, true)).toBe('cloudy');
  });

  it('the precipitating + gray groups map to their own panes; showers borrows rain, thunderstorm → storm', () => {
    expect(paneKeyFor('fog', 45, true)).toBe('fog');
    expect(paneKeyFor('drizzle', 51, true)).toBe('drizzle');
    expect(paneKeyFor('rain', 61, true)).toBe('rain');
    expect(paneKeyFor('showers', 80, true)).toBe('rain'); // no dedicated showers pane
    expect(paneKeyFor('snow', 71, true)).toBe('snow');
    expect(paneKeyFor('thunderstorm', 95, true)).toBe('storm');
  });
});

describe('parseLocalIso / sunFraction', () => {
  it('parses a local-ISO wall-clock string (with or without seconds)', () => {
    expect(parseLocalIso('2026-06-27T06:13')).toBe(new Date(2026, 5, 27, 6, 13, 0).getTime());
    expect(parseLocalIso('2026-06-27T06:13:30')).toBe(new Date(2026, 5, 27, 6, 13, 30).getTime());
    expect(parseLocalIso('')).toBeNull();
    expect(parseLocalIso('garbage')).toBeNull();
  });

  it('is the clamped [0,1] position of now between sunrise and sunset', () => {
    const sr = new Date(2026, 5, 27, 6, 0).getTime();
    const ss = new Date(2026, 5, 27, 18, 0).getTime();
    const noon = new Date(2026, 5, 27, 12, 0).getTime();
    expect(sunFraction('2026-06-27T06:00', '2026-06-27T18:00', noon)).toBeCloseTo(0.5, 5);
    expect(sunFraction('2026-06-27T06:00', '2026-06-27T18:00', sr - 3600_000)).toBe(0); // before dawn clamps 0
    expect(sunFraction('2026-06-27T06:00', '2026-06-27T18:00', ss + 3600_000)).toBe(1); // after dusk clamps 1
  });

  it('returns null when a bound is missing or the window is degenerate (never NaN)', () => {
    expect(sunFraction('', '2026-06-27T18:00', Date.now())).toBeNull();
    expect(sunFraction('2026-06-27T18:00', '2026-06-27T06:00', Date.now())).toBeNull(); // sunset <= sunrise
  });
});

describe('tempColor (§4 thermometer blend across the 8 stops)', () => {
  const TEMP: TempStops = {
    ice: '#7FA3D9',
    cold: '#8CA9C7',
    cool: '#B3AFA0',
    mild: '#C8B183',
    warm: '#D4A868',
    balmy: '#DC9853',
    hot: '#E08348',
    swelter: '#D65A3C',
  };

  it('pins the endpoints below ice (<=6°) and above swelter (>=30°)', () => {
    expect(tempColor(-5, TEMP)).toBe(TEMP.ice);
    expect(tempColor(6, TEMP)).toBe(TEMP.ice);
    expect(tempColor(35, TEMP)).toBe(TEMP.swelter);
  });

  it('blends between neighbouring stops (a mid value differs from both anchors)', () => {
    const at18 = tempColor(18, TEMP); // between warm(17) and balmy(19)
    expect(at18).not.toBe(TEMP.warm);
    expect(at18).not.toBe(TEMP.balmy);
    expect(/^#[0-9A-F]{6}$/.test(at18)).toBe(true);
  });

  it('exactly at a stop temperature returns that stop colour', () => {
    expect(tempColor(17, TEMP)).toBe(TEMP.warm.toUpperCase());
    expect(tempColor(19, TEMP)).toBe(TEMP.balmy.toUpperCase());
  });

  it('collapses to a single colour when every stop is identical (the Monochrome theme axis)', () => {
    const bone = '#F4F4F8';
    const mono: TempStops = {
      ice: bone, cold: bone, cool: bone, mild: bone, warm: bone,
      balmy: bone, hot: bone, swelter: bone,
    };
    expect(tempColor(18, mono)).toBe(bone);
    expect(tempColor(2, mono)).toBe(bone);
    expect(tempColor(40, mono)).toBe(bone);
  });

  it('mixHex falls back to the first colour when either input is not a hex (rgba/role safety)', () => {
    expect(mixHex('rgba(0,0,0,0.6)', '#FFFFFF', 0.5)).toBe('rgba(0,0,0,0.6)');
  });
});
