// AOD-133 token-lock (the Weather Forecast RANGE face geometry). The same byte-identical guard the earlier
// geometry groups use (transit-tokens.test.ts, arrange-tokens.test.ts, wall-tokens.test.ts): pin the one
// numbers-only token group the Range adds (`range`) so a future edit cannot drift it silently. NUMBERS
// ONLY — the colours arrive as ROLE values from the leaf (tempColor via theme.temp, colors.text/textMuted,
// ink.rain), never a hex here; this test never touches the FROZEN colour-family locks (data-tokens.test.ts
// / data-monochrome-tokens.test.ts).
import { darkTheme, lightTheme } from '../unistyles';

describe('§range span-bar token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('range', () => {
    expect(darkTheme.range).toEqual({
      barHeight: 3, // the span-bar thickness (later days)
      todayBarHeight: 4, // today's span-bar, a touch thicker
      capRadius: 2, // the rounded bar end-cap radius
      minBarWidth: 8, // a rangeless day still shows a short mark
      todayOpacity: 1, // today's bar at full tempColor
      pastOpacity: 0.5, // later days' bars recede
      rowHeight: 20, // the L row height (fitCount)
      compactRowHeight: 14, // the W row height (fitCount, denser)
      glyph: 16, // the L row day-glyph size
      compactGlyph: 13, // the W row day-glyph size
    });
  });

  it('is theme-independent (dark and light share the same values)', () => {
    expect(lightTheme.range).toEqual(darkTheme.range);
  });

  it('every value is a plain number (no embedded TextStyle, no role alias) — Unistyles-safe', () => {
    for (const v of Object.values(darkTheme.range)) {
      expect(typeof v).toBe('number');
    }
  });

  it("today's bar is thicker than a later day's, and full-bright vs receded", () => {
    expect(darkTheme.range.todayBarHeight).toBeGreaterThan(darkTheme.range.barHeight);
    expect(darkTheme.range.todayOpacity).toBeGreaterThan(darkTheme.range.pastOpacity);
  });

  it('the comfortable L row is taller than the compact W row (and its glyph larger)', () => {
    expect(darkTheme.range.rowHeight).toBeGreaterThan(darkTheme.range.compactRowHeight);
    expect(darkTheme.range.glyph).toBeGreaterThan(darkTheme.range.compactGlyph);
  });
});
