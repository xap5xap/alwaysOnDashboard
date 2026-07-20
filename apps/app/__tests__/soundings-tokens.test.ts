// AOD-134 token-lock (design-linear.md §4; the My Issues Soundings silhouette geometry). The same
// byte-identical guard the earlier geometry groups use (transit-tokens.test.ts / range-tokens.test.ts /
// arrange-tokens.test.ts, the weatherIcon/priorityIcon precedent): pin the one numbers-only token group
// Soundings adds (`soundings`) so a future edit cannot drift it silently. NUMBERS ONLY — the marks draw bone
// / shape-only via PriorityGlyph (colors.text / colors.textMuted @ priorityIcon.offOpacity), never a hex
// here; this test never touches the FROZEN colour-family locks (data-tokens.test.ts /
// data-monochrome-tokens.test.ts).
import { darkTheme, lightTheme } from '../unistyles';

describe('§4 soundings silhouette token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('soundings', () => {
    expect(darkTheme.soundings).toEqual({
      mark: 14, // the silhouette glyph edge
      gap: 4, // the horizontal gap between marks (the packing unit)
      rowHeight: 18, // the silhouette band reserved above the L rows (fitCount lead)
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

  it('the mark matches the per-row priority glyph size (one mark weight across My Issues)', () => {
    expect(darkTheme.soundings.mark).toBe(darkTheme.priorityIcon.size);
  });
});
