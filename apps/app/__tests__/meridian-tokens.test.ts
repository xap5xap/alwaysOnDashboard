// AOD-130 token-lock (design-color-law.md §Clock; the Clock Meridian satellite geometry). The same
// byte-identical guard the earlier geometry groups use (transit-tokens.test.ts, arrange-tokens.test.ts,
// wall-tokens.test.ts, the money/weatherIcon precedent): pin the one numbers-only token group Meridian adds
// (`meridian`) so a future edit cannot drift it silently. NUMBERS ONLY — the colours arrive as ROLE values
// from the leaf (colors.text / night.primary for the figure, colors.textMuted / night.secondary·muted for
// the receding satellites), never a hex here; this test never touches the FROZEN colour-family locks
// (data-tokens.test.ts / data-monochrome-tokens.test.ts).
import { darkTheme, lightTheme } from '../unistyles';

describe('§meridian Clock satellite token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('meridian', () => {
    expect(darkTheme.meridian).toEqual({
      meridiemScale: 0.34, // the AM/PM height vs the hero time figure
      secondsScale: 0.28, // the seconds whisper height vs the hero figure
      secondsOpacity: 0.5, // the whisper recedes further than its muted colour
      gapScale: 0.12, // the hero -> satellite gap, as a fraction of the fitted figure size
    });
  });

  it('is theme-independent (dark and light share the same values)', () => {
    expect(lightTheme.meridian).toEqual(darkTheme.meridian);
  });

  it('every value is a plain number (no embedded TextStyle, no role alias) — Unistyles-safe', () => {
    for (const v of Object.values(darkTheme.meridian)) {
      expect(typeof v).toBe('number');
    }
  });

  it('the seconds whisper is smaller than the meridiem, and recedes (opacity < 1)', () => {
    expect(darkTheme.meridian.secondsScale).toBeLessThan(darkTheme.meridian.meridiemScale);
    expect(darkTheme.meridian.secondsOpacity).toBeLessThan(1);
  });
});
