// The wall-mount profile (design-kiosk-wall.md §3, kiosk-mode.md §7.1). The §3 visual values of the AOD-11
// WallMountProfile are fixed; typeScale is injected from the token so the wall-tokens.test.ts lock is the
// single source of truth for the number.
import { wallProfile } from '../profile';
import { darkTheme } from '../../../unistyles';

describe('wallProfile (design-kiosk-wall.md §3)', () => {
  it('fixes theme dark / minContrast AA / hideChrome true and carries the injected typeScale', () => {
    expect(wallProfile(1.4)).toEqual({
      theme: 'dark',
      typeScale: 1.4,
      minContrast: 'AA',
      hideChrome: true,
    });
  });

  it('uses the wall.typeScale token as the type scale (single source of truth)', () => {
    expect(wallProfile(darkTheme.wall.typeScale).typeScale).toBe(darkTheme.wall.typeScale);
    expect(wallProfile(darkTheme.wall.typeScale).typeScale).toBe(1.4);
  });

  it('hideChrome is always true (no app bar / nav / status chrome on the wall)', () => {
    expect(wallProfile(1).hideChrome).toBe(true);
    expect(wallProfile(2).hideChrome).toBe(true);
  });
});
