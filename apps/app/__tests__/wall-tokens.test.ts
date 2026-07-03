// AOD-72 token-lock (design-kiosk-wall.md §10). The same byte-identical guard AOD-66/67/68/69 used
// (tokens.test.ts, component-tokens.test.ts, shell-tokens.test.ts, arrange-tokens.test.ts): pin the one
// kiosk-wall-scoped token group the wall adds (`wall`) so a future edit cannot drift it silently. NUMBERS
// ONLY (two pixel sizes) with NO colour-role alias: the wall composes existing colour tokens. The two sizes
// are the exit affordance geometry (§7). (AOD-81 removed the former `typeScale: 1.4` — the wall now auto-fits
// the layout to the screen via viewport.wallFitScale instead of a fixed scale; see src/kiosk/viewport.ts.)
import { darkTheme, lightTheme } from '../unistyles';

describe('§10 kiosk-wall-scoped token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('wall', () => {
    expect(darkTheme.wall).toEqual({
      exitCorner: 56, // spacing(14): the invisible long-press exit hit-target
      pinKey: 64, // spacing(16): the PIN-pad key diameter
    });
  });

  it('is theme-independent (dark and light share the same values)', () => {
    expect(lightTheme.wall).toEqual(darkTheme.wall);
  });

  it('every value is a plain number (no embedded TextStyle, no role alias) — Unistyles-safe', () => {
    expect(typeof darkTheme.wall.exitCorner).toBe('number');
    expect(typeof darkTheme.wall.pinKey).toBe('number');
  });

  it('the geometry values match spacing(14)/spacing(16) (56/64)', () => {
    expect(darkTheme.wall.exitCorner).toBe(darkTheme.spacing(14));
    expect(darkTheme.wall.pinKey).toBe(darkTheme.spacing(16));
  });

  it('the abandoned fixed typeScale is gone (the wall auto-fits now, no fixed scale token)', () => {
    expect(darkTheme.wall).not.toHaveProperty('typeScale');
  });
});
