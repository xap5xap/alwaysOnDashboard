// AOD-134 token-lock (design-linear.md §4; the My Issues Soundings geometry, post the 2026-07-20 device
// RETUNE). The same byte-identical guard the earlier geometry groups use (transit-tokens.test.ts /
// range-tokens.test.ts / arrange-tokens.test.ts, the weatherIcon/priorityIcon precedent): pin the one
// numbers-only token group Soundings keeps (`soundings`) so a future edit cannot drift it silently. The
// RETUNE retired the aggregate silhouette, so the `mark`/`gap` packing geometry is gone (the inline row glyph
// uses priorityIcon.size); only `summaryBand` — the worded-summary line reserved above the L rows — remains.
// NUMBERS ONLY; this test never touches the FROZEN colour-family locks (data-tokens.test.ts /
// data-monochrome-tokens.test.ts).
import { darkTheme, lightTheme } from '../unistyles';

describe('§4 soundings token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('soundings', () => {
    expect(darkTheme.soundings).toEqual({
      summaryBand: 18, // the worded priority-summary line reserved above the L rows (fitCount lead)
    });
  });

  it('is theme-independent (dark and light share the same values)', () => {
    expect(lightTheme.soundings).toEqual(darkTheme.soundings);
  });

  it('every value is a plain number (no embedded TextStyle, no role alias) — Unistyles-safe', () => {
    for (const v of Object.values(darkTheme.soundings)) {
      expect(typeof v).toBe('number');
    }
  });
});
