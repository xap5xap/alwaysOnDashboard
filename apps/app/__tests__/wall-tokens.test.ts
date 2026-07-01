// AOD-72 token-lock (design-kiosk-wall.md §10). The same byte-identical guard AOD-66/67/68/69 used
// (tokens.test.ts, component-tokens.test.ts, shell-tokens.test.ts, arrange-tokens.test.ts): pin the one
// kiosk-wall-scoped token group the wall adds (`wall`) so a future edit cannot drift it silently. Unlike
// `arrange`, this group is NUMBERS ONLY (a multiplier + two pixel sizes) with NO colour-role alias: the
// wall composes existing colour tokens (colors.background / night.* / overlay / scrim), so it adds no
// colour. `typeScale` is the load-bearing WallMountProfile multiplier (AOD-11 §7.1); the two sizes are the
// exit affordance geometry (§7).
import { darkTheme, lightTheme } from '../unistyles';

describe('§10 kiosk-wall-scoped token group: pinned byte-identical (numbers only, no role alias)', () => {
  it('wall', () => {
    expect(darkTheme.wall).toEqual({
      typeScale: 1.4, // the WallMountProfile.typeScale multiplier on type.*
      exitCorner: 56, // spacing(14): the invisible long-press exit hit-target
      pinKey: 64, // spacing(16): the PIN-pad key diameter
    });
  });

  it('is theme-independent (dark and light share the same values)', () => {
    expect(lightTheme.wall).toEqual(darkTheme.wall);
  });

  it('every value is a plain number (no embedded TextStyle, no role alias) — Unistyles-safe', () => {
    expect(typeof darkTheme.wall.typeScale).toBe('number');
    expect(typeof darkTheme.wall.exitCorner).toBe('number');
    expect(typeof darkTheme.wall.pinKey).toBe('number');
  });

  it('the geometry values match spacing(14)/spacing(16) (56/64)', () => {
    expect(darkTheme.wall.exitCorner).toBe(darkTheme.spacing(14));
    expect(darkTheme.wall.pinKey).toBe(darkTheme.spacing(16));
  });

  it('typeScale is > 1 (the wall enlarges the type ramp, never shrinks it)', () => {
    expect(darkTheme.wall.typeScale).toBeGreaterThan(1);
  });
});
