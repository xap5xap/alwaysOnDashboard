// AOD-132 token-lock (design-color-law.md §4/§7; the Weather Transit sun-arc geometry). The same
// byte-identical guard the earlier geometry groups use (arrange-tokens.test.ts, wall-tokens.test.ts,
// weatherIcon precedent): pin the one numbers-only token group Transit adds (`transit`) so a future edit
// cannot drift it silently. NUMBERS ONLY — the colours arrive as ROLE values from the leaf (pane.line /
// ink.sun / pane.clearNight.moon), never a hex here; this test never touches the FROZEN colour-family
// locks (data-tokens.test.ts / data-monochrome-tokens.test.ts).
import { darkTheme, lightTheme } from '../unistyles';

describe('§4/§7 transit sun-arc token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('transit', () => {
    expect(darkTheme.transit).toEqual({
      arcHeight: 46, // the curved sun-arc band height (L)
      waterlineHeight: 22, // the flat waterline band height (W/M)
      stroke: 2, // the arc/waterline line weight
      sunRadius: 5, // the gold sun-mark disc radius
      moonRadius: 5, // the night moon crescent radius
      inset: 10, // horizontal inset of the arc endpoints
    });
  });

  it('is theme-independent (dark and light share the same values)', () => {
    expect(lightTheme.transit).toEqual(darkTheme.transit);
  });

  it('every value is a plain number (no embedded TextStyle, no role alias) — Unistyles-safe', () => {
    for (const v of Object.values(darkTheme.transit)) {
      expect(typeof v).toBe('number');
    }
  });

  it('the stroke matches the weatherIcon glyph stroke (one line weight across the weather set)', () => {
    expect(darkTheme.transit.stroke).toBe(darkTheme.weatherIcon.stroke);
  });

  it('the curved band is taller than the flat waterline band', () => {
    expect(darkTheme.transit.arcHeight).toBeGreaterThan(darkTheme.transit.waterlineHeight);
  });
});
